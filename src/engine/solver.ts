import type {
  BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad,
  Reaction, DiagramPoint, SegmentInfo, BeamResult, SegmentDerivation,
  ReactionDerivationStep,
} from '../types';

function cleanNumber(n: number): number {
  if (Math.abs(n) < 1e-8) return 0;
  const rounded = Math.round(n * 1e8) / 1e8;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-8) return Math.round(rounded);
  return rounded;
}

function pointLoadVertical(load: PointLoad): number {
  const vert = load.magnitude * Math.cos(load.angle * Math.PI / 180);
  return load.direction === 'up' ? vert : -vert;
}

function pointLoadHorizontal(load: PointLoad): number {
  return load.magnitude * Math.sin(load.angle * Math.PI / 180);
}

type DistContrib = { shear: number; moment: number };

function computeDistLoadShearMoment(x: number, load: DistributedLoad): DistContrib {
  const { startPos: a, endPos: b, startMag: w1, endMag: w2 } = load;
  if (x <= a) return { shear: 0, moment: 0 };

  const L = b - a;
  const m = (w2 - w1) / L;
  const actualEnd = Math.min(x, b);
  const dx = actualEnd - a;

  let shear: number;
  let moment: number;

  if (x <= b) {
    shear = -(w1 * dx + 0.5 * m * dx * dx);
    moment = -(0.5 * w1 * dx * dx + (1 / 6) * m * dx * dx * dx);
  } else {
    const totalForce = (w1 + w2) * L / 2;
    const centroidOffset = L * (w1 + 2 * w2) / (3 * (w1 + w2));
    const centroid = a + centroidOffset;
    shear = -totalForce;
    moment = -totalForce * (x - centroid);
  }

  return { shear: cleanNumber(shear), moment: cleanNumber(moment) };
}

export function computeInternalShearMoment(
  x: number,
  supports: BeamSupport[],
  pointLoads: PointLoad[],
  moments: ConcentratedMoment[],
  distributedLoads: DistributedLoad[],
  reactions: Reaction[],
): { shear: number; moment: number } {
  let shear = 0;
  let moment = 0;

  for (const r of reactions) {
    const sup = supports.find(s => s.id === r.supportId)!;
    if (sup.position < x) {
      shear += r.vertical;
      moment += r.vertical * (x - sup.position);
      if (r.moment !== 0) {
        moment += r.moment;
      }
    }
  }

  for (const p of pointLoads) {
    const v = pointLoadVertical(p);
    if (p.position < x) {
      shear += v;
      moment += v * (x - p.position);
    }
  }

  for (const m of moments) {
    if (m.position < x) {
      moment += (m.direction === 'CCW' ? 1 : -1) * m.magnitude;
    }
  }

  for (const d of distributedLoads) {
    const contrib = computeDistLoadShearMoment(x, d);
    shear += contrib.shear;
    moment += contrib.moment;
  }

  shear = cleanNumber(shear);
  moment = cleanNumber(moment);
  return { shear, moment };
}

