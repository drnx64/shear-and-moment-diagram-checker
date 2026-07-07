import { useState } from 'react';
import type { BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad, SupportType, LoadCase, UnitSystem } from '../types';
import { UNIT_SYSTEMS } from '../types';
import {
  Trash2, Plus, ChevronDown, ChevronUp,
  Ruler, Columns2, ArrowDown, ArrowUp, RotateCw, LayoutDashboard,
} from 'lucide-react';

interface Props {
  beamLength: number;
  setBeamLength: (v: number) => void;
  supports: BeamSupport[];
  setSupports: (v: BeamSupport[]) => void;
  pointLoads: PointLoad[];
  setPointLoads: (v: PointLoad[]) => void;
  moments: ConcentratedMoment[];
  setMoments: (v: ConcentratedMoment[]) => void;
  distributedLoads: DistributedLoad[];
  setDistributedLoads: (v: DistributedLoad[]) => void;
  unitSystem: UnitSystem;
  setUnitSystem: (v: UnitSystem) => void;
}

let nextId = 1;
function genId(): string { return `id-${nextId++}-${Date.now()}`; }

const loadCases: LoadCase[] = ['dead', 'live', 'wind', 'roof', 'rain', 'snow', 'earthquake'];
const supportTypes: SupportType[] = ['fixed', 'pin', 'roller'];

const inputBase = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-shadow";
const labelBase = "block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1";

