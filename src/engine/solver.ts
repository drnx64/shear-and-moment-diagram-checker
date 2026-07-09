import type {
  BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad,
  Reaction, DiagramPoint, SegmentInfo, BeamResult, SegmentDerivation,
  ReactionDerivationStep,
} from '../types';
import { fmtNum } from '../types';

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
  if (Math.abs(b - a) < 1e-10) return { shear: 0, moment: 0 };

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
    if (Math.abs(w1 + w2) < 1e-10) {
      const centroid = (a + b) / 2;
      shear = -totalForce;
      moment = -totalForce * (x - centroid);
    } else {
      const centroidOffset = L * (w1 + 2 * w2) / (3 * (w1 + w2));
      const centroid = a + centroidOffset;
      shear = -totalForce;
      moment = -totalForce * (x - centroid);
    }
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
    steps.push({ label: 'Configuration', equation: '\\text{Single fixed support at } x = ' + fmtNum(sorted[0].position) });
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
      `x_L = ${fmtNum(left.position)}, x_R = ${fmtNum(right.position)}, L = ${fmtNum(dist)}` });

    let sumVertTerms: string[] = [];
    let sumMomTerms: string[] = [];
    let sumVert = 0;
    let sumMomAboutLeft = 0;

    for (const p of pointLoads) {
      const v = pointLoadVertical(p);
      sumVertTerms.push(`${v >= 0 ? '+' : ''}${fmtNum(v)}`);
      sumMomTerms.push(`${v >= 0 ? '+' : ''}${fmtNum(v)}(${fmtNum(p.position - left.position)})`);
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
      sumVertTerms.push(`${totalForce >= 0 ? '-' : '+'}${fmtNum(Math.abs(totalForce))}`);
      sumMomTerms.push(`- ${fmtNum(totalForce)}(${fmtNum(centroid - left.position)})`);
      sumVert -= totalForce;
      sumMomAboutLeft -= totalForce * (centroid - left.position);
    }

    for (const m of moments) {
      const sign = m.direction === 'CW' ? '+' : '-';
      sumMomTerms.push(`${sign} ${fmtNum(m.magnitude)}`);
      sumMomAboutLeft += (m.direction === 'CW' ? 1 : -1) * m.magnitude;
    }

    steps.push({ label: 'ΣF_y = 0 (↑+)',
      equation: `R_L + R_R ${sumVertTerms.join(' ')} = 0` });

    steps.push({ label: 'ΣM_L = 0',
      equation: `R_R(${fmtNum(dist)}) ${sumMomTerms.join(' ')} = 0` });

    const rRightVert = -sumMomAboutLeft / dist;
    const rLeftVert = -sumVert - rRightVert;

    steps.push({ label: 'R_R', equation: `R_R = ${fmtNum(rRightVert, 4)}` });
    steps.push({ label: 'R_L', equation: `R_L = ${fmtNum(rLeftVert, 4)}` });

    for (const s of sorted) {
      if (s.type === 'fixed') {
        steps.push({ label: `M_${s.id}`, equation: `\\text{Moment reaction at fixed support computed from } \\sum M = 0` });
      }
    }

    return steps;
  }

  return [];
}

function gcd(a: number, b: number): number {
  return Math.abs(b) < 1e-10 ? Math.abs(a) : gcd(b, a % b);
}

function fmtFrac(num: number, den: number, varPart: string): string {
  const g = gcd(num, den);
  const n = num / g;
  const d = den / g;
  if (Math.abs(d - 1) < 1e-10) return `${n}${varPart}`;
  return `\\frac{${n}}{${d}}${varPart}`;
}

function toFracString(val: number): string {
  const intVal = Math.round(val);
  if (Math.abs(val - intVal) < 1e-10) return String(intVal);
  for (const d of [2, 3, 4, 6, 8, 12]) {
    const n = Math.round(val * d);
    if (Math.abs(val - n / d) < 1e-10) return `\\frac{${n}}{${d}}`;
  }
  return val.toFixed(2);
}

function getPower(varPart: string): number {
  if (!varPart) return 0;
  const m = varPart.match(/\{(\d+)\}/);
  if (m) return parseInt(m[1], 10);
  return varPart ? 1 : 0;
}

