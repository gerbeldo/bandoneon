import { describe, expect, it } from 'vitest';

import fingerings, { type Layout, type ScaleFingering } from '../../data/fingerings/rheinische142';
import { instruments, notes } from '../../data/index';
import { scaleFingering } from '../fingering';

const layouts: Layout[] = ['right-open', 'right-close', 'left-open', 'left-close'];
const keyedTypes = ['major', 'harmonic minor', 'melodic minor'] as const;

const layoutPitches = (layout: Layout) => {
  const [side, direction] = layout.split('-') as ['right' | 'left', 'open' | 'close'];
  return new Set(instruments.rheinische142[side][direction].flat().filter(Boolean));
};

const tablesOf = (layout: Layout): Array<[string, ScaleFingering]> => [
  ...keyedTypes.flatMap((type) =>
    Object.entries(fingerings[type][layout]).map(([tonic, table]): [string, ScaleFingering] => [
      `${type} ${tonic}`,
      table,
    ]),
  ),
  ['chromatic', fingerings.chromatic[layout]],
];

describe('fingering data', () => {
  for (const layout of layouts) {
    it(`${layout}: every entry names a button of the layout with a finger 2–5`, () => {
      const pitches = layoutPitches(layout);
      for (const [where, table] of tablesOf(layout)) {
        for (const [pitch, finger] of Object.entries(table)) {
          expect(pitches.has(pitch), `${layout} ${where}: ${pitch} is a button`).toBe(true);
          expect([2, 3, 4, 5], `${layout} ${where} ${pitch}`).toContain(finger);
        }
      }
    });
  }

  it('spells every tonic with sharps, as Explore does', () => {
    for (const type of keyedTypes) {
      for (const layout of layouts) {
        for (const tonic of Object.keys(fingerings[type][layout])) {
          expect(notes, `${type} ${layout}`).toContain(tonic);
        }
      }
    }
  });
});

describe('fingering coverage', () => {
  it('fingers every major key in every layout, except E♭ right/close', () => {
    for (const layout of layouts) {
      const expected = notes.filter((tonic) => !(layout === 'right-close' && tonic === 'D#'));
      expect(Object.keys(fingerings.major[layout]).sort(), layout).toEqual([...expected].sort());
    }
  });

  it('fingers every harmonic minor, and every melodic minor but G left/open', () => {
    for (const layout of layouts) {
      expect(Object.keys(fingerings['harmonic minor'][layout]).sort(), layout).toEqual(
        [...notes].sort(),
      );
      // pp. 64–66 print a single left-hand row for G melodic minor: the closing one.
      const melodic = notes.filter((tonic) => !(layout === 'left-open' && tonic === 'G'));
      expect(Object.keys(fingerings['melodic minor'][layout]).sort(), layout).toEqual(
        [...melodic].sort(),
      );
    }
  });

  it('fingers an octave and a half at least, in every key of every table', () => {
    for (const type of keyedTypes) {
      for (const layout of layouts) {
        for (const [tonic, table] of Object.entries(fingerings[type][layout])) {
          expect(Object.keys(table).length, `${type} ${layout} ${tonic}`).toBeGreaterThanOrEqual(
            11,
          );
        }
      }
    }
  });

  it('fingers each layout’s whole compass chromatically', () => {
    const counts = Object.fromEntries(
      layouts.map((layout) => [layout, Object.keys(fingerings.chromatic[layout]).length]),
    );
    expect(counts).toEqual({
      'right-open': 38,
      'right-close': 37,
      'left-open': 32,
      'left-close': 29,
    });
  });
});

describe('scaleFingering', () => {
  it('reads the layout table for a major key', () => {
    expect(scaleFingering('right', 'open', 'C', 'major')).toBe(fingerings.major['right-open'].C);
    expect(scaleFingering('left', 'close', 'F#', 'major')).toBe(
      fingerings.major['left-close']['F#'],
    );
  });

  it('carries Madrigal’s digits: C major p. 18 and the E major stack rule', () => {
    // p. 18, natural scale opening, right hand: C4 D4 E4 F4 = 2 4 3 2
    expect(scaleFingering('right', 'open', 'C', 'major')).toMatchObject({
      C4: 2,
      D4: 4,
      E4: 3,
      F4: 2,
    });
    // p. 18, closing, left hand: the compass ends G4 B4 — no A4 closing
    expect(scaleFingering('left', 'close', 'C', 'major')).not.toHaveProperty('A4');
    // p. 44, right hand opening, B5 is stacked 4/5: the upper (ascending) digit stays
    expect(scaleFingering('right', 'open', 'E', 'major')?.B5).toBe(4);
    // p. 50 fingers E♭ major's right hand opening only
    expect(scaleFingering('right', 'close', 'D#', 'major')).toBeUndefined();
  });

  it('reads the relative major for a natural minor', () => {
    expect(scaleFingering('right', 'open', 'A', 'minor')).toBe(fingerings.major['right-open'].C);
    expect(scaleFingering('left', 'open', 'C', 'minor')).toBe(fingerings.major['left-open']['D#']);
  });

  it('reads its own table for a harmonic or melodic minor', () => {
    expect(scaleFingering('right', 'open', 'A', 'harmonic minor')).toBe(
      fingerings['harmonic minor']['right-open'].A,
    );
    expect(scaleFingering('left', 'close', 'E', 'melodic minor')).toBe(
      fingerings['melodic minor']['left-close'].E,
    );
    // p. 52, A harmonic minor, right hand opening: A3 D4 = 2 5
    expect(scaleFingering('right', 'open', 'A', 'harmonic minor')).toMatchObject({ A3: 2, D4: 5 });
    // p. 66 leaves G melodic minor's left hand opening unfingered
    expect(scaleFingering('left', 'open', 'G', 'melodic minor')).toBeUndefined();
  });

  it('reads the layout’s chromatic run, whatever the tonic', () => {
    expect(scaleFingering('right', 'open', 'C', 'chromatic')).toBe(
      fingerings.chromatic['right-open'],
    );
    expect(scaleFingering('right', 'open', 'F#', 'chromatic')).toBe(
      fingerings.chromatic['right-open'],
    );
    // p. 34, right hand opening: the run starts on A3 with 3
    expect(scaleFingering('right', 'open', 'C', 'chromatic')?.A3).toBe(3);
  });

  it('has nothing for no scale, an unknown scale type, or an unknown tonic', () => {
    expect(scaleFingering('right', 'open', 'C', null)).toBeUndefined();
    expect(scaleFingering('right', 'open', 'C', 'whole tone')).toBeUndefined();
    expect(scaleFingering('right', 'open', 'H', 'major')).toBeUndefined();
  });
});
