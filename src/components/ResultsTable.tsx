import LatexFormula from './LatexFormula';
import SegmentCutDiagram from './SegmentCutDiagram';
import ShearMomentIcon from './ShearMomentIcon';
import type { SegmentInfo, Reaction, BeamSupport, UnitSystem, ReactionDerivationStep, PointLoad, ConcentratedMoment, DistributedLoad, LabeledPoint } from '../types';
import { UNIT_SYSTEMS, fmtNum } from '../types';

interface Props {
  segments: SegmentInfo[];
  reactions: Reaction[];
  supports: BeamSupport[];
  unitSystem: UnitSystem;
  maxShear: number;
  minShear: number;
  maxMoment: number;
  minMoment: number;
  reactionDerivation: ReactionDerivationStep[];
  beamLength: number;
  pointLoads: PointLoad[];
  moments: ConcentratedMoment[];
  distributedLoads: DistributedLoad[];
  labeledPoints: LabeledPoint[];
}

function supportLabel(sup: BeamSupport, index: number): string {
  if (sup.type === 'fixed') return 'Fixed Support';
  const side = index === 0 ? 'Left' : 'Right';
  return `${side} ${sup.type === 'pin' ? 'Pin' : 'Roller'}`;
}

function valColorClass(val: number): string {
  if (val > 0.001) return 'text-green-600';
  if (val < -0.001) return 'text-red-600';
  return 'text-slate-500';
}

