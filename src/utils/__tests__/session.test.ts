import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { instruments } from '../../data/index';
import { useStore } from '../../stores/main';
import type { AnswerEvent } from '../../stores/practice';
import { useSettingsStore } from '../../stores/settings';
import { createSweep, flattenGrid, layoutGrid } from '../session';

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

    expect(engine.prompt()).toEqual({ index: 0, total: 3, buttonIndex: 0 });
    engine.answer({ pitch: 'C4', elapsedMs: 1_200 });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].key).toBe('rheinische142/right/open/0/0/forward');
    expect(recorded[0].event.grade).toBe(2);

    expect(engine.prompt()).toEqual({ index: 1, total: 3, buttonIndex: 1 });
    engine.answer({ pitch: 'D5', elapsedMs: 800 });
    expect(recorded).toHaveLength(2);
    expect(recorded[1].key).toBe('rheinische142/right/open/1/0/forward');
    expect(recorded[1].event.grade).toBe(1);

    expect(engine.prompt()).toEqual({ index: 2, total: 3, buttonIndex: 2 });
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

    expect(engine.prompt()).toEqual({ index: 0, total: 3, buttonIndex: 2 });
    const outcome = engine.answer({ pitch: 'E4', elapsedMs: 1 });

    expect(outcome).toEqual({ grade: 2, buttonIndex: 2 });
    expect(recorded[0].key).toBe('rheinische142/right/open/1/1/forward');
    expect(engine.prompt()).toEqual({ index: 1, total: 3, buttonIndex: 0 });
  });

  it('refuses an answer after the sweep is done', () => {
    const { engine, recorded } = testSweep({ grid: [['C4']] });

    engine.answer({ pitch: 'C4', elapsedMs: 1 });

    expect(() => engine.answer({ pitch: 'C4', elapsedMs: 1 })).toThrow();
    expect(recorded).toHaveLength(1);
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
