import { Note } from 'tonal';
import { describe, expect, it } from 'vitest';

import type { KeyedScaleKind, ScaleChoice } from '../scale';
import {
  CHROMATIC,
  chromaOf,
  inScale,
  isKeyed,
  keyName,
  keySpelling,
  scaleChromas,
  scaleNoteNames,
  tonicNames,
} from '../scale';

const KEYED_KINDS: KeyedScaleKind[] = ['major', 'minor'];

// Tests name their key rather than its chroma.
const chroma = (pitchClass: string) => Note.get(pitchClass).chroma;
const major = (tonic: string): ScaleChoice => ({ kind: 'major', tonic: chroma(tonic) });
const minor = (tonic: string): ScaleChoice => ({ kind: 'minor', tonic: chroma(tonic) });

const isNatural = (name: string) => !name.includes('#') && !name.includes('b');

// The spelling of every key whose tonic name carries no accidental of its own.
function naturalSpellings(kind: KeyedScaleKind): Record<string, string | null> {
  return Object.fromEntries(
    tonicNames(kind)
      .map((name, tonic) => [name, keySpelling({ kind, tonic })] as const)
      .filter(([name]) => isNatural(name)),
  );
}

describe('isKeyed', () => {
  it('tells the chromatic run from a keyed one', () => {
    expect(isKeyed(CHROMATIC)).toBe(false);
    expect(isKeyed(major('F'))).toBe(true);
    expect(isKeyed(minor('A'))).toBe(true);
  });
});

describe('tonicNames', () => {
  it('names one key per chroma for each keyed kind', () => {
    for (const kind of KEYED_KINDS) {
      const names = tonicNames(kind);

      expect(names, kind).toHaveLength(12);
      expect(names.map(chroma), kind).toEqual([...Array(12).keys()]);
    }
  });
});

describe('keySpelling', () => {
  it('follows the accidental in the key’s own tonic name', () => {
    for (const kind of KEYED_KINDS) {
      tonicNames(kind).forEach((name, tonic) => {
        if (isNatural(name)) return;
        const expected = name.includes('#') ? 'sharp' : 'flat';
        expect(keySpelling({ kind, tonic }), `${name} ${kind}`).toBe(expected);
      });
    }
  });

  it('spells each natural major key by its signature; C major, having none, goes sharp', () => {
    expect(naturalSpellings('major')).toEqual({
      C: 'sharp',
      D: 'sharp',
      E: 'sharp',
      F: 'flat',
      G: 'sharp',
      A: 'sharp',
      B: 'sharp',
    });
  });

  it('spells each natural minor key by its signature; A minor, having none, goes sharp', () => {
    expect(naturalSpellings('minor')).toEqual({
      C: 'flat',
      D: 'flat',
      E: 'sharp',
      F: 'flat',
      G: 'flat',
      A: 'sharp',
      B: 'sharp',
    });
  });

  it('leaves the spelling to the setup under chromatic', () => {
    expect(keySpelling(CHROMATIC)).toBeNull();
  });
});

describe('keyName', () => {
  it('names the key as the player reads it, with accidental glyphs', () => {
    expect(keyName(major('F'))).toBe('F major');
    expect(keyName(minor('Eb'))).toBe('E♭ minor');
    expect(keyName(major('F#'))).toBe('F♯ major');
  });

  it('names the chromatic run', () => {
    expect(keyName(CHROMATIC)).toBe('Chromatic');
  });
});

describe('scaleNoteNames', () => {
  it('lists a major scale tonic first, spelled as the key spells it', () => {
    expect(scaleNoteNames(major('F'))).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
    expect(scaleNoteNames(major('C'))).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('lists a natural minor scale, flat keys with their flats', () => {
    expect(scaleNoteNames(minor('A'))).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(scaleNoteNames(minor('C'))).toEqual(['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb']);
  });

  it('lists all twelve as sharps under chromatic', () => {
    expect(scaleNoteNames(CHROMATIC)).toEqual([
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ]);
  });
});

describe('scaleChromas', () => {
  it('gives a keyed scale’s seven pitch classes', () => {
    expect(scaleChromas(major('D'))).toEqual(new Set([2, 4, 6, 7, 9, 11, 1]));
    expect(scaleChromas(minor('A'))).toEqual(new Set([9, 11, 0, 2, 4, 5, 7]));
  });

  it('gives all twelve under chromatic', () => {
    expect(scaleChromas(CHROMATIC)).toEqual(new Set(Array(12).keys()));
  });
});

describe('chromaOf', () => {
  it('reads the sounding pitch class, whatever the spelling or octave', () => {
    expect(chromaOf('Bb4')).toBe(10);
    expect(chromaOf('A#4')).toBe(10);
    expect(chromaOf('A#7')).toBe(10);
    expect(chromaOf('Cb4')).toBe(11);
  });

  it('reads no chroma off a name it cannot read', () => {
    // tonal answers NaN, which no scale's chroma set holds.
    expect(chromaOf('nope')).toBeNaN();
    expect(chromaOf('')).toBeNaN();
  });
});

describe('inScale', () => {
  it('judges membership by sound, so spelling never matters', () => {
    expect(inScale('Bb4', major('F'))).toBe(true);
    expect(inScale('A#4', major('F'))).toBe(true);
    expect(inScale('B4', major('F'))).toBe(false);
  });

  it('ignores the octave', () => {
    expect(inScale('E2', major('C'))).toBe(true);
    expect(inScale('F#7', major('C'))).toBe(false);
  });

  it('leaves a name it cannot read out', () => {
    expect(inScale('nope', major('C'))).toBe(false);
  });

  it('takes every pitch under chromatic', () => {
    const pitches = ['C4', 'C#4', 'Db5', 'D4', 'E6', 'F2', 'F#4', 'G4', 'Ab3', 'A4', 'Bb4', 'B7'];

    expect(pitches.filter((pitch) => inScale(pitch, CHROMATIC))).toEqual(pitches);
  });
});
