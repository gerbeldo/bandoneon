// Scale: which notes a run draws from — every note, or one key's major or
// natural minor scale. A keyed scale also fixes how notes are spelled: F major
// has a B♭, never an A♯, and F♯ major has an E♯, never an F.

import { Note, Scale } from 'tonal';

import type { Spelling } from './spelling';
import { accidentalGlyphs, FLATS, SHARPS } from './spelling';

export type ScaleKind = 'chromatic' | 'major' | 'minor';
export type KeyedScaleKind = Exclude<ScaleKind, 'chromatic'>;

export const SCALE_KINDS: ScaleKind[] = ['chromatic', 'major', 'minor'];

// What the practice setup chooses: the kind, and the tonic as a chroma
// (0 = C … 11 = B). The tonic is kept under chromatic, so switching back to a
// keyed scale finds it again.
export interface ScaleChoice {
  kind: ScaleKind;
  tonic: number;
}

export const CHROMATIC: Readonly<ScaleChoice> = { kind: 'chromatic', tonic: 0 };

export const CHROMA_COUNT = 12;

// Scale degrees as semitones above the tonic.
const DEGREES: Record<KeyedScaleKind, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

// One conventional tonic name per chroma. The six-accidental keys go by
// F♯ major and D♯ minor: E♭ minor would need C♭, whose written octave is not
// the sounding one (C♭4 sounds B3), while E♯4 sounds F4 and keeps its number.
const KEYS: Record<KeyedScaleKind, string[]> = {
  major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  minor: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
};

export function isKeyed(scale: ScaleChoice): scale is ScaleChoice & { kind: KeyedScaleKind } {
  return scale.kind !== 'chromatic';
}

// The tonic names of one kind, by chroma — the setup's key picker.
export function tonicNames(kind: KeyedScaleKind): string[] {
  return [...KEYS[kind]];
}

// "F major", "D♯ minor" — as shown to the player.
export function keyName(scale: ScaleChoice): string {
  if (!isKeyed(scale)) return 'Chromatic';
  return `${accidentalGlyphs(KEYS[scale.kind][scale.tonic])} ${scale.kind}`;
}

// The scale's pitch classes, tonic first, spelled as the key spells them.
// Chromatic lists all twelve as sharps.
export function scaleNoteNames(scale: ScaleChoice): string[] {
  if (!isKeyed(scale)) return [...SHARPS];
  return Scale.get(`${KEYS[scale.kind][scale.tonic]} ${scale.kind}`).notes;
}

// How the chosen key names the twelve chromas: the scale's own names, and
// sharps or flats by its signature for the rest. Null under chromatic, where
// the setup's own accidentals choice applies.
export function keySpelling(scale: ScaleChoice): Spelling | null {
  if (!isKeyed(scale)) return null;
  const names = scaleNoteNames(scale);
  const table = [...(names.some((name) => name.includes('b')) ? FLATS : SHARPS)];
  for (const name of names) table[chromaOf(name)] = name;
  return table;
}

export function scaleChromas(scale: ScaleChoice): Set<number> {
  if (!isKeyed(scale)) return new Set(SHARPS.keys());
  return new Set(DEGREES[scale.kind].map((degree) => (scale.tonic + degree) % CHROMA_COUNT));
}

// Pitch strings repeat across every pool filter, so their chromas are kept.
const chromas = new Map<string, number>();

// 0–11, or NaN for a name tonal cannot read.
export function chromaOf(pitch: string): number {
  let chroma = chromas.get(pitch);
  if (chroma === undefined) {
    chroma = Note.get(pitch).chroma ?? Number.NaN;
    chromas.set(pitch, chroma);
  }
  return chroma;
}

// Membership by sound, so spelling never matters; an unreadable pitch is out.
export function inScale(pitch: string, scale: ScaleChoice): boolean {
  return !isKeyed(scale) || scaleChromas(scale).has(chromaOf(pitch));
}