export default function ResultsTable({ segments, reactions, supports, unitSystem, maxShear, minShear, maxMoment, minMoment, reactionDerivation = [], beamLength = 0, pointLoads = [], moments = [], distributedLoads = [], labeledPoints = [] }: Props) {
  const U = UNIT_SYSTEMS[unitSystem];

  if (segments.length === 0 && reactions.length === 0) {
    return (
      <div className="text-slate-400 text-sm text-center py-4">
        Add a beam configuration to see results
      </div>
    );
  }

  const thCls = "px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200";
  const tdCls = "px-3 py-2 text-xs align-top";

  return (
    <div className="space-y-4">
      {reactionDerivation.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Reaction Solution</h3>
          <div className="space-y-1.5">
            {reactionDerivation.map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="text-[10px] font-medium text-slate-400 uppercase w-24 shrink-0 pt-0.5">{step.label}</span>
                <div className="font-mono text-slate-700">
                  <LatexFormula formula={step.equation} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reactions.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Support Reactions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className={thCls}>Support</th>
                  <th className={thCls}>Type</th>
                  <th className={`${thCls} text-right`}>Position ({U.length})</th>
                  <th className={`${thCls} text-right`}>Vertical ({U.force})</th>
                  <th className={`${thCls} text-right`}>Horizontal ({U.force})</th>
                  <th className={`${thCls} text-right`}>Moment ({U.moment})</th>
                </tr>
              </thead>
              <tbody>
                {reactions.map((r, i) => {
                  const sup = supports.find(s => s.id === r.supportId);
                  if (!sup) return null;
                  const hasHoriz = sup.type === 'pin' || sup.type === 'fixed';
                  const hasMoment = sup.type === 'fixed';
                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className={tdCls + " text-slate-700 font-medium"}>{supportLabel(sup, i)}</td>
                      <td className={tdCls + " text-slate-500 capitalize"}>{sup.type}</td>
                      <td className={`${tdCls} text-right text-slate-500`}>{fmtNum(sup.position)}</td>
                      <td className={`${tdCls} text-right font-mono font-medium ${valColorClass(r.vertical)}`}>{fmtNum(r.vertical)}</td>
                      <td className={`${tdCls} text-right font-mono font-medium ${hasHoriz ? valColorClass(r.horizontal) : 'text-slate-300'}`}>
                        {hasHoriz ? fmtNum(r.horizontal) : '—'}
                      </td>
                      <td className={`${tdCls} text-right font-mono font-medium ${hasMoment ? valColorClass(r.moment) : 'text-slate-300'}`}>
                        {hasMoment ? fmtNum(r.moment) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {segments.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Segment Equations (Equilibrium Method)</h3>
          <div className="space-y-3">
              {segments.map((seg, i) => {
                const segName = `${String.fromCharCode(65 + i)} → ${String.fromCharCode(66 + i)}`;
                return (
                  <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">{segName}</span>
                        <span className="text-[10px] text-slate-400">({fmtNum(seg.start)} → {fmtNum(seg.end)} {U.length})</span>
                      </div>
                      <ShearMomentIcon />
                    </div>
                    <div className="p-3 flex gap-3">
                      <SegmentCutDiagram
                        segment={seg}
                        beamLength={beamLength}
                        supports={supports}
                        reactions={reactions}
                        pointLoads={pointLoads}
                        moments={moments}
                        distributedLoads={distributedLoads}
                        labeledPoints={labeledPoints}
                        segLabel={segName}
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Ratio & Proportion */}
                        {seg.derivation?.ratioProportion && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-1.5">
                            <div className="text-[9px] text-amber-700 font-semibold">Ratio &amp; Proportion</div>
                            <div className="font-mono text-[10px] text-amber-600">
                              <LatexFormula formula={seg.derivation.ratioProportion} />
                            </div>
                          </div>
                        )}
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-2">
                          <div className="text-[10px] text-orange-700 font-semibold mb-1 flex items-center gap-1">
                            <span>Shear</span>
                            <span className="text-[9px] font-normal text-orange-500">ΣF<sub>y</sub> = 0 (↑+)</span>
                          </div>
                          {seg.derivation ? (
                            <div className="space-y-0.5">
                              {/* Geometric initial equation */}
                              {seg.derivation.shear.geometricEquation && (
                                <div className="font-mono text-[10px] text-orange-500/70">
                                  <LatexFormula formula={seg.derivation.shear.geometricEquation} />
                                </div>
                              )}
                              {/* Simplified result */}
                              <div className="font-mono text-xs font-semibold bg-white rounded px-2 py-0.5 border border-orange-100">
                                <LatexFormula formula={seg.shearFormula} />
                              </div>
                              <div className="flex gap-3 text-[10px] text-slate-500 font-mono">
                                <span><LatexFormula formula={seg.derivation.shear.atLeft} /></span>
                                <span><LatexFormula formula={seg.derivation.shear.atRight} /></span>
                              </div>
                            </div>
                          ) : (
                            <div className="font-mono text-xs font-medium"><LatexFormula formula={seg.shearFormula} /></div>
                          )}
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
                          <div className="text-[10px] text-blue-700 font-semibold mb-1 flex items-center gap-1">
                            <span>Moment</span>
                            <span className="text-[9px] font-normal text-blue-500">ΣM<sub>cut</sub> = 0 (CW+)</span>
                          </div>
                          {seg.derivation ? (
                            <div className="space-y-0.5">
                              {/* Geometric initial equation */}
                              {seg.derivation.moment.geometricEquation && (
                                <div className="font-mono text-[10px] text-blue-500/70">
                                  <LatexFormula formula={seg.derivation.moment.geometricEquation} />
                                </div>
                              )}
                              {/* Simplified result */}
                              <div className="font-mono text-xs font-semibold bg-white rounded px-2 py-0.5 border border-blue-100">
                                <LatexFormula formula={seg.momentFormula} />
                              </div>
                              <div className="flex gap-3 text-[10px] text-slate-500 font-mono">
                                <span><LatexFormula formula={seg.derivation.moment.atLeft} /></span>
                                <span><LatexFormula formula={seg.derivation.moment.atRight} /></span>
                              </div>
                            </div>
                          ) : (
                            <div className="font-mono text-xs font-medium"><LatexFormula formula={seg.momentFormula} /></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {segments.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Extreme Values</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">V<sub>max</sub> (Max Shear)</div>
              <div className={`text-lg font-bold tabular-nums ${valColorClass(maxShear)}`}>{fmtNum(maxShear)}</div>
              <div className="text-[10px] text-slate-400">{U.force}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">V<sub>min</sub> (Min Shear)</div>
              <div className={`text-lg font-bold tabular-nums ${valColorClass(minShear)}`}>{fmtNum(minShear)}</div>
              <div className="text-[10px] text-slate-400">{U.force}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">M<sub>max</sub> (Max Moment)</div>
              <div className={`text-lg font-bold tabular-nums ${valColorClass(maxMoment)}`}>{fmtNum(maxMoment)}</div>
              <div className="text-[10px] text-slate-400">{U.moment}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">M<sub>min</sub> (Min Moment)</div>
              <div className={`text-lg font-bold tabular-nums ${valColorClass(minMoment)}`}>{fmtNum(minMoment)}</div>
              <div className="text-[10px] text-slate-400">{U.moment}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
