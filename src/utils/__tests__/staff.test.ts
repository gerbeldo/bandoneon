import { describe, expect, it } from 'vitest';

import { accidentalOf, chordLayout, ledgerSteps, staffPosition, stepIndex } from '../staff';

describe('stepIndex', () => {
  it('numbers diatonic steps from C0', () => {
    expect(stepIndex('C0')).toBe(0);
    expect(stepIndex('C4')).toBe(28);
    expect(stepIndex('B4')).toBe(34);
    expect(stepIndex('D3')).toBe(22);
    expect(stepIndex('A1')).toBe(12);
  });

  it('ignores accidentals — spelling does not move the step', () => {
    expect(stepIndex('A#1')).toBe(stepIndex('A1'));
    expect(stepIndex('Bb1')).toBe(stepIndex('B1'));
    expect(stepIndex('C#4')).toBe(stepIndex('C4'));
  });

  it('returns null for unparseable notes and notes without octave', () => {
    expect(stepIndex('nope')).toBeNull();
    expect(stepIndex('C')).toBeNull();
    expect(stepIndex('')).toBeNull();
  });
});

describe('staffPosition', () => {
  it('is 0 on the middle line: B4 treble (right), D3 bass (left)', () => {
    expect(staffPosition('B4', 'right')).toBe(0);
    expect(staffPosition('D3', 'left')).toBe(0);
  });

  it('counts steps above the middle line', () => {
    expect(staffPosition('C5', 'right')).toBe(1);
    expect(staffPosition('E5', 'right')).toBe(3);
    expect(staffPosition('C4', 'right')).toBe(-6); // middle C, first ledger below treble
    expect(staffPosition('C4', 'left')).toBe(6); // middle C, first ledger above bass
    expect(staffPosition('B6', 'right')).toBe(14);
    expect(staffPosition('A1', 'left')).toBe(-10);
  });

  it('returns null for invalid notes', () => {
    expect(staffPosition('nope', 'right')).toBeNull();
  });
});

describe('ledgerSteps', () => {
  it('is empty within the staff (|p| < 6)', () => {
    expect(ledgerSteps(0)).toEqual([]);
    expect(ledgerSteps(5)).toEqual([]);
    expect(ledgerSteps(-5)).toEqual([]);
  });

  it('lists even positions from the staff edge out to the note', () => {
    expect(ledgerSteps(6)).toEqual([6]);
    expect(ledgerSteps(7)).toEqual([6]);
    expect(ledgerSteps(9)).toEqual([6, 8]);
    expect(ledgerSteps(14)).toEqual([6, 8, 10, 12, 14]);
    expect(ledgerSteps(-6)).toEqual([-6]);
    expect(ledgerSteps(-10)).toEqual([-6, -8, -10]);
  });
});

describe('accidentalOf', () => {
  it('extracts sharp and flat from the spelled note', () => {
    expect(accidentalOf('C#4')).toBe('#');
    expect(accidentalOf('Bb3')).toBe('b');
  });

  it('is null for naturals and invalid notes', () => {
    expect(accidentalOf('C4')).toBeNull();
    expect(accidentalOf('nope')).toBeNull();
  });
});

describe('chordLayout', () => {
  const n = (step: number, accidental: '#' | 'b' | null = null) => ({ step, accidental });

  it('leaves spaced notes unshifted', () => {
    // C4 E4 G4
    expect(chordLayout([n(28), n(30), n(32)]).map((l) => l.headShift)).toEqual([0, 0, 0]);
  });

  it('shifts the upper note of a second to the right', () => {
    // C4 D4
    expect(chordLayout([n(28), n(29)]).map((l) => l.headShift)).toEqual([0, 1]);
  });

  it('alternates shifts up a stacked cluster', () => {
    // C4 D4 E4 F4
    expect(chordLayout([n(28), n(29), n(30), n(31)]).map((l) => l.headShift)).toEqual([0, 1, 0, 1]);
  });

  it('keeps results aligned with the input order', () => {
    const layout = chordLayout([n(29), n(28)]); // D4 first, C4 second
    expect(layout.map((l) => l.headShift)).toEqual([1, 0]);
  });

  it('gives notes without accidentals no column', () => {
    expect(chordLayout([n(28), n(30, '#')]).map((l) => l.accidentalColumn)).toEqual([null, 0]);
  });

  it('stacks distant accidentals in one column', () => {
    // C#4 and D#5 — 8 steps apart, no vertical overlap
    expect(chordLayout([n(28, '#'), n(36, '#')]).map((l) => l.accidentalColumn)).toEqual([0, 0]);
  });

  it('moves an overlapping accidental one column left', () => {
    // F#4 above C#4 — 3 steps apart, would collide
    const layout = chordLayout([n(28, '#'), n(31, '#')]);
    expect(layout.map((l) => l.accidentalColumn)).toEqual([1, 0]);
  });

  it('fills columns top-down, right-to-left', () => {
    // A#4 (33), F#4 (31), C#4 (28): A# -> col 0; F# collides with A# -> col 1;
    // C# collides with both -> col 2
    const layout = chordLayout([n(28, '#'), n(31, '#'), n(33, '#')]);
    expect(layout.map((l) => l.accidentalColumn)).toEqual([2, 1, 0]);
  });

  it('reuses a column once there is vertical room', () => {
    // B5 (41), A#4 (33), F#4 (31): B5 -> col 0; A# is 8 steps below -> col 0; F# -> col 1
    const layout = chordLayout([n(31, '#'), n(33, '#'), n(41, '#')]);
    expect(layout.map((l) => l.accidentalColumn)).toEqual([1, 0, 0]);
  });
});
