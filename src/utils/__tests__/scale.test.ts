import { Note } from 'tonal';
import { describe, expect, it } from 'vitest';

import type { KeyedScaleKind, ScaleChoice } from '../scale';
import {
  CHROMATIC,
  chromaOf,
  inScale,
  isKeyed,
  keyAccidental,
  keyName,
  keySpelling,
  scaleChromas,
  scaleNoteNames,
  tonicNames,
} from '../scale';
import { FLATS, SHARPS } from '../spelling';

const KEYED_KINDS: KeyedScaleKind[] = ['major', 'minor'];

// Tests name their key rather than its chroma.
const chroma = (pitchClass: string) => Note.get(pitchClass).chroma;
const major = (tonic: string): ScaleChoice => ({ kind: 'major', tonic: chroma(tonic) });
const minor = (tonic: string): ScaleChoice => ({ kind: 'minor', tonic: chroma(tonic) });

const everyKey = KEYED_KINDS.flatMap((kind) =>
  tonicNames(kind).map((name, tonic) => ({ kind, tonic, label: `${name} ${kind}` })),
);

// Sharps with the seventh degree of F♯ major (and second of D♯ minor) named E♯.
const SHARPS_WITH_E_SHARP = SHARPS.map((name, chroma) => (chroma === 5 ? 'E#' : name));

// The keys whose signature is flats; every other key goes by sharps.
const FLAT_KEYS = new Set([
  'Db major',
  'Eb major',
  'F major',
  'Ab major',
  'Bb major',
  'C minor',
  'D minor',
  'F minor',
  'G minor',
  'Bb minor',
]);

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

  it('names the keys the conventional way; the six-accidental keys go by F♯ major and D♯ minor', () => {
    expect(tonicNames('major')).toEqual([
      'C',
      'Db',
      'D',
      'Eb',
      'E',
      'F',
      'F#',
      'G',
      'Ab',
      'A',
      'Bb',
      'B',
    ]);
    expect(tonicNames('minor')).toEqual([
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
      'Bb',
      'B',
    ]);
  });
});

describe('keySpelling', () => {
  it('names every chroma, each by a name that sounds it', () => {
    for (const { kind, tonic, label } of everyKey) {
      const table = keySpelling({ kind, tonic })!;

      expect(table, label).toHaveLength(12);
      expect(table.map(chroma), label).toEqual([...Array(12).keys()]);
    }
  });

  it('lays the scale’s own names over its chromas', () => {
    for (const { kind, tonic, label } of everyKey) {
      const table = keySpelling({ kind, tonic })!;

      for (const name of scaleNoteNames({ kind, tonic })) {
        expect(table[chroma(name)], label).toBe(name);
      }
    }
  });

  it('names the notes outside the scale as sharps or flats, the way the key’s signature goes', () => {
    for (const { kind, tonic, label } of everyKey) {
      const table = keySpelling({ kind, tonic })!;
      const names = scaleNoteNames({ kind, tonic });
      const base = FLAT_KEYS.has(label) ? FLATS : SHARPS;

      table.forEach((name, i) => {
        if (!names.includes(name)) expect(name, `${label} at ${i}`).toBe(base[i]);
      });
    }
  });

  it('is the flats table for a flat key and the sharps table for a sharp or an open key', () => {
    expect(keySpelling(major('F'))).toEqual(FLATS);
    expect(keySpelling(minor('C'))).toEqual(FLATS);
    expect(keySpelling(major('D'))).toEqual(SHARPS);
    expect(keySpelling(major('C'))).toEqual(SHARPS);
    expect(keySpelling(minor('A'))).toEqual(SHARPS);
  });

  it('names F as E♯ in F♯ major and in D♯ minor, the only unusual name in any key', () => {
    expect(keySpelling(major('F#'))).toEqual(SHARPS_WITH_E_SHARP);
    expect(keySpelling(minor('D#'))).toEqual(SHARPS_WITH_E_SHARP);

    const usual = new Set([...SHARPS, ...FLATS]);
    const unusual = everyKey.flatMap(({ kind, tonic }) =>
      keySpelling({ kind, tonic })!.filter((name) => !usual.has(name)),
    );
    expect(unusual).toEqual(['E#', 'E#']);
  });

  it('leaves the spelling to the setup under chromatic', () => {
    expect(keySpelling(CHROMATIC)).toBeNull();
  });
});

describe('keyAccidental', () => {
  it('is the sign of the key’s accidentals, or null where it has none', () => {
    expect(keyAccidental(major('F'))).toBe('b');
    expect(keyAccidental(major('F#'))).toBe('#');
    expect(keyAccidental(minor('D#'))).toBe('#');
    expect(keyAccidental(major('C'))).toBeNull();
    expect(keyAccidental(minor('A'))).toBeNull();
    expect(keyAccidental(CHROMATIC)).toBeNull();
  });

  it('is flats for exactly the flat-signature keys', () => {
    for (const { kind, tonic, label } of everyKey) {
      expect(keyAccidental({ kind, tonic }) === 'b', label).toBe(FLAT_KEYS.has(label));
    }
  });
});

describe('keyName', () => {
  it('names the key as the player reads it, with accidental glyphs', () => {
    expect(keyName(major('F'))).toBe('F major');
    expect(keyName(minor('D#'))).toBe('D♯ minor');
    expect(keyName(major('Eb'))).toBe('E♭ major');
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

  it('spells the six-sharp keys with E♯, never F', () => {
    expect(scaleNoteNames(major('F#'))).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
    expect(scaleNoteNames(minor('D#'))).toEqual(['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C#']);
  });

  it('names each key’s seven chromas, one letter each', () => {
    for (const { kind, tonic, label } of everyKey) {
      const names = scaleNoteNames({ kind, tonic });

      expect(new Set(names.map(chroma)), label).toEqual(scaleChromas({ kind, tonic }));
      expect(new Set(names.map((name) => name[0])).size, label).toBe(7);
    }
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
