import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { instruments } from '../../data/index';
import { useStore } from '../../stores/main';
import type { AnswerEvent } from '../../stores/practice';
import { useSettingsStore } from '../../stores/settings';
import {
  createSweep,
  flattenGrid,
  itemKey,
  layoutGrid,
  parseItemKey,
  twinGroups,
} from '../session';

// Toy grid with an empty cell, so button order and grid coordinates diverge
// the way they do on real layouts.
const GRID = [
  ['C4', ''],
  ['D4', 'E4'],
];

function testSweep(overrides: Partial<Parameters<typeof createSweep>[0]> = {}) {
  const recorded: { key: string; event: AnswerEvent }[] = [];
  const engine = createSweep({
    grid: GRID,
    instrument: 'rheinische142',
    side: 'right',
    direction: 'open',
    quizDirection: 'forward',
    mode: 'note-game',
    record: (key, event) => recorded.push({ key, event }),
    now: () => 1_000,
    ...overrides,
  });
  return { engine, recorded };
}

describe('sweep', () => {
  it('prompts every button once and records one graded event per answer, immediately', () => {
    const { engine, recorded } = testSweep();

    expect(engine.total).toBe(3);

    expect(engine.prompt()).toEqual({ index: 0, total: 3, buttonIndex: 0, pitch: 'C4' });
    engine.answer({ pitch: 'C4', elapsedMs: 1_200 });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].key).toBe('rheinische142/right/open/0/0/forward');
    expect(recorded[0].event.grade).toBe(2);

    expect(engine.prompt()).toEqual({ index: 1, total: 3, buttonIndex: 1, pitch: 'D4' });
    engine.answer({ pitch: 'D5', elapsedMs: 800 });
    expect(recorded).toHaveLength(2);
    expect(recorded[1].key).toBe('rheinische142/right/open/1/0/forward');
    expect(recorded[1].event.grade).toBe(1);

    expect(engine.prompt()).toEqual({ index: 2, total: 3, buttonIndex: 2, pitch: 'E4' });
    engine.answer({ pitch: 'C4', elapsedMs: 500 });
    expect(recorded).toHaveLength(3);
    expect(recorded[2].key).toBe('rheinische142/right/open/1/1/forward');
    expect(recorded[2].event.grade).toBe(0);

    expect(engine.prompt()).toBeNull();
  });

  it('stamps each event with the injected clock, the mode tag, and the response time clamped to 60 s', () => {
    let clock = 5_000;
    const { engine, recorded } = testSweep({ now: () => clock });

    engine.answer({ pitch: 'C4', elapsedMs: 2_345 });
    clock = 9_000;
    engine.answer({ pitch: 'D4', elapsedMs: 61_000 });
    engine.answer({ pitch: 'E4', elapsedMs: -5 });

    expect(recorded[0].event).toEqual({
      grade: 2,
      timestamp: 5_000,
      responseMs: 2_345,
      mode: 'note-game',
    });
    expect(recorded[1].event.timestamp).toBe(9_000);
    expect(recorded[1].event.responseMs).toBe(60_000);
    expect(recorded[2].event.responseMs).toBe(0);
  });

  it('grades by sounding pitch, independent of spelling; an unreadable answer grades wrong', () => {
    const grades = [];
    const { engine } = testSweep({ grid: [['A#4', 'A#4', 'A#4']] });

    grades.push(engine.answer({ pitch: 'Bb4', elapsedMs: 1 }).grade);
    grades.push(engine.answer({ pitch: 'Bb2', elapsedMs: 1 }).grade);
    grades.push(engine.answer({ pitch: 'nope', elapsedMs: 1 }).grade);

    expect(grades).toEqual([2, 1, 0]);
  });

  it('follows an injected prompt order, keying each answer to the prompted button', () => {
    const { engine, recorded } = testSweep({ order: (count) => [2, 0, 1].slice(0, count) });

    expect(engine.prompt()).toEqual({ index: 0, total: 3, buttonIndex: 2, pitch: 'E4' });
    const outcome = engine.answer({ pitch: 'E4', elapsedMs: 1 });

    expect(outcome).toEqual({ grade: 2, buttonIndex: 2 });
    expect(recorded[0].key).toBe('rheinische142/right/open/1/1/forward');
    expect(engine.prompt()).toEqual({ index: 1, total: 3, buttonIndex: 0, pitch: 'C4' });
  });

  it('refuses an answer after the sweep is done', () => {
    const { engine, recorded } = testSweep({ grid: [['C4']] });

    engine.answer({ pitch: 'C4', elapsedMs: 1 });

    expect(() => engine.answer({ pitch: 'C4', elapsedMs: 1 })).toThrow();
    expect(recorded).toHaveLength(1);
  });
});

