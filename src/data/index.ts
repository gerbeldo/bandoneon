import rheinische142 from './instruments/rheinische142';

export type Instrument = Record<'right' | 'left', Record<'open' | 'close', string[][]>>;

// The app models exactly one instrument; the registry stays a map so item keys
// keep naming it (ADR 0002).
export const instruments = <Record<string, Instrument>>{
  rheinische142,
};

export const pitchNotations = <Array<'scientific' | 'helmholtz' | 'solfege' | 'staff'>>[
  'scientific',
  'helmholtz',
  'solfege',
  'staff',
];

export const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const scaleTypes = ['major', 'minor', 'chromatic'];

export const chordTypes = ['M', 'm', '7', 'dim', 'm7', 'M7'];

export const colors = [
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#0ea5e9', // sky-500
  '#ef4444', // red-500
];
