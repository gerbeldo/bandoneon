// Spelling: the name each of the twelve pitch classes goes by — a table of
// twelve names indexed by chroma (0 = C … 11 = B). Layout data spells every
// accidental as a sharp; any other spelling is derived by respelling into the
// table's name, so a key may name a natural too (E♯ in F♯ major).

import { Note } from 'tonal';

import { scientificToSolfegeNotation } from './solfege';

export type Spelling = readonly string[];

export const SHARPS: Spelling = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLATS: Spelling = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// What the practice setup stores: sharps, flats, or both.
export type SpellingChoice = 'sharp' | 'flat' | 'both';

export const SPELLINGS: SpellingChoice[] = ['sharp', 'flat', 'both'];

export function spellingTable(choice: Exclude<SpellingChoice, 'both'>): Spelling {
  return choice === 'flat' ? FLATS : SHARPS;
}

// What a run is set to: one table for every prompt, or 'both' — each accidental
// item named from SHARPS or FLATS, drawn at random when the run starts.
export type RunSpelling = Spelling | 'both';

// The setup's stored choice as a run takes it.
export function runSpelling(choice: SpellingChoice): RunSpelling {
  return choice === 'both' ? 'both' : spellingTable(choice);
}

export function isAccidental(pitch: string): boolean {
  return Note.get(pitch).acc !== '';
}

// Respells a pitch (or pitch class) by the table, keeping the sounding pitch
// (C♭4 is B3); an unreadable name passes through unchanged.
export function spellPitch(pitch: string, spelling: Spelling): string {
  const note = Note.get(pitch);
  return note.empty ? pitch : Note.enharmonic(pitch, spelling[note.chroma]);
}

// Display form: unicode accidentals, as the keyboard and the palette print them.
// Doubles first, so C## reads 𝄪 rather than ♯♯.
export function accidentalGlyphs(name: string): string {
  return name.replace('##', '𝄪').replace('bb', '𝄫').replace('#', '♯').replace('b', '♭');
}

// A pitch class as written — no respelling — in letters or solfège.
export function formatPitchClass(pc: string, notation: string): string {
  return accidentalGlyphs(notation === 'solfege' ? scientificToSolfegeNotation(pc) : pc);
}

// A pitch class as the palette prints it: respelled, in letters or solfège.
export function displayPitchClass(pc: string, spelling: Spelling, notation: string): string {
  return formatPitchClass(spellPitch(pc, spelling), notation);
}