// The staff game answers with a tapped position; the engine resolves it to a
// pitch through the same grid it prompts from (ADR 0004).
describe('sweep with tapped-position answers', () => {
  const PAIR_GRID = [
    ['C4', ''],
    ['D4', 'C5'],
  ];

  function tapSweep() {
    return testSweep({
      grid: PAIR_GRID,
      quizDirection: 'reverse',
      mode: 'staff-game',
    });
  }

  it('resolves the tapped position through the grid and grades with the midi rule', () => {
    const { engine, recorded } = tapSweep();

    // Prompted C4: tapping its own button is correct.
    expect(engine.prompt()).toEqual({ index: 0, total: 3, buttonIndex: 0, pitch: 'C4' });
    expect(engine.answer({ tappedIndex: 0, elapsedMs: 700 })).toEqual({
      grade: 2,
      buttonIndex: 0,
    });

    // Prompted D4: tapping C4 is a different pitch class — wrong.
    expect(engine.prompt()?.pitch).toBe('D4');
    expect(engine.answer({ tappedIndex: 0, elapsedMs: 700 }).grade).toBe(0);

    // Prompted C5: tapping C4 matches the pitch class — partial credit.
    expect(engine.prompt()?.pitch).toBe('C5');
    expect(engine.answer({ tappedIndex: 0, elapsedMs: 700 }).grade).toBe(1);

    expect(recorded.map((r) => r.event.grade)).toEqual([2, 0, 1]);
  });

  it('keys each answer to the prompted button and tags the staff-game mode', () => {
    const { engine, recorded } = tapSweep();

    engine.answer({ tappedIndex: 2, elapsedMs: 1_500 });

    expect(recorded[0].key).toBe('rheinische142/right/open/0/0/reverse');
    expect(recorded[0].event).toEqual({
      grade: 1,
      timestamp: 1_000,
      responseMs: 1_500,
      mode: 'staff-game',
    });
  });

  it('grades a tap outside the grid wrong instead of throwing', () => {
    const { engine } = tapSweep();

    expect(engine.answer({ tappedIndex: 99, elapsedMs: 1 }).grade).toBe(0);
  });
});

describe('parseItemKey', () => {
  it('reads the positional parts back out of a key', () => {
    expect(parseItemKey('rheinische142/left/close/3/12/reverse')).toEqual({
      instrument: 'rheinische142',
      side: 'left',
      direction: 'close',
      row: 3,
      column: 12,
      quizDirection: 'reverse',
    });
  });

  it('inverts itemKey', () => {
    const parts = parseItemKey(itemKey('toy', 'right', 'open', 0, 7, 'forward'));

    expect(itemKey(...(Object.values(parts) as Parameters<typeof itemKey>))).toBe(
      'toy/right/open/0/7/forward',
    );
  });
});