function computeReactions(
  _beamLength: number,
  supports: BeamSupport[],
  pointLoads: PointLoad[],
  moments: ConcentratedMoment[],
  distributedLoads: DistributedLoad[],
): Reaction[] {
  const sorted = [...supports].sort((a, b) => a.position - b.position);

  if (sorted.length === 1 && sorted[0].type === 'fixed') {
    const fixed = sorted[0];
    let sumVert = 0;
    let sumHoriz = 0;
    let sumMom = 0;

    for (const p of pointLoads) {
      const v = pointLoadVertical(p);
      sumVert += v;
      sumHoriz += pointLoadHorizontal(p);
      sumMom += v * (p.position - fixed.position);
    }

    for (const m of moments) {
      sumMom += (m.direction === 'CCW' ? 1 : -1) * m.magnitude;
    }

    for (const d of distributedLoads) {
      const L = d.endPos - d.startPos;
      const totalForce = (d.startMag + d.endMag) * L / 2;
      const denom = d.startMag + d.endMag;
      const centroid = denom !== 0
        ? d.startPos + L * (d.startMag + 2 * d.endMag) / (3 * denom)
        : (d.startPos + d.endPos) / 2;
      sumVert -= totalForce;
      sumMom -= totalForce * (centroid - fixed.position);
    }

    return [{
      id: `reaction-${fixed.id}`,
      supportId: fixed.id,
      vertical: cleanNumber(-sumVert),
      horizontal: cleanNumber(-sumHoriz),
      moment: cleanNumber(sumMom),
    }];
  }

  if (sorted.length === 2) {
    const left = sorted[0];
    const right = sorted[1];
    const dist = right.position - left.position;
    if (dist <= 0) return [];

    let sumVert = 0;
    let sumHoriz = 0;
    let sumMomAboutLeft = 0;

    for (const p of pointLoads) {
      const v = pointLoadVertical(p);
      sumVert += v;
      sumHoriz += pointLoadHorizontal(p);
      sumMomAboutLeft += v * (p.position - left.position);
    }

    for (const m of moments) {
      sumMomAboutLeft += (m.direction === 'CW' ? 1 : -1) * m.magnitude;
    }

    for (const d of distributedLoads) {
      const L = d.endPos - d.startPos;
      const totalForce = (d.startMag + d.endMag) * L / 2;
      const denom = d.startMag + d.endMag;
      const centroid = denom !== 0
        ? d.startPos + L * (d.startMag + 2 * d.endMag) / (3 * denom)
        : (d.startPos + d.endPos) / 2;
      sumVert -= totalForce;
      sumMomAboutLeft -= totalForce * (centroid - left.position);
    }

    const rRightVert = -sumMomAboutLeft / dist;
    const rLeftVert = -sumVert - rRightVert;

    const pinSupport = sorted.find(s => s.type === 'pin' || s.type === 'fixed');
    const pinId = pinSupport ? pinSupport.id : left.id;

    const reactions: Reaction[] = [];
    for (const s of sorted) {
      const isPin = s.id === pinId;
      let momentReaction = 0;

      if (s.type === 'fixed') {
        let netMom = 0;
        const other = s.id === left.id ? right : left;
        for (const p of pointLoads) {
          netMom += pointLoadVertical(p) * (p.position - s.position);
        }
        for (const m of moments) {
          netMom += (m.direction === 'CCW' ? 1 : -1) * m.magnitude;
        }
        for (const d of distributedLoads) {
          const L = d.endPos - d.startPos;
          const totalForce = (d.startMag + d.endMag) * L / 2;
          const denom = d.startMag + d.endMag;
          const centroid = denom !== 0
            ? d.startPos + L * (d.startMag + 2 * d.endMag) / (3 * denom)
            : (d.startPos + d.endPos) / 2;
          netMom -= totalForce * (centroid - s.position);
        }
        const otherReaction = s.id === left.id ? rRightVert : rLeftVert;
        netMom += otherReaction * (other.position - s.position);
        momentReaction = -netMom;
      }

      reactions.push({
        id: `reaction-${s.id}`,
        supportId: s.id,
        vertical: cleanNumber(s.id === left.id ? rLeftVert : rRightVert),
        horizontal: cleanNumber(isPin ? -sumHoriz : 0),
        moment: cleanNumber(momentReaction),
      });
    }
    return reactions;
  }

  return [];
}

function getCriticalPoints(
  beamLength: number,
  supports: BeamSupport[],
  pointLoads: PointLoad[],
  moments: ConcentratedMoment[],
  distributedLoads: DistributedLoad[],
): number[] {
  const points = new Set<number>();
  points.add(0);
  points.add(beamLength);
  for (const s of supports) points.add(s.position);
  for (const p of pointLoads) points.add(p.position);
  for (const m of moments) points.add(m.position);
  for (const d of distributedLoads) {
    points.add(d.startPos);
    points.add(d.endPos);
  }
  return Array.from(points).sort((a, b) => a - b);
}

