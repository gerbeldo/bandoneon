import { describe, expect, it } from 'vitest';

import type { Instrument } from '../../data/index';
import { instruments } from '../../data/index';
import type { IntroductionOptions } from '../introduction';
import { introductionOrder } from '../introduction';
import { flattenGrid, itemKey, layoutGrid } from '../session';

// Item keys without the instrument prefix and quiz-direction suffix, so
// expectations read as side/direction/row/column.
function positionKeys(keys: string[]): string[] {
  return keys.map((key) => key.split('/').slice(1, 5).join('/'));
}

function toy(layouts: Partial<Instrument>): Instrument {
  return { right: { open: [], close: [] }, left: { open: [], close: [] }, ...layouts };
}

function order(layouts: Instrument, extra: Partial<IntroductionOptions> = {}): string[] {
  return positionKeys(
    introductionOrder({ instrument: 'toy', layouts, quizDirection: 'forward', ...extra }),
  );
}

// One entry per physical button, in introduction order.
function opens(layouts: Instrument, extra: Partial<IntroductionOptions> = {}): string[] {
  return order(layouts, extra).filter((key) => key.includes('/open/'));
}

describe('introductionOrder', () => {
  it('starts at the home cluster: the six naturals nearest middle C, nearest first, each button open then close', () => {
    const layouts = toy({
      right: {
        open: [['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4']],
        close: [['B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']],
      },
    });

    const keys = introductionOrder({ instrument: 'toy', layouts, quizDirection: 'forward' });

    expect(keys[0]).toBe('toy/right/open/0/2/forward');
    expect(positionKeys(keys).slice(0, 12)).toEqual([
      'right/open/0/2', // C4
      'right/close/0/2',
      'right/open/0/1', // B3
      'right/close/0/1',
      'right/open/0/3', // D4
      'right/close/0/3',
      'right/open/0/0', // A3
      'right/close/0/0',
      'right/open/0/4', // E4
      'right/close/0/4',
      'right/open/0/5', // F4
      'right/close/0/5',
    ]);
  });

  it('then grows outward: the natural nearest the introduced region comes next, ties to the lower pitch', () => {
    // The home cluster is C4 B3 D4 E4 F4 G4 (columns 1–5, 7). A4 and E5 both
    // touch it; C3 is the lowest pitch but two buttons away.
    const row = ['E5', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B3', '', 'C3'];
    const layouts = toy({ right: { open: [row], close: [row] } });

    expect(opens(layouts).slice(6)).toEqual(['right/open/0/6', 'right/open/0/0', 'right/open/0/9']);
  });

  it('introduces every natural before any accidental, even one sitting inside the home cluster', () => {
    const row = ['C4', 'C#4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
    const layouts = toy({ right: { open: [row], close: [row] } });

    expect(opens(layouts).slice(-2)).toEqual(['right/open/0/7', 'right/open/0/1']);
  });

  it('measures accidentals against everything introduced: beside a late natural ties beside the home cluster, and the lower pitch wins', () => {
    // C#4 touches the home cluster; A#3 only touches D5, the last natural in.
    const row = ['C#4', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'A#3'];
    const layouts = toy({ right: { open: [row], close: [row] } });

    expect(opens(layouts).slice(-2)).toEqual(['right/open/0/10', 'right/open/0/0']);
  });

  it('measures proximity on the staggered lattice: a diagonal neighbor in the next row beats the next button in the same row', () => {
    // Odd rows sit half a column left, so C5 at 1/6 touches A4 at 0/5 more
    // closely than B4 at 0/6 does.
    const grid = [
      ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'],
      ['', '', '', '', '', '', 'C5'],
    ];
    const layouts = toy({ right: { open: grid, close: grid } });

    expect(opens(layouts).slice(6)).toEqual(['right/open/1/6', 'right/open/0/6']);
  });

  it('anchors the left side at C3 and interleaves sides per button, right first, the longer side trailing', () => {
    const left = ['A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3'];
    const layouts = toy({
      right: { open: [['C4', 'D4', 'E4']], close: [['C4', 'D4', 'E4']] },
      left: { open: [left], close: [left] },
    });

    expect(order(layouts).slice(0, 4)).toEqual([
      'right/open/0/0',
      'right/close/0/0',
      'left/open/0/2',
      'left/close/0/2',
    ]);
    expect(opens(layouts)).toEqual([
      'right/open/0/0', // C4
      'left/open/0/2', // C3
      'right/open/0/1', // D4
      'left/open/0/1', // B2
      'right/open/0/2', // E4
      'left/open/0/3', // D3
      'left/open/0/0', // A2
      'left/open/0/4', // E3
      'left/open/0/5', // F3
      'left/open/0/6', // G3
    ]);
  });

  it('gives a position present in only one direction just the item it has, judged by that pitch', () => {
    const layouts = toy({
      right: {
        open: [['C4', 'D4', 'E4', 'F4', 'G4', 'A4', '']],
        close: [['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C#4']],
      },
    });

    const keys = order(layouts);

    expect(keys).toHaveLength(13);
    expect(keys[keys.length - 1]).toBe('right/close/0/6');
    expect(keys).not.toContain('right/open/0/6');
  });

  it('covers every item of every layout exactly once, for every instrument', () => {
    for (const [name, layouts] of Object.entries(instruments)) {
      const expected: string[] = [];
      for (const side of ['right', 'left'] as const) {
        for (const direction of ['open', 'close'] as const) {
          for (const { row, column } of flattenGrid(layoutGrid(layouts, side, direction))) {
            expected.push(itemKey(name, side, direction, row, column, 'forward'));
          }
        }
      }

      const keys = introductionOrder({ instrument: name, layouts, quizDirection: 'forward' });

      expect([...keys].sort(), name).toEqual(expected.sort());
    }
  });

  it('shares one order between the two quiz directions', () => {
    const layouts = instruments.rheinische142;
    const forward = introductionOrder({
      instrument: 'rheinische142',
      layouts,
      quizDirection: 'forward',
    });
    const reverse = introductionOrder({
      instrument: 'rheinische142',
      layouts,
      quizDirection: 'reverse',
    });

    expect(reverse[0]).toMatch(/\/reverse$/);
    expect(reverse).toEqual(forward.map((key) => key.replace(/forward$/, 'reverse')));
  });

  it('starts the Rheinische 142 at C4 B3 D4 A3 E4 F4 (right) and C3 B2 D3 A2 E3 G2 (left)', () => {
    const buttons = opens(instruments.rheinische142, { instrument: 'rheinische142' });

    expect(buttons.filter((key) => key.startsWith('right')).slice(0, 6)).toEqual([
      'right/open/2/1', // C4
      'right/open/3/1', // B3
      'right/open/2/2', // D4
      'right/open/4/0', // A3
      'right/open/3/2', // E4
      'right/open/4/1', // F4
    ]);
    // G2 and F3 are both five semitones from C3; the lower pitch wins.
    expect(buttons.filter((key) => key.startsWith('left')).slice(0, 6)).toEqual([
      'left/open/3/5', // C3
      'left/open/5/1', // B2
      'left/open/3/1', // D3
      'left/open/2/1', // A2
      'left/open/4/0', // E3
      'left/open/3/6', // G2
    ]);
  });

  it('lets a per-side override replace the generated home cluster; the spiral grows from it', () => {
    const row = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    const layouts = toy({ right: { open: [row], close: [row] } });

    const buttons = opens(layouts, { overrides: { toy: { right: [[0, 7]] } } });

    expect(buttons.slice(0, 3)).toEqual(['right/open/0/7', 'right/open/0/6', 'right/open/0/5']);
  });
});

// One readable file per instrument: every item in introduction order with the
// pitch it sounds, so a rule change shows up as a reviewable diff.
describe('introduction order snapshots', () => {
  for (const [name, layouts] of Object.entries(instruments)) {
    it(name, async () => {
      const lines = positionKeys(
        introductionOrder({ instrument: name, layouts, quizDirection: 'forward' }),
      ).map((key) => {
        const [side, direction, row, column] = key.split('/');
        const grid = layoutGrid(layouts, side as 'right' | 'left', direction as 'open' | 'close');
        return `${key} ${grid[Number(row)][Number(column)]}`;
      });

      await expect(lines.join('\n') + '\n') //
        .toMatchFileSnapshot(`__snapshots__/introduction-order/${name}.txt`);
    });
  }
});