// Duplicate pitches (ADR 0004): when the quizzed pitch sounds on two buttons of
// the layout, a correct tap credits the tapped button and the engine at once
// asks for the remaining one as an ordinary full-weight prompt.
describe('duplicate-pitch follow-up', () => {
  // E5 sounds on buttons 0 and 2; D5 and E4 are single.
  const TWIN_GRID = [
    ['E5', 'D5'],
    ['E5', 'E4'],
  ];
  const keyAt = (row: number, column: number) =>
    `rheinische142/right/open/${row}/${column}/reverse`;

  function twinSweep(overrides: Partial<Parameters<typeof createSweep>[0]> = {}) {
    return testSweep({
      grid: TWIN_GRID,
      quizDirection: 'reverse',
      mode: 'staff-game',
      ...overrides,
    });
  }

  it('marks the twin prompt, credits the tapped button, and asks for the other one next', () => {
    const { engine, recorded } = twinSweep();
    expect(engine.total).toBe(4);

    expect(engine.prompt()).toEqual({
      index: 0,
      total: 4,
      buttonIndex: 0,
      pitch: 'E5',
      twin: 'expected',
    });
    expect(engine.answer({ tappedIndex: 0, elapsedMs: 900 })).toEqual({ grade: 2, buttonIndex: 0 });
    expect(recorded[0].key).toBe(keyAt(0, 0));

    // The follow-up comes immediately and grows the run by one.
    expect(engine.total).toBe(5);
    expect(engine.prompt()).toEqual({
      index: 1,
      total: 5,
      buttonIndex: 2,
      pitch: 'E5',
      twin: 'follow-up',
    });
    expect(engine.answer({ tappedIndex: 2, elapsedMs: 1_100 })).toEqual({
      grade: 2,
      buttonIndex: 2,
    });
    expect(recorded[1]).toEqual({
      key: keyAt(1, 0),
      event: { grade: 2, timestamp: 1_000, responseMs: 1_100, mode: 'staff-game' },
    });

    // Then the run continues where it was; a single pitch carries no marker.
    expect(engine.prompt()).toEqual({ index: 2, total: 5, buttonIndex: 1, pitch: 'D5' });
  });

  it('credits the twin when the tap lands there first, then asks for the prompted button', () => {
    const { engine, recorded } = twinSweep();

    expect(engine.answer({ tappedIndex: 2, elapsedMs: 1 })).toEqual({ grade: 2, buttonIndex: 2 });
    expect(recorded[0].key).toBe(keyAt(1, 0));
    expect(engine.prompt()).toMatchObject({ buttonIndex: 0, pitch: 'E5', twin: 'follow-up' });

    expect(engine.answer({ tappedIndex: 0, elapsedMs: 1 })).toEqual({ grade: 2, buttonIndex: 0 });
    expect(recorded[1].key).toBe(keyAt(0, 0));
  });

  it('grades the follow-up like any prompt, against the remaining button', () => {
    // Wrong octave: partial credit, keyed to the remaining button.
    const partial = twinSweep();
    partial.engine.answer({ tappedIndex: 0, elapsedMs: 1 });
    expect(partial.engine.answer({ tappedIndex: 3, elapsedMs: 1 })).toEqual({
      grade: 1,
      buttonIndex: 2,
    });
    expect(partial.recorded[1]).toMatchObject({ key: keyAt(1, 0), event: { grade: 1 } });

    // Re-tapping the button already credited is not the remaining one: wrong.
    const spent = twinSweep();
    spent.engine.answer({ tappedIndex: 0, elapsedMs: 1 });
    expect(spent.engine.answer({ tappedIndex: 0, elapsedMs: 1 })).toEqual({
      grade: 0,
      buttonIndex: 2,
    });
    expect(spent.recorded[1]).toMatchObject({ key: keyAt(1, 0), event: { grade: 0 } });

    // Either way the run moves on with no further follow-up.
    for (const { engine } of [partial, spent]) {
      expect(engine.total).toBe(5);
      expect(engine.prompt()).toEqual({ index: 2, total: 5, buttonIndex: 1, pitch: 'D5' });
    }
  });

  it('enqueues nothing after a partial or wrong first tap on a twin pitch', () => {
    const { engine, recorded } = twinSweep();

    engine.answer({ tappedIndex: 3, elapsedMs: 1 }); // E4 for E5: partial credit

    expect(recorded[0]).toMatchObject({ key: keyAt(0, 0), event: { grade: 1 } });
    expect(engine.total).toBe(4);
    expect(engine.prompt()).toEqual({ index: 1, total: 4, buttonIndex: 1, pitch: 'D5' });
  });

  it('follows up once per correct twin prompt, so both regular prompts of a pair ask again', () => {
    const { engine, recorded } = twinSweep();

    engine.answer({ tappedIndex: 0, elapsedMs: 1 }); // E5 → follow-up for button 2
    engine.answer({ tappedIndex: 2, elapsedMs: 1 });
    engine.answer({ tappedIndex: 1, elapsedMs: 1 }); // D5
    expect(engine.prompt()).toMatchObject({ index: 3, total: 5, buttonIndex: 2, twin: 'expected' });
    engine.answer({ tappedIndex: 0, elapsedMs: 1 }); // the other E5, tapped at button 0
    expect(engine.prompt()).toMatchObject({
      index: 4,
      total: 6,
      buttonIndex: 2,
      twin: 'follow-up',
    });
    engine.answer({ tappedIndex: 2, elapsedMs: 1 });
    engine.answer({ tappedIndex: 3, elapsedMs: 1 }); // E4

    expect(engine.prompt()).toBeNull();
    expect(recorded.map((r) => r.key)).toEqual([
      keyAt(0, 0),
      keyAt(1, 0),
      keyAt(0, 1),
      keyAt(0, 0),
      keyAt(1, 0),
      keyAt(1, 1),
    ]);
  });

  it('never follows up in a button-prompted mode: the note game answers a twin pitch once', () => {
    const { engine, recorded } = testSweep({ grid: TWIN_GRID });

    expect(engine.prompt()).toEqual({ index: 0, total: 4, buttonIndex: 0, pitch: 'E5' });
    engine.answer({ pitch: 'E5', elapsedMs: 1 });

    expect(engine.total).toBe(4);
    expect(engine.prompt()).toEqual({ index: 1, total: 4, buttonIndex: 1, pitch: 'D5' });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].key).toBe('rheinische142/right/open/0/0/forward');
  });

  it('detects twins by sounding pitch, spelling aside', () => {
    const { engine } = twinSweep({ grid: [['E5', 'Fb5']] });

    expect(engine.prompt()?.twin).toBe('expected');
    engine.answer({ tappedIndex: 1, elapsedMs: 1 });
    expect(engine.prompt()).toMatchObject({ buttonIndex: 0, twin: 'follow-up' });
  });

  it('asks for the other E5 of the 142 right-close layout once the first is found', () => {
    const grid = layoutGrid(instruments.rheinische142, 'right', 'close');
    const buttons = flattenGrid(grid);
    const first = buttons.findIndex((b) => b.pitch === 'E5');
    const second = buttons.findIndex((b, i) => b.pitch === 'E5' && i !== first);
    const { engine, recorded } = testSweep({
      grid,
      direction: 'close',
      quizDirection: 'reverse',
      mode: 'staff-game',
      order: (count) => [first, ...[...Array(count).keys()].filter((i) => i !== first)],
    });

    expect(engine.total).toBe(38);
    expect(engine.prompt()).toMatchObject({ pitch: 'E5', twin: 'expected' });
    engine.answer({ tappedIndex: first, elapsedMs: 1 });
    expect(engine.prompt()).toMatchObject({ total: 39, buttonIndex: second, twin: 'follow-up' });
    engine.answer({ tappedIndex: second, elapsedMs: 1 });

    expect(recorded.map((r) => r.key)).toEqual([
      'rheinische142/right/close/4/5/reverse',
      'rheinische142/right/close/5/4/reverse',
    ]);
  });
});