function fmtNumAbs(n: number): string {
  const abs = Math.abs(Math.round(n * 100) / 100);
  return abs === 0 ? '0' : `${abs}`;
}

function generateReactionDerivation(
  _beamLength: number,
  supports: BeamSupport[],
  pointLoads: PointLoad[],
  moments: ConcentratedMoment[],
  distributedLoads: DistributedLoad[],
): ReactionDerivationStep[] {
  const steps: ReactionDerivationStep[] = [];
  const sorted = [...supports].sort((a, b) => a.position - b.position);

  if (sorted.length === 1 && sorted[0].type === 'fixed') {
    steps.push({ label: 'Configuration', equation: '\\text{Single fixed support at } x = ' + sorted[0].position.toFixed(2) });
    steps.push({ label: 'ΣF_y = 0 (↑+)', equation: 'R_y + \\sum F_{\\text{vertical}} = 0' });
    steps.push({ label: 'ΣF_x = 0 (→+)', equation: 'R_x + \\sum F_{\\text{horizontal}} = 0' });
    steps.push({ label: 'ΣM = 0 (CCW+)', equation: 'M_R + \\sum M_{\\text{about support}} = 0' });
    steps.push({ label: 'Result', equation: '\\text{Reactions computed from equilibrium}' });
    return steps;
  }

  if (sorted.length === 2) {
    const left = sorted[0];
    const right = sorted[1];
    const dist = right.position - left.position;

    steps.push({ label: 'Setup', equation: '\\text{Two supports: } ' +
      `x_L = ${left.position.toFixed(2)}, x_R = ${right.position.toFixed(2)}, L = ${dist.toFixed(2)}` });

    let sumVertTerms: string[] = [];
    let sumMomTerms: string[] = [];
    let sumVert = 0;
    let sumMomAboutLeft = 0;

    for (const p of pointLoads) {
      const v = pointLoadVertical(p);
      sumVertTerms.push(`${v >= 0 ? '+' : ''}${v.toFixed(2)}`);
      sumMomTerms.push(`${v >= 0 ? '+' : ''}${v.toFixed(2)} \\times (${p.position.toFixed(2)} - ${left.position.toFixed(2)})`);
      sumVert += v;
      sumMomAboutLeft += v * (p.position - left.position);
    }

    for (const d of distributedLoads) {
      const Ld = d.endPos - d.startPos;
      const totalForce = (d.startMag + d.endMag) * Ld / 2;
      const denom = d.startMag + d.endMag;
      const centroid = denom !== 0
        ? d.startPos + Ld * (d.startMag + 2 * d.endMag) / (3 * denom)
        : (d.startPos + d.endPos) / 2;
      sumVertTerms.push(`${totalForce >= 0 ? '-' : '+'}${Math.abs(totalForce).toFixed(2)}`);
      sumMomTerms.push(`- ${totalForce.toFixed(2)} \\times (${centroid.toFixed(2)} - ${left.position.toFixed(2)})`);
      sumVert -= totalForce;
      sumMomAboutLeft -= totalForce * (centroid - left.position);
    }

    for (const m of moments) {
      const sign = m.direction === 'CW' ? '+' : '-';
      sumMomTerms.push(`${sign} ${m.magnitude.toFixed(2)}`);
      sumMomAboutLeft += (m.direction === 'CW' ? 1 : -1) * m.magnitude;
    }

    steps.push({ label: 'ΣF_y = 0 (↑+)',
      equation: `R_L + R_R ${sumVertTerms.join(' ')} = 0` });

    steps.push({ label: 'ΣM_L = 0',
      equation: `R_R \\times ${dist.toFixed(2)} ${sumMomTerms.join(' ')} = 0` });

    const rRightVert = -sumMomAboutLeft / dist;
    const rLeftVert = -sumVert - rRightVert;

    steps.push({ label: 'R_R', equation: `R_R = ${rRightVert.toFixed(4)}` });
    steps.push({ label: 'R_L', equation: `R_L = ${rLeftVert.toFixed(4)}` });

    for (const s of sorted) {
      if (s.type === 'fixed') {
        steps.push({ label: `M_${s.id}`, equation: `\\text{Moment reaction at fixed support computed from } \\sum M = 0` });
      }
    }

    return steps;
  }

  return [];
}