function combineTerms(terms: string[]): string {
  const groups: Map<string, number> = new Map();
  const re = /^([+-])\s*(?:(\d+(?:\.\d+)?)|\\frac\{([^}]+)\}\{([^}]+)\})(.*)$/;
  for (const raw of terms) {
    const t = raw.trim();
    const m = t.match(re);
    if (!m) continue;
    const sign = m[1] === '+' ? 1 : -1;
    let coeff: number;
    if (m[2] !== undefined) coeff = parseFloat(m[2]);
    else coeff = parseFloat(m[3]) / parseFloat(m[4]);
    const vp = m[5].trim();
    groups.set(vp, (groups.get(vp) || 0) + sign * coeff);
  }
  const parts: { vp: string; pow: number; coeff: number }[] = [];
  for (const [vp, coeff] of groups) {
    if (Math.abs(coeff) < 1e-10) continue;
    parts.push({ vp, pow: getPower(vp), coeff });
  }
  parts.sort((a, b) => b.pow - a.pow);
  const out: string[] = [];
  for (const p of parts) {
    const s = p.coeff >= 0 ? '+' : '-';
    const ac = Math.abs(p.coeff);
    const ic = Math.round(ac);
    const cs = Math.abs(ac - ic) < 1e-10 ? String(ic) : toFracString(ac);
    out.push(`${s} ${cs}${p.vp}`);
  }
  return out.join(' ').replace(/^\+ /, '');
}

