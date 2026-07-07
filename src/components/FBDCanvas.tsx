import { useMemo } from 'react';
import type { BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad, Reaction, LabeledPoint, UnitSystem } from '../types';
import { UNIT_SYSTEMS } from '../types';

interface Props {
  beamLength: number;
  supports: BeamSupport[];
  pointLoads: PointLoad[];
  moments: ConcentratedMoment[];
  distributedLoads: DistributedLoad[];
  reactions: Reaction[];
  labeledPoints: LabeledPoint[];
  unitSystem: UnitSystem;
}

export default function FBDCanvas({ beamLength, supports, pointLoads, moments, distributedLoads, reactions, labeledPoints, unitSystem }: Props) {
  const U = UNIT_SYSTEMS[unitSystem];
  const W = 800, H = 320;
  const MARGIN_L = 80, MARGIN_R = 80;
  const DRAW_W = W - MARGIN_L - MARGIN_R;
  const BEAM_Y = 160;

  const toX = (x: number) => MARGIN_L + (x / beamLength) * DRAW_W;

  const maxDistMag = useMemo(() => {
    let max = 0;
    for (const d of distributedLoads) {
      if (d.startMag > max) max = d.startMag;
      if (d.endMag > max) max = d.endMag;
    }
    return max || 1;
  }, [distributedLoads]);

  const maxPointMag = useMemo(() => {
    let max = 0;
    for (const p of pointLoads) {
      if (p.magnitude > max) max = p.magnitude;
    }
    return max || 1;
  }, [pointLoads]);

  const scale = Math.max(maxDistMag, maxPointMag);
  const arrowScale = (mag: number) => 15 + (mag / scale) * 35;

  function pointColor(type: LabeledPoint['type']) {
    switch (type) {
      case 'support': return '#fbbf24';
      case 'load': return '#f87171';
      case 'moment': return '#a78bfa';
      case 'dist': return '#34d399';
      case 'end': return '#94a3b8';
    }
  }

  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Free Body Diagram</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-white rounded-lg border border-slate-200 shadow-sm" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="fbd-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <polygon points="0 0, 0 10, 10 5" fill="#f87171" />
          </marker>
          <marker id="fbd-reaction" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <polygon points="0 0, 0 10, 10 5" fill="#3b82f6" />
          </marker>
        </defs>

        <line x1={MARGIN_L - 10} y1={BEAM_Y} x2={MARGIN_L + DRAW_W + 10} y2={BEAM_Y} stroke="#334155" strokeWidth="2" />

        <text x={MARGIN_L - 6} y={BEAM_Y + 4} textAnchor="end" fontSize="11" fill="#64748b">0</text>
        <text x={MARGIN_L + DRAW_W + 6} y={BEAM_Y + 4} textAnchor="start" fontSize="11" fill="#64748b">{beamLength.toFixed(1)}</text>

        <line x1={MARGIN_L} y1={BEAM_Y + 12} x2={MARGIN_L + DRAW_W} y2={BEAM_Y + 12} stroke="#cbd5e1" strokeWidth="0.5" />
        <text x={MARGIN_L + DRAW_W / 2} y={BEAM_Y + 24} textAnchor="middle" fontSize="9" fill="#94a3b8">
          L = {beamLength.toFixed(2)} {U.length}
        </text>

        {pointLoads.map(p => {
          const x = toX(p.position);
          const len = arrowScale(p.magnitude);
          const rad = p.angle * Math.PI / 180;
          const dx = len * Math.sin(rad);
          const dy = len * Math.cos(rad);
          const yTip = BEAM_Y;
          const yTail = BEAM_Y + (p.direction === 'down' ? -dy : dy);
          const xTip = x;
          const xTail = x - dx;
          return (
            <g key={p.id}>
              <line x1={xTail} y1={yTail} x2={xTip} y2={yTip}
                stroke="#f87171" strokeWidth="2" markerEnd="url(#fbd-arrow)" />
              <text x={xTip + 8} y={yTail + (p.direction === 'down' ? -4 : 14)} fontSize="10" fill="#f87171" fontWeight="bold">
                P = {p.magnitude.toFixed(1)} {U.force}
              </text>
            </g>
          );
        })}

        {moments.map(m => {
          const x = toX(m.position);
          return (
            <g key={m.id}>
              <ellipse cx={x} cy={BEAM_Y - 28} rx="16" ry="8" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="3,2" />
              <polygon points={
                m.direction === 'CW'
                  ? `${x + 4},${BEAM_Y - 33} ${x + 9},${BEAM_Y - 40} ${x + 14},${BEAM_Y - 33}`
                  : `${x - 4},${BEAM_Y - 33} ${x - 9},${BEAM_Y - 40} ${x - 14},${BEAM_Y - 33}`
              } fill="#a78bfa" />
              <text x={x} y={BEAM_Y - 44} textAnchor="middle" fontSize="9" fill="#a78bfa">
                M = {m.magnitude.toFixed(1)} {U.moment}
              </text>
            </g>
          );
        })}

        {distributedLoads.map(d => {
          const x1 = toX(d.startPos);
          const x2 = toX(d.endPos);
          const h1 = (d.startMag / scale) * 45;
          const h2 = (d.endMag / scale) * 45;

          return (
            <g key={d.id}>
              <polygon points={`${x1},${BEAM_Y} ${x1},${BEAM_Y - h1} ${x2},${BEAM_Y - h2} ${x2},${BEAM_Y}`}
                fill="rgba(52, 211, 153, 0.15)" stroke="#34d399" strokeWidth="1.5" />
              {[0.2, 0.4, 0.6, 0.8].map(t => {
                const px = x1 + (x2 - x1) * t;
                const ph = h1 + (h2 - h1) * t;
                return (
                  <line key={t} x1={px} y1={BEAM_Y} x2={px} y2={BEAM_Y - ph}
                    stroke="#34d399" strokeWidth="0.8" opacity="0.6" />
                );
              })}
              <text x={(x1 + x2) / 2} y={BEAM_Y - 6 - Math.max(h1, h2)}
                textAnchor="middle" fontSize="9" fill="#34d399">
                w = {d.startMag.toFixed(1)}-{d.endMag.toFixed(1)} {U.distLoad}
              </text>
            </g>
          );
        })}

        {reactions.filter(r => r.vertical !== 0).map(r => {
          const sup = supports.find(s => s.id === r.supportId);
          if (!sup) return null;
          const x = toX(sup.position);
          const len = Math.min(Math.abs(r.vertical) / 10 * 30, 40);
          const isUp = r.vertical > 0;
          const yTip = BEAM_Y;
          const yTail = isUp ? BEAM_Y + len : BEAM_Y - len;
          return (
            <g key={r.id}>
              <line x1={x} y1={yTail} x2={x} y2={yTip}
                stroke="#3b82f6" strokeWidth="2" markerEnd="url(#fbd-reaction)" />
              <text x={x + 8} y={yTail + (isUp ? 14 : -4)} fontSize="9" fill="#3b82f6">
                R = {r.vertical.toFixed(1)} {U.force}
              </text>
            </g>
          );
        })}

        {reactions.filter(r => r.moment !== 0).map(r => {
          const sup = supports.find(s => s.id === r.supportId);
          if (!sup) return null;
          const x = toX(sup.position);
          return (
            <g key={r.id}>
              <ellipse cx={x} cy={BEAM_Y - 50} rx="10" ry="5" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2,2" />
              <text x={x} y={BEAM_Y - 44} textAnchor="middle" fontSize="9" fill="#3b82f6">
                M_R = {r.moment.toFixed(1)} {U.moment}
              </text>
            </g>
          );
        })}

        {labeledPoints.map(pt => {
          const x = toX(pt.position);
          const color = pointColor(pt.type);
          return (
            <g key={pt.label}>
              <circle cx={x} cy={BEAM_Y} r="10" fill={color} stroke="#fff" strokeWidth="2.5" />
              <circle cx={x} cy={BEAM_Y} r="10" fill="none" stroke={color} strokeWidth="1" />
              <text x={x} y={BEAM_Y + 3.5} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">
                {pt.label}
              </text>
              <line x1={x} y1={BEAM_Y + 12} x2={x} y2={BEAM_Y + 35} stroke={color} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