function DirBtn({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
      }`}>
      {children}
    </button>
  );
}

export default function ControlPanel({
  beamLength, setBeamLength, supports, setSupports,
  pointLoads, setPointLoads, moments, setMoments,
  distributedLoads, setDistributedLoads,
  unitSystem, setUnitSystem,
}: Props) {
  const [supportsOpen, setSupportsOpen] = useState(true);
  const [loadsOpen, setLoadsOpen] = useState(true);
  const [momentsOpen, setMomentsOpen] = useState(true);
  const [distOpen, setDistOpen] = useState(true);

  const U = UNIT_SYSTEMS[unitSystem];

  function addSupport() {
    if (supports.length >= 2) return;
    const type = supports.length === 0 ? 'fixed' : 'pin';
    setSupports([...supports, { id: genId(), type, position: supports.length === 0 ? 0 : beamLength }]);
  }
  function updSupport(id: string, f: Partial<BeamSupport>) {
    setSupports(supports.map(s => s.id === id ? { ...s, ...f } : s));
  }
  function delSupport(id: string) { setSupports(supports.filter(s => s.id !== id)); }

  function addLoad() {
    setPointLoads([...pointLoads, {
      id: genId(), magnitude: 10, position: beamLength / 2,
      direction: 'down', angle: 0, loadCase: 'dead', repeatCount: 1, repeatInterval: 0,
    }]);
  }
  function updLoad(id: string, f: Partial<PointLoad>) {
    setPointLoads(pointLoads.map(p => p.id === id ? { ...p, ...f } : p));
  }
  function delLoad(id: string) { setPointLoads(pointLoads.filter(p => p.id !== id)); }

  function addMoment() {
    setMoments([...moments, { id: genId(), magnitude: 10, position: beamLength / 2, direction: 'CW', loadCase: 'dead' }]);
  }
  function updMoment(id: string, f: Partial<ConcentratedMoment>) {
    setMoments(moments.map(m => m.id === id ? { ...m, ...f } : m));
  }
  function delMoment(id: string) { setMoments(moments.filter(m => m.id !== id)); }

  function addDist() {
    setDistributedLoads([...distributedLoads, {
      id: genId(), startPos: 0, endPos: beamLength / 2,
      startMag: 10, endMag: 10, loadCase: 'dead',
    }]);
  }
  function updDist(id: string, f: Partial<DistributedLoad>) {
    setDistributedLoads(distributedLoads.map(d => d.id === id ? { ...d, ...f } : d));
  }
  function delDist(id: string) { setDistributedLoads(distributedLoads.filter(d => d.id !== id)); }

  function cap(v: number) { return Math.min(beamLength, Math.max(0, v)); }
function safeParse(s: string, fallback?: number): number | undefined {
  const v = parseFloat(s);
  return isNaN(v) ? fallback : v;
}

  function Section({ icon: Icon, title, count, max, open, onToggle, children }: {
    icon: React.ElementType; title: string; count: number; max?: number; open: boolean; onToggle: () => void; children: React.ReactNode;
  }) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button onClick={onToggle} className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2.5">
            <Icon size={16} className="text-slate-400" />
            <span>{title}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
            }`}>{count}{max ? ` / ${max}` : ''}</span>
          </div>
          {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
        </button>
        {open && <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">{children}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-slate-700">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Units</span>
        <select value={unitSystem} onChange={e => setUnitSystem(e.target.value as UnitSystem)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="metric">Metric (kN, m)</option>
          <option value="imperial">Imperial (kips, ft)</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <label className={`${labelBase} flex items-center gap-1.5`}><Ruler size={13} /> Beam Length</label>
        <div className="flex items-center gap-2">
          <input type="text" inputMode="decimal" value={beamLength}
            onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0.1) setBeamLength(v); }}
            onBlur={() => { if (beamLength < 0.1) setBeamLength(0.1); }}
            className={inputBase} />
          <span className="text-sm font-medium text-slate-400 w-6">{U.length}</span>
        </div>
      </div>

      <Section icon={Columns2} title="Supports" count={supports.length} max={2} open={supportsOpen} onToggle={() => setSupportsOpen(!supportsOpen)}>
        {supports.map(s => (
          <div key={s.id} className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex-1 space-y-2">
              <div>
                <label className={labelBase}>Type</label>
                <select value={s.type} onChange={e => updSupport(s.id, { type: e.target.value as SupportType })}
                  className={inputBase}>
                  {supportTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelBase}>Position ({U.length})</label>
                <input type="text" inputMode="decimal" value={s.position}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) updSupport(s.id, { position: cap(v) }); }}
                  className={inputBase} />
              </div>
            </div>
            <button onClick={() => delSupport(s.id)}
              className="p-1.5 mt-6 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {supports.length < 2 && (
          <button onClick={addSupport} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
            <Plus size={14} /> Add Support
          </button>
        )}
      </Section>

      <Section icon={ArrowDown} title="Point Loads" count={pointLoads.length} open={loadsOpen} onToggle={() => setLoadsOpen(!loadsOpen)}>
        {pointLoads.map(p => (
          <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className={labelBase}>Direction</span>
              <div className="flex gap-2">
                <DirBtn selected={p.direction === 'down'} onClick={() => updLoad(p.id, { direction: 'down' })}>
                  <ArrowDown size={16} />
                </DirBtn>
                <DirBtn selected={p.direction === 'up'} onClick={() => updLoad(p.id, { direction: 'up' })}>
                  <ArrowUp size={16} />
                </DirBtn>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelBase}>Position ({U.length})</label>
                <input type="text" inputMode="decimal" value={p.position}
                  onChange={e => { const v = safeParse(e.target.value); if (v !== undefined) updLoad(p.id, { position: cap(v) }); }}
                  className={inputBase} />
              </div>
              <div>
                <label className={labelBase}>Magnitude ({U.force})</label>
                <input type="text" inputMode="decimal" value={p.magnitude}
                  onChange={e => { const v = safeParse(e.target.value); if (v !== undefined) updLoad(p.id, { magnitude: Math.max(0, v) }); }}
                  className={inputBase} />
              </div>
            </div>
            <div>
              <label className={labelBase}>Angle (° from vertical)</label>
              <input type="text" inputMode="decimal" value={p.angle}
                onChange={e => { const v = safeParse(e.target.value); if (v !== undefined) updLoad(p.id, { angle: Math.min(90, Math.max(0, v)) }); }}
                className={inputBase} />
            </div>
            <div>
              <label className={labelBase}>Load Case</label>
              <select value={p.loadCase} onChange={e => updLoad(p.id, { loadCase: e.target.value as LoadCase })}
                className={inputBase}>
                {loadCases.map(lc => <option key={lc} value={lc}>{lc}</option>)}
              </select>
            </div>
            <div className="border-t border-slate-200 pt-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <input type="checkbox" id={`repeat-${p.id}`} checked={p.repeatCount > 1}
                  onChange={e => updLoad(p.id, { repeatCount: e.target.checked ? 2 : 1, repeatInterval: e.target.checked ? beamLength / 3 : 0 })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor={`repeat-${p.id}`} className="text-xs font-medium text-slate-600">Repeat Loads</label>
              </div>
              {p.repeatCount > 1 && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelBase}>Number of Loads</label>
                    <input type="text" inputMode="numeric" value={p.repeatCount}
                      onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) updLoad(p.id, { repeatCount: Math.max(2, Math.min(20, v)) }); }}
                      className={inputBase} />
                  </div>
                  <div>
                    <label className={labelBase}>Interval ({U.length})</label>
                    <input type="text" inputMode="decimal" value={p.repeatInterval}
                      onChange={e => { const v = safeParse(e.target.value); if (v !== undefined) updLoad(p.id, { repeatInterval: Math.max(0.1, v) }); }}
                      className={inputBase} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={() => delLoad(p.id)}
                className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600 transition-colors">
                <Trash2 size={13} /> Remove Load
              </button>
            </div>
          </div>
        ))}
        <button onClick={addLoad} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
          <Plus size={14} /> Add Point Load
        </button>
      </Section>

      <Section icon={RotateCw} title="Moments" count={moments.length} open={momentsOpen} onToggle={() => setMomentsOpen(!momentsOpen)}>
        {moments.map(m => (
          <div key={m.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className={labelBase}>Direction</span>
              <div className="flex gap-2">
                <DirBtn selected={m.direction === 'CW'} onClick={() => updMoment(m.id, { direction: 'CW' })}>
                  <RotateCw size={14} /> Clockwise
                </DirBtn>
                <DirBtn selected={m.direction === 'CCW'} onClick={() => updMoment(m.id, { direction: 'CCW' })}>
                  <RotateCw size={14} className="scale-x-[-1]" /> CCW
                </DirBtn>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelBase}>Magnitude ({U.moment})</label>
                <input type="text" inputMode="decimal" value={m.magnitude}
                  onChange={e => { const v = safeParse(e.target.value); if (v !== undefined) updMoment(m.id, { magnitude: v }); }}
                  className={inputBase} />
              </div>
              <div>
                <label className={labelBase}>Position ({U.length})</label>
                <input type="text" inputMode="decimal" value={m.position}
                  onChange={e => { const v = safeParse(e.target.value); if (v !== undefined) updMoment(m.id, { position: cap(v) }); }}
                  className={inputBase} />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => delMoment(m.id)}
                className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600 transition-colors">
                <Trash2 size={13} /> Remove Moment
              </button>
            </div>
          </div>
        ))}
        <button onClick={addMoment} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
          <Plus size={14} /> Add Moment
        </button>
      </Section>

      <Section icon={LayoutDashboard} title="Dist. Loads" count={distributedLoads.length} open={distOpen} onToggle={() => setDistOpen(!distOpen)}>
        {distributedLoads.map(d => (
          <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelBase}>Start Pos ({U.length})</label>
                <input type="text" inputMode="decimal" value={d.startPos}
                  onChange={e => { const v = safeParse(e.target.value); if (v !== undefined) updDist(d.id, { startPos: cap(v) }); }}
                  className={inputBase} />
              </div>
              <div>
                <label className={labelBase}>End Pos ({U.length})</label>
                <input type="text" inputMode="decimal" value={d.endPos}
                  onChange={e => { const v = safeParse(e.target.value); if (v !== undefined) updDist(d.id, { endPos: cap(v) }); }}
                  className={inputBase} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelBase}>Start Mag ({U.distLoad})</label>
                <input type="text" inputMode="decimal" value={d.startMag}
                  onChange={e => { const v = safeParse(e.target.value); if (v !== undefined) updDist(d.id, { startMag: v }); }}
                  className={inputBase} />
              </div>
              <div>
                <label className={labelBase}>End Mag ({U.distLoad})</label>
                <input type="text" inputMode="decimal" value={d.endMag}
                  onChange={e => { const v = safeParse(e.target.value); if (v !== undefined) updDist(d.id, { endMag: v }); }}
                  className={inputBase} />
              </div>
            </div>
            <div>
              <label className={labelBase}>Load Case</label>
              <select value={d.loadCase} onChange={e => updDist(d.id, { loadCase: e.target.value as LoadCase })}
                className={inputBase}>
                {loadCases.map(lc => <option key={lc} value={lc}>{lc}</option>)}
              </select>
            </div>
            <div className="flex justify-end">
              <button onClick={() => delDist(d.id)}
                className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600 transition-colors">
                <Trash2 size={13} /> Remove Load
              </button>
            </div>
          </div>
        ))}
        <button onClick={addDist} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
          <Plus size={14} /> Add Distributed Load
        </button>
      </Section>
    </div>
  );
}
