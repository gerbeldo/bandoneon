import { describe, expect, it } from 'vitest';

import { useNotePick } from '../useNotePick';

const mount = (octaves: number[] = [3, 4, 5, 6]) => useNotePick({ octaves: () => octaves });

describe('useNotePick', () => {
  it('completes on letter then octave, and resets itself', () => {
    const pick = mount();
    expect(pick.choose({ letter: 'C' })).toBeNull();
    expect(pick.choose({ octave: 4 })).toBe('C4');
    expect(pick.pick).toEqual({ letter: null, accidental: '', octave: null });
  });

  it('takes the accidental in either order around the letter', () => {
    const pick = mount();
    pick.choose({ accidental: '#' });
    pick.choose({ letter: 'F' });
    expect(pick.choose({ octave: 4 })).toBe('F#4');

    pick.choose({ letter: 'D' });
    pick.choose({ accidental: 'bb' });
    expect(pick.choose({ octave: 5 })).toBe('Dbb5');
  });

  it('completes in one call when the staff places letter and octave together', () => {
    const pick = mount();
    pick.choose({ accidental: 'b' });
    expect(pick.choose({ letter: 'E', octave: 3 })).toBe('Eb3');
  });

  it('ignores an octave before any letter', () => {
    const pick = mount();
    expect(pick.choose({ octave: 4 })).toBeNull();
    expect(pick.pick.octave).toBeNull();
  });

  it('ignores an octave the layout does not offer', () => {
    const pick = mount([3, 4]);
    pick.choose({ letter: 'C' });
    expect(pick.choose({ octave: 9 })).toBeNull();
    expect(pick.choose({ octave: 4 })).toBe('C4');
  });

  it('answers keydowns: letters, accidentals, digits, Escape', () => {
    const pick = mount();
    expect(pick.onKeydown('e')).toBeNull();
    expect(pick.onKeydown('#')).toBeNull();
    expect(pick.onKeydown('4')).toBe('E#4');

    pick.onKeydown('G');
    expect(pick.pick).toEqual({ letter: 'G', accidental: '#', octave: null });
    pick.onKeydown('Escape');
    expect(pick.pick.letter).toBeNull();

    expect(pick.onKeydown('Enter')).toBeNull();
  });
});
