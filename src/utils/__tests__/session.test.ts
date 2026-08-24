import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { instruments } from '../../data/index';
import { useStore } from '../../stores/main';
import type { AnswerEvent } from '../../stores/practice';
import { useSettingsStore } from '../../stores/settings';
import { createSweep, flattenGrid, itemKey, layoutGrid, parseItemKey } from '../session';

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
