import LatexFormula from './LatexFormula';
import type { SegmentInfo, Reaction, BeamSupport, UnitSystem } from '../types';
import { UNIT_SYSTEMS } from '../types';

interface Props {
  segments: SegmentInfo[];
  reactions: Reaction[];
  supports: BeamSupport[];
  unitSystem: UnitSystem;
}

function supportLabel(sup: BeamSupport, index: number): string {
  if (sup.type === 'fixed') return 'Fixed Support';
  const side = index === 0 ? 'Left' : 'Right';
  return `${side} ${sup.type === 'pin' ? 'Pin' : 'Roller'}`;
}

export default function ResultsTable({ segments, reactions, supports, unitSystem }: Props) {
  const U = UNIT_SYSTEMS[unitSystem];

  function fmtTerm(value: string): string {
    return value.replace(/\\text\{/g, '').replace(/\}/g, '').replace(/\\\\/g, '').replace(/\\times/g, '×');
  }

  if (segments.length === 0 && reactions.length === 0) {
    return (
      <div className="text-slate-400 text-sm text-center py-4">
        Add a beam configuration to see results
      </div>
    );
  }

  const thCls = "px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200";
  const tdCls = "px-3 py-2 text-sm align-top";

  return (
    <div className="space-y-5">
      {reactions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-2">Support Reactions</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
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
                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className={tdCls + " text-slate-700"}>{supportLabel(sup, i)}</td>
                      <td className={tdCls + " text-slate-600 capitalize"}>{sup.type}</td>
                      <td className={`${tdCls} text-right text-slate-600`}>{sup.position.toFixed(2)}</td>
                      <td className={`${tdCls} text-right font-mono text-blue-700 font-medium`}>{r.vertical.toFixed(2)}</td>
                      <td className={`${tdCls} text-right font-mono text-slate-500`}>{r.horizontal.toFixed(2)}</td>
                      <td className={`${tdCls} text-right font-mono text-slate-500`}>{r.moment.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {segments.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-2">Segment Equations (Equilibrium Method)</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className={thCls}>Segment</th>
                  <th className={thCls}>Shear — ΣF<sub>y</sub> = 0 (↑+)</th>
                  <th className={thCls}>Moment — ΣM<sub>cut</sub> = 0 (clockwise +)</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((seg, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className={`${tdCls} text-slate-600 font-mono whitespace-nowrap`}>
                      {String.fromCharCode(65 + i)}–{String.fromCharCode(66 + i)}
                    </td>
                    <td className={tdCls + " text-orange-700"}>
                      {seg.derivation ? (
                        <div className="space-y-1">
                          <div className="font-mono text-[11px]">
                            <LatexFormula formula={seg.derivation.shear.equation} />
                          </div>
                          <div className="font-mono text-[11px] text-orange-600/80">
                            {seg.derivation.shear.terms.length > 0 ? (
                              <span>-V{' '}{seg.derivation.shear.terms.map(t => fmtTerm(t.value)).join(' ')} = 0</span>
                            ) : (
                              <span>-V = 0</span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] font-medium">
                            <LatexFormula formula={seg.shearFormula} />
                          </div>
                        </div>
                      ) : (
                        <LatexFormula formula={seg.shearFormula} />
                      )}
                    </td>
                    <td className={tdCls + " text-blue-700"}>
                      {seg.derivation ? (
                        <div className="space-y-1">
                          <div className="font-mono text-[11px]">
                            <LatexFormula formula={seg.derivation.moment.equation} />
                          </div>
                          <div className="font-mono text-[11px] text-blue-600/80">
                            {seg.derivation.moment.terms.length > 0 ? (
                              <span>-M{' '}{seg.derivation.moment.terms.map(t => fmtTerm(t.value)).join(' ')} = 0</span>
                            ) : (
                              <span>-M = 0</span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] font-medium">
                            <LatexFormula formula={seg.momentFormula} />
                          </div>
                        </div>
                      ) : (
                        <LatexFormula formula={seg.momentFormula} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
