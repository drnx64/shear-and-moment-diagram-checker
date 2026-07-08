import { type JSX, useState } from 'react';
import type { DiagramPoint, LabeledPoint, UnitSystem } from '../types';
import { UNIT_SYSTEMS } from '../types';

interface Props {
  points: DiagramPoint[];
  maxShear: number;
  minShear: number;
  maxMoment: number;
  minMoment: number;
  beamLength: number;
  labeledPoints: LabeledPoint[];
  shearZeroCrossings: number[];
  unitSystem: UnitSystem;
}

function buildPath(points: DiagramPoint[], getY: (pt: DiagramPoint) => number, toX: (x: number) => number): string {
  if (points.length === 0) return '';
  return points.map((p, i) => {
    const px = toX(p.x);
    const py = getY(p);
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');
}

function buildFillPath(points: DiagramPoint[], getY: (pt: DiagramPoint) => number, toX: (x: number) => number, midY: number): string {
  if (points.length === 0) return '';
  let d = `M${toX(points[0].x).toFixed(1)},${midY.toFixed(1)}`;
  for (const p of points) {
    d += `L${toX(p.x).toFixed(1)},${getY(p).toFixed(1)}`;
  }
  d += `L${toX(points[points.length - 1].x).toFixed(1)},${midY.toFixed(1)}Z`;
  return d;
}

function valColor(val: number): string {
  if (val > 0.001) return '#16a34a';
  if (val < -0.001) return '#dc2626';
  return '#64748b';
}

function valColorClass(val: number): string {
  if (val > 0.001) return 'text-green-600';
  if (val < -0.001) return 'text-red-600';
  return 'text-slate-500';
}

export default function DiagramOutput({ points, maxShear, minShear, maxMoment, minMoment, beamLength, labeledPoints, shearZeroCrossings, unitSystem }: Props) {
  const U = UNIT_SYSTEMS[unitSystem];
  const W = 700, H = 220;
  const MARGIN = { top: 24, right: 24, bottom: 44, left: 64 };
  const DRAW_W = W - MARGIN.left - MARGIN.right;
  const DRAW_H = H - MARGIN.top - MARGIN.bottom;
  const MID_Y = MARGIN.top + DRAW_H / 2;

  const toX = (x: number) => MARGIN.left + (x / beamLength) * DRAW_W;

  function yScale(val: number, range: number): number {
    const clamped = Math.max(-range, Math.min(range, val));
    return MID_Y - (clamped / range) * (DRAW_H / 2);
  }

  const shearRange = Math.max(Math.abs(maxShear), Math.abs(minShear), 1);
  const momentRange = Math.max(Math.abs(maxMoment), Math.abs(minMoment), 1);

  const shearZeroAnnotations = shearZeroCrossings.map(pos => {
    return { px: toX(pos), py: yScale(0, shearRange), label: '', distance: pos };
  });

  const shearPath = buildPath(points, p => yScale(p.shear, shearRange), toX);
  const shearFillPath = buildFillPath(points, p => yScale(p.shear, shearRange), toX, MID_Y);
  const momentPath = buildPath(points, p => yScale(p.moment, momentRange), toX);
  const momentFillPath = buildFillPath(points, p => yScale(p.moment, momentRange), toX, MID_Y);

  function yGridLines(range: number, steps: number): JSX.Element[] {
    const lines: JSX.Element[] = [];
    for (let i = -steps; i <= steps; i++) {
      const val = (i / steps) * range;
      const y = yScale(val, range);
      const isZero = Math.abs(val) < 1e-8;
      lines.push(
        <g key={i}>
          <line x1={MARGIN.left} y1={y} x2={MARGIN.left + DRAW_W} y2={y}
            stroke={isZero ? '#cbd5e1' : '#f1f5f9'}
            strokeWidth={isZero ? '1.5' : '1'}
            strokeDasharray={isZero ? '4,3' : 'none'} />
          <text x={MARGIN.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
            {val.toFixed(1)}
          </text>
        </g>
      );
    }
    return lines;
  }

  const xTicks: JSX.Element[] = labeledPoints.map(pt => {
    const px = toX(pt.position);
    return (
      <g key={`xt-${pt.label}`}>
        <line x1={px} y1={MARGIN.top + DRAW_H} x2={px} y2={MARGIN.top + DRAW_H + 4} stroke="#94a3b8" strokeWidth="1" />
        <text x={px} y={MARGIN.top + DRAW_H + 14} textAnchor="middle" fontSize="11" fontWeight="600" fill="#475569" style={{ cursor: 'pointer' }}>
          {pt.label}<title>x = {pt.position.toFixed(2)}{U.length}</title>
        </text>
        <text x={px} y={MARGIN.top + DRAW_H + 26} textAnchor="middle" fontSize="8" fill="#94a3b8">
          {pt.position.toFixed(2)}{U.length}
        </text>
      </g>
    );
  });

  const critLines = labeledPoints.map(pt => {
    const px = toX(pt.position);
    return (
      <line key={`cl-${pt.label}`} x1={px} y1={MARGIN.top} x2={px} y2={MARGIN.top + DRAW_H}
        stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="3,3" />
    );
  });

  const Chart = ({ path, fillPath, color, fillColor, maxVal, minVal, range, label, unit, zeroAnnotations, valueKey }: {
    path: string; fillPath: string; color: string; fillColor: string;
    maxVal: number; minVal: number; range: number; label: string; unit: string;
    zeroAnnotations?: { px: number; py: number; label: string; distance: number }[];
    valueKey?: 'shear' | 'moment';
  }) => {
    const prefix = valueKey === 'shear' ? 'V' : 'M';
    const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
          <span className="text-xs font-semibold text-slate-700">{label}</span>
          <span className="text-[10px] text-slate-400">({unit})</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {yGridLines(range, 3)}
          {critLines}

          <line x1={MARGIN.left} y1={MID_Y} x2={MARGIN.left + DRAW_W} y2={MID_Y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,2" />
          <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + DRAW_H} stroke="#94a3b8" strokeWidth="1" />
          <line x1={MARGIN.left} y1={MID_Y} x2={MARGIN.left - 5} y2={MID_Y} stroke="#94a3b8" strokeWidth="1" />
          <line x1={MARGIN.left} y1={MARGIN.top + DRAW_H} x2={MARGIN.left + DRAW_W} y2={MARGIN.top + DRAW_H} stroke="#94a3b8" strokeWidth="1" />

          {xTicks}

          {fillPath && <path d={fillPath} fill={fillColor} />}
          {path && <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />}

          {valueKey && labeledPoints.map(pt => {
            const allAtPos = points.filter(p => Math.abs(p.x - pt.position) < 1e-8);
            if (allAtPos.length === 0) return null;
            const px = toX(pt.position);
            const seen = new Set<string>();
            const uniq = allAtPos.filter(dp => {
              const v = valueKey === 'shear' ? dp.shear : dp.moment;
              const key = `${Math.round(v * 10)}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            return (
              <g key={`pv-${pt.label}`}>
                {uniq.map((dp, i) => {
                  const v = valueKey === 'shear' ? dp.shear : dp.moment;
                  const dpy = yScale(v, range);
                  const side = uniq.length > 1 ? (i === 0 ? 'left' : 'right') : '';
                  const tipText = `${pt.label}${side ? ` (${side})` : ''}: ${prefix} = ${v.toFixed(2)} ${unit} @ x = ${pt.position.toFixed(2)}${U.length}`;
                  const labelY = uniq.length > 1 ? dpy + (i === 0 ? -10 : 12) : dpy - 6;
                  return (
                    <g key={i}>
                      <circle cx={px} cy={dpy} r="4" fill={color} stroke="white" strokeWidth="2" opacity="0.85"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={e => {
                          const r = (e.currentTarget as SVGCircleElement).getBoundingClientRect();
                          const c = (e.currentTarget as SVGCircleElement).closest('svg')!.getBoundingClientRect();
                          setTip({ text: tipText, x: r.left - c.left + 10, y: r.top - c.top - 8 });
                        }}
                        onMouseLeave={() => setTip(null)}
                      />
                      <text x={px + 8} y={labelY} textAnchor="start" fontSize="9"
                        fill={valColor(v)} fontWeight="700" opacity="0.9" style={{ cursor: 'pointer' }}>
                        {v.toFixed(1)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          <text x={MARGIN.left + DRAW_W / 2} y={MARGIN.top + DRAW_H + 38} textAnchor="middle" fontSize="8" fill="#94a3b8">
            Position ({U.length})
          </text>

          {zeroAnnotations?.map((z, i) => (
            <g key={`z${i}`}>
              <line x1={z.px} y1={z.py - 6} x2={z.px} y2={z.py + 6} stroke="#dc2626" strokeWidth="1.5" />
              <circle cx={z.px} cy={z.py} r="3" fill="#dc2626" />
              <text x={z.px + 6} y={z.py - 4} fontSize="9" fill="#dc2626" fontWeight="bold">
                x = {z.distance.toFixed(2)} {U.length} {z.label ? `from ${z.label}` : ''}
              </text>
            </g>
          ))}
        </svg>
        {tip && (
          <div
            className="pointer-events-none absolute z-50 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-white rounded-md shadow-lg"
            style={{
              left: tip.x, top: tip.y,
              background: 'rgba(30,41,59,0.92)',
              transform: 'translateY(-100%)',
              whiteSpace: 'nowrap',
            }}
          >
            {tip.text}
          </div>
        )}
        <div className="flex items-center gap-4 px-4 py-1.5 border-t border-slate-100 text-[10px]">
          <span>{prefix}<sub>max</sub> = <span className={`font-bold ${valColorClass(maxVal)}`}>{maxVal.toFixed(2)}</span> {unit}</span>
          <span>{prefix}<sub>min</sub> = <span className={`font-bold ${valColorClass(minVal)}`}>{minVal.toFixed(2)}</span> {unit}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Chart
        path={shearPath} fillPath={shearFillPath} color="#f87171" fillColor="rgba(248,113,113,0.08)"
        maxVal={maxShear} minVal={minShear}
        range={shearRange} label="Shear Diagram" unit={U.force}
        zeroAnnotations={shearZeroAnnotations}
        valueKey="shear"
      />
      <Chart
        path={momentPath} fillPath={momentFillPath} color="#60a5fa" fillColor="rgba(96,165,250,0.08)"
        maxVal={maxMoment} minVal={minMoment}
        range={momentRange} label="Moment Diagram" unit={U.moment}
        valueKey="moment"
      />
    </div>
  );
}
