import { describe, expect, it } from 'vitest';

import fingerings from '../../data/fingerings/rheinische142';
import { instruments, notes } from '../../data/index';
import { scaleFingering } from '../fingering';

const layoutPitches = (layout: string) => {
  const [side, direction] = layout.split('-') as ['right' | 'left', 'open' | 'close'];
  return new Set(instruments.rheinische142[side][direction].flat().filter(Boolean));
};

describe('fingering data', () => {
  for (const [layout, keys] of Object.entries(fingerings)) {
    it(`${layout}: every entry names a button of the layout with a finger 2–5`, () => {
      const pitches = layoutPitches(layout);
      for (const [key, table] of Object.entries(keys)) {
        expect(notes, `${layout} ${key}: key spelled with sharps`).toContain(key);
        for (const [pitch, finger] of Object.entries(table)) {
          expect(pitches.has(pitch), `${layout} ${key}: ${pitch} is a button`).toBe(true);
          expect([2, 3, 4, 5], `${layout} ${key} ${pitch}`).toContain(finger);
        }
      }
    });
  }
});

describe('scaleFingering', () => {
  it('reads the layout table for a major key', () => {
    expect(scaleFingering('right', 'open', 'C', 'major')).toBe(fingerings['right-open'].C);
    expect(scaleFingering('left', 'close', 'F#', 'major')).toBe(fingerings['left-close']['F#']);
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
    expect(scaleFingering('right', 'open', 'A', 'minor')).toBe(fingerings['right-open'].C);
    expect(scaleFingering('left', 'open', 'C', 'minor')).toBe(fingerings['left-open']['D#']);
  });

  it('has nothing for chromatic, no scale, or an unknown tonic', () => {
    expect(scaleFingering('right', 'open', 'C', 'chromatic')).toBeUndefined();
    expect(scaleFingering('right', 'open', 'C', null)).toBeUndefined();
    expect(scaleFingering('right', 'open', 'H', 'major')).toBeUndefined();
  });
});