function generateSegmentDerivation(
  segStart: number,
  segEnd: number,
  supports: BeamSupport[],
  pointLoads: PointLoad[],
  moments: ConcentratedMoment[],
  distributedLoads: DistributedLoad[],
  reactions: Reaction[],
): SegmentDerivation {
  const shearTerms: string[] = [];
  const momentTerms: string[] = [];
  const momentFormulaTerms: string[] = [];

  const reactionsLeft = reactions.filter(r => {
    const sup = supports.find(s => s.id === r.supportId);
    return sup && sup.position < segEnd;
  });

  for (const r of reactionsLeft) {
    const sup = supports.find(s => s.id === r.supportId)!;
    if (Math.abs(r.vertical) > 1e-8) {
      const val = cleanNumber(r.vertical);
      const sign = val >= 0 ? '+' : '-';
      const absVal = fmtNumAbs(val);
      shearTerms.push(`${sign} ${absVal}`);
      const pos = sup.position;
      const lever = pos <= segStart
        ? (Math.abs(segStart - pos) < 1e-8 ? 'x' : `(x + ${fmtNumAbs(segStart - pos)})`)
        : `(x - ${fmtNumAbs(pos - segStart)})`;
      const msign = val >= 0 ? '+' : '-';
      momentTerms.push(`${msign} ${absVal} \\times ${lever}`);
      momentFormulaTerms.push(`${msign} ${absVal}${lever}`);
    }
    if (Math.abs(r.moment) > 1e-8) {
      const mVal = cleanNumber(r.moment);
      const sign = mVal >= 0 ? '+' : '-';
      momentTerms.push(`${sign} ${fmtNumAbs(mVal)} \\times 1`);
      momentFormulaTerms.push(`${sign} ${fmtNumAbs(mVal)}`);
    }
  }

  for (const p of pointLoads) {
    if (p.position >= segEnd) continue;
    const v = cleanNumber(pointLoadVertical(p));
    if (Math.abs(v) < 1e-8) continue;
    const sign = v >= 0 ? '+' : '-';
    const absVal = fmtNumAbs(v);
    shearTerms.push(`${sign} ${absVal}`);
    const pos = p.position;
    const lever = pos < segStart
      ? `(x + ${fmtNumAbs(segStart - pos)})`
      : `(x - ${fmtNumAbs(pos - segStart)})`;
    const msign = v >= 0 ? '+' : '-';
    momentTerms.push(`${msign} ${absVal} \\times ${lever}`);
    momentFormulaTerms.push(`${msign} ${absVal}${lever}`);
  }

  for (const m of moments) {
    if (m.position >= segEnd) continue;
    const mv = cleanNumber((m.direction === 'CCW' ? 1 : -1) * m.magnitude);
    const sign = mv >= 0 ? '+' : '-';
    const absVal = fmtNumAbs(mv);
    momentTerms.push(`${sign} ${absVal} \\times 1`);
    momentFormulaTerms.push(`${sign} ${absVal}`);
  }

  // Distributed loads — fixed to handle partial overlaps correctly
  for (const d of distributedLoads) {
    if (d.startPos >= segEnd) continue;
    const a = d.startPos;
    const b = d.endPos;
    const Ld = b - a;
    const w1 = d.startMag;
    const w2 = d.endMag;
    const mSlope = (w2 - w1) / Ld;

    const oStart = Math.max(a, segStart);
    const oEnd = Math.min(b, segEnd);
    if (oEnd <= oStart + 1e-10) continue;
    const dx = oEnd - oStart;

    if (segStart >= a) {
      // Segment starts within or at the distributed load
      const wAtStart = w1 + mSlope * (segStart - a);
      if (Math.abs(wAtStart) < 1e-8 && Math.abs(mSlope) < 1e-8) continue;

      const isUniform = Math.abs(w1 - w2) < 1e-8 || Math.abs(mSlope) < 1e-8;

      if (isUniform) {
        const w = wAtStart;
        if (Math.abs(w) > 1e-8) {
          shearTerms.push(`- (${fmtNumAbs(w)})x`);
          momentTerms.push(`- \\frac{${fmtNumAbs(w)}x^{2}}{2}`);
          momentFormulaTerms.push(`- \\frac{${fmtNumAbs(w)}}{2}x^{2}`);
        }
      } else {
        let sTerm = '';
        let mTerm = '';
        let mfTerm = '';

        if (Math.abs(wAtStart) > 1e-8) {
          sTerm = `- (${fmtNumAbs(wAtStart)})x`;
          mTerm = `- \\frac{${fmtNumAbs(wAtStart)}x^{2}}{2}`;
          mfTerm = `- \\frac{${fmtNumAbs(wAtStart)}}{2}x^{2}`;
        }

        if (sTerm) sTerm += ' ';
        sTerm += `- \\frac{${fmtNumAbs(mSlope)}}{2}x^{2}`;
        if (mTerm) mTerm += ' ';
        mTerm += `- \\frac{${fmtNumAbs(mSlope)}x^{3}}{6}`;
        if (mfTerm) mfTerm += ' ';
        mfTerm += `- \\frac{${fmtNumAbs(mSlope)}}{6}x^{3}`;

        shearTerms.push(sTerm);
        momentTerms.push(mTerm);
        momentFormulaTerms.push(mfTerm);
      }
    } else {
      // Segment starts before the distributed load — use partial resultant
      // for the overlapping portion (a to oEnd)
      const wAtOStart = w1 + mSlope * (oStart - a);
      const wAtOEnd = w1 + mSlope * (oEnd - a);
      const partialForce = (wAtOStart + wAtOEnd) * dx / 2;
      const denom = wAtOStart + wAtOEnd;
      let centroidOffset: number;
      if (Math.abs(denom) > 1e-10) {
        centroidOffset = dx * (wAtOStart + 2 * wAtOEnd) / (3 * denom);
      } else {
        centroidOffset = dx / 2;
      }
      const centroid = oStart + centroidOffset;
      const arm = centroid - segStart;

      shearTerms.push(`- ${fmtNumAbs(partialForce)}`);
      momentTerms.push(`- ${fmtNumAbs(partialForce)}(${fmtNumAbs(arm)})`);
      momentFormulaTerms.push(`- ${fmtNumAbs(partialForce)}(${fmtNumAbs(arm)})`);
    }
  }

  const shearEquation = '\\sum F_y = 0 \\quad (\\uparrow+)';
  const momentEquation = '\\sum M_{\\text{cut}} = 0 \\quad (\\text{clockwise }+)';

  const shearFullEq = shearTerms.length > 0
    ? `-V ${shearTerms.join(' ')} = 0`
    : '-V = 0';

  const momentFullEq = momentTerms.length > 0
    ? `-M ${momentTerms.join(' ')} = 0`
    : '-M = 0';

  const shearResult = (() => {
    if (shearTerms.length === 0) return 'V(x) = 0';
    const inner = shearFullEq
      .replace(/^-V /, '')
      .replace(/ = 0$/, '')
      .replace(/^\+ /, '');
    return `V(x) = ${inner}`;
  })();

  const momentResult = (() => {
    if (momentFormulaTerms.length === 0) return 'M(x) = 0';
    const inner = momentFormulaTerms.join(' ').replace(/^\+ /, '');
    return `M(x) = ${inner}`;
  })();

  const xDist = cleanNumber(segEnd - segStart);
  // Exact shear at segment boundaries matching the formula
  const shearLeftOfStart = computeInternalShearMoment(segStart, supports, pointLoads, moments, distributedLoads, reactions).shear;
  let vLeft = shearLeftOfStart;
  for (const r of reactions) if (Math.abs(r.position - segStart) < 1e-8) vLeft += r.vertical;
  for (const p of pointLoads) if (Math.abs(p.position - segStart) < 1e-8) vLeft += pointLoadVertical(p);
  const vRight = computeInternalShearMoment(segEnd - 0.0001, supports, pointLoads, moments, distributedLoads, reactions).shear;
  const mLeft = computeInternalShearMoment(segStart + 0.0001, supports, pointLoads, moments, distributedLoads, reactions).moment;
  const mRight = computeInternalShearMoment(segEnd - 0.0001, supports, pointLoads, moments, distributedLoads, reactions).moment;

  return {
    shear: {
      equation: shearEquation,
      terms: shearTerms.map(t => ({ label: '', value: t })),
      result: shearResult,
      fullEquation: shearFullEq,
      xRange: [0, xDist],
      atLeft: `x = 0 \\rightarrow V = ${cleanNumber(vLeft).toFixed(1)}`,
      atRight: `x = ${xDist.toFixed(2)} \\rightarrow V = ${cleanNumber(vRight).toFixed(1)}`,
    },
    moment: {
      equation: momentEquation,
      terms: momentTerms.map(t => ({ label: '', value: t })),
      result: momentResult,
      fullEquation: momentFullEq,
      xRange: [0, xDist],
      atLeft: `x = 0 \\rightarrow M = ${cleanNumber(mLeft).toFixed(1)}`,
      atRight: `x = ${xDist.toFixed(2)} \\rightarrow M = ${cleanNumber(mRight).toFixed(1)}`,
    },
  };
}

