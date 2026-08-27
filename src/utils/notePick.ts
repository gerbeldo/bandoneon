// The pick: the note-game answer in progress — a letter, an accidental, and an
// octave, composed into one spelled pitch for the engine. The name is the
// player's own: E♯ stays E♯, never respelled into the prompt's table.

import type { StaffGlyph } from '../assets/staffGlyphs';
import { staffGlyphs } from '../assets/staffGlyphs';
import { formatPitchClass } from './spelling';

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

// '' is natural; doubles spell as tonal reports them ('##', 'bb'), never 'x'.
export type Accidental = '' | '#' | '##' | 'b' | 'bb';

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Row order: flattest to sharpest, natural in the middle.
export const ACCIDENTALS: readonly Accidental[] = ['bb', 'b', '', '#', '##'];

// Accessible names; the visible face is a drawn glyph (AccidentalGlyph.vue).
export const ACCIDENTAL_NAMES: Record<Accidental, string> = {
  bb: 'Double flat',
  b: 'Flat',
  '': 'Natural',
  '#': 'Sharp',
  '##': 'Double sharp',
};

// Drawn outlines, not typed characters: many phone fonts lack 𝄪 and 𝄫, so
// the inputs draw every sign from the extracted paths.
export const ACCIDENTAL_GLYPHS: Record<Accidental, StaffGlyph> = {
  '': staffGlyphs.accidentalNatural,
  '#': staffGlyphs.accidentalSharp,
  '##': staffGlyphs.accidentalDoubleSharp,
  b: staffGlyphs.accidentalFlat,
  bb: staffGlyphs.accidentalDoubleFlat,
};

export interface NotePick {
  letter: Letter | null;
  accidental: Accidental;
  octave: number | null;
}

export function emptyPick(): NotePick {
  return { letter: null, accidental: '', octave: null };
}

// The spelled pitch a complete pick names; null while a part is missing.
export function pitchOf(pick: NotePick): string | null {
  return pick.letter && pick.octave !== null ? pick.letter + pick.accidental + pick.octave : null;
}

// Plain signs every phone font carries; a double prints as two (♯♯), never as
// 𝄪/𝄫 text, which many system fonts lack — drawn faces use the outlines instead.
const SIGN: Record<Accidental, string> = { '': '', '#': '♯', '##': '♯♯', b: '♭', bb: '♭♭' };

// The pick as the player wrote it, in letters or solfège: E♯, Do♯♯; '?' before
// a letter is chosen.
export function pickLabel(pick: NotePick, notation: string): string {
  return pick.letter ? formatPitchClass(pick.letter, notation) + SIGN[pick.accidental] : '?';
}

const KEY_ACCIDENTALS: Record<string, Accidental> = { '#': '#', '-': 'b', x: '##' };

// What a keydown means for the pick; null for keys that are not note input.
// Shift+letter names that letter sharp, as the old shortcuts did.
export function pickFromKey(key: string): Partial<NotePick> | null {
  if (/^[cdefgab]$/.test(key)) return { letter: key.toUpperCase() as Letter };
  if (/^[CDEFGAB]$/.test(key)) return { letter: key as Letter, accidental: '#' };
  if (key in KEY_ACCIDENTALS) return { accidental: KEY_ACCIDENTALS[key] };
  if (/^\d$/.test(key)) return { octave: Number(key) };
  return null;
}

// The octaves a layout offers, read off its key positions, ascending.
export function octavesOf(keyPositions: readonly (readonly [number, number, string])[]): number[] {
  const octaves = new Set<number>();
  for (const [, , name] of keyPositions) {
    const octave = Number.parseInt(name[name.length - 1] ?? '', 10);
    if (!Number.isNaN(octave)) octaves.add(octave);
  }
  return [...octaves].sort((a, b) => a - b);
}

// An octave as the row prints it: the digit or, under Helmholtz, the picked
// name's case and marks (C, c, c’, c’’ …).
export function formatOctave(pitchClass: string, octave: number, notation: string): string {
  if (notation !== 'helmholtz') return '' + octave;
  const name = pitchClass || 'X';
  return (
    (octave < 3 ? name : name.toLowerCase()) +
    (octave > 3 ? '’'.repeat(octave - 3) : '') +
    (octave < 2 ? ','.repeat(-(octave - 2)) : '')
  );
}
