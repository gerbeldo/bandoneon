import { Note } from 'tonal';
import { describe, expect, it } from 'vitest';

import type { Spelling } from '../spelling';
import {
  accidentalGlyphs,
  displayPitchClass,
  FLATS,
  isAccidental,
  SHARPS,
  SPELLINGS,
  spellingTable,
  spellPitch,
} from '../spelling';

// F♯ major's names over the sharps: the seventh degree is E♯, not F.
const F_SHARP_MAJOR: Spelling = SHARPS.map((name, chroma) => (chroma === 5 ? 'E#' : name));

describe('isAccidental', () => {
  it('is true for a sharp or a flat, whatever octave', () => {
    expect(isAccidental('C#4')).toBe(true);
    expect(isAccidental('Db4')).toBe(true);
    expect(isAccidental('A#2')).toBe(true);
  });

  it('is false for a natural', () => {
    expect(isAccidental('C4')).toBe(false);
    expect(isAccidental('B3')).toBe(false);
  });

  it('reads a bare pitch class too', () => {
    expect(isAccidental('C#')).toBe(true);
    expect(isAccidental('Db')).toBe(true);
    expect(isAccidental('C')).toBe(false);
  });

  it('is false for a name it cannot read', () => {
    expect(isAccidental('nope')).toBe(false);
    expect(isAccidental('')).toBe(false);
  });
});

describe('SHARPS and FLATS', () => {
  it('name each of the twelve chromas, in chroma order', () => {
    for (const table of [SHARPS, FLATS]) {
      expect(table).toHaveLength(12);
      expect(table.map((name) => Note.get(name).chroma)).toEqual([...Array(12).keys()]);
    }
  });

  it('name the naturals alike and the five accidentals as sharps or as flats', () => {
    expect(SHARPS).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
    expect(FLATS).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']);
  });
});

describe('spellingTable', () => {
  it('maps the setup’s one-way choices to their tables', () => {
    expect(spellingTable('sharp')).toBe(SHARPS);
    expect(spellingTable('flat')).toBe(FLATS);
  });
});

describe('spellPitch', () => {
  it('respells a sharp as a flat and back', () => {
    expect(spellPitch('C#4', FLATS)).toBe('Db4');
    expect(spellPitch('Db4', SHARPS)).toBe('C#4');
  });

  it('leaves a pitch already in the asked spelling alone', () => {
    expect(spellPitch('C#4', SHARPS)).toBe('C#4');
    expect(spellPitch('Db4', FLATS)).toBe('Db4');
  });

  it('passes naturals through in either spelling', () => {
    expect(spellPitch('C4', FLATS)).toBe('C4');
    expect(spellPitch('C4', SHARPS)).toBe('C4');
    expect(spellPitch('B3', FLATS)).toBe('B3');
  });

  it('works on a bare pitch class, keeping it octave-less', () => {
    expect(spellPitch('C#', FLATS)).toBe('Db');
    expect(spellPitch('Db', SHARPS)).toBe('C#');
    expect(spellPitch('C', FLATS)).toBe('C');
    expect(spellPitch('F', F_SHARP_MAJOR)).toBe('E#');
  });

  it('names a natural by the table where a key asks it to: F is E♯ in F♯ major', () => {
    expect(spellPitch('F4', F_SHARP_MAJOR)).toBe('E#4');
    expect(Note.midi('E#4')).toBe(Note.midi('F4'));
    expect(spellPitch('F#4', F_SHARP_MAJOR)).toBe('F#4');
    expect(spellPitch('E4', F_SHARP_MAJOR)).toBe('E4');
  });

  it('keeps the sounding pitch, crossing letter and octave where it must', () => {
    expect(spellPitch('E#4', FLATS)).toBe('F4');
    expect(spellPitch('E#4', SHARPS)).toBe('F4');
    expect(spellPitch('Cb4', SHARPS)).toBe('B3');
  });

  it('passes a name it cannot read through unchanged', () => {
    expect(spellPitch('nope', FLATS)).toBe('nope');
    expect(spellPitch('nope', SHARPS)).toBe('nope');
    expect(spellPitch('', FLATS)).toBe('');
  });
});

describe('displayPitchClass', () => {
  it('prints the respelled pitch class with accidental glyphs', () => {
    expect(displayPitchClass('C#', FLATS, 'scientific')).toBe('D♭');
    expect(displayPitchClass('F', F_SHARP_MAJOR, 'scientific')).toBe('E♯');
    expect(displayPitchClass('F', SHARPS, 'scientific')).toBe('F');
  });

  it('prints solfège when asked', () => {
    expect(displayPitchClass('C#', FLATS, 'solfege')).toBe('Re♭');
    expect(displayPitchClass('F', F_SHARP_MAJOR, 'solfege')).toBe('Mi♯');
  });
});

describe('accidentalGlyphs', () => {
  it('prints ascii accidentals as their unicode signs', () => {
    expect(accidentalGlyphs('C#4')).toBe('C♯4');
    expect(accidentalGlyphs('Db4')).toBe('D♭4');
    expect(accidentalGlyphs('Bb')).toBe('B♭');
  });

  it('leaves a natural, and the note letter B, alone', () => {
    expect(accidentalGlyphs('C4')).toBe('C4');
    expect(accidentalGlyphs('B3')).toBe('B3');
    expect(accidentalGlyphs('')).toBe('');
  });
});

describe('SPELLINGS', () => {
  it('offers one spelling each and both', () => {
    expect(SPELLINGS).toEqual(['sharp', 'flat', 'both']);
  });
});
