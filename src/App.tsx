import { useState, useMemo, useEffect, useCallback } from 'react';
import type { BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad, UnitSystem, LabeledPoint } from './types';
import { solveBeam } from './engine/solver';
import ControlPanel from './components/ControlPanel';
import BeamCanvas from './components/BeamCanvas';
import FBDCanvas from './components/FBDCanvas';
import DiagramOutput from './components/DiagramOutput';
import ResultsTable from './components/ResultsTable';
import ReportView from './components/ReportView';
import { FileText, RotateCcw, Menu, X, Ruler } from 'lucide-react';

type CanvasView = 'beam' | 'fbd';

const CACHE_KEY = 'beam-solver-config';

interface BeamConfigCache {
  beamLength: number;
  supports: BeamSupport[];
  pointLoads: PointLoad[];
  moments: ConcentratedMoment[];
  distributedLoads: DistributedLoad[];
  unitSystem: UnitSystem;
}

function loadConfig(): BeamConfigCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as BeamConfigCache;
  } catch { /* ignore */ }
  return null;
}

function expandRepeatedLoads(loads: PointLoad[]): PointLoad[] {
  const r: PointLoad[] = [];
  for (const p of loads) {
    for (let i = 0; i < p.repeatCount; i++) {
      r.push({ ...p, position: p.position + i * p.repeatInterval, id: `${p.id}-${i}` });
    }
  }
  return r;
}

function defaultState() {
  return {
    beamLength: 10,
    supports: [{ id: 'sup-1', type: 'fixed' as const, position: 0 }],
    pointLoads: [] as PointLoad[],
    moments: [] as ConcentratedMoment[],
    distributedLoads: [] as DistributedLoad[],
    unitSystem: 'metric' as UnitSystem,
  };
}