function generateSegments(
  criticalPoints: number[],
  _beamLength: number,
  supports: BeamSupport[],
  pointLoads: PointLoad[],
  moments: ConcentratedMoment[],
  distributedLoads: DistributedLoad[],
  reactions: Reaction[],
): SegmentInfo[] {
  const segments: SegmentInfo[] = [];

  for (let i = 0; i < criticalPoints.length - 1; i++) {
    const xStart = criticalPoints[i];
    const xEnd = criticalPoints[i + 1];
    if (xEnd - xStart < 1e-10) continue;

    // Exact shear just RIGHT of xStart (no epsilon UDL error)
    const shearLeftOfStart = computeInternalShearMoment(
      xStart, supports, pointLoads, moments, distributedLoads, reactions
    ).shear;
    let vStart = shearLeftOfStart;
    for (const r of reactions) {
      if (Math.abs(r.position - xStart) < 1e-8) vStart += r.vertical;
    }
    for (const p of pointLoads) {
      if (Math.abs(p.position - xStart) < 1e-8) vStart += pointLoadVertical(p);
    }
    const mStart = computeInternalShearMoment(
      xStart + 0.0001, supports, pointLoads, moments, distributedLoads, reactions
    ).moment;

    const distLoad = distributedLoads.find(d => {
      const loadStart = Math.max(xStart, d.startPos);
      const loadEnd = Math.min(xEnd, d.endPos);
      return loadEnd > loadStart + 1e-10;
    }) || null;

    let distLoadInfo: { wStart: number; wEnd: number; startPos: number; endPos: number } | null = null;
    if (distLoad) {
      const wAt = (x: number) => {
        const dL = distLoad.endPos - distLoad.startPos;
        if (Math.abs(dL) < 1e-10) return distLoad.startMag;
        return distLoad.startMag + (distLoad.endMag - distLoad.startMag) * (x - distLoad.startPos) / dL;
      };
      distLoadInfo = { wStart: wAt(xStart), wEnd: wAt(xEnd), startPos: xStart, endPos: xEnd };
    }

    const derivation = generateSegmentDerivation(
      xStart, xEnd,
      supports, pointLoads, moments, distributedLoads, reactions,
    );

    segments.push({
      start: xStart,
      end: xEnd,
      shearFormula: derivation.shear.result,
      momentFormula: derivation.moment.result,
      vStart,
      mStart,
      distLoad: distLoadInfo,
      derivation,
    });
  }

  return segments;
}

