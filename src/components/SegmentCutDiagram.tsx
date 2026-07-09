import type { BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad, Reaction, SegmentInfo, LabeledPoint } from '../types';
import { fmtNum } from '../types';

interface Props {
  segment: SegmentInfo;
  beamLength: number;
  supports: BeamSupport[];
  reactions: Reaction[];
  pointLoads: PointLoad[];
  moments: ConcentratedMoment[];
  distributedLoads: DistributedLoad[];
  labeledPoints: LabeledPoint[];
  segLabel: string;
}

export default function SegmentCutDiagram({
  segment, beamLength: _beamLength, supports, reactions, pointLoads, moments, distributedLoads, labeledPoints, segLabel,
}: Props) {
  const W = 190, H = 120;
  const MARGIN_L = 15, MARGIN_R = 15;
  const DRAW_W = W - MARGIN_L - MARGIN_R;
  const BEAM_Y = 42;
  const TEXT_Y = 100;


  const visCutRatio = 0.65;
  const cutPos = segment.start + visCutRatio * (segment.end - segment.start);

  const viewLen = cutPos || 1;
  const toX = (x: number) => MARGIN_L + (x / viewLen) * DRAW_W;
  const cutVisX = toX(cutPos);

  const safePointLoads = pointLoads ?? [];
  const safeReactions = reactions ?? [];
  const safeSupports = supports ?? [];
  const safeMoments = moments ?? [];
  const safeDistLoads = distributedLoads ?? [];
  const safeLabeledPoints = labeledPoints ?? [];

  const maxMag = (() => {
    let m = 1;
    for (const r of safeReactions) if (Math.abs(r.vertical) > m) m = Math.abs(r.vertical);
    for (const p of safePointLoads) if (Math.abs(p.magnitude) > m) m = Math.abs(p.magnitude);
    return m;
  })();

  const arrowLen = (mag: number) => Math.max(10, Math.min(28, 8 + (Math.abs(mag) / maxMag) * 20));

  const isLeftOfCut = (pos: number) => pos < cutPos - 1e-10;

  const validReactions = safeReactions.filter(r => {
    const sup = safeSupports.find(s => s.id === r.supportId);
    return sup && isLeftOfCut(sup.position);
  });

  const validPointLoads = safePointLoads.filter(p => isLeftOfCut(p.position));

  const validMoments = safeMoments.filter(m => isLeftOfCut(m.position));

  const validDistLoads = safeDistLoads.filter(d => d.startPos < cutPos - 1e-10);

  const pointCaseColors: Record<string, string> = {
    dead: '#f59e0b', live: '#3b82f6', wind: '#8b5cf6',
    roof: '#14b8a6', rain: '#06b6d4', snow: '#6366f1', earthquake: '#ef4444',
  };

  const markerId = `seg-cut-${segLabel.replace('→', '-')}`;

  const leftPoints = safeLabeledPoints
    .filter(p => p.position <= cutPos + 1e-10)
    .sort((a, b) => a.position - b.position);

  const nearestLeftIdx = leftPoints.length - 1;

  const dimLines: { x1: number; x2: number; midX: number; label: string; color: string }[] = [];
  for (let i = 0; i < leftPoints.length - 1; i++) {
    const p = leftPoints[i];
    const next = leftPoints[i + 1];
    const x1 = toX(p.position);
    const x2 = toX(next.position);
    const midX = (x1 + x2) / 2;
    const dist = next.position - p.position;
    dimLines.push({
      x1, x2, midX,
      label: fmtNum(dist),
      color: '#94a3b8',
    });
  }
  if (nearestLeftIdx >= 0) {
    const lastPt = leftPoints[nearestLeftIdx];
    const x1 = toX(lastPt.position);
    const x2 = cutVisX;
    if (x2 - x1 > 5) {
      dimLines.push({
        x1, x2,
        midX: (x1 + x2) / 2,
        label: 'x',
        color: '#dc2626',
      });
    }
  }

  const zeroX = toX(0);
  const beamEndX = toX(viewLen);

  function SupportIcon({ type, x }: { type: string; x: number }) {
    switch (type) {
      case 'fixed':
        return (
          <g>
            <rect x={x - 4} y={BEAM_Y - 6} width={8} height={12} fill="url(#hatch)" stroke="#475569" strokeWidth="0.8" />
          </g>
        );
      case 'pin': {
        const tipY = BEAM_Y + 4;
        const baseY = tipY + 10;
        return (
          <g>
            <polygon points={`${x - 6},${baseY} ${x + 6},${baseY} ${x},${tipY}`} fill="#475569" stroke="#334155" strokeWidth="0.8" />
            <circle cx={x} cy={tipY} r="2" fill="#fbbf24" />
          </g>
        );
      }
      case 'roller': {
        const tipY = BEAM_Y + 4;
        const baseY = tipY + 8;
        return (
          <g>
            <polygon points={`${x - 6},${baseY} ${x + 6},${baseY} ${x},${tipY}`} fill="none" stroke="#64748b" strokeWidth="0.8" />
            <circle cx={x - 4} cy={baseY + 4} r="2.5" fill="none" stroke="#64748b" strokeWidth="0.8" />
            <circle cx={x + 4} cy={baseY + 4} r="2.5" fill="none" stroke="#64748b" strokeWidth="0.8" />
          </g>
        );
      }
      default:
        return null;
    }
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-label={`Cut diagram for segment ${segLabel}`}>
      <defs>
        <marker id={`cut-arrow-${markerId}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <polygon points="0 0, 0 10, 10 5" fill="#64748b" />
        </marker>
        <pattern id={`hatch-${markerId}`} patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="3" stroke="#475569" strokeWidth="0.8" />
        </pattern>
      </defs>

      {/* Beam background */}
      <rect x={zeroX} y={BEAM_Y - 6} width={beamEndX - zeroX} height={12} rx="2" fill="rgba(99, 102, 241, 0.15)" />

      {/* Beam line */}
      <line x1={zeroX} y1={BEAM_Y} x2={beamEndX} y2={BEAM_Y} stroke="#64748b" strokeWidth="3" strokeLinecap="round" />

      {/* Support symbols */}
      {safeSupports.map(s => {
        if (!isLeftOfCut(s.position)) return null;
        return <SupportIcon key={s.id} type={s.type} x={toX(s.position)} />;
      })}

      {/* Cut line */}
      <line x1={cutVisX} y1={BEAM_Y - 24} x2={cutVisX} y2={BEAM_Y + 20} stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3,2" />

      {/* V arrow at cut — DOWNWARD */}
      <line x1={cutVisX} y1={BEAM_Y} x2={cutVisX} y2={BEAM_Y + 16} stroke="#dc2626" strokeWidth="1.5" markerEnd={`url(#cut-arrow-${markerId})`} />
      <text x={cutVisX + 8} y={BEAM_Y + 14} fontSize="8" fill="#dc2626" fontWeight="700">V</text>

      {/* M arc at cut — CCW */}
      <path d={`M ${cutVisX + 10} ${BEAM_Y + 12} Q ${cutVisX} ${BEAM_Y + 22} ${cutVisX - 10} ${BEAM_Y + 12}`}
        fill="none" stroke="#2563eb" strokeWidth="1.5" />
      <polygon points={`${cutVisX - 8},${BEAM_Y + 10} ${cutVisX - 13},${BEAM_Y + 12} ${cutVisX - 8},${BEAM_Y + 14}`} fill="#2563eb" />
      <text x={cutVisX - 14} y={BEAM_Y + 12} fontSize="8" fill="#2563eb" fontWeight="700" textAnchor="end">M</text>

      {/* Point labels on beam */}
      {leftPoints.map(pt => {
        const x = toX(pt.position);
        return (
          <g key={pt.label}>
            <circle cx={x} cy={BEAM_Y} r="2.5" fill="#1e293b" />
            <text x={x} y={BEAM_Y - 10} textAnchor="middle" fontSize="7" fontWeight="600" fill="#1e293b">{pt.label}</text>
          </g>
        );
      })}

      {/* Reactions (below beam) */}
      {validReactions.map(r => {
        const sup = supports.find(s => s.id === r.supportId);
        if (!sup || Math.abs(r.vertical) < 1e-6) return null;
        const x = toX(sup.position);
        const len = arrowLen(r.vertical);
        const tipY = BEAM_Y + 2;
        const tailY = tipY + len;
        const valLabel = `${fmtNum(r.vertical)}`;
        return (
          <g key={r.id}>
            <line x1={x} y1={tailY} x2={x} y2={tipY} stroke="#2563eb" strokeWidth="1.5" markerEnd={`url(#cut-arrow-${markerId})`} />
            <text x={x + 5} y={tailY + 4} fontSize="6" fill="#2563eb" fontWeight="600">{valLabel}</text>
          </g>
        );
      })}

      {/* Point loads (above beam) */}
      {validPointLoads.map(p => {
        const x = toX(p.position);
        const len = arrowLen(p.magnitude);
        const dir = p.direction === 'down' ? 1 : -1;
        const tipY = BEAM_Y - 2;
        const tailY = tipY - dir * len;
        const color = pointCaseColors[p.loadCase] || '#f59e0b';
        const valLabel = `${fmtNum(p.magnitude)}`;
        return (
          <g key={p.id}>
            <line x1={x} y1={tailY} x2={x} y2={tipY} stroke={color} strokeWidth="1.5" markerEnd={`url(#cut-arrow-${markerId})`} />
            <text x={x + 5} y={tailY - 2} fontSize="6" fill={color} fontWeight="600">{valLabel}</text>
          </g>
        );
      })}

      {/* Moments */}
      {validMoments.map(m => {
        const x = toX(m.position);
        const sweepFlag = m.direction === 'CW' ? 1 : 0;
        const valLabel = `${fmtNum(m.magnitude)}`;
        return (
          <g key={m.id}>
            <path d={`M ${x - 7},${BEAM_Y - 11} A ${7},${3.5} 0 0,${sweepFlag} ${x + 7},${BEAM_Y - 11}`}
              fill="none" stroke="#a855f7" strokeWidth="1.2" />
            <polygon points={
              m.direction === 'CW'
                ? `${x + 4},${BEAM_Y - 13} ${x + 9},${BEAM_Y - 11} ${x + 4},${BEAM_Y - 9}`
                : `${x - 4},${BEAM_Y - 13} ${x - 9},${BEAM_Y - 11} ${x - 4},${BEAM_Y - 9}`
            } fill="#a855f7" />
            <text x={x} y={BEAM_Y - 17} fontSize="6" fill="#a855f7" fontWeight="600" textAnchor="middle">{valLabel}</text>
          </g>
        );
      })}

      {/* Distributed loads — with ratio & proportion diagram */}
      {validDistLoads.map(d => {
        const xLoadStart = toX(Math.max(d.startPos, 0));
        const xLoadEnd = toX(Math.min(d.endPos, cutPos));
        const normScale = maxMag;
        const hStart = (d.startMag / normScale) * 22;
        const hCut = (d.startMag + (d.endMag - d.startMag) * (cutPos - d.startPos) / (d.endPos - d.startPos || 1)) / normScale * 22;
        const baseY = BEAM_Y - 2;

        const pStart = baseY - hStart;
        const pCut = baseY - hCut;

        // The portion of the load from cut to load end (beyond beam) shown dashed
        const showFull = d.endPos > cutPos;
        const xFullEnd = toX(Math.min(d.endPos, segment.end));
        const pFullEnd = baseY - (d.endMag / normScale) * 22;

        if (xLoadEnd <= xLoadStart) return null;

        // Find the actual local x distance from load start to cut
        const xLocalDist = cutPos - Math.max(d.startPos, segment.start);

        return (
          <g key={d.id}>
            {showFull && (
              <>
                {/* Dashed outline of the full load shape past the cut */}
                <polygon points={`${xLoadStart},${baseY} ${xLoadStart},${pStart} ${xFullEnd},${pFullEnd} ${xFullEnd},${baseY}`}
                  fill="none" stroke="#14b8a6" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.4" />
                {/* Label at the end */}
                <text x={xFullEnd} y={pFullEnd - 3} textAnchor="end" fontSize="5" fill="#14b8a6" opacity="0.6">{fmtNum(d.endMag)}</text>
              </>
            )}
            {/* Filled portion up to cut */}
            <polygon points={`${xLoadStart},${baseY} ${xLoadStart},${pStart} ${xLoadEnd},${pCut} ${xLoadEnd},${baseY}`}
              fill="rgba(20, 184, 166, 0.18)" stroke="#14b8a6" strokeWidth="1" />
            {/* Arrows for the filled portion */}
            {Array.from({ length: 3 }, (_, i) => {
              const t = (i + 1) / 4;
              const px = xLoadStart + (xLoadEnd - xLoadStart) * t;
              const ph = hStart + (hCut - hStart) * t;
              if (px >= cutVisX - 1) return null;
              return (
                <line key={i} x1={px} y1={baseY - ph} x2={px} y2={baseY - 2} stroke="#14b8a6" strokeWidth="0.8" opacity="0.7" markerEnd={`url(#cut-arrow-${markerId})`} />
              );
            })}
            {/* Load intensity labels at start and at cut */}
            <text x={xLoadStart} y={pStart - 3} textAnchor="start" fontSize="5" fill="#0d9488" fontWeight="600">{fmtNum(d.startMag)}</text>
            {showFull && (
              <>
                {/* y label at cut on the load */}
                <line x1={cutVisX + 3} y1={pCut} x2={cutVisX + 16} y2={pCut - 6} stroke="#14b8a6" strokeWidth="0.6" />
                <text x={cutVisX + 17} y={pCut - 6} fontSize="6" fill="#14b8a6" fontWeight="700" textAnchor="start">y</text>
                {/* Proportion annotation: y/x = w2/L or (y-w1)/xSlope = (w2-w1)/L */}
                <text x={cutVisX + 17} y={pCut - 0} fontSize="5" fill="#14b8a6" textAnchor="start" opacity="0.85">
                  {`y ${xLocalDist > 0 ? `= ${fmtNum(Math.round(d.startMag + (d.endMag - d.startMag) * xLocalDist / (d.endPos - Math.max(d.startPos, segment.start)) * 100) / 100)}` : ''}`}
                </text>
                <text x={cutVisX + 17} y={pCut + 7} fontSize="4" fill="#14b8a6" textAnchor="start" opacity="0.7">
                  {`(y-${fmtNum(d.startMag)})/${fmtNum(xLocalDist > 0 ? xLocalDist : 0)} = (${fmtNum(d.endMag)}-${fmtNum(d.startMag)})/${fmtNum(Math.round((d.endPos - Math.max(d.startPos, segment.start)) * 10) / 10)}`}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* Dimension lines */}
      <line x1={zeroX} y1={TEXT_Y} x2={cutVisX} y2={TEXT_Y} stroke="#cbd5e1" strokeWidth="0.5" />
      {dimLines.map((d, i) => {
        const isX = d.label === 'x';
        return (
          <g key={i}>
            {isX ? (
              <>
                <line x1={d.x2} y1={TEXT_Y} x2={d.x1 + 3} y2={TEXT_Y} stroke={d.color} strokeWidth="1" />
                <polygon points={`${d.x1},${TEXT_Y} ${d.x1 + 5},${TEXT_Y - 3} ${d.x1 + 5},${TEXT_Y + 3}`} fill={d.color} />
                <text x={(d.x1 + d.x2) / 2} y={TEXT_Y - 4} textAnchor="middle" fontSize="7" fill={d.color} fontWeight="700">x</text>
              </>
            ) : (
              <>
                <line x1={d.x1} y1={TEXT_Y - 2} x2={d.x1} y2={TEXT_Y + 2} stroke={d.color} strokeWidth="0.5" />
                <line x1={d.x2} y1={TEXT_Y - 2} x2={d.x2} y2={TEXT_Y + 2} stroke={d.color} strokeWidth="0.5" />
                <text x={d.midX} y={TEXT_Y + 10} textAnchor="middle" fontSize="7" fill={d.color} fontWeight="500">{d.label}</text>
              </>
            )}
          </g>
        );
      })}

      {/* Segment label above beam */}
      <text x={cutVisX / 2} y={BEAM_Y - 28} textAnchor="middle" fontSize="7" fill="#6366f1" fontWeight="600">
        {segLabel}
      </text>
    </svg>
  );
}
