import { useState } from 'react';
import type { BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad, SupportType, LoadCase, UnitSystem } from '../types';
import { UNIT_SYSTEMS } from '../types';
import BlurInput from './BlurInput';
import {
  Trash2, Plus, ChevronRight, ChevronDown,
  Ruler, Columns2, ArrowDown, ArrowUp, RotateCw, LayoutDashboard,
  Pin, Circle, Square,
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

const inputBase = "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-shadow pr-7";

function DirBtn({ selected, onClick, children, title }: { selected: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
        selected
          ? 'bg-blue-500 text-white shadow-sm'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}>
      {children}
    </button>
  );
}

function IconBtn({ selected, onClick, children, title }: { selected: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
        selected
          ? 'bg-blue-500 text-white'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
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
  const [sections, setSections] = useState<Record<string, boolean>>({
    supports: true, pointLoads: true, moments: true, distLoads: true,
  });
  const [advancedLoads, setAdvancedLoads] = useState<Record<string, boolean>>({});

  const U = UNIT_SYSTEMS[unitSystem];

  function toggleSection(key: string) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function openSection(key: string) {
    if (!sections[key]) setSections(prev => ({ ...prev, [key]: true }));
  }

  function cap(v: number) { return Math.min(beamLength, Math.max(0, v)); }

  function addSupport() {
    if (supports.length >= 2) return;
    openSection('supports');
    const type: SupportType = supports.length === 0 ? 'fixed' : 'pin';
    setSupports([...supports, { id: genId(), type, position: supports.length === 0 ? 0 : beamLength }]);
  }
  function updSupport(id: string, f: Partial<BeamSupport>) { setSupports(supports.map(s => s.id === id ? { ...s, ...f } : s)); }
  function delSupport(id: string) { setSupports(supports.filter(s => s.id !== id)); }

  function addLoad() {
    openSection('pointLoads');
    setPointLoads([...pointLoads, {
      id: genId(), magnitude: 10, position: beamLength / 2,
      direction: 'down', angle: 0, loadCase: 'dead', repeatCount: 1, repeatInterval: 0,
    }]);
  }
  function updLoad(id: string, f: Partial<PointLoad>) { setPointLoads(pointLoads.map(p => p.id === id ? { ...p, ...f } : p)); }
  function delLoad(id: string) { setPointLoads(pointLoads.filter(p => p.id !== id)); }

  function addMoment() {
    openSection('moments');
    setMoments([...moments, { id: genId(), magnitude: 10, position: beamLength / 2, direction: 'CW', loadCase: 'dead' }]);
  }
  function updMoment(id: string, f: Partial<ConcentratedMoment>) { setMoments(moments.map(m => m.id === id ? { ...m, ...f } : m)); }
  function delMoment(id: string) { setMoments(moments.filter(m => m.id !== id)); }

  function addDist() {
    openSection('distLoads');
    setDistributedLoads([...distributedLoads, {
      id: genId(), startPos: 0, endPos: beamLength / 2,
      startMag: 10, endMag: 10, loadCase: 'dead',
    }]);
  }
  function updDist(id: string, f: Partial<DistributedLoad>) { setDistributedLoads(distributedLoads.map(d => d.id === id ? { ...d, ...f } : d)); }
  function delDist(id: string) { setDistributedLoads(distributedLoads.filter(d => d.id !== id)); }

  const supportTypes: SupportType[] = ['fixed', 'pin', 'roller'];
  const supportLabels: Record<SupportType, string> = { fixed: 'Fixed', pin: 'Pin', roller: 'Roller' };

  function Section({ icon: Icon, title, count, max, sectionKey, children }: {
    icon: React.ElementType; title: string; count: number; max?: number; sectionKey: string; children: React.ReactNode;
  }) {
    const open = sections[sectionKey] ?? true;
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <button onClick={() => toggleSection(sectionKey)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors select-none">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown size={14} className="text-slate-400 transition-transform" /> : <ChevronRight size={14} className="text-slate-400 transition-transform" />}
            <Icon size={14} className="text-slate-400" />
            <span>{title}</span>
            {count > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{count}{max ? `/${max}` : ''}</span>
            )}
          </div>
        </button>
        <div className={`overflow-hidden transition-all duration-100 ease-in-out ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-2">{children}</div>
        </div>
      </div>
    );
  }

  function RowAccent({ color }: { color: string }) {
    return <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l" style={{ background: color }} />;
  }

  function DeleteBtn({ onClick }: { onClick: () => void }) {
    return (
      <button onClick={onClick} title="Remove" aria-label="Remove"
        className="p-1 rounded text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-all duration-150">
        <Trash2 size={13} />
      </button>
    );
  }

  return (
    <div className="space-y-2 text-slate-700 text-xs">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Units</label>
        <div className="flex rounded-full bg-slate-100 p-0.5">
          <button
            onClick={() => setUnitSystem('metric')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${unitSystem === 'metric' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Metric (kN·m)
          </button>
          <button
            onClick={() => setUnitSystem('imperial')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${unitSystem === 'imperial' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Imperial (kips·ft)
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Ruler size={12} /> Beam Length
        </label>
        <BlurInput value={beamLength} onChange={setBeamLength} min={0.1} className={inputBase} suffix={U.length} />
      </div>

      {/* JSON Import / Export */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Import / Export</label>
        <div className="flex gap-2">
          <button onClick={() => {
            const data = { beamLength, supports, pointLoads, moments, distributedLoads, unitSystem };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'beam-config.json'; a.click();
            URL.revokeObjectURL(url);
          }} className="flex-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors">
            Export JSON
          </button>
          <label className="flex-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors cursor-pointer text-center">
            Import JSON
            <input type="file" accept=".json" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(reader.result as string);
                  if (typeof data.beamLength === 'number') setBeamLength(data.beamLength);
                  if (data.unitSystem === 'metric' || data.unitSystem === 'imperial') setUnitSystem(data.unitSystem);
                  if (Array.isArray(data.supports)) setSupports(data.supports.map((s: BeamSupport) => ({ ...s, id: genId() })));
                  if (Array.isArray(data.pointLoads)) setPointLoads(data.pointLoads.map((p: PointLoad) => ({ ...p, id: genId() })));
                  if (Array.isArray(data.moments)) setMoments(data.moments.map((m: ConcentratedMoment) => ({ ...m, id: genId() })));
                  if (Array.isArray(data.distributedLoads)) setDistributedLoads(data.distributedLoads.map((d: DistributedLoad) => ({ ...d, id: genId() })));
                } catch { alert('Invalid JSON file'); }
              };
              reader.readAsText(file);
              e.target.value = '';
            }} />
          </label>
        </div>
      </div>

      <Section icon={Columns2} title="Supports" count={supports.length} max={2} sectionKey="supports">
        {supports.map(s => (
          <div key={s.id} className="relative group flex items-center gap-2 p-2 bg-slate-50 rounded-md border border-slate-200 pl-3">
            <RowAccent color="#3b82f6" />
            <div className="flex gap-1">
              {supportTypes.map(t => (
                <IconBtn key={t} selected={s.type === t} onClick={() => updSupport(s.id, { type: t })}
                  title={supportLabels[t]}>
                  {t === 'fixed' ? <Square size={12} /> : t === 'pin' ? <Pin size={12} /> : <Circle size={12} />}
                </IconBtn>
              ))}
            </div>
            <BlurInput value={s.position} onChange={v => updSupport(s.id, { position: cap(v) })} className={inputBase} suffix={U.length} />
            <DeleteBtn onClick={() => delSupport(s.id)} />
          </div>
        ))}
        {supports.length < 2 ? (
          <button onClick={addSupport} className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium text-blue-600 border border-dashed border-slate-300 rounded-md hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Plus size={13} /> Add Support
          </button>
        ) : (
          <div className="text-center text-[10px] text-slate-400 py-1" title="Maximum 2 supports">Max 2 supports</div>
        )}
      </Section>

      <Section icon={ArrowDown} title="Point Loads" count={pointLoads.length} sectionKey="pointLoads">
        {pointLoads.map(p => {
          const showAdvanced = advancedLoads[p.id] ?? false;
          const toggleAdvanced = () => setAdvancedLoads(prev => ({ ...prev, [p.id]: !(prev[p.id] ?? false) }));
          return (
            <div key={p.id} className="relative group space-y-1.5 p-2 bg-slate-50 rounded-md border border-slate-200 pl-3" style={{ borderLeftColor: '#f59e0b' }}>
              <RowAccent color="#f59e0b" />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <DirBtn selected={p.direction === 'down'} onClick={() => updLoad(p.id, { direction: 'down' })} title="Down">
                    <ArrowDown size={13} />
                  </DirBtn>
                  <DirBtn selected={p.direction === 'up'} onClick={() => updLoad(p.id, { direction: 'up' })} title="Up">
                    <ArrowUp size={13} />
                  </DirBtn>
                </div>
                <DeleteBtn onClick={() => delLoad(p.id)} />
              </div>
              <div className="flex items-center gap-1.5">
                <BlurInput value={p.position} onChange={v => updLoad(p.id, { position: cap(v) })} className={inputBase} suffix={U.length} placeholder="Pos" />
                <BlurInput value={p.magnitude} onChange={v => updLoad(p.id, { magnitude: v })} className={inputBase} suffix={U.force} placeholder="Mag" />
              </div>
              <div className="flex items-center gap-1.5">
                <select value={p.loadCase} onChange={e => updLoad(p.id, { loadCase: e.target.value as LoadCase })}
                  className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:border-blue-500 focus:outline-none">
                  {loadCases.map(lc => <option key={lc} value={lc}>{lc}</option>)}
                </select>
                <button onClick={toggleAdvanced}
                  className="text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-1 rounded transition-colors">
                  {showAdvanced ? 'Less' : 'More'}
                </button>
              </div>
              {showAdvanced && (
                <div className="space-y-1.5 pt-1 border-t border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] text-slate-500 w-10">Angle</label>
                    <BlurInput value={p.angle} onChange={v => updLoad(p.id, { angle: v })} min={-90} max={90} className={inputBase} suffix="°" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
                      <input type="checkbox" checked={p.repeatCount > 1}
                        onChange={e => updLoad(p.id, { repeatCount: e.target.checked ? 2 : 1, repeatInterval: e.target.checked ? beamLength / 3 : 0 })}
                        className="rounded border-slate-300 text-blue-500 focus:ring-blue-500 w-3 h-3" />
                      Repeat
                    </label>
                  </div>
                  {p.repeatCount > 1 && (
                    <div className="flex items-center gap-1.5">
                      <BlurInput value={p.repeatCount} onChange={v => updLoad(p.id, { repeatCount: v })} min={2} max={20} className={inputBase} suffix="×" />
                      <BlurInput value={p.repeatInterval} onChange={v => updLoad(p.id, { repeatInterval: v })} min={0.1} className={inputBase} suffix={U.length} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button onClick={addLoad} className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium text-blue-600 border border-dashed border-slate-300 rounded-md hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <Plus size={13} /> Add Point Load
        </button>
      </Section>

      <Section icon={RotateCw} title="Moments" count={moments.length} sectionKey="moments">
        {moments.map(m => (
          <div key={m.id} className="relative group space-y-1.5 p-2 bg-slate-50 rounded-md border border-slate-200 pl-3" style={{ borderLeftColor: '#a855f7' }}>
            <RowAccent color="#a855f7" />
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <DirBtn selected={m.direction === 'CW'} onClick={() => updMoment(m.id, { direction: 'CW' })} title="Clockwise">
                  <RotateCw size={13} className="scale-x-[-1]" />
                </DirBtn>
                <DirBtn selected={m.direction === 'CCW'} onClick={() => updMoment(m.id, { direction: 'CCW' })} title="Counter-clockwise">
                  <RotateCw size={13} />
                </DirBtn>
              </div>
              <DeleteBtn onClick={() => delMoment(m.id)} />
            </div>
            <div className="flex items-center gap-1.5">
              <BlurInput value={m.magnitude} onChange={v => updMoment(m.id, { magnitude: v })} className={inputBase} suffix={U.moment} placeholder="Mag" />
              <BlurInput value={m.position} onChange={v => updMoment(m.id, { position: cap(v) })} className={inputBase} suffix={U.length} placeholder="Pos" />
            </div>
          </div>
        ))}
        <button onClick={addMoment} className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium text-blue-600 border border-dashed border-slate-300 rounded-md hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <Plus size={13} /> Add Moment
        </button>
      </Section>

      <Section icon={LayoutDashboard} title="Dist. Loads" count={distributedLoads.length} sectionKey="distLoads">
        {distributedLoads.map(d => (
          <div key={d.id} className="relative group space-y-1.5 p-2 bg-slate-50 rounded-md border border-slate-200 pl-3" style={{ borderLeftColor: '#14b8a6' }}>
            <RowAccent color="#14b8a6" />
            <div className="flex items-center justify-end">
              <DeleteBtn onClick={() => delDist(d.id)} />
            </div>
            <div className="flex items-center gap-1.5">
              <BlurInput value={d.startPos} onChange={v => updDist(d.id, { startPos: cap(v) })} className={inputBase} suffix={U.length} placeholder="Start" />
              <BlurInput value={d.endPos} onChange={v => updDist(d.id, { endPos: cap(v) })} className={inputBase} suffix={U.length} placeholder="End" />
            </div>
            <div className="flex items-center gap-1.5">
              <BlurInput value={d.startMag} onChange={v => updDist(d.id, { startMag: v })} className={inputBase} suffix={U.distLoad} placeholder="w₁" />
              <BlurInput value={d.endMag} onChange={v => updDist(d.id, { endMag: v })} className={inputBase} suffix={U.distLoad} placeholder="w₂" />
            </div>
            <select value={d.loadCase} onChange={e => updDist(d.id, { loadCase: e.target.value as LoadCase })}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:border-blue-500 focus:outline-none">
              {loadCases.map(lc => <option key={lc} value={lc}>{lc}</option>)}
            </select>
          </div>
        ))}
        <button onClick={addDist} className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium text-blue-600 border border-dashed border-slate-300 rounded-md hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <Plus size={13} /> Add Distributed Load
        </button>
      </Section>
    </div>
  );
}
