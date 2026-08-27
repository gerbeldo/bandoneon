import { Note } from 'tonal';
import { describe, expect, it } from 'vitest';

import { emptyPick, formatOctave, octavesOf, pickFromKey, pickLabel, pitchOf } from '../notePick';

describe('pitchOf', () => {
  it('composes the spelled pitch once letter and octave are set', () => {
    expect(pitchOf({ letter: 'C', accidental: '', octave: 4 })).toBe('C4');
    expect(pitchOf({ letter: 'E', accidental: '#', octave: 4 })).toBe('E#4');
    expect(pitchOf({ letter: 'C', accidental: 'bb', octave: 5 })).toBe('Cbb5');
  });

  it('is null while a part is missing', () => {
    expect(pitchOf(emptyPick())).toBeNull();
    expect(pitchOf({ letter: 'C', accidental: '#', octave: null })).toBeNull();
    expect(pitchOf({ letter: null, accidental: '', octave: 4 })).toBeNull();
  });

  it('names pitches the grading engine can sound, doubles included', () => {
    expect(Note.midi(pitchOf({ letter: 'E', accidental: '#', octave: 4 })!)).toBe(Note.midi('F4'));
    expect(Note.midi(pitchOf({ letter: 'G', accidental: '##', octave: 5 })!)).toBe(Note.midi('A5'));
    expect(Note.midi(pitchOf({ letter: 'D', accidental: 'bb', octave: 3 })!)).toBe(Note.midi('C3'));
  });
});

describe('pickLabel', () => {
  it('shows the pick as written, never respelled', () => {
    expect(pickLabel({ letter: 'E', accidental: '#', octave: null }, 'scientific')).toBe('E♯');
    // Doubles print as two plain signs: 𝄪/𝄫 text is missing from many phone fonts.
    expect(pickLabel({ letter: 'G', accidental: '##', octave: null }, 'scientific')).toBe('G♯♯');
    expect(pickLabel({ letter: 'D', accidental: 'bb', octave: null }, 'scientific')).toBe('D♭♭');
  });

  it('speaks solfège when the notation asks for it', () => {
    expect(pickLabel({ letter: 'E', accidental: 'b', octave: null }, 'solfege')).toBe('Mi♭');
  });

  it('is a question mark before a letter is chosen', () => {
    expect(pickLabel(emptyPick(), 'scientific')).toBe('?');
  });
});

describe('pickFromKey', () => {
  it('maps lowercase letters to the letter alone', () => {
    expect(pickFromKey('c')).toEqual({ letter: 'C' });
    expect(pickFromKey('b')).toEqual({ letter: 'B' });
  });

  it('maps Shift+letter to that letter sharp', () => {
    expect(pickFromKey('F')).toEqual({ letter: 'F', accidental: '#' });
    expect(pickFromKey('E')).toEqual({ letter: 'E', accidental: '#' });
  });

  it('maps the accidental keys', () => {
    expect(pickFromKey('#')).toEqual({ accidental: '#' });
    expect(pickFromKey('-')).toEqual({ accidental: 'b' });
    expect(pickFromKey('x')).toEqual({ accidental: '##' });
  });

  it('maps digits to octaves and ignores everything else', () => {
    expect(pickFromKey('4')).toEqual({ octave: 4 });
    expect(pickFromKey('l')).toBeNull();
    expect(pickFromKey('Enter')).toBeNull();
  });
});

describe('octavesOf', () => {
  it('collects the layout’s octaves, ascending and without repeats', () => {
    const positions: [number, number, string][] = [
      [0, 0, 'C4'],
      [1, 0, 'A#3'],
      [2, 0, 'B6'],
      [3, 0, 'D4'],
    ];
    expect(octavesOf(positions)).toEqual([3, 4, 6]);
  });

  it('skips empty cells', () => {
    expect(octavesOf([[0, 0, '']])).toEqual([]);
  });
});

describe('formatOctave', () => {
  it('prints the digit outside Helmholtz', () => {
    expect(formatOctave('C#', 4, 'scientific')).toBe('4');
    expect(formatOctave('', 2, 'solfege')).toBe('2');
  });

  it('prints Helmholtz case and marks off the picked name', () => {
    expect(formatOctave('C', 2, 'helmholtz')).toBe('C');
    expect(formatOctave('C', 3, 'helmholtz')).toBe('c');
    expect(formatOctave('C#', 5, 'helmholtz')).toBe('c#’’');
    expect(formatOctave('', 4, 'helmholtz')).toBe('x’');
  });
});