describe('twinGroups', () => {
  it('finds exactly the twin pairs of the real layouts', () => {
    const found: string[] = [];
    for (const instrument of Object.keys(instruments)) {
      for (const side of ['right', 'left'] as const) {
        for (const direction of ['open', 'close'] as const) {
          const buttons = flattenGrid(layoutGrid(instruments[instrument], side, direction));
          for (const group of twinGroups(buttons)) {
            const cells = group.map((i) => `${buttons[i].row},${buttons[i].column}`).join(' ');
            found.push(`${instrument} ${side} ${direction} ${buttons[group[0]].pitch} ${cells}`);
          }
        }
      }
    }

    expect(found).toEqual([
      'rheinische142 right close E5 4,5 5,4',
      'rheinische142 left close E3 4,1 5,1',
      'rheinische152 right close E5 4,5 5,4',
      'rheinische152 left close E3 4,1 5,1',
      'einheitsbandonion144 left close C#2 5,0 5,7',
      'peguri146 right open D#6 2,5 5,8',
      'peguri146 right close D#6 2,5 5,8',
      'peguri146 left open A4 2,3 5,0',
      'peguri146 left close A4 2,3 5,0',
      'manouri148 right open D#6 2,5 5,8',
      'manouri148 right close D#6 2,5 5,8',
      'manouri148 left close A4 2,3 5,0',
    ]);
  });
});

describe('layoutGrid', () => {
  it('orders buttons exactly as the keyboard renders them, for every layout', () => {
    setActivePinia(createPinia());
    const store = useStore();
    const settings = useSettingsStore();

    for (const instrument of Object.keys(instruments)) {
      settings.instrument = instrument;
      for (const side of ['right', 'left'] as const) {
        store.side = side;
        for (const direction of ['open', 'close'] as const) {
          store.direction = direction;
          const pitches = flattenGrid(layoutGrid(instruments[instrument], side, direction)) //
            .map((b) => b.pitch);
          expect(pitches, `${instrument} ${side} ${direction}`) //
            .toEqual(store.keyPositions.map(([, , tonal]) => tonal));
          expect(pitches.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
