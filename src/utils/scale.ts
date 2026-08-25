// Scale: which notes a run draws from — every note, or one key's major or
// natural minor scale. A keyed scale also fixes how accidentals are spelled:
// F major has a B♭, never an A♯.

import { Note } from 'tonal';

import type { Spelling } from './spelling';
import { accidentalGlyphs, spellPitch } from './spelling';

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

interface KeyName {
  // The key's conventional tonic name, as the setup labels it.
  tonic: string;
  // How the key spells its accidentals; C major and A minor have none.
  spelling: Spelling;
}

// One conventional name per tonic chroma. The six-accidental keys go by
// F♯ major and E♭ minor, so E♭ stays E♭ whichever kind is chosen.
const KEYS: Record<KeyedScaleKind, KeyName[]> = {
  major: [
    { tonic: 'C', spelling: 'sharp' },
    { tonic: 'Db', spelling: 'flat' },
    { tonic: 'D', spelling: 'sharp' },
    { tonic: 'Eb', spelling: 'flat' },
    { tonic: 'E', spelling: 'sharp' },
    { tonic: 'F', spelling: 'flat' },
    { tonic: 'F#', spelling: 'sharp' },
    { tonic: 'G', spelling: 'sharp' },
    { tonic: 'Ab', spelling: 'flat' },
    { tonic: 'A', spelling: 'sharp' },
    { tonic: 'Bb', spelling: 'flat' },
    { tonic: 'B', spelling: 'sharp' },
  ],
  minor: [
    { tonic: 'C', spelling: 'flat' },
    { tonic: 'C#', spelling: 'sharp' },
    { tonic: 'D', spelling: 'flat' },
    { tonic: 'Eb', spelling: 'flat' },
    { tonic: 'E', spelling: 'sharp' },
    { tonic: 'F', spelling: 'flat' },
    { tonic: 'F#', spelling: 'sharp' },
    { tonic: 'G', spelling: 'flat' },
    { tonic: 'G#', spelling: 'sharp' },
    { tonic: 'A', spelling: 'sharp' },
    { tonic: 'Bb', spelling: 'flat' },
    { tonic: 'B', spelling: 'sharp' },
  ],
};

export function isKeyed(scale: ScaleChoice): scale is ScaleChoice & { kind: KeyedScaleKind } {
  return scale.kind !== 'chromatic';
}

// The tonic names of one kind, by chroma — the setup's key picker.
export function tonicNames(kind: KeyedScaleKind): string[] {
  return KEYS[kind].map((key) => key.tonic);
}

// How the chosen key spells accidentals; null under chromatic, where the
// setup's own accidentals choice applies.
export function keySpelling(scale: ScaleChoice): Spelling | null {
  return isKeyed(scale) ? KEYS[scale.kind][scale.tonic].spelling : null;
}

// "F major", "E♭ minor" — as shown to the player.
export function keyName(scale: ScaleChoice): string {
  if (!isKeyed(scale)) return 'Chromatic';
  return `${accidentalGlyphs(KEYS[scale.kind][scale.tonic].tonic)} ${scale.kind}`;
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// The scale's pitch classes, tonic first, spelled as the key spells them.
// Chromatic lists all twelve as sharps.
export function scaleNoteNames(scale: ScaleChoice): string[] {
  if (!isKeyed(scale)) return [...SHARP_NAMES];
  const spelling = KEYS[scale.kind][scale.tonic].spelling;
  return DEGREES[scale.kind].map((degree) =>
    spellPitch(SHARP_NAMES[(scale.tonic + degree) % CHROMA_COUNT], spelling),
  );
}

export function scaleChromas(scale: ScaleChoice): Set<number> {
  if (!isKeyed(scale)) return new Set(SHARP_NAMES.keys());
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
