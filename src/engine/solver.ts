import type {
  BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad,
  Reaction, DiagramPoint, SegmentInfo, BeamResult, SegmentDerivation,
} from '../types';

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

  const shear = -(w1 * dx + 0.5 * m * dx * dx);

  let moment: number;
  if (x <= b) {
    moment = -(0.5 * w1 * dx * dx + (1 / 6) * m * dx * dx * dx);
  } else {
    moment = -(w1 * L * (x - (a + b) / 2) + 0.5 * m * L * L * (x - (a + 2 * b) / 3));
  }

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

  return { shear, moment };
}

function computeReactions(
  beamLength: number,
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
      vertical: -sumVert,
      horizontal: -sumHoriz,
      moment: -sumMom,
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
        vertical: s.id === left.id ? rLeftVert : rRightVert,
        horizontal: isPin ? -sumHoriz : 0,
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

function fmtNum(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  if (rounded === 0) return '0';
  return rounded < 0 ? `-${Math.abs(rounded)}` : `${rounded}`;
}

function fmtNumAbs(n: number): string {
  const abs = Math.abs(Math.round(n * 1000) / 1000);
  return abs === 0 ? '0' : `${abs}`;
}

function fmtLatexConst(val: number, label: string): string {
  return `${label}(x) = ${fmtNum(val)}`;
}

function fmtLatexLinear(a1: number, a0: number, label: string): string {
  let result = `${label}(x) = ${fmtNum(a0)}`;
  if (Math.abs(a1) > 1e-8) {
    const sign = a1 >= 0 ? ' + ' : ' - ';
    result += `${sign}${fmtNumAbs(a1)}x`;
  }
  return result;
}

function fmtLatexPoly(coeffs: number[], label: string): string {
  const deg = coeffs.length - 1;
  let result = `${label}(x) = `;
  let first = true;

  for (let i = 0; i < coeffs.length; i++) {
    const c = Math.round(coeffs[i] * 1000) / 1000;
    if (Math.abs(c) < 1e-8) continue;
    const power = deg - i;
    const abs = Math.abs(c);

    if (first) {
      if (c < 0) result += '-';
      first = false;
    } else {
      result += c < 0 ? ' - ' : ' + ';
    }

    if (power === 0) {
      result += abs === 0 && first ? '0' : `${abs}`;
    } else if (power === 1) {
      result += `${abs}x`;
    } else {
      result += `${abs}x^{${power}}`;
    }
  }

  if (first) result += '0';
  return result;
}

function generateSegmentDerivation(
  segStart: number,
  segEnd: number,
  supports: BeamSupport[],
  pointLoads: PointLoad[],
  moments: ConcentratedMoment[],
  distributedLoads: DistributedLoad[],
  reactions: Reaction[],
  vStart: number,
  mStart: number,
  distLoad: { wStart: number; wEnd: number } | null,
): SegmentDerivation {
  const U = { force: '', length: '', distLoad: '', moment: '' };

  function term(val: number, desc: string): string {
    const sign = val >= 0 ? '+' : '-';
    return `${sign} ${fmtNumAbs(val)}${desc}`;
  }

  function momentTerm(val: number, leverDesc: string): string {
    const sign = val >= 0 ? '+' : '-';
    return `${sign} ${fmtNumAbs(val)} \\times ${leverDesc}`;
  }

  const shearTerms: string[] = [];
  const momentTerms: string[] = [];

  const reactionsLeft = reactions.filter(r => {
    const sup = supports.find(s => s.id === r.supportId);
    return sup && sup.position < segEnd;
  });

  for (const r of reactionsLeft) {
    const sup = supports.find(s => s.id === r.supportId)!;
    if (Math.abs(r.vertical) > 1e-8) {
      const pos = sup.position;
      const desc = segStart > pos ? ` (R @ ${pos.toFixed(2)})` : '';
      shearTerms.push(term(r.vertical, desc));
      const lever = pos <= segStart
        ? `(x - ${pos.toFixed(2)})`
        : `${(segStart - pos).toFixed(2)}`;
      momentTerms.push(momentTerm(r.vertical, lever));
    }
    if (Math.abs(r.moment) > 1e-8 && sup.position < segEnd) {
      const desc = ` (M_R @ ${sup.position.toFixed(2)})`;
      shearTerms.push(term(0, desc));
    }
  }

  for (const p of pointLoads) {
    if (p.position >= segEnd) continue;
    const v = pointLoadVertical(p);
    const desc = ` (P=${p.magnitude.toFixed(1)} @ ${p.position.toFixed(2)})`;
    shearTerms.push(term(v, desc));
    const arm = p.position <= segStart
      ? `(x - ${p.position.toFixed(2)})`
      : `${(segStart - p.position).toFixed(2)}`;
    momentTerms.push(momentTerm(v, arm));
  }

  for (const m of moments) {
    if (m.position >= segEnd) continue;
    const mv = (m.direction === 'CCW' ? 1 : -1) * m.magnitude;
    const desc = ` (M \\text{ ${m.direction}} @ ${m.position.toFixed(2)})`;
    momentTerms.push(momentTerm(mv, '1'));
  }

  for (const d of distributedLoads) {
    if (d.startPos >= segEnd) continue;
    const overlapStart = Math.max(d.startPos, segStart);
    const overlapEnd = Math.min(d.endPos, segEnd);
    if (overlapEnd <= overlapStart + 1e-10) {
      const totalForce = computeDistLoadShearMoment(segEnd, d).shear;
      if (Math.abs(totalForce) > 1e-8) {
        shearTerms.push(term(totalForce, ''));
        const cent = d.startPos + (d.endPos - d.startPos) * (d.startMag + 2 * d.endMag) / (3 * (d.startMag + d.endMag));
        const arm = segStart - cent;
        momentTerms.push(momentTerm(totalForce, arm.toFixed(2)));
      }
      continue;
    }
    const xWithin = segStart + 0.5 * (segEnd - segStart);
    const contrib = computeDistLoadShearMoment(xWithin, d);
    if (Math.abs(contrib.shear) > 1e-8) {
      const ol = Math.max(d.startPos, segStart);
      const or = Math.min(d.endPos, segEnd);
      const dx = or - ol;
      if (segStart >= d.startPos) {
        shearTerms.push(term(contrib.shear, ''));
        const cent = ol + dx * (d.startMag + 2 * d.endMag) / (3 * (d.startMag + d.endMag));
        const arm = `(x - ${cent.toFixed(2)})`;
        momentTerms.push(momentTerm(contrib.shear, arm));
      }
    }
  }

  let shearEquation = '\\sum F_y = 0 \\quad (\\uparrow+)';
  let shearResult = fmtLatexConst(vStart, 'V');
  if (distLoad && segEnd > distLoad.wStart) {
    if (Math.abs(distLoad.wStart - distLoad.wEnd) > 1e-8) {
      const mSlope = (distLoad.wEnd - distLoad.wStart) / (segEnd - segStart);
      shearResult = fmtLatexPoly([-0.5 * mSlope, -(distLoad.wStart - mSlope * segStart), vStart + distLoad.wStart * segStart - 0.5 * mSlope * segStart * segStart], 'V');
    } else {
      shearResult = fmtLatexLinear(-distLoad.wStart, vStart + distLoad.wStart * segStart, 'V');
    }
  }

  let momentEquation = '\\sum M_{\\text{cut}} = 0 \\quad (\\text{clockwise }+)';

  return {
    shear: {
      equation: shearEquation,
      terms: shearTerms.map(t => ({ label: '', value: t })),
      result: shearResult,
    },
    moment: {
      equation: momentEquation,
      terms: momentTerms.map(t => ({ label: '', value: t })),
      result: fmtLatexConst(mStart, 'M'),
    },
  };
}

function expandMomentCubic(mStart: number, vStart: number, xStart: number, w1: number, mSlope: number): number[] {
  const a3 = -(1 / 6) * mSlope;
  const a2 = -0.5 * w1 + 0.5 * mSlope * xStart;
  const a1 = vStart + w1 * xStart - 0.5 * mSlope * xStart * xStart;
  const a0 = mStart - vStart * xStart - 0.5 * w1 * xStart * xStart + (1 / 6) * mSlope * xStart * xStart * xStart;

  return [a3, a2, a1, a0];
}

function generateSegments(
  criticalPoints: number[],
  beamLength: number,
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

    const midX = (xStart + xEnd) / 2;

    const forcesAtStart = computeInternalForces(xStart + 0.0001, supports, pointLoads, moments, distributedLoads, reactions);
    const forcesAtEnd = computeInternalForces(xEnd - 0.0001, supports, pointLoads, moments, distributedLoads, reactions);

    const vStart = forcesAtStart.shear;
    const mStart = forcesAtStart.moment;

    const distLoad = distributedLoads.find(d => {
      const loadStart = Math.max(xStart, d.startPos);
      const loadEnd = Math.min(xEnd, d.endPos);
      return loadEnd > loadStart + 1e-10;
    }) || null;

    let shearFormula: string;
    let momentFormula: string;

    if (distLoad && midX > distLoad.startPos && midX < distLoad.endPos) {
      const L = distLoad.endPos - distLoad.startPos;
      const mSlope = (distLoad.endMag - distLoad.startMag) / L;
      const w1 = distLoad.startMag;

      const a2 = -0.5 * mSlope;
      const a1 = -w1 + mSlope * xStart;
      const a0 = vStart + w1 * xStart - 0.5 * mSlope * xStart * xStart;

      shearFormula = fmtLatexPoly([a2, a1, a0], 'V');

      const coef = expandMomentCubic(mStart, vStart, xStart, w1, mSlope);
      momentFormula = fmtLatexPoly(coef, 'M');
    } else if (distLoad && midX > distLoad.startPos && midX < distLoad.endPos + 1e-10) {
      const w = distLoad.startMag;
      shearFormula = fmtLatexLinear(-w, vStart + w * xStart, 'V');

      const a2 = -0.5 * w;
      const a1 = vStart + w * xStart;
      const a0 = mStart - vStart * xStart - 0.5 * w * xStart * xStart;
      momentFormula = fmtLatexPoly([a2, a1, a0], 'M');
    } else {
      shearFormula = fmtLatexConst(vStart, 'V');
      momentFormula = fmtLatexLinear(vStart, mStart - vStart * xStart, 'M');
    }

    let distLoadInfo: { wStart: number; wEnd: number } | null = null;
    if (distLoad) {
      distLoadInfo = { wStart: distLoad.startMag, wEnd: distLoad.endMag };
    }

    const derivation = generateSegmentDerivation(
      xStart, xEnd,
      supports, pointLoads, moments, distributedLoads, reactions,
      vStart, mStart, distLoadInfo,
    );

    segments.push({
      start: xStart,
      end: xEnd,
      shearFormula,
      momentFormula,
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
    return { reactions: [], diagramPoints: [], segments: [], maxShear: 0, minShear: 0, maxMoment: 0, minMoment: 0 };
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

  return { reactions, diagramPoints, segments, maxShear, minShear, maxMoment, minMoment };
}
