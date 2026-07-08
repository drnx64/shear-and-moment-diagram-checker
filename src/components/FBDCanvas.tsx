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

export default function FBDCanvas({ beamLength, supports, pointLoads, moments: _moments, distributedLoads, reactions, labeledPoints, unitSystem }: Props) {
  const U = UNIT_SYSTEMS[unitSystem];
  const W = 700, H = 280;
  const MARGIN_L = 60, MARGIN_R = 60;
  const DRAW_W = W - MARGIN_L - MARGIN_R;
  const BEAM_Y = 140;
  const BEAM_H = 8;
  const BEAM_TOP = BEAM_Y - BEAM_H / 2;
  const BEAM_BOT = BEAM_Y + BEAM_H / 2;

  const toX = (x: number) => MARGIN_L + (x / beamLength) * DRAW_W;

  const maxReaction = useMemo(() => {
    let max = 1;
    for (const r of reactions) {
      const abs = Math.abs(r.vertical);
      if (abs > max) max = abs;
    }
    return max;
  }, [reactions]);

  const arrowLen = (mag: number) => Math.max(20, Math.min(55, 15 + (Math.abs(mag) / maxReaction) * 40));

  const normScale = useMemo(() => {
    let scale = 1;
    for (const p of pointLoads) if (p.magnitude > scale) scale = p.magnitude;
    for (const d of distributedLoads) {
      if (d.startMag > scale) scale = d.startMag;
      if (d.endMag > scale) scale = d.endMag;
    }
    return scale;
  }, [pointLoads, distributedLoads]);

  const loadArrowLen = (mag: number) => Math.max(20, Math.min(60, 20 + (mag / normScale) * 40));

  function valColor(v: number): string {
    if (v > 0.001) return '#16a34a';
    if (v < -0.001) return '#dc2626';
    return '#64748b';
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="reaction-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <polygon points="0 0, 0 10, 10 5" fill="#2563eb" />
          </marker>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>

        <rect x={MARGIN_L} y={BEAM_TOP} width={DRAW_W} height={BEAM_H} rx="3" fill="url(#beamGrad)" />

        {labeledPoints.map(pt => {
          const x = toX(pt.position);
          return (
            <g key={pt.label}>
              <circle cx={x} cy={BEAM_Y} r="3" fill="#1e293b" />
              <text x={x} y={BEAM_TOP - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1e293b">
                {pt.label}
              </text>
            </g>
          );
        })}

        {reactions.map(r => {
          const sup = supports.find(s => s.id === r.supportId);
          if (!sup) return null;
          const x = toX(sup.position);

          const vLen = arrowLen(r.vertical);
          // Reactions always drawn BELOW the beam
          let tipY: number, tailY: number;
          if (r.vertical >= 0) {
            // Upward: arrow from below pointing UP to beam bottom
            tailY = BEAM_BOT + vLen;
            tipY = BEAM_BOT;
          } else {
            // Downward: arrow from beam bottom pointing DOWN
            tailY = BEAM_BOT;
            tipY = BEAM_BOT + vLen;
          }

          return (
            <g key={r.id}>
              {Math.abs(r.vertical) > 1e-6 && (
                <>
                  <line x1={x} y1={tailY} x2={x} y2={tipY} stroke="#2563eb" strokeWidth="2" markerEnd="url(#reaction-arrow)" />
                  <rect x={x - 20} y={tailY + (r.vertical >= 0 ? 4 : -18)} width="40" height="14" rx="3" fill="rgba(255,255,255,0.9)" />
                  <text x={x} y={tailY + (r.vertical >= 0 ? 14 : -6)} textAnchor="middle" fontSize="9" fill={valColor(r.vertical)} fontWeight="700">
                    {r.vertical.toFixed(2)} {U.force}
                  </text>
                </>
              )}
              {Math.abs(r.horizontal) > 1e-6 && (
                <>
                  <line x1={x} y1={BEAM_BOT + 22} x2={x + (r.horizontal >= 0 ? 30 : -30)} y2={BEAM_BOT + 22} stroke="#2563eb" strokeWidth="2" markerEnd="url(#reaction-arrow)" />
                  <text x={x + (r.horizontal >= 0 ? 34 : -34)} y={BEAM_BOT + 26} textAnchor={r.horizontal >= 0 ? 'start' : 'end'} fontSize="9" fill={valColor(r.horizontal)} fontWeight="700">
                    {r.horizontal.toFixed(2)} {U.force}
                  </text>
                </>
              )}
              {Math.abs(r.moment) > 1e-6 && (
                <>
                  <circle cx={x} cy={BEAM_BOT + 46} r="12" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="3,2" />
                  <polygon points={
                    r.moment >= 0
                      ? `${x + 4},${BEAM_BOT + 40} ${x + 8},${BEAM_BOT + 34} ${x + 12},${BEAM_BOT + 40}`
                      : `${x - 4},${BEAM_BOT + 40} ${x - 8},${BEAM_BOT + 34} ${x - 12},${BEAM_BOT + 40}`
                  } fill="#2563eb" />
                  <text x={x} y={BEAM_BOT + 64} textAnchor="middle" fontSize="9" fill={valColor(r.moment)} fontWeight="700">
                    {r.moment.toFixed(2)} {U.moment}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {pointLoads.map(p => {
          const x = toX(p.position);
          const len = loadArrowLen(p.magnitude);
          const rad = p.angle * Math.PI / 180;
          const dx = len * Math.sin(rad);
          const dy = len * Math.cos(rad);
          // Loads always shown above the beam
          // Downward: arrow from above beam pointing DOWN into beam
          // Upward: arrow from beam top pointing UP away from beam
          let tailX: number, tailY: number, tipX: number, tipY: number;
          if (p.direction === 'down') {
            tailX = x + dx;
            tailY = BEAM_TOP - dy;
            tipX = x;
            tipY = BEAM_TOP;
          } else {
            tailX = x;
            tailY = BEAM_TOP;
            tipX = x + dx;
            tipY = BEAM_TOP - dy;
          }
          return (
            <g key={p.id} opacity="0.25">
              <line x1={tailX} y1={tailY} x2={tipX} y2={tipY} stroke="#94a3b8" strokeWidth="2" />
            </g>
          );
        })}

        {distributedLoads.map(d => {
          const x1 = toX(d.startPos);
          const x2 = toX(d.endPos);
          const h1 = (d.startMag / normScale) * 40;
          const h2 = (d.endMag / normScale) * 40;
          const baseY = BEAM_TOP;
          const p1 = baseY - h1;
          const p2 = baseY - h2;
          return (
            <g key={d.id} opacity="0.15">
              <polygon points={`${x1},${baseY} ${x1},${p1} ${x2},${p2} ${x2},${baseY}`} fill="#94a3b8" stroke="#94a3b8" strokeWidth="1" />
              <text x={x1} y={p1 - 4} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="600" opacity="1">
                {d.startMag.toFixed(1)}
              </text>
              {Math.abs(d.endMag - d.startMag) > 1e-6 && (
                <text x={x2} y={p2 - 4} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="600" opacity="1">
                  {d.endMag.toFixed(1)}
                </text>
              )}
            </g>
          );
        })}

        <line x1={MARGIN_L} y1={BEAM_BOT + 52} x2={MARGIN_L + DRAW_W} y2={BEAM_BOT + 52} stroke="#cbd5e1" strokeWidth="0.5" />
        <text x={MARGIN_L + DRAW_W / 2} y={BEAM_BOT + 64} textAnchor="middle" fontSize="9" fill="#94a3b8">
          L = {beamLength.toFixed(2)} {U.length}
        </text>
      </svg>
    </div>
  );
}
