import { describe, expect, it } from 'vitest';

import { accidentalGlyphs, isAccidental, SPELLINGS, spellPitch } from '../spelling';

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

describe('spellPitch', () => {
  it('respells a sharp as a flat and back', () => {
    expect(spellPitch('C#4', 'flat')).toBe('Db4');
    expect(spellPitch('Db4', 'sharp')).toBe('C#4');
  });

  it('leaves a pitch already in the asked spelling alone', () => {
    expect(spellPitch('C#4', 'sharp')).toBe('C#4');
    expect(spellPitch('Db4', 'flat')).toBe('Db4');
  });

  it('passes naturals through in either spelling', () => {
    expect(spellPitch('C4', 'flat')).toBe('C4');
    expect(spellPitch('C4', 'sharp')).toBe('C4');
    expect(spellPitch('B3', 'flat')).toBe('B3');
  });

  it('works on a bare pitch class, keeping it octave-less', () => {
    expect(spellPitch('C#', 'flat')).toBe('Db');
    expect(spellPitch('Db', 'sharp')).toBe('C#');
    expect(spellPitch('C', 'flat')).toBe('C');
  });

  it('keeps the sounding pitch, crossing letter and octave where it must', () => {
    expect(spellPitch('E#4', 'flat')).toBe('F4');
    expect(spellPitch('Cb4', 'sharp')).toBe('B3');
  });

  it('passes a name it cannot read through unchanged', () => {
    expect(spellPitch('nope', 'flat')).toBe('nope');
    expect(spellPitch('nope', 'sharp')).toBe('nope');
    expect(spellPitch('', 'flat')).toBe('');
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
