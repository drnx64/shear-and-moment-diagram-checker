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

export default function BeamCanvas({ beamLength, supports, pointLoads, moments, distributedLoads, unitSystem }: Props) {
  const U = UNIT_SYSTEMS[unitSystem];
  const W = 800, H = 370;
  const MARGIN_L = 80, MARGIN_R = 80;
  const DRAW_W = W - MARGIN_L - MARGIN_R;
  const BEAM_Y = 180;
  const GROUND_Y = BEAM_Y + 50;

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

  const pixelScale = Math.max(maxDistMag, maxPointMag);
  const dimY = GROUND_Y + 20;

  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Beam View — Applied Loads</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-white rounded-lg border border-slate-200 shadow-sm" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="beam-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <polygon points="0 0, 0 10, 10 5" fill="#f87171" />
          </marker>
          <marker id="beam-dist-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <polygon points="0 0, 0 10, 10 5" fill="#34d399" />
          </marker>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#525252" strokeWidth="1.5" />
          </pattern>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>

        <rect x={MARGIN_L - 10} y={BEAM_Y - 6} width={DRAW_W + 20} height="12" rx="2" fill="url(#beamGrad)" />

        <line x1={MARGIN_L - 15} y1={GROUND_Y} x2={MARGIN_L + DRAW_W + 15} y2={GROUND_Y} stroke="#cbd5e1" strokeWidth="2" />
        {Array.from({ length: 7 }, (_, i) => {
          const gx = MARGIN_L - 15 + (i / 6) * (DRAW_W + 30);
          return (
            <line key={i} x1={gx} y1={GROUND_Y} x2={gx + (i % 2 === 0 ? -4 : 4)} y2={GROUND_Y + 8} stroke="#cbd5e1" strokeWidth="1" />
          );
        })}
        <line x1={MARGIN_L - 15} y1={GROUND_Y} x2={MARGIN_L - 15} y2={GROUND_Y + 14} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={MARGIN_L + DRAW_W + 15} y1={GROUND_Y} x2={MARGIN_L + DRAW_W + 15} y2={GROUND_Y + 14} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={MARGIN_L - 15} y1={GROUND_Y + 14} x2={MARGIN_L + DRAW_W + 15} y2={GROUND_Y + 14} stroke="#cbd5e1" strokeWidth="1" />

        <text x={MARGIN_L - 5} y={BEAM_Y + 4} textAnchor="end" fontSize="12" fill="#64748b">0</text>
        <text x={MARGIN_L + DRAW_W + 5} y={BEAM_Y + 4} textAnchor="start" fontSize="12" fill="#64748b">{beamLength.toFixed(1)}</text>

        <line x1={MARGIN_L} y1={BEAM_Y - 16} x2={MARGIN_L} y2={BEAM_Y + 12} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={MARGIN_L + DRAW_W} y1={BEAM_Y - 16} x2={MARGIN_L + DRAW_W} y2={BEAM_Y + 12} stroke="#cbd5e1" strokeWidth="0.5" />

        <line x1={MARGIN_L} y1={dimY} x2={MARGIN_L + DRAW_W} y2={dimY} stroke="#cbd5e1" strokeWidth="0.5" />
        <text x={MARGIN_L + DRAW_W / 2} y={dimY + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">L = {beamLength.toFixed(2)} {U.length}</text>

        {supports.map(s => {
          const x = toX(s.position);
          switch (s.type) {
            case 'fixed':
              return (
                <g key={s.id}>
                  <rect x={x - 6} y={BEAM_Y - 14} width="12" height="34" fill="url(#hatch)" stroke="#525252" strokeWidth="1" />
                  <line x1={x} y1={BEAM_Y} x2={x} y2={BEAM_Y + 18} stroke="#a1a1aa" strokeWidth="2" />
                  <text x={x} y={BEAM_Y + 30} textAnchor="middle" fontSize="9" fill="#a1a1aa">Fixed</text>
                </g>
              );
            case 'pin':
              return (
                <g key={s.id}>
                  <line x1={x} y1={BEAM_Y} x2={x} y2={BEAM_Y + 18} stroke="#a1a1aa" strokeWidth="2" />
                  <polygon points={`${x - 10},${BEAM_Y + 18} ${x + 10},${BEAM_Y + 18} ${x},${BEAM_Y + 4}`} fill="none" stroke="#fbbf24" strokeWidth="2" />
                  <circle cx={x} cy={BEAM_Y + 2} r="2" fill="#fbbf24" />
                  <text x={x} y={BEAM_Y + 30} textAnchor="middle" fontSize="9" fill="#fbbf24">Pin</text>
                </g>
              );
            case 'roller':
              return (
                <g key={s.id}>
                  <line x1={x} y1={BEAM_Y} x2={x} y2={BEAM_Y + 18} stroke="#a1a1aa" strokeWidth="2" />
                  <polygon points={`${x - 10},${BEAM_Y + 18} ${x + 10},${BEAM_Y + 18} ${x},${BEAM_Y + 6}`} fill="none" stroke="#60a5fa" strokeWidth="2" />
                  <circle cx={x - 7} cy={BEAM_Y + 24} r="3" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
                  <circle cx={x + 7} cy={BEAM_Y + 24} r="3" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
                  <text x={x} y={BEAM_Y + 34} textAnchor="middle" fontSize="9" fill="#60a5fa">Roller</text>
                </g>
              );
          }
        })}

        {pointLoads.map(p => {
          const x = toX(p.position);
          const arrowLen = 25 + (p.magnitude / pixelScale) * 40;
          const rad = p.angle * Math.PI / 180;
          const dx = arrowLen * Math.sin(rad);
          const dy = arrowLen * Math.cos(rad);
          const yTip = BEAM_Y - 6;
          const yTail = BEAM_Y - 6 + (p.direction === 'down' ? -dy : dy);
          const xTip = x;
          const xTail = x - dx;

          return (
            <g key={p.id}>
              <line x1={xTail} y1={yTail} x2={xTip} y2={yTip}
                stroke="#f87171" strokeWidth="2.5" markerEnd="url(#beam-arrow)" />
              <text x={xTip + 8} y={yTail + (p.direction === 'down' ? -4 : 14)} fontSize="10" fill="#f87171">
                {p.magnitude.toFixed(0)} {U.force}
              </text>
            </g>
          );
        })}

        {moments.map(m => {
          const x = toX(m.position);
          const r = 18;
          return (
            <g key={m.id}>
              <ellipse cx={x} cy={BEAM_Y - 34} rx={r} ry={r * 0.5} fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="3,2" />
              <polygon points={
                m.direction === 'CW'
                  ? `${x + 5},${BEAM_Y - 39} ${x + 10},${BEAM_Y - 46} ${x + 15},${BEAM_Y - 39}`
                  : `${x - 5},${BEAM_Y - 39} ${x - 10},${BEAM_Y - 46} ${x - 15},${BEAM_Y - 39}`
              } fill="#a78bfa" />
              <text x={x} y={BEAM_Y - 52} textAnchor="middle" fontSize="9" fill="#a78bfa">
                M = {m.magnitude.toFixed(0)} {U.moment}
              </text>
            </g>
          );
        })}

        {distributedLoads.map(d => {
          const x1 = toX(d.startPos);
          const x2 = toX(d.endPos);
          const h1 = (d.startMag / pixelScale) * 50;
          const h2 = (d.endMag / pixelScale) * 50;

          return (
            <g key={d.id}>
              <polygon points={`${x1},${BEAM_Y - 6} ${x1},${BEAM_Y - 6 - h1} ${x2},${BEAM_Y - 6 - h2} ${x2},${BEAM_Y - 6}`}
                fill="rgba(52, 211, 153, 0.2)" stroke="#34d399" strokeWidth="1.5" />
              {Array.from({ length: 5 }, (_, i) => {
                const t = (i + 1) / 6;
                const px = x1 + (x2 - x1) * t;
                const ph = h1 + (h2 - h1) * t;
                return (
                  <line key={i} x1={px} y1={BEAM_Y - 6 - ph} x2={px} y2={BEAM_Y - 6}
                    stroke="#34d399" strokeWidth="1.2" opacity="0.6" markerEnd="url(#beam-dist-arrow)" />
                );
              })}
              <text x={(x1 + x2) / 2} y={BEAM_Y - 10 - Math.max(h1, h2)}
                textAnchor="middle" fontSize="9" fill="#34d399">
                {d.startMag.toFixed(0)}-{d.endMag.toFixed(0)} {U.distLoad}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
