// Spelling: which enharmonic name an accidental goes by. Layout data spells
// every accidental as a sharp; the flat spelling is derived.

import { Note } from 'tonal';

import { scientificToSolfegeNotation } from './solfege';

export type Spelling = 'sharp' | 'flat';

// What a run is set to: one spelling, or both — each accidental item named
// one way or the other, drawn at random per run.
export type SpellingChoice = Spelling | 'both';

export const SPELLINGS: SpellingChoice[] = ['sharp', 'flat', 'both'];

export function isAccidental(pitch: string): boolean {
  return Note.get(pitch).acc !== '';
}

// Respells a pitch (or pitch class) into the given spelling; naturals and an
// unreadable name pass through unchanged.
export function spellPitch(pitch: string, spelling: Spelling): string {
  const acc = Note.get(pitch).acc;
  if ((spelling === 'flat' && acc === '#') || (spelling === 'sharp' && acc === 'b')) {
    return Note.enharmonic(pitch);
  }
  return pitch;
}

// Display form: unicode accidentals, as the keyboard and the palette print them.
export function accidentalGlyphs(name: string): string {
  return name.replace('#', '♯').replace('b', '♭');
}

// A pitch class as written — no respelling — in letters or solfège.
export function formatPitchClass(pc: string, notation: string): string {
  return accidentalGlyphs(notation === 'solfege' ? scientificToSolfegeNotation(pc) : pc);
}

// A pitch class as the palette prints it: respelled, in letters or solfège.
export function displayPitchClass(pc: string, spelling: Spelling, notation: string): string {
  return formatPitchClass(spellPitch(pc, spelling), notation);
}
