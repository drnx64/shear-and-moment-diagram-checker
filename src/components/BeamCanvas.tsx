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

function supportLabel(sup: BeamSupport, index: number): string {
  if (sup.type === 'fixed') return 'Fixed Support';
  const side = index === 0 ? 'Left' : 'Right';
  return `${side} ${sup.type === 'pin' ? 'Pin' : 'Roller'}`;
}

export default function BeamCanvas({ beamLength, supports, pointLoads, moments, distributedLoads, labeledPoints, unitSystem }: Props) {
  const U = UNIT_SYSTEMS[unitSystem];
  const W = 700, H = 280;
  const MARGIN_L = 60, MARGIN_R = 60;
  const DRAW_W = W - MARGIN_L - MARGIN_R;
  const BEAM_Y = 140;
  const BEAM_H = 8;
  const BEAM_TOP = BEAM_Y - BEAM_H / 2;
  const BEAM_BOT = BEAM_Y + BEAM_H / 2;
  const DIM_Y = BEAM_Y + 60;

  const toX = (x: number) => MARGIN_L + (x / beamLength) * DRAW_W;

  const normScale = useMemo(() => {
    let scale = 1;
    for (const p of pointLoads) if (p.magnitude > scale) scale = p.magnitude;
    for (const d of distributedLoads) {
      if (d.startMag > scale) scale = d.startMag;
      if (d.endMag > scale) scale = d.endMag;
    }
    return scale;
  }, [pointLoads, distributedLoads]);

  const arrowLength = (mag: number) => Math.max(20, Math.min(60, 20 + (mag / normScale) * 40));

  const pointCaseColors: Record<string, string> = {
    dead: '#f59e0b', live: '#3b82f6', wind: '#8b5cf6',
    roof: '#14b8a6', rain: '#06b6d4', snow: '#6366f1', earthquake: '#ef4444',
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="pt-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <polygon points="0 0, 0 10, 10 5" fill="#f59e0b" />
          </marker>
          <marker id="dist-arrow-up" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <polygon points="0 0, 0 10, 10 5" fill="#14b8a6" />
          </marker>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#475569" strokeWidth="1.2" />
          </pattern>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>

        <rect x={MARGIN_L} y={BEAM_TOP} width={DRAW_W} height={BEAM_H} rx="3" fill="url(#beamGrad)" />

        {supports.map(s => {
          const x = toX(s.position);
          switch (s.type) {
            case 'fixed': {
              const drawRight = s.position < beamLength / 2;
              const rx = drawRight ? x + 1 : x - BEAM_H;
              return (
                <g key={s.id}>
                  <rect x={rx} y={BEAM_TOP - 4} width={BEAM_H} height={BEAM_H + 8} fill="url(#hatch)" stroke="#475569" strokeWidth="1" />
                  <line x1={x} y1={BEAM_BOT} x2={x} y2={BEAM_BOT + 14} stroke="#64748b" strokeWidth="1.5" />
                </g>
              );
            }
            case 'pin': {
              const tipY = BEAM_BOT + 4;
              const baseY = tipY + 16;
              return (
                <g key={s.id}>
                  <line x1={x} y1={BEAM_BOT} x2={x} y2={tipY + 2} stroke="#64748b" strokeWidth="1.5" />
                  <polygon points={`${x - 10},${baseY} ${x + 10},${baseY} ${x},${tipY}`} fill="#475569" stroke="#334155" strokeWidth="1" />
                  <circle cx={x} cy={tipY} r="2.5" fill="#fbbf24" />
                </g>
              );
            }
            case 'roller': {
              const tipY = BEAM_BOT + 4;
              const baseY = tipY + 12;
              return (
                <g key={s.id}>
                  <line x1={x} y1={BEAM_BOT} x2={x} y2={tipY + 2} stroke="#64748b" strokeWidth="1.5" />
                  <polygon points={`${x - 9},${baseY} ${x + 9},${baseY} ${x},${tipY}`} fill="none" stroke="#64748b" strokeWidth="1.5" />
                  <circle cx={x - 6} cy={baseY + 5} r="3.5" fill="none" stroke="#64748b" strokeWidth="1.2" />
                  <circle cx={x + 6} cy={baseY + 5} r="3.5" fill="none" stroke="#64748b" strokeWidth="1.2" />
                </g>
              );
            }
          }
        })}

        {distributedLoads.map(d => {
          const x1 = toX(d.startPos);
          const x2 = toX(d.endPos);
          const h1 = (d.startMag / normScale) * 50;
          const h2 = (d.endMag / normScale) * 50;
          const dir = 1;
          const baseY = BEAM_TOP;
          const p1 = baseY - h1 * dir;
          const p2 = baseY - h2 * dir;
          const fillColor = 'rgba(20, 184, 166, 0.18)';
          return (
            <g key={d.id}>
              <polygon points={`${x1},${baseY} ${x1},${p1} ${x2},${p2} ${x2},${baseY}`} fill={fillColor} stroke="#14b8a6" strokeWidth="1.5" />
              {Array.from({ length: 5 }, (_, i) => {
                const t = (i + 1) / 6;
                const px = x1 + (x2 - x1) * t;
                const ph = h1 + (h2 - h1) * t;
                const arrowTop = baseY - ph;
                const arrowBot = baseY - 4;
                return (
                  <line key={i} x1={px} y1={arrowTop} x2={px} y2={arrowBot} stroke="#14b8a6" strokeWidth="1" opacity="0.7" markerEnd="url(#dist-arrow-up)" />
                );
              })}
            </g>
          );
        })}

        {pointLoads.map(p => {
          const x = toX(p.position);
          const len = arrowLength(p.magnitude);
          const rad = p.angle * Math.PI / 180;
          const dx = len * Math.sin(rad);
          const dy = len * Math.cos(rad);
          const dir = p.direction === 'down' ? 1 : -1;
          const tipX = x + dx;
          const tipY = BEAM_TOP + dir * dy;
          const tailX = x;
          const tailY = BEAM_TOP;
          const loadColor = pointCaseColors[p.loadCase] || '#f59e0b';

          return (
            <g key={p.id}>
              <line x1={tailX} y1={tailY} x2={tipX} y2={tipY} stroke={loadColor} strokeWidth="2.5" markerEnd="url(#pt-arrow)" />
              <text x={tipX + 6} y={tipY + 4} fontSize="10" fill={loadColor} fontWeight="600">
                {p.magnitude.toFixed(1)} {U.force}
              </text>
            </g>
          );
        })}

        {moments.map(m => {
          const x = toX(m.position);
          const r = 16;
          const sweepFlag = m.direction === 'CW' ? 1 : 0;
          return (
            <g key={m.id}>
              <path d={`M ${x - r},${BEAM_TOP - 16} A ${r},${r * 0.5} 0 0,${sweepFlag} ${x + r},${BEAM_TOP - 16}`}
                fill="none" stroke="#a855f7" strokeWidth="1.5" />
              <polygon points={
                m.direction === 'CW'
                  ? `${x + r - 3},${BEAM_TOP - 19} ${x + r + 5},${BEAM_TOP - 16} ${x + r - 3},${BEAM_TOP - 13}`
                  : `${x - r + 3},${BEAM_TOP - 19} ${x - r - 5},${BEAM_TOP - 16} ${x - r + 3},${BEAM_TOP - 13}`
              } fill="#a855f7" />
              <text x={x} y={BEAM_TOP - 28} textAnchor="middle" fontSize="9" fill="#a855f7" fontWeight="600">
                M = {m.magnitude.toFixed(1)} {U.moment}
              </text>
            </g>
          );
        })}

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

        {labeledPoints.length > 1 && (
          <g>
            <line x1={toX(labeledPoints[0].position)} y1={DIM_Y} x2={toX(labeledPoints[labeledPoints.length - 1].position)} y2={DIM_Y} stroke="#94a3b8" strokeWidth="0.5" />
            {labeledPoints.map((pt, i) => {
              const x = toX(pt.position);
              return (
                <line key={i} x1={x} y1={DIM_Y - 3} x2={x} y2={DIM_Y + 3} stroke="#94a3b8" strokeWidth="0.5" />
              );
            })}
            {labeledPoints.slice(0, -1).map((pt, i) => {
              const next = labeledPoints[i + 1];
              const x1 = toX(pt.position);
              const x2 = toX(next.position);
              const mid = (x1 + x2) / 2;
              const dist = next.position - pt.position;
              return (
                <text key={i} x={mid} y={DIM_Y + 14} textAnchor="middle" fontSize="8" fill="#94a3b8">
                  {dist.toFixed(2)} {U.length}
                </text>
              );
            })}
          </g>
        )}

        {supports.map((s, i) => {
          const x = toX(s.position);
          return (
            <text key={`sl-${s.id}`} x={x} y={BEAM_BOT + 38} textAnchor="middle" fontSize="8" fill="#64748b">
              {supportLabel(s, i)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
