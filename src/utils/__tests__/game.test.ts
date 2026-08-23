import { describe, expect, it } from 'vitest';

import { scoreTap } from '../game';

describe('scoreTap', () => {
  it('scores green when the tapped button sounds the shown pitch, regardless of spelling', () => {
    expect(scoreTap('A4', 'A4')).toBe(2);
    expect(scoreTap('A#4', 'Bb4')).toBe(2);
    expect(scoreTap('Db3', 'C#3')).toBe(2);
  });

  it('scores yellow for the right pitch class in the wrong octave', () => {
    expect(scoreTap('C4', 'C5')).toBe(1);
    expect(scoreTap('C#5', 'Db2')).toBe(1);
  });

  it('scores red for a different pitch class', () => {
    expect(scoreTap('C4', 'D4')).toBe(0);
    expect(scoreTap('A4', 'Eb2')).toBe(0);
  });

  it('returns null when either note has no pitch', () => {
    expect(scoreTap('', 'C4')).toBe(null);
    expect(scoreTap('C4', 'nope')).toBe(null);
  });
});
