import { useRef, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import LatexFormula from './LatexFormula';
import FBDCanvas from './FBDCanvas';
import DiagramOutput from './DiagramOutput';
import type { BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad, BeamResult, LabeledPoint, UnitSystem } from '../types';
import { UNIT_SYSTEMS } from '../types';

function scrubModernCSS(doc: Document) {
  const replaceModernCSS = (css: string) =>
    css
      .replace(/color-mix\([^)]*\)/g, '#64748b')
      .replace(/oklch\([^)]*\)/g, '#64748b')
      .replace(/oklab\([^)]*\)/g, '#64748b');
  doc.querySelectorAll('style').forEach(el => {
    el.textContent = replaceModernCSS(el.textContent || '');
  });
  doc.querySelectorAll('[style]').forEach(el => {
    const inline = (el as HTMLElement).getAttribute('style') || '';
    (el as HTMLElement).setAttribute('style', replaceModernCSS(inline));
  });
  doc.querySelectorAll('svg').forEach(svg => {
    if (!svg.getAttribute('width')) svg.setAttribute('width', '800');
    if (!svg.getAttribute('height') || svg.getAttribute('height') === '0') svg.setAttribute('height', '300');
  });
  doc.querySelectorAll('.katex-html').forEach(el => {
    (el as HTMLElement).style.display = 'inline';
  });
}

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

function valColor(val: number): string {
  if (val > 0.001) return '#16a34a';
  if (val < -0.001) return '#dc2626';
  return '#64748b';
}

