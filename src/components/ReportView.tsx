import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import LatexFormula from './LatexFormula';
import FBDCanvas from './FBDCanvas';
import DiagramOutput from './DiagramOutput';
import type { BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad, BeamResult, LabeledPoint, UnitSystem } from '../types';
import { UNIT_SYSTEMS } from '../types';

interface Props {
  beamLength: number;
  supports: BeamSupport[];
  pointLoads: PointLoad[];
  moments: ConcentratedMoment[];
  distributedLoads: DistributedLoad[];
  result: BeamResult;
  labeledPoints: LabeledPoint[];
  unitSystem: UnitSystem;
}

function supportLabel(sup: BeamSupport, index: number): string {
  if (sup.type === 'fixed') return 'Fixed Support';
  const side = index === 0 ? 'Left' : 'Right';
  return `${side} ${sup.type === 'pin' ? 'Pin' : 'Roller'}`;
}

export default function ReportView({ beamLength, supports, pointLoads, moments, distributedLoads, result, labeledPoints, unitSystem }: Props) {
  const U = UNIT_SYSTEMS[unitSystem];
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criticalPositions = labeledPoints.map(p => p.position);

  if (result.segments.length === 0 && result.reactions.length === 0) {
    return (
      <div className="text-slate-400 text-sm text-center py-8">
        Add a beam configuration and the report will populate automatically.
      </div>
    );
  }

  const thCls = "px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200";
  const tdCls = "px-3 py-2 text-sm align-top";

  function fmtTerm(value: string): string {
    return value.replace(/\\text\{/g, '').replace(/\}/g, '').replace(/\\\\/g, '').replace(/\\times/g, '×');
  }

  async function handleDownloadPDF() {
    if (!reportRef.current) return;
    setDownloading(true);
    setError(null);
    try {
      const svgs = reportRef.current.querySelectorAll('svg');
      svgs.forEach(svg => {
        const bbox = svg.getBoundingClientRect();
        if (!svg.getAttribute('width') || svg.getAttribute('width') === '0') {
          svg.setAttribute('width', String(bbox.width || 800));
        }
        if (!svg.getAttribute('height') || svg.getAttribute('height') === '0') {
          svg.setAttribute('height', String(bbox.height || 300));
        }
      });

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (doc) => {
          const clonedSvgs = doc.querySelectorAll('svg');
          clonedSvgs.forEach(svg => {
            if (!svg.getAttribute('width')) svg.setAttribute('width', '800');
            if (!svg.getAttribute('height')) svg.setAttribute('height', '300');
          });
          doc.querySelectorAll('.katex-html').forEach(el => {
            (el as HTMLElement).style.display = 'inline';
          });
        },
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = Math.min(pdfW / imgW, pdfH / imgH);
      const scaledW = imgW * ratio;
      const scaledH = imgH * ratio;
      const xOff = (pdfW - scaledW) / 2;
      const yOff = (pdfH - scaledH) / 2;

      if (scaledH <= pdfH) {
        pdf.addImage(imgData, 'PNG', xOff, yOff, scaledW, scaledH);
      } else {
        let remainingH = imgH;
        let srcY = 0;
        while (remainingH > 0) {
          const pageImgH = pdfH / ratio;
          const sliceH = Math.min(pageImgH, remainingH);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = imgW;
          sliceCanvas.height = sliceH;
          const ctx = sliceCanvas.getContext('2d')!;
          ctx.drawImage(canvas, 0, srcY, imgW, sliceH, 0, 0, imgW, sliceH);
          const sliceData = sliceCanvas.toDataURL('image/png');
          if (srcY > 0) pdf.addPage();
          pdf.addImage(sliceData, 'PNG', xOff, 0, scaledW, sliceH * ratio);
          srcY += sliceH;
          remainingH -= sliceH;
        }
      }
      pdf.save('beam-analysis-report.pdf');
    } catch (err) {
      setError('PDF generation failed. Try using Print instead.');
      console.error('PDF generation error:', err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div ref={reportRef} className="space-y-6 bg-white">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-800">Calculation Report</h2>
          <p className="text-xs text-slate-500 mt-1">Units: {unitSystem === 'metric' ? 'Metric (kN, m)' : 'Imperial (kips, ft)'}</p>
        </div>

        <section>
          <h3 className="text-sm font-bold text-slate-700 mb-2">1. Beam Configuration</h3>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-500 w-40 font-medium">Beam Length</td>
                <td className="px-3 py-2 text-slate-700">{beamLength.toFixed(2)} {U.length}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-500 font-medium">Supports</td>
                <td className="px-3 py-2 text-slate-700">
                  {supports.map((s, i) => `${supportLabel(s, i)} @ ${s.position.toFixed(2)}${U.length}`).join(', ')}
                </td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-500 font-medium">Reference Points</td>
                <td className="px-3 py-2 text-slate-700">
                  {labeledPoints.map(p => `${p.label} @ ${p.position.toFixed(2)}${U.length}`).join(', ')}
                </td>
              </tr>
              {pointLoads.length > 0 && (
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500 font-medium">Point Loads</td>
                  <td className="px-3 py-2 text-slate-700">
                    {pointLoads.map(p => `${p.magnitude.toFixed(1)} ${U.force} ${p.direction === 'up' ? '↑' : '↓'} @ ${p.position.toFixed(2)}${U.length}`).join('; ')}
                  </td>
                </tr>
              )}
              {moments.length > 0 && (
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500 font-medium">Concentrated Moments</td>
                  <td className="px-3 py-2 text-slate-700">
                    {moments.map(m => `${m.magnitude.toFixed(1)} ${U.moment} ${m.direction} @ ${m.position.toFixed(2)}${U.length}`).join('; ')}
                  </td>
                </tr>
              )}
              {distributedLoads.length > 0 && (
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500 font-medium">Distributed Loads</td>
                  <td className="px-3 py-2 text-slate-700">
                    {distributedLoads.map(d =>
                      `${d.startMag.toFixed(1)}-${d.endMag.toFixed(1)} ${U.distLoad} from ${d.startPos.toFixed(2)}${U.length} to ${d.endPos.toFixed(2)}${U.length}`
                    ).join('; ')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="text-sm font-bold text-slate-700 mb-2">2. Beam Diagram</h3>
          <FBDCanvas
            beamLength={beamLength}
            supports={supports}
            pointLoads={pointLoads}
            moments={moments}
            distributedLoads={distributedLoads}
            reactions={result.reactions}
            labeledPoints={labeledPoints}
            unitSystem={unitSystem}
          />
        </section>

        {result.reactions.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-2">3. Support Reactions</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className={thCls}>Support</th>
                    <th className={`${thCls} text-right`}>Vertical ({U.force})</th>
                    <th className={`${thCls} text-right`}>Horizontal ({U.force})</th>
                    <th className={`${thCls} text-right`}>Moment ({U.moment})</th>
                  </tr>
                </thead>
                <tbody>
                  {result.reactions.map((r, i) => {
                    const sup = supports.find(s => s.id === r.supportId);
                    if (!sup) return null;
                    return (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className={tdCls + " text-slate-700"}>{supportLabel(sup, i)}</td>
                        <td className={`${tdCls} text-right font-mono text-blue-700 font-medium`}>{r.vertical.toFixed(2)}</td>
                        <td className={`${tdCls} text-right font-mono text-slate-500`}>{r.horizontal.toFixed(2)}</td>
                        <td className={`${tdCls} text-right font-mono text-slate-500`}>{r.moment.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {result.segments.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-2">4. Segment Equations (Equilibrium Method)</h3>
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
                  {result.segments.map((seg, i) => (
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
          </section>
        )}

        {result.diagramPoints.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-2">5. Shear & Moment Diagrams</h3>
            <DiagramOutput
              points={result.diagramPoints}
              maxShear={result.maxShear}
              minShear={result.minShear}
              maxMoment={result.maxMoment}
              minMoment={result.minMoment}
              beamLength={beamLength}
              criticalPositions={criticalPositions}
              unitSystem={unitSystem}
            />
          </section>
        )}

        <section>
          <h3 className="text-sm font-bold text-slate-700 mb-2">6. Summary of Extremes</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500 w-40 font-medium">Max Shear</td>
                  <td className="px-3 py-2 text-orange-700 font-mono font-medium">{result.maxShear.toFixed(2)} {U.force}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500 font-medium">Min Shear</td>
                  <td className="px-3 py-2 text-orange-700 font-mono font-medium">{result.minShear.toFixed(2)} {U.force}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500 font-medium">Max Moment</td>
                  <td className="px-3 py-2 text-blue-700 font-mono font-medium">{result.maxMoment.toFixed(2)} {U.moment}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500 font-medium">Min Moment</td>
                  <td className="px-3 py-2 text-blue-700 font-mono font-medium">{result.minMoment.toFixed(2)} {U.moment}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="flex items-center gap-3 pt-4 no-print">
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {downloading ? 'Generating PDF...' : 'Download PDF Report'}
        </button>
        {error && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600">{error}</span>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Print (Save as PDF)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