export function solveBeam(
  beamLength: number,
  supports: BeamSupport[],
  pointLoads: PointLoad[],
  moments: ConcentratedMoment[],
  distributedLoads: DistributedLoad[],
): BeamResult {
  if (beamLength <= 0 || supports.length === 0) {
    return { reactions: [], diagramPoints: [], segments: [], maxShear: 0, minShear: 0, maxMoment: 0, minMoment: 0, shearZeroCrossings: [], reactionDerivation: [] };
  }

  const reactions = computeReactions(beamLength, supports, pointLoads, moments, distributedLoads);

  const critical = getCriticalPoints(beamLength, supports, pointLoads, moments, distributedLoads);

  const NUM_SAMPLES = 150;
  const diagramPoints: DiagramPoint[] = [];

  for (let i = 0; i <= NUM_SAMPLES; i++) {
    const x = (beamLength * i) / NUM_SAMPLES;
    const forces = computeInternalShearMoment(x, supports, pointLoads, moments, distributedLoads, reactions);
    diagramPoints.push({ x, shear: forces.shear, moment: forces.moment });
  }

  for (const cp of critical) {
    const left = computeInternalShearMoment(cp - 0.0001, supports, pointLoads, moments, distributedLoads, reactions);
    const right = computeInternalShearMoment(cp + 0.0001, supports, pointLoads, moments, distributedLoads, reactions);

    if (Math.abs(left.shear - right.shear) > 1e-8) {
      diagramPoints.push({ x: cp, shear: left.shear, moment: left.moment });
      diagramPoints.push({ x: cp, shear: right.shear, moment: right.moment });
    }
    if (Math.abs(left.moment - right.moment) > 1e-8) {
      if (Math.abs(left.shear - right.shear) < 1e-8) {
        diagramPoints.push({ x: cp, shear: left.shear, moment: left.moment });
        diagramPoints.push({ x: cp, shear: right.shear, moment: right.moment });
      }
    }
  }

  diagramPoints.sort((a, b) => a.x - b.x);

  const segments = generateSegments(critical, beamLength, supports, pointLoads, moments, distributedLoads, reactions);
  const reactionDerivation = generateReactionDerivation(beamLength, supports, pointLoads, moments, distributedLoads);

  let maxShear = -Infinity, minShear = Infinity;
  let maxMoment = -Infinity, minMoment = Infinity;
  for (const p of diagramPoints) {
    if (p.shear > maxShear) maxShear = p.shear;
    if (p.shear < minShear) minShear = p.shear;
    if (p.moment > maxMoment) maxMoment = p.moment;
    if (p.moment < minMoment) minMoment = p.moment;
  }

  // Find shear zero crossings directly from diagram points
  // (catches crossings in all cases: distributed loads, point loads, supports)
  const shearZeroCrossings: number[] = [];
  for (let i = 0; i < diagramPoints.length - 1; i++) {
    const p1 = diagramPoints[i];
    const p2 = diagramPoints[i + 1];
    if (p1.shear * p2.shear < 0) {
      const t = p1.shear / (p1.shear - p2.shear);
      const x = p1.x + t * (p2.x - p1.x);
      if (shearZeroCrossings.length === 0 || Math.abs(shearZeroCrossings[shearZeroCrossings.length - 1] - x) > 1e-6) {
        shearZeroCrossings.push(x);
      }
    }
  }

  return { reactions, diagramPoints, segments, maxShear, minShear, maxMoment, minMoment, shearZeroCrossings, reactionDerivation };
}
