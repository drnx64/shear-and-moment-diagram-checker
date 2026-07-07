import type {
  BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad,
  Reaction, DiagramPoint, SegmentInfo, BeamResult, SegmentDerivation,
} from '../types';

function cleanNumber(n: number): number {
  if (Math.abs(n) < 1e-6) return 0;
  const rounded = Math.round(n * 1e8) / 1e8;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return Math.round(rounded);
  return rounded;
}

function pointLoadVertical(load: PointLoad): number {
  const vert = load.magnitude * Math.cos(load.angle * Math.PI / 180);
  return load.direction === 'up' ? vert : -vert;
}

function pointLoadHorizontal(load: PointLoad): number {
  return load.magnitude * Math.sin(load.angle * Math.PI / 180);
}

function distLoadParams(load: DistributedLoad) {
  const L = load.endPos - load.startPos;
  if (L <= 0) return { force: 0, centroid: load.startPos, slope: 0 };
  const slope = (load.endMag - load.startMag) / L;
  const force = -(load.startMag + load.endMag) * L / 2;
  const denom = load.startMag + load.endMag;
  const centroid = denom !== 0
    ? load.startPos + L * (load.startMag + 2 * load.endMag) / (3 * denom)
    : (load.startPos + load.endPos) / 2;
  return { force, centroid, slope };
}

function computeDistLoadShearMoment(x: number, load: DistributedLoad): { shear: number; moment: number } {
  const { startPos: a, endPos: b, startMag: w1, endMag: w2 } = load;
  if (x <= a) return { shear: 0, moment: 0 };
  const L = b - a;
  const m = (w2 - w1) / L;
  const actualEnd = Math.min(x, b);
  const dx = actualEnd - a;

  let shear = -(w1 * dx + 0.5 * m * dx * dx);
  let moment: number;
  if (x <= b) {
    moment = -(0.5 * w1 * dx * dx + (1 / 6) * m * dx * dx * dx);
  } else {
    moment = -(w1 * L * (x - (a + b) / 2) + 0.5 * m * L * L * (x - (a + 2 * b) / 3));
  }

  shear = cleanNumber(shear);
  moment = cleanNumber(moment);
  return { shear, moment };
}

