import { useState, useMemo } from 'react';
import type { BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad, UnitSystem, LabeledPoint } from './types';
import { solveBeam } from './engine/solver';
import ControlPanel from './components/ControlPanel';
import BeamCanvas from './components/BeamCanvas';
import FBDCanvas from './components/FBDCanvas';
import DiagramOutput from './components/DiagramOutput';
import ResultsTable from './components/ResultsTable';
import ReportView from './components/ReportView';
import { FileText, BarChart3, GitBranch } from 'lucide-react';

type CanvasView = 'fbd' | 'beam';

function expandRepeatedLoads(loads: PointLoad[]): PointLoad[] {
  const r: PointLoad[] = [];
  for (const p of loads) {
    for (let i = 0; i < p.repeatCount; i++) {
      r.push({ ...p, position: p.position + i * p.repeatInterval, id: `${p.id}-${i}` });
    }
  }
  return r;
}

export default function App() {
  const [beamLength, setBeamLength] = useState(10);
  const [supports, setSupports] = useState<BeamSupport[]>([{ id: 'sup-1', type: 'fixed', position: 0 }]);
  const [pointLoads, setPointLoads] = useState<PointLoad[]>([]);
  const [moments, setMoments] = useState<ConcentratedMoment[]>([]);
  const [distributedLoads, setDistributedLoads] = useState<DistributedLoad[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [showReport, setShowReport] = useState(false);
  const [canvasView, setCanvasView] = useState<CanvasView>('beam');

  const expandedLoads = useMemo(() => expandRepeatedLoads(pointLoads), [pointLoads]);

  const result = useMemo(
    () => solveBeam(beamLength, supports, expandedLoads, moments, distributedLoads),
    [beamLength, supports, expandedLoads, moments, distributedLoads],
  );

  const labeledPoints = useMemo((): LabeledPoint[] => {
    const pts = new Map<number, LabeledPoint['type']>();
    pts.set(0, 'end');
    pts.set(beamLength, 'end');
    for (const s of supports) pts.set(s.position, 'support');
    for (const p of expandedLoads) pts.set(p.position, 'load');
    for (const m of moments) pts.set(m.position, 'moment');
    for (const d of distributedLoads) { pts.set(d.startPos, 'dist'); pts.set(d.endPos, 'dist'); }
    return Array.from(pts.entries()).sort(([a], [b]) => a - b).map(([pos, type], i) => ({ position: pos, label: String.fromCharCode(65 + i), type }));
  }, [beamLength, supports, expandedLoads, moments, distributedLoads]);

  const criticalPositions = useMemo(() => labeledPoints.map(p => p.position), [labeledPoints]);
  const hasResults = result.reactions.length > 0 || result.segments.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-3 py-2 flex items-center justify-between select-none">
        <h1 className="text-sm font-bold text-slate-700 tracking-tight">Beam Solver</h1>
        <div className="flex items-center gap-1.5">
          {hasResults && (
            <button onClick={() => setShowReport(!showReport)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors ${showReport ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
              {showReport ? <BarChart3 size={14} /> : <FileText size={14} />}
              {showReport ? 'Diagrams' : 'Report'}
            </button>
          )}
        </div>
      </header>

      <div className="flex">
        <div className="w-72 shrink-0 border-r border-slate-200 bg-white p-3">
          <ControlPanel
            beamLength={beamLength} setBeamLength={setBeamLength}
            supports={supports} setSupports={setSupports}
            pointLoads={pointLoads} setPointLoads={setPointLoads}
            moments={moments} setMoments={setMoments}
            distributedLoads={distributedLoads} setDistributedLoads={setDistributedLoads}
            unitSystem={unitSystem} setUnitSystem={setUnitSystem}
          />
        </div>

        <main className="flex-1 min-w-0 p-3 sm:p-4 mx-auto w-full max-w-[1100px]">
          {!showReport ? (
            <div className="space-y-4">
              <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5 w-fit">
                <button onClick={() => setCanvasView('fbd')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${canvasView === 'fbd' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                  <GitBranch size={13} /> Free Body Diagram
                </button>
                <button onClick={() => setCanvasView('beam')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${canvasView === 'beam' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                  <BarChart3 size={13} /> Beam View
                </button>
              </div>

              {canvasView === 'fbd' ? (
                <FBDCanvas beamLength={beamLength} supports={supports} pointLoads={expandedLoads} moments={moments} distributedLoads={distributedLoads} reactions={result.reactions} labeledPoints={labeledPoints} unitSystem={unitSystem} />
              ) : (
                <BeamCanvas beamLength={beamLength} supports={supports} pointLoads={expandedLoads} moments={moments} distributedLoads={distributedLoads} reactions={result.reactions} labeledPoints={labeledPoints} unitSystem={unitSystem} />
              )}

              {hasResults ? (
                <>
                  <DiagramOutput points={result.diagramPoints} maxShear={result.maxShear} minShear={result.minShear} maxMoment={result.maxMoment} minMoment={result.minMoment} beamLength={beamLength} criticalPositions={criticalPositions} unitSystem={unitSystem} />
                  <div className="bg-white rounded-lg border border-slate-200 p-3">
                    <ResultsTable segments={result.segments} reactions={result.reactions} supports={supports} unitSystem={unitSystem} />
                  </div>
                </>
              ) : (
                <div className="text-slate-400 text-sm text-center py-12 border-2 border-dashed border-slate-200 rounded-lg bg-white">
                  <p className="mb-1 font-medium">Configure the beam using the controls</p>
                  <p className="text-xs">Add supports and loads to see shear and moment diagrams</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <ReportView beamLength={beamLength} supports={supports} pointLoads={expandedLoads} moments={moments} distributedLoads={distributedLoads} result={result} labeledPoints={labeledPoints} unitSystem={unitSystem} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
