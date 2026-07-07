import type { JSX } from 'react';
import type { DiagramPoint, UnitSystem } from '../types';
import { UNIT_SYSTEMS } from '../types';

interface Props {
  points: DiagramPoint[];
  maxShear: number;
  minShear: number;
  maxMoment: number;
  minMoment: number;
  beamLength: number;
  criticalPositions: number[];
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

export default function DiagramOutput({ points, maxShear, minShear, maxMoment, minMoment, beamLength, criticalPositions, unitSystem }: Props) {
  const U = UNIT_SYSTEMS[unitSystem];
  const W = 700, H = 200;
  const MARGIN = { top: 20, right: 20, bottom: 40, left: 60 };
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

  const shearPath = buildPath(points, p => yScale(p.shear, shearRange), toX);
  const shearFillPath = buildFillPath(points, p => yScale(p.shear, shearRange), toX, MID_Y);
  const momentPath = buildPath(points, p => yScale(p.moment, momentRange), toX);
  const momentFillPath = buildFillPath(points, p => yScale(p.moment, momentRange), toX, MID_Y);

  function findExtreme(selector: (p: DiagramPoint) => number, cmp: (a: number, b: number) => boolean): DiagramPoint | null {
    let best: DiagramPoint | null = null;
    let bestVal = 0;
    for (const p of points) {
      const v = selector(p);
      if (!best || cmp(v, bestVal)) { best = p; bestVal = v; }
    }
    return best;
  }

  const maxSPt = findExtreme(p => p.shear, (a, b) => a > b);
  const minSPt = findExtreme(p => p.shear, (a, b) => a < b);
  const maxMPt = findExtreme(p => p.moment, (a, b) => a > b);
  const minMPt = findExtreme(p => p.moment, (a, b) => a < b);

  const axisTickX = (x: number) => {
    const px = toX(x);
    return (
      <g key={x}>
        <line x1={px} y1={MARGIN.top + DRAW_H} x2={px} y2={MARGIN.top + DRAW_H + 5} stroke="#94a3b8" strokeWidth="1" />
        <text x={px} y={MARGIN.top + DRAW_H + 16} textAnchor="middle" fontSize="9" fill="#64748b">
          {x.toFixed(1)}
        </text>
      </g>
    );
  };

  function yGridLines(range: number, steps: number): JSX.Element[] {
    const lines: JSX.Element[] = [];
    for (let i = -steps; i <= steps; i++) {
      const val = (i / steps) * range;
      const y = yScale(val, range);
      lines.push(
        <g key={i}>
          <line x1={MARGIN.left} y1={y} x2={MARGIN.left + DRAW_W} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
          <text x={MARGIN.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
            {val.toFixed(1)}
          </text>
        </g>
      );
    }
    return lines;
  }

  const xTicks: JSX.Element[] = [];
  const numXTicks = Math.min(6, Math.ceil(beamLength / 2));
  const xStep = beamLength / numXTicks;
  for (let i = 0; i <= numXTicks; i++) {
    xTicks.push(axisTickX(i * xStep));
  }

  const critLines = criticalPositions.map(pos => {
    const px = toX(pos);
    return (
      <line key={`cl-${pos}`} x1={px} y1={MARGIN.top} x2={px} y2={MARGIN.top + DRAW_H}
        stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3,3" />
    );
  });

  const Chart = ({ path, fillPath, color, fillColor, maxPt, minPt, maxVal, minVal, range, label, unit }: {
    path: string; fillPath: string; color: string; fillColor: string;
    maxPt: DiagramPoint | null; minPt: DiagramPoint | null;
    maxVal: number; minVal: number; range: number; label: string; unit: string;
  }) => (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-white rounded-lg border border-slate-200 shadow-sm" preserveAspectRatio="xMidYMid meet">
      {yGridLines(range, 3)}
      {critLines}

      <line x1={MARGIN.left} y1={MID_Y} x2={MARGIN.left + DRAW_W} y2={MID_Y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,2" />
      <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + DRAW_H} stroke="#94a3b8" strokeWidth="1" />
      <line x1={MARGIN.left} y1={MID_Y} x2={MARGIN.left - 5} y2={MID_Y} stroke="#94a3b8" strokeWidth="1" />
      <line x1={MARGIN.left} y1={MARGIN.top + DRAW_H} x2={MARGIN.left + DRAW_W} y2={MARGIN.top + DRAW_H} stroke="#94a3b8" strokeWidth="1" />

      {xTicks}

      {fillPath && <path d={fillPath} fill={fillColor} />}
      {path && <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />}

      {maxPt && (
        <g>
          <circle cx={toX(maxPt.x)} cy={yScale(maxVal, range)} r="4" fill={color} stroke="#18181b" strokeWidth="1.5" />
          <text x={toX(maxPt.x) + 6} y={yScale(maxVal, range) - 4} fontSize="9" fill={color} fontWeight="bold">
            Max: {maxVal.toFixed(1)}
          </text>
        </g>
      )}
      {minPt && (
        <g>
          <circle cx={toX(minPt.x)} cy={yScale(minVal, range)} r="4" fill={color} stroke="#18181b" strokeWidth="1.5" />
          <text x={toX(minPt.x) + 6} y={yScale(minVal, range) - 4} fontSize="9" fill={color} fontWeight="bold">
            Min: {minVal.toFixed(1)}
          </text>
        </g>
      )}

      <text x={MARGIN.left + DRAW_W / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">
        {label} Diagram
      </text>
      <text x={8} y={MID_Y + 4} fontSize="9" fill="#94a3b8" textAnchor="start">
        ({unit})
      </text>
      <text x={MARGIN.left + DRAW_W / 2} y={MARGIN.top + DRAW_H + 28} textAnchor="middle" fontSize="9" fill="#94a3b8">
        Position ({U.length})
      </text>
    </svg>
  );

  return (
    <div className="space-y-2">
      <Chart
        path={shearPath} fillPath={shearFillPath} color="#f87171" fillColor="rgba(248,113,113,0.08)"
        maxPt={maxSPt} minPt={minSPt}
        maxVal={maxShear} minVal={minShear}
        range={shearRange} label="Shear Force" unit={U.force}
      />
      <Chart
        path={momentPath} fillPath={momentFillPath} color="#60a5fa" fillColor="rgba(96,165,250,0.08)"
        maxPt={maxMPt} minPt={minMPt}
        maxVal={maxMoment} minVal={minMoment}
        range={momentRange} label="Bending Moment" unit={U.moment}
      />
    </div>
  );
}