function computeInternalForces(
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
      sumVert += pointLoadVertical(p);
      sumHoriz += pointLoadHorizontal(p);
      sumMom += pointLoadVertical(p) * (p.position - fixed.position);
    }

    for (const m of moments) {
      sumMom += (m.direction === 'CCW' ? 1 : -1) * m.magnitude;
    }

    for (const d of distributedLoads) {
      const eq = distLoadParams(d);
      sumVert += eq.force;
      sumHoriz += 0;
      sumMom += eq.force * (eq.centroid - fixed.position);
    }

    return [{
      id: `reaction-${fixed.id}`,
      supportId: fixed.id,
      vertical: cleanNumber(-sumVert),
      horizontal: cleanNumber(-sumHoriz),
      moment: cleanNumber(-sumMom),
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
      const h = pointLoadHorizontal(p);
      sumVert += v;
      sumHoriz += h;
      sumMomAboutLeft += v * (p.position - left.position);
    }

    for (const m of moments) {
      sumMomAboutLeft += (m.direction === 'CCW' ? 1 : -1) * m.magnitude;
    }

    for (const d of distributedLoads) {
      const eq = distLoadParams(d);
      sumVert += eq.force;
      sumMomAboutLeft += eq.force * (eq.centroid - left.position);
    }

    const rRightVert = -sumMomAboutLeft / dist;
    const rLeftVert = -sumVert - rRightVert;

    const pinSupport = sorted.find(s => s.type === 'pin' || s.type === 'fixed');
    const pinId = pinSupport ? pinSupport.id : left.id;

    const reactions: Reaction[] = [];
      for (const s of sorted) {
        const isPin = s.id === pinId;
        reactions.push({
          id: `reaction-${s.id}`,
          supportId: s.id,
          vertical: cleanNumber(s.id === left.id ? rLeftVert : rRightVert),
          horizontal: cleanNumber(isPin ? -sumHoriz : 0),
          moment: 0,
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

function generateSegmentDerivation(
  segStart: number,
  segEnd: number,
  supports: BeamSupport[],
  pointLoads: PointLoad[],
  moments: ConcentratedMoment[],
  distributedLoads: DistributedLoad[],
  reactions: Reaction[],
): SegmentDerivation {
  function term(val: number, desc: string): string {
    const sign = val >= 0 ? '+' : '-';
    return `${sign} ${fmtNumAbs(val)}${desc}`;
  }

  function momentTerm(val: number, leverDesc: string): string {
    const sign = val >= 0 ? '+' : '-';
    return `${sign} ${fmtNumAbs(val)} \\times ${leverDesc}`;
  }

  function momentTermFormula(val: number, leverDesc: string): string {
    const sign = val >= 0 ? '+' : '-';
    return `${sign} ${fmtNumAbs(val)}${leverDesc}`;
  }

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
      shearTerms.push(term(val, ''));
      const pos = sup.position;
      if (pos <= segStart) {
        const offset = cleanNumber(segStart - pos);
        const lever = Math.abs(offset) < 1e-8 ? 'x' : `(x + ${fmtNumAbs(offset)})`;
        const mt = momentTerm(val, lever);
        momentTerms.push(mt);
        momentFormulaTerms.push(momentTermFormula(val, lever));
      } else {
        const offset = cleanNumber(pos - segStart);
        const lever = `(x - ${fmtNumAbs(offset)})`;
        const mt = momentTerm(val, lever);
        momentTerms.push(mt);
        momentFormulaTerms.push(momentTermFormula(val, lever));
      }
    }
  }

  for (const p of pointLoads) {
    if (p.position >= segEnd) continue;
    const v = cleanNumber(pointLoadVertical(p));
    shearTerms.push(term(v, ''));
    if (p.position <= segStart) {
      const offset = cleanNumber(segStart - p.position);
      const lever = Math.abs(offset) < 1e-8 ? 'x' : `(x + ${fmtNumAbs(offset)})`;
      const mt = momentTerm(v, lever);
      momentTerms.push(mt);
      momentFormulaTerms.push(momentTermFormula(v, lever));
    } else {
      const offset = cleanNumber(p.position - segStart);
      const lever = `(x - ${fmtNumAbs(offset)})`;
      const mt = momentTerm(v, lever);
      momentTerms.push(mt);
      momentFormulaTerms.push(momentTermFormula(v, lever));
    }
  }

  for (const m of moments) {
    if (m.position >= segEnd) continue;
    const mv = cleanNumber((m.direction === 'CCW' ? 1 : -1) * m.magnitude);
    const mt = momentTerm(mv, '1');
    momentTerms.push(mt);
    momentFormulaTerms.push(momentTermFormula(mv, '1'));
  }

  for (const d of distributedLoads) {
    if (d.startPos >= segEnd) continue;
    const overlapStart = Math.max(d.startPos, segStart);
    const overlapEnd = Math.min(d.endPos, segEnd);
    if (overlapEnd <= overlapStart + 1e-10) {
      const totalForce = cleanNumber(computeDistLoadShearMoment(segEnd, d).shear);
      if (Math.abs(totalForce) > 1e-8) {
        shearTerms.push(term(totalForce, ''));
        const cent = d.startPos + (d.endPos - d.startPos) * (d.startMag + 2 * d.endMag) / (3 * (d.startMag + d.endMag));
        const arm = cleanNumber(segStart - cent);
        const mt = momentTerm(totalForce, fmtNumAbs(arm));
        momentTerms.push(mt);
        momentFormulaTerms.push(momentTermFormula(totalForce, fmtNumAbs(arm)));
      }
      continue;
    }
    if (segStart >= d.startPos) {
      const w1 = d.startMag;
      const w2 = d.endMag;
      const a = d.startPos;
      const L = d.endPos - a;
      const m = (w2 - w1) / L;
      const wAtSegStart = cleanNumber(w1 + m * (segStart - a));
      if (Math.abs(w1 - w2) < 1e-10) {
        shearTerms.push(`- ${fmtNumAbs(w1)}x`);
        momentTerms.push(`- ${fmtNumAbs(wAtSegStart)} \\times \\frac{x^{2}}{2}`);
        momentFormulaTerms.push(`- ${fmtNumAbs(0.5 * wAtSegStart)}x^{2}`);
      } else {
        shearTerms.push(`- ${fmtNumAbs(w1)}x - \\frac{1}{2} \\times ${fmtNumAbs(m)}x^{2}`);
        momentTerms.push(`- ${fmtNumAbs(wAtSegStart)} \\times \\frac{x^{2}}{2} - \\frac{1}{2} \\times ${fmtNumAbs(m)} \\times \\frac{x^{3}}{3}`);
        momentFormulaTerms.push(`- ${fmtNumAbs(0.5 * wAtSegStart)}x^{2} - ${fmtNumAbs((1 / 6) * m)}x^{3}`);
      }
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

  return {
    shear: {
      equation: shearEquation,
      terms: shearTerms.map(t => ({ label: '', value: t })),
      result: shearResult,
      fullEquation: shearFullEq,
    },
    moment: {
      equation: momentEquation,
      terms: momentTerms.map(t => ({ label: '', value: t })),
      result: momentResult,
      fullEquation: momentFullEq,
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

    const forcesAtStart = computeInternalForces(xStart + 0.0001, supports, pointLoads, moments, distributedLoads, reactions);


    const vStart = forcesAtStart.shear;
    const mStart = forcesAtStart.moment;

    const distLoad = distributedLoads.find(d => {
      const loadStart = Math.max(xStart, d.startPos);
      const loadEnd = Math.min(xEnd, d.endPos);
      return loadEnd > loadStart + 1e-10;
    }) || null;

    let distLoadInfo: { wStart: number; wEnd: number; startPos: number; endPos: number } | null = null;
    if (distLoad) {
      distLoadInfo = { wStart: distLoad.startMag, wEnd: distLoad.endMag, startPos: distLoad.startPos, endPos: distLoad.endPos };
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

function computeShearZeroCrossings(segments: SegmentInfo[]): number[] {
  const crossings: number[] = [];

  for (const seg of segments) {
    const { start, end, vStart, distLoad } = seg;

    if (!distLoad) continue;

    const wStart = distLoad.wStart;
    const wEnd = distLoad.wEnd;
    const L = end - start;
    if (L < 1e-10) continue;

    if (Math.abs(wStart - wEnd) < 1e-10) {
      const w = wStart;
      if (Math.abs(w) < 1e-10) continue;
      const xZero = (vStart + w * start) / w;
      if (xZero > start + 1e-8 && xZero < end - 1e-8) {
        crossings.push(xZero);
      }
    } else {
      const mSlope = (wEnd - wStart) / L;
      const a = -0.5 * mSlope;
      const b = -wStart + mSlope * start;
      const c = vStart + wStart * start - 0.5 * mSlope * start * start;

      if (Math.abs(a) > 1e-10) {
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sqrtD = Math.sqrt(disc);
          for (const root of [(-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a)]) {
            if (root > start + 1e-8 && root < end - 1e-8) {
              crossings.push(root);
            }
          }
        }
      }
    }
  }

  crossings.sort((a, b) => a - b);
  return crossings;
}

export function solveBeam(
  beamLength: number,
  supports: BeamSupport[],
  pointLoads: PointLoad[],
  moments: ConcentratedMoment[],
  distributedLoads: DistributedLoad[],
): BeamResult {
  if (beamLength <= 0 || supports.length === 0) {
    return { reactions: [], diagramPoints: [], segments: [], maxShear: 0, minShear: 0, maxMoment: 0, minMoment: 0, shearZeroCrossings: [] };
  }

  const reactions = computeReactions(beamLength, supports, pointLoads, moments, distributedLoads);

  const critical = getCriticalPoints(beamLength, supports, pointLoads, moments, distributedLoads);

  const NUM_SAMPLES = 150;
  const diagramPoints: DiagramPoint[] = [];

  for (let i = 0; i <= NUM_SAMPLES; i++) {
    const x = (beamLength * i) / NUM_SAMPLES;
    const forces = computeInternalForces(x, supports, pointLoads, moments, distributedLoads, reactions);
    diagramPoints.push({ x, shear: forces.shear, moment: forces.moment });
  }

  for (const cp of critical) {
    const left = computeInternalForces(cp - 0.0001, supports, pointLoads, moments, distributedLoads, reactions);
    const right = computeInternalForces(cp + 0.0001, supports, pointLoads, moments, distributedLoads, reactions);

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

  let maxShear = -Infinity, minShear = Infinity;
  let maxMoment = -Infinity, minMoment = Infinity;
  for (const p of diagramPoints) {
    if (p.shear > maxShear) maxShear = p.shear;
    if (p.shear < minShear) minShear = p.shear;
    if (p.moment > maxMoment) maxMoment = p.moment;
    if (p.moment < minMoment) minMoment = p.moment;
  }

  const shearZeroCrossings = computeShearZeroCrossings(segments);

  return { reactions, diagramPoints, segments, maxShear, minShear, maxMoment, minMoment, shearZeroCrossings };
}