export default function ReportView({ beamLength, supports, pointLoads, moments, distributedLoads, result, labeledPoints, unitSystem }: Props) {
  const U = UNIT_SYSTEMS[unitSystem];
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (result.segments.length === 0 && result.reactions.length === 0) {
    return (
      <div className="text-slate-400 text-sm text-center py-8">
        Add a beam configuration and the report will populate automatically.
      </div>
    );
  }

  const thCls = "px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200";
  const tdCls = "px-3 py-2 text-xs align-top";

  const captureAsImage = useCallback(async (format: 'png' | 'jpeg') => {
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
        onclone: scrubModernCSS,
      });
      const link = document.createElement('a');
      link.download = `beam-analysis.${format === 'jpeg' ? 'jpg' : 'png'}`;
      link.href = canvas.toDataURL(`image/${format === 'jpeg' ? 'jpeg' : 'png'}`, format === 'jpeg' ? 0.92 : undefined);
      link.click();
    } catch (err) {
      setError('Image generation failed.');
      console.error('Image generation error:', err);
    } finally {
      setDownloading(false);
    }
  }, []);

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
        onclone: scrubModernCSS,
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
      <div ref={reportRef} className="space-y-6 bg-white" style={{ width: '816px', margin: '0 auto' }}>
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-lg font-bold text-slate-800">Beam Analysis Report</h2>
          <p className="text-xs text-slate-500 mt-1">
            Length: {beamLength.toFixed(2)} {U.length} &middot; Units: {unitSystem === 'metric' ? 'Metric (kN, m)' : 'Imperial (kips, ft)'} &middot;
            Generated: {new Date().toLocaleString()}
          </p>
        </div>

        <section>
          <h3 className="text-sm font-bold text-slate-700 mb-2">1. Configuration Summary</h3>
          <table className="w-full text-xs border-collapse border border-slate-200 rounded-lg overflow-hidden">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-3 py-2 bg-slate-50 text-slate-500 w-48 font-medium">Beam Length</td>
                <td className="px-3 py-2 text-slate-700">{beamLength.toFixed(2)} {U.length}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-3 py-2 bg-slate-50 text-slate-500 font-medium">Supports</td>
                <td className="px-3 py-2 text-slate-700">
                  {supports.map((s, i) => `${supportLabel(s, i)} @ ${s.position.toFixed(2)}${U.length}`).join(', ')}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-3 py-2 bg-slate-50 text-slate-500 font-medium">Reference Points</td>
                <td className="px-3 py-2 text-slate-700">
                  {labeledPoints.map(p => `${p.label} @ ${p.position.toFixed(2)}${U.length}`).join(', ')}
                </td>
              </tr>
              {pointLoads.length > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 bg-slate-50 text-slate-500 font-medium">Point Loads</td>
                  <td className="px-3 py-2 text-slate-700">
                    {pointLoads.map(p => `${p.magnitude.toFixed(1)} ${U.force} ${p.direction === 'up' ? '↑' : '↓'} @ ${p.position.toFixed(2)}${U.length}`).join('; ')}
                  </td>
                </tr>
              )}
              {moments.length > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 bg-slate-50 text-slate-500 font-medium">Concentrated Moments</td>
                  <td className="px-3 py-2 text-slate-700">
                    {moments.map(m => `${m.magnitude.toFixed(1)} ${U.moment} ${m.direction} @ ${m.position.toFixed(2)}${U.length}`).join('; ')}
                  </td>
                </tr>
              )}
              {distributedLoads.length > 0 && (
                <tr>
                  <td className="px-3 py-2 bg-slate-50 text-slate-500 font-medium">Distributed Loads</td>
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
          <h3 className="text-sm font-bold text-slate-700 mb-2">2. Free Body Diagram</h3>
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

        {result.reactionDerivation.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-2">3. Reaction Solution</h3>
            <div className="border border-slate-200 rounded-lg p-3 space-y-1.5">
              {result.reactionDerivation.map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <span className="text-[10px] font-medium text-slate-400 uppercase w-24 shrink-0 pt-0.5">{step.label}</span>
                  <div className="font-mono text-slate-700"><LatexFormula formula={step.equation} /></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {result.reactions.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-2">4. Support Reactions</h3>
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
                    const hasHoriz = sup.type === 'pin' || sup.type === 'fixed';
                    const hasMoment = sup.type === 'fixed';
                    return (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className={tdCls + " text-slate-700 font-medium"}>{supportLabel(sup, i)}</td>
                        <td className={`${tdCls} text-right font-mono font-medium`} style={{ color: valColor(r.vertical) }}>{r.vertical.toFixed(2)}</td>
                        <td className={`${tdCls} text-right font-mono`} style={{ color: hasHoriz ? valColor(r.horizontal) : '#94a3b8' }}>
                          {hasHoriz ? r.horizontal.toFixed(2) : '—'}
                        </td>
                        <td className={`${tdCls} text-right font-mono`} style={{ color: hasMoment ? valColor(r.moment) : '#94a3b8' }}>
                          {hasMoment ? r.moment.toFixed(2) : '—'}
                        </td>
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
            <h3 className="text-sm font-bold text-slate-700 mb-2">5. Segment Equations (Equilibrium Method)</h3>
            <div className="space-y-3">
              {result.segments.map((seg, i) => {
                const segName = `${String.fromCharCode(65 + i)} → ${String.fromCharCode(66 + i)}`;
                return (
                  <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <span className="text-[10px] font-medium bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">{segName}</span>
                      <span className="text-[10px] text-slate-400">({seg.start.toFixed(2)} → {seg.end.toFixed(2)} {U.length})</span>
                    </div>
                    <div className="p-3 space-y-2">
                      <div>
                        <div className="text-[10px] text-slate-500 mb-0.5 font-medium">Shear</div>
                        {seg.derivation ? (
                          <div className="space-y-1">
                            <div className="font-mono text-[11px] text-slate-500"><LatexFormula formula={seg.derivation.shear.equation} /></div>
                            <div className="font-mono text-[11px] text-orange-600/80"><LatexFormula formula={seg.derivation.shear.fullEquation} /></div>
                            <div className="font-mono text-xs font-semibold bg-slate-50 rounded px-2 py-1"><LatexFormula formula={seg.shearFormula} /></div>
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
          </section>
        )}

        {result.diagramPoints.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-2">6. Shear &amp; Moment Diagrams</h3>
            <DiagramOutput
              points={result.diagramPoints}
              maxShear={result.maxShear}
              minShear={result.minShear}
              maxMoment={result.maxMoment}
              minMoment={result.minMoment}
              beamLength={beamLength}
              labeledPoints={labeledPoints}
              shearZeroCrossings={result.shearZeroCrossings}
              unitSystem={unitSystem}
            />
          </section>
        )}

        <section>
            <h3 className="text-sm font-bold text-slate-700 mb-2">7. Extreme Values Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Max Shear</div>
              <div className="text-lg font-bold" style={{ color: valColor(result.maxShear) }}>{result.maxShear.toFixed(2)} {U.force}</div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Min Shear</div>
              <div className="text-lg font-bold" style={{ color: valColor(result.minShear) }}>{result.minShear.toFixed(2)} {U.force}</div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Max Moment</div>
              <div className="text-lg font-bold" style={{ color: valColor(result.maxMoment) }}>{result.maxMoment.toFixed(2)} {U.moment}</div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Min Moment</div>
              <div className="text-lg font-bold" style={{ color: valColor(result.minMoment) }}>{result.minMoment.toFixed(2)} {U.moment}</div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-center gap-3 pt-4 no-print flex-wrap">
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {downloading ? 'Generating...' : 'Download PDF'}
        </button>
        <button
          onClick={() => captureAsImage('png')}
          disabled={downloading}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {downloading ? 'Generating...' : 'Save as PNG'}
        </button>
        <button
          onClick={() => captureAsImage('jpeg')}
          disabled={downloading}
          className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {downloading ? 'Generating...' : 'Save as JPG'}
        </button>
        {error && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600">{error}</span>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Print
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