export default function App() {
  const cached = useMemo(loadConfig, []);
  const initial = cached ?? defaultState();

  const [beamLength, setBeamLength] = useState(initial.beamLength);
  const [supports, setSupports] = useState<BeamSupport[]>(initial.supports);
  const [pointLoads, setPointLoads] = useState<PointLoad[]>(initial.pointLoads);
  const [moments, setMoments] = useState<ConcentratedMoment[]>(initial.moments);
  const [distributedLoads, setDistributedLoads] = useState<DistributedLoad[]>(initial.distributedLoads);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(initial.unitSystem);
  const [showReport, setShowReport] = useState(false);
  const [canvasView, setCanvasView] = useState<CanvasView>('beam');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const config: BeamConfigCache = { beamLength, supports, pointLoads, moments, distributedLoads, unitSystem };
    localStorage.setItem(CACHE_KEY, JSON.stringify(config));
  }, [beamLength, supports, pointLoads, moments, distributedLoads, unitSystem]);

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

  const hasResults = result.reactions.length > 0 || result.segments.length > 0;

  const handleReset = useCallback(() => {
    if (!window.confirm('Reset all beam configuration data?')) return;
    const def = defaultState();
    setBeamLength(def.beamLength);
    setSupports(def.supports);
    setPointLoads(def.pointLoads);
    setMoments(def.moments);
    setDistributedLoads(def.distributedLoads);
    setUnitSystem(def.unitSystem);
    setShowReport(false);
    setCanvasView('beam');
    localStorage.removeItem(CACHE_KEY);
  }, []);

  const unitLabel = unitSystem === 'metric' ? 'kN·m' : 'kips·ft';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased">
      <header className="sticky top-0 z-30 h-14 bg-[#1e293b] text-white flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="md:hidden p-1 rounded-md hover:bg-white/10 transition-colors"
            title="Toggle menu"
            aria-label="Toggle menu"
          >
            {drawerOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Beam Solver</h1>
            <p className="text-[10px] text-slate-300 hidden sm:block leading-tight">Shear &amp; Moment Diagram Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              document.querySelector('[data-section="units"]')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-white/80 hover:bg-white/10 transition-colors"
            title={`Current units: ${unitLabel}`}
          >
            <Ruler size={14} />
            <span className="font-medium">{unitLabel}</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-white/80 hover:bg-white/10 hover:text-red-300 transition-colors"
            title="Reset all data"
            aria-label="Reset"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reset</span>
          </button>
          {hasResults && (
            <button
              onClick={() => setShowReport(!showReport)}
              className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs transition-colors ${
                showReport ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
              }`}
              title={showReport ? 'Show diagrams' : 'Show report'}
              aria-label={showReport ? 'Show diagrams' : 'Show report'}
            >
              <FileText size={14} />
              <span className="hidden sm:inline">Report</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex relative">
        {/* Mobile drawer backdrop */}
        {drawerOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Left panel */}
        <aside
          className={`
            fixed md:sticky top-14 z-20
            w-[280px] md:w-[280px] shrink-0
            h-[calc(100vh-56px)] overflow-y-auto
            border-r border-slate-200 bg-white
            transition-transform duration-200 ease-out
            ${drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-2 md:hidden">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Controls</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded hover:bg-slate-100 transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <ControlPanel
              beamLength={beamLength} setBeamLength={setBeamLength}
              supports={supports} setSupports={setSupports}
              pointLoads={pointLoads} setPointLoads={setPointLoads}
              moments={moments} setMoments={setMoments}
              distributedLoads={distributedLoads} setDistributedLoads={setDistributedLoads}
              unitSystem={unitSystem} setUnitSystem={setUnitSystem}
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 mx-auto w-full max-w-[1200px]">
          {!showReport ? (
            <div className="space-y-4">
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 w-fit">
                <button onClick={() => setCanvasView('fbd')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                    canvasView === 'fbd' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  Free Body Diagram
                </button>
                <button onClick={() => setCanvasView('beam')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                    canvasView === 'beam' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  Beam View
                </button>
              </div>

              {/* Canvas */}
              {canvasView === 'fbd' ? (
                <FBDCanvas beamLength={beamLength} supports={supports} pointLoads={expandedLoads} moments={moments} distributedLoads={distributedLoads} reactions={result.reactions} labeledPoints={labeledPoints} unitSystem={unitSystem} />
              ) : (
                <BeamCanvas beamLength={beamLength} supports={supports} pointLoads={expandedLoads} moments={moments} distributedLoads={distributedLoads} reactions={result.reactions} labeledPoints={labeledPoints} unitSystem={unitSystem} />
              )}

              {/* Charts + Results */}
              {hasResults ? (
                <>
                  <DiagramOutput points={result.diagramPoints} maxShear={result.maxShear} minShear={result.minShear} maxMoment={result.maxMoment} minMoment={result.minMoment} beamLength={beamLength} labeledPoints={labeledPoints} shearZeroCrossings={result.shearZeroCrossings} unitSystem={unitSystem} />
                  <ResultsTable segments={result.segments} reactions={result.reactions} supports={supports} unitSystem={unitSystem} maxShear={result.maxShear} minShear={result.minShear} maxMoment={result.maxMoment} minMoment={result.minMoment} reactionDerivation={result.reactionDerivation} />
                </>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 p-8">
                  <div className="space-y-3 animate-pulse-slow">
                    <div className="h-4 bg-slate-100 rounded w-48" />
                    <div className="h-32 bg-slate-100 rounded" />
                    <div className="h-4 bg-slate-100 rounded w-64" />
                    <div className="h-20 bg-slate-100 rounded" />
                  </div>
                  <p className="text-xs text-slate-400 text-center mt-4">Configure the beam using the controls to see results</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6">
              <ReportView beamLength={beamLength} supports={supports} pointLoads={expandedLoads} moments={moments} distributedLoads={distributedLoads} result={result} labeledPoints={labeledPoints} unitSystem={unitSystem} />
            </div>
          )}
        </main>
      </div>

      <footer className="text-center text-[10px] text-slate-400 py-3 border-t border-slate-200">
        Beam Shear &amp; Moment Diagram Solver &middot; made by @drnx64
      </footer>
    </div>
  );
}
