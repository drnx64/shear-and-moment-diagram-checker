import LatexFormula from './LatexFormula';
import type { SegmentInfo, Reaction, BeamSupport, UnitSystem, ReactionDerivationStep } from '../types';
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

export default function ResultsTable({ segments, reactions, supports, unitSystem, maxShear, minShear, maxMoment, minMoment, reactionDerivation = [] }: Props) {
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
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-[10px] font-medium bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">{segName}</span>
                    <span className="text-[10px] text-slate-400">({fmtNum(seg.start)} → {fmtNum(seg.end)} {U.length})</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <div className="text-[10px] text-slate-500 mb-0.5 font-medium">Shear</div>
                      {seg.derivation ? (
                        <div className="space-y-1">
                          <div className="font-mono text-[11px] text-slate-500"><LatexFormula formula={seg.derivation.shear.equation} /></div>
                          <div className="font-mono text-[11px] text-orange-600/80"><LatexFormula formula={seg.derivation.shear.fullEquation} /></div>
                          <div className="font-mono text-xs font-semibold bg-slate-50 rounded px-2 py-1"><LatexFormula formula={seg.shearFormula} /></div>
                          <div className="flex gap-4 text-[10px] text-slate-500 font-mono">
                            <span><LatexFormula formula={seg.derivation.shear.atLeft} /></span>
                            <span><LatexFormula formula={seg.derivation.shear.atRight} /></span>
                          </div>
                        </div>
                      ) : (
                        <div className="font-mono text-xs font-medium"><LatexFormula formula={seg.shearFormula} /></div>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 mb-0.5 font-medium">Moment</div>
                      {seg.derivation ? (
                        <div className="space-y-1">
                          <div className="font-mono text-[11px] text-slate-500"><LatexFormula formula={seg.derivation.moment.equation} /></div>
                          <div className="font-mono text-[11px] text-blue-600/80"><LatexFormula formula={seg.derivation.moment.fullEquation} /></div>
                          <div className="font-mono text-xs font-semibold bg-slate-50 rounded px-2 py-1"><LatexFormula formula={seg.momentFormula} /></div>
                          <div className="flex gap-4 text-[10px] text-slate-500 font-mono">
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
