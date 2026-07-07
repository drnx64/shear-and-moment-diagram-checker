export type SupportType = 'fixed' | 'roller' | 'pin';
export type LoadDirection = 'up' | 'down';
export type MomentDirection = 'CW' | 'CCW';
export type LoadCase = 'dead' | 'live' | 'wind' | 'roof' | 'rain' | 'snow' | 'earthquake';
export type UnitSystem = 'metric' | 'imperial';

export interface UnitLabels {
  force: string;
  length: string;
  distLoad: string;
  moment: string;
}

export const UNIT_SYSTEMS: Record<UnitSystem, UnitLabels> = {
  metric: { force: 'kN', length: 'm', distLoad: 'kN/m', moment: 'kN·m' },
  imperial: { force: 'kips', length: 'ft', distLoad: 'kips/ft', moment: 'kip·ft' },
};

export interface BeamSupport {
  id: string;
  type: SupportType;
  position: number;
}

export interface PointLoad {
  id: string;
  magnitude: number;
  position: number;
  direction: LoadDirection;
  angle: number;
  loadCase: LoadCase;
  repeatCount: number;
  repeatInterval: number;
}

export interface ConcentratedMoment {
  id: string;
  magnitude: number;
  position: number;
  direction: MomentDirection;
  loadCase: LoadCase;
}

export interface DistributedLoad {
  id: string;
  startPos: number;
  endPos: number;
  startMag: number;
  endMag: number;
  loadCase: LoadCase;
}

export interface Reaction {
  id: string;
  supportId: string;
  vertical: number;
  horizontal: number;
  moment: number;
}

export interface DiagramPoint {
  x: number;
  shear: number;
  moment: number;
}

export interface ShearDerivationLine {
  label: string;
  value: string;
}

export interface MomentDerivationLine {
  label: string;
  value: string;
}

export interface SegmentDerivation {
  shear: {
    equation: string;
    terms: ShearDerivationLine[];
    result: string;
    fullEquation: string;
  };
  moment: {
    equation: string;
    terms: MomentDerivationLine[];
    result: string;
    fullEquation: string;
  };
}

export interface SegmentInfo {
  start: number;
  end: number;
  shearFormula: string;
  momentFormula: string;
  vStart: number;
  mStart: number;
  distLoad: { wStart: number; wEnd: number; startPos: number; endPos: number } | null;
  derivation?: SegmentDerivation;
}

export interface ZeroCrossing {
  position: number;
  fromLabel: string;
  distance: number;
}

export interface BeamResult {
  reactions: Reaction[];
  diagramPoints: DiagramPoint[];
  segments: SegmentInfo[];
  maxShear: number;
  minShear: number;
  maxMoment: number;
  minMoment: number;
  shearZeroCrossings: number[];
}

export interface LabeledPoint {
  position: number;
  label: string;
  type: 'support' | 'load' | 'moment' | 'dist' | 'end';
}