function expandedFormulaTerms(msign: string, val: number, absVal: string, pos: number, segStart: number): string[] {
  const atStart = Math.abs(pos - segStart) < 1e-8;
  if (atStart) return [`${msign} ${absVal}x`];
  const offset = pos < segStart ? segStart - pos : pos - segStart;
  const c = pos < segStart ? val * offset : -val * offset;
  const cSign = c >= 0 ? '+' : '-';
  const cAbs = fmtNumAbs(c);
  if (cAbs === '0') return [`${msign} ${absVal}x`];
  return [`${msign} ${absVal}x`, `${cSign} ${cAbs}`];
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
  const geoShearTerms: string[] = [];
  const geoMomentTerms: string[] = [];
  let ratioProp: string | undefined;
  let hasDistLoad = false;

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
      geoShearTerms.push(`${sign} ${absVal}`);
      const pos = sup.position;
      const lever = pos <= segStart
        ? (Math.abs(segStart - pos) < 1e-8 ? 'x' : `(x + ${fmtNumAbs(segStart - pos)})`)
        : `(x - ${fmtNumAbs(pos - segStart)})`;
      const msign = val >= 0 ? '+' : '-';
      momentTerms.push(`${msign} ${absVal}${lever}`);
      geoMomentTerms.push(`${msign} ${absVal}${lever}`);
      momentFormulaTerms.push(...expandedFormulaTerms(msign, val, absVal, pos, segStart));
    }
    if (Math.abs(r.moment) > 1e-8) {
      const mVal = cleanNumber(r.moment);
      const sign = mVal >= 0 ? '+' : '-';
      const term = `${sign} ${fmtNumAbs(mVal)}`;
      momentTerms.push(term);
      geoMomentTerms.push(term);
      momentFormulaTerms.push(term);
    }
  }

  for (const p of pointLoads) {
    if (p.position >= segEnd) continue;
    const v = cleanNumber(pointLoadVertical(p));
    if (Math.abs(v) < 1e-8) continue;
    const sign = v >= 0 ? '+' : '-';
    const absVal = fmtNumAbs(v);
    shearTerms.push(`${sign} ${absVal}`);
    geoShearTerms.push(`${sign} ${absVal}`);
    const pos = p.position;
    const lever = pos < segStart
      ? `(x + ${fmtNumAbs(segStart - pos)})`
      : (Math.abs(pos - segStart) < 1e-8 ? 'x' : `(x - ${fmtNumAbs(pos - segStart)})`);
    const msign = v >= 0 ? '+' : '-';
    momentTerms.push(`${msign} ${absVal}${lever}`);
    geoMomentTerms.push(`${msign} ${absVal}${lever}`);
    momentFormulaTerms.push(...expandedFormulaTerms(msign, v, absVal, pos, segStart));
  }

  for (const m of moments) {
    if (m.position >= segEnd) continue;
    const mv = cleanNumber((m.direction === 'CCW' ? 1 : -1) * m.magnitude);
    const sign = mv >= 0 ? '+' : '-';
    const term = `${sign} ${fmtNumAbs(mv)}`;
    momentTerms.push(term);
    geoMomentTerms.push(term);
    momentFormulaTerms.push(term);
  }

  // Distributed loads — rectangle + triangle splitting per handbook guide
  // The scanned load is included if any part of it lies left of X_cut
  for (const d of distributedLoads) {
    if (d.startPos >= segEnd) continue;
    const a = d.startPos;
    const b = d.endPos;
    const Ld = b - a;
    if (Ld < 1e-10) continue;
    const w1 = d.startMag;
    const w2 = d.endMag;
    const m = (w2 - w1) / Ld;

    // --- Pre-load portion: load from a to segStart (constant force) ---
    if (a < segStart) {
      const preEnd = Math.min(b, segStart);
      const preLen = preEnd - a;
      if (preLen > 1e-10) {
        const pre_w1 = w1;
        const pre_w2 = w1 + m * preLen;
        const preForce = (pre_w1 + pre_w2) * preLen / 2;
        if (Math.abs(preForce) > 1e-8) {
          const preCentroid = a + preLen * (pre_w1 + 2 * pre_w2) / (3 * (pre_w1 + pre_w2));
          const preLever = segStart - preCentroid;
          const pfStr = fmtNumAbs(preForce);
          shearTerms.push(`- ${pfStr}`);
          geoShearTerms.push(`- ${pfStr}`);
          momentTerms.push(`- ${pfStr}(x + ${fmtNumAbs(preLever)})`);
          geoMomentTerms.push(`- ${pfStr}(x + ${fmtNumAbs(preLever)})`);
          momentFormulaTerms.push(`- ${pfStr}x`);
          if (Math.abs(preForce * preLever) > 1e-10) momentFormulaTerms.push(`- ${fmtNumAbs(preForce * preLever)}`);
          hasDistLoad = true;
        }
      }
    }

    // --- Within-segment portion: from sliceStart to X_cut ---
    const sliceStart = Math.max(a, segStart);
    if (sliceStart >= segEnd) continue;
    if (sliceStart >= b - 1e-10) continue; // load doesn't extend into segment

    const loadOffset = a > segStart ? a - segStart : 0;

    const w_left = w1 + m * (sliceStart - a);
    if (Math.abs(w_left) < 1e-8 && Math.abs(m) < 1e-8) continue;
    hasDistLoad = true;

    const dxStr = loadOffset > 0 ? `(x - ${fmtNumAbs(loadOffset)})` : 'x';
    const w1Str = fmtNumAbs(w_left);
    const mStr = fmtNumAbs(m);

    // Ratio & proportion: y/x = (w₂ - w₁) / L_load  (triangular portion, y is extra height above uniform base)
    if (Math.abs(m) > 1e-8) {
      const wDiff = fmtNumAbs(w2 - w1);
      ratioProp = `\\frac{y}{${dxStr}} = \\frac{${wDiff}}{${fmtNum(Ld, 1)}} \\quad\\longrightarrow\\quad y = ${mStr}${dxStr}`;
    }

      // Rectangle block: w_left × dx
    if (Math.abs(w_left) > 1e-8) {
      const rectShear = `- ${w1Str}${dxStr}`;
      shearTerms.push(rectShear);
      geoShearTerms.push(rectShear);
      const rectMoment = `- ${fmtFrac(w_left, 2, `${dxStr}^{2}`)}`;
      momentTerms.push(rectMoment);
      geoMomentTerms.push(rectMoment);
      const rectMFVar = loadOffset > 0 ? `(x - ${fmtNumAbs(loadOffset)})^{2}` : `${dxStr}^{2}`;
      momentFormulaTerms.push(`- ${fmtFrac(w_left, 2, rectMFVar)}`);
    }

    // Triangle block: ½ × dx × (w_cut − w_left)  where w_cut − w_left = m × dx
    if (Math.abs(m) > 1e-8) {
      // Regular (uses simplified slope form)
      const triVar = loadOffset > 0 ? `(x - ${fmtNumAbs(loadOffset)})^{2}` : `${dxStr}^{2}`;
      const triCubed = loadOffset > 0 ? `(x - ${fmtNumAbs(loadOffset)})^{3}` : `${dxStr}^{3}`;
      shearTerms.push(`- ${fmtFrac(m, 2, triVar)}`);
      momentTerms.push(`- ${fmtFrac(m, 6, triCubed)}`);
      momentFormulaTerms.push(`- ${fmtFrac(m, 6, triCubed)}`);

      // Geometric (uses y as the triangular portion only)
      geoShearTerms.push(`- \\frac{1}{2}${dxStr}y`);
      geoMomentTerms.push(`- \\frac{1}{2}${dxStr}y\\frac{${dxStr}}{3}`);
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

  // Geometric equations (use y for dist load)
  const shearGeoEq = hasDistLoad && geoShearTerms.length > 0
    ? `-V ${geoShearTerms.join(' ')} = 0`
    : undefined;
  const momentGeoEq = hasDistLoad && geoMomentTerms.length > 0
    ? `-M ${geoMomentTerms.join(' ')} = 0`
    : undefined;

  const shearResult = (() => {
    if (shearTerms.length === 0) return 'V(x) = 0';
    return `V(x) = ${combineTerms(shearTerms)}`;
  })();

  const momentResult = (() => {
    if (momentFormulaTerms.length === 0) return 'M(x) = 0';
    return `M(x) = ${combineTerms(momentFormulaTerms)}`;
  })();

  const xDist = cleanNumber(segEnd - segStart);
  // Exact shear at segment boundaries matching the formula
  const shearLeftOfStart = computeInternalShearMoment(segStart, supports, pointLoads, moments, distributedLoads, reactions).shear;
  let vLeft = shearLeftOfStart;
  for (const r of reactions) {
    const sup = supports.find(s => s.id === r.supportId);
    if (sup && Math.abs(sup.position - segStart) < 1e-8) vLeft += r.vertical;
  }
  for (const p of pointLoads) if (Math.abs(p.position - segStart) < 1e-8) vLeft += pointLoadVertical(p);
  const vRight = computeInternalShearMoment(segEnd - 0.0001, supports, pointLoads, moments, distributedLoads, reactions).shear;
  const mLeft = computeInternalShearMoment(segStart + 0.0001, supports, pointLoads, moments, distributedLoads, reactions).moment;
  const mRight = computeInternalShearMoment(segEnd - 0.0001, supports, pointLoads, moments, distributedLoads, reactions).moment;

  return {
    ratioProportion: ratioProp,
    shear: {
      equation: shearEquation,
      terms: shearTerms.map(t => ({ label: '', value: t })),
      result: shearResult,
      fullEquation: shearFullEq,
      geometricEquation: shearGeoEq,
      xRange: [0, xDist],
      atLeft: `x = 0 \\rightarrow V = ${fmtNum(cleanNumber(vLeft), 1)}`,
      atRight: `x = ${fmtNum(xDist)} \\rightarrow V = ${fmtNum(cleanNumber(vRight), 1)}`,
    },
    moment: {
      equation: momentEquation,
      terms: momentTerms.map(t => ({ label: '', value: t })),
      result: momentResult,
      fullEquation: momentFullEq,
      geometricEquation: momentGeoEq,
      xRange: [0, xDist],
      atLeft: `x = 0 \\rightarrow M = ${fmtNum(cleanNumber(mLeft), 1)}`,
      atRight: `x = ${fmtNum(xDist)} \\rightarrow M = ${fmtNum(cleanNumber(mRight), 1)}`,
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
      const sup = supports.find(s => s.id === r.supportId);
      if (sup && Math.abs(sup.position - xStart) < 1e-8) vStart += r.vertical;
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

  // Find shear zero crossings — only within segments, not across discontinuities
  const shearZeroCrossings: number[] = [];
  for (const seg of segments) {
    if (!seg.distLoad) continue;
    const shearSeg = computeInternalShearMoment(seg.start + 0.0001, supports, pointLoads, moments, distributedLoads, reactions).shear;
    const shearEnd = computeInternalShearMoment(seg.end - 0.0001, supports, pointLoads, moments, distributedLoads, reactions).shear;
    if (shearSeg * shearEnd < 0) {
      // Zero crossing within this segment — binary search
      let lo = seg.start + 0.0001;
      let hi = seg.end - 0.0001;
      let vLo = computeInternalShearMoment(lo, supports, pointLoads, moments, distributedLoads, reactions).shear;
      for (let iter = 0; iter < 50; iter++) {
        const mid = (lo + hi) / 2;
        const vMid = computeInternalShearMoment(mid, supports, pointLoads, moments, distributedLoads, reactions).shear;
        if (vLo * vMid > 0) { lo = mid; vLo = vMid; }
        else hi = mid;
      }
      const xZero = (lo + hi) / 2;
      if (shearZeroCrossings.length === 0 || Math.abs(shearZeroCrossings[shearZeroCrossings.length - 1] - xZero) > 1e-6) {
        shearZeroCrossings.push(xZero);
      }
    }
  }

  // Check extremum values at zero-shear points (where max/min moment typically occur)
  for (const zx of shearZeroCrossings) {
    const forces = computeInternalShearMoment(zx, supports, pointLoads, moments, distributedLoads, reactions);
    if (forces.moment > maxMoment) maxMoment = forces.moment;
    if (forces.moment < minMoment) minMoment = forces.moment;
  }

  return { reactions, diagramPoints, segments, maxShear, minShear, maxMoment, minMoment, shearZeroCrossings, reactionDerivation };
}
