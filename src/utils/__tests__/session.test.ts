import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import type { Instrument } from '../../data/index';
import { instruments } from '../../data/index';
import { useStore } from '../../stores/main';
import type { AnswerEvent } from '../../stores/practice';
import { useSettingsStore } from '../../stores/settings';
import type { Layout, Prompt, QuizDirection, SessionEngine } from '../session';
import {
  createSession,
  flattenGrid,
  itemKey,
  layoutGrid,
  parseItemKey,
  twinGroups,
} from '../session';
import type { Spelling, SpellingChoice } from '../spelling';

const RIGHT_OPEN = { side: 'right', direction: 'open' } as const;

// Toy grid with an empty cell, so button order and grid coordinates diverge
// the way they do on real layouts.
const GRID = [
  ['C4', ''],
  ['D4', 'E4'],
];

// Small deterministic random source (mulberry32), so draws are repeatable.
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface RunOptions {
  grid: string[][];
  instrument: string;
  layout: Layout;
  quizDirection: QuizDirection;
  mode: string;
  // Permutation of button indices to draw in; render order when omitted.
  order?: (count: number) => number[];
  spelling?: SpellingChoice;
  random?: () => number;
  now: () => number;
}

// A fixed run over one layout: the draw is that layout's buttons as item keys,
// in render order or in the injected permutation. The instrument carries the
// tested grid and nothing else, so a stray key would find no button.
function testRun(overrides: Partial<RunOptions> = {}) {
  const options: RunOptions = {
    grid: GRID,
    instrument: 'rheinische142',
    layout: RIGHT_OPEN,
    quizDirection: 'forward',
    mode: 'note-game',
    now: () => 1_000,
    ...overrides,
  };
  const { grid, instrument, layout, quizDirection } = options;
  const buttons = flattenGrid(grid);
  const indices = options.order?.(buttons.length) ?? buttons.map((_, i) => i);
  const layouts: Instrument = {
    right: { open: [], close: [] },
    left: { open: [], close: [] },
  };
  layouts[layout.side][layout.direction] = grid;

  const recorded: { key: string; event: AnswerEvent }[] = [];
  const engine = createSession({
    layouts,
    instrument,
    quizDirection,
    mode: options.mode,
    spelling: options.spelling,
    random: options.random,
    draw: indices.map((i) =>
      itemKey(
        instrument,
        layout.side,
        layout.direction,
        buttons[i].row,
        buttons[i].column,
        quizDirection,
      ),
    ),
    record: (key, event) => recorded.push({ key, event }),
    now: options.now,
  });
  return { engine, recorded };
}

describe('fixed run over one layout', () => {
  it('prompts every button once and records one graded event per answer, immediately', () => {
    const { engine, recorded } = testRun();

    expect(engine.total).toBe(3);

    expect(engine.prompt()).toEqual({
      index: 0,
      total: 3,
      layout: RIGHT_OPEN,
      buttonIndex: 0,
      pitch: 'C4',
      spelling: 'sharp',
    });
    engine.answer({ pitch: 'C4', elapsedMs: 1_200 });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].key).toBe('rheinische142/right/open/0/0/forward');
    expect(recorded[0].event.grade).toBe(2);

    expect(engine.prompt()).toEqual({
      index: 1,
      total: 3,
      layout: RIGHT_OPEN,
      buttonIndex: 1,
      pitch: 'D4',
      spelling: 'sharp',
    });
    engine.answer({ pitch: 'D5', elapsedMs: 800 });
    expect(recorded).toHaveLength(2);
    expect(recorded[1].key).toBe('rheinische142/right/open/1/0/forward');
    expect(recorded[1].event.grade).toBe(1);

    expect(engine.prompt()).toEqual({
      index: 2,
      total: 3,
      layout: RIGHT_OPEN,
      buttonIndex: 2,
      pitch: 'E4',
      spelling: 'sharp',
    });
    engine.answer({ pitch: 'C4', elapsedMs: 500 });
    expect(recorded).toHaveLength(3);
    expect(recorded[2].key).toBe('rheinische142/right/open/1/1/forward');
    expect(recorded[2].event.grade).toBe(0);

    expect(engine.prompt()).toBeNull();
  });

  it('stamps each event with the injected clock, the mode tag, and the response time clamped to 60 s', () => {
    let clock = 5_000;
    const { engine, recorded } = testRun({ now: () => clock });

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
    const { engine } = testRun({ grid: [['A#4', 'A#4', 'A#4']] });

    grades.push(engine.answer({ pitch: 'Bb4', elapsedMs: 1 }).grade);
    grades.push(engine.answer({ pitch: 'Bb2', elapsedMs: 1 }).grade);
    grades.push(engine.answer({ pitch: 'nope', elapsedMs: 1 }).grade);

    expect(grades).toEqual([2, 1, 0]);
  });

  it('follows an injected prompt order, keying each answer to the prompted button', () => {
    const { engine, recorded } = testRun({ order: (count) => [2, 0, 1].slice(0, count) });

    expect(engine.prompt()).toEqual({
      index: 0,
      total: 3,
      layout: RIGHT_OPEN,
      buttonIndex: 2,
      pitch: 'E4',
      spelling: 'sharp',
    });
    const outcome = engine.answer({ pitch: 'E4', elapsedMs: 1 });

    expect(outcome).toEqual({ grade: 2, buttonIndex: 2 });
    expect(recorded[0].key).toBe('rheinische142/right/open/1/1/forward');
    expect(engine.prompt()).toEqual({
      index: 1,
      total: 3,
      layout: RIGHT_OPEN,
      buttonIndex: 0,
      pitch: 'C4',
      spelling: 'sharp',
    });
  });

  it('refuses an answer after the run is done', () => {
    const { engine, recorded } = testRun({ grid: [['C4']] });

    engine.answer({ pitch: 'C4', elapsedMs: 1 });

    expect(() => engine.answer({ pitch: 'C4', elapsedMs: 1 })).toThrow();
    expect(recorded).toHaveLength(1);
  });
});

// The staff game answers with a tapped position; the engine resolves it to a
// pitch through the same grid it prompts from (ADR 0004).
describe('fixed run with tapped-position answers', () => {
  const PAIR_GRID = [
    ['C4', ''],
    ['D4', 'C5'],
  ];

  function tapRun() {
    return testRun({
      grid: PAIR_GRID,
      quizDirection: 'reverse',
      mode: 'staff-game',
    });
  }

  it('resolves the tapped position through the grid and grades with the midi rule', () => {
    const { engine, recorded } = tapRun();

    // Prompted C4: tapping its own button is correct.
    expect(engine.prompt()).toEqual({
      index: 0,
      total: 3,
      layout: RIGHT_OPEN,
      buttonIndex: 0,
      pitch: 'C4',
      spelling: 'sharp',
    });
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
    const { engine, recorded } = tapRun();

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
    const { engine } = tapRun();

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
    const { instrument, side, direction, row, column, quizDirection } = parseItemKey(
      itemKey('toy', 'right', 'open', 0, 7, 'forward'),
    );

    expect(itemKey(instrument, side, direction, row, column, quizDirection)).toBe(
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

  function twinRun(overrides: Partial<RunOptions> = {}) {
    return testRun({
      grid: TWIN_GRID,
      quizDirection: 'reverse',
      mode: 'staff-game',
      ...overrides,
    });
  }

  it('marks the twin prompt, credits the tapped button, and asks for the other one next', () => {
    const { engine, recorded } = twinRun();
    expect(engine.total).toBe(4);

    expect(engine.prompt()).toEqual({
      index: 0,
      total: 4,
      layout: RIGHT_OPEN,
      buttonIndex: 0,
      pitch: 'E5',
      spelling: 'sharp',
      twin: 'expected',
    });
    expect(engine.answer({ tappedIndex: 0, elapsedMs: 900 })).toEqual({ grade: 2, buttonIndex: 0 });
    expect(recorded[0].key).toBe(keyAt(0, 0));

    // The follow-up comes immediately and grows the run by one.
    expect(engine.total).toBe(5);
    expect(engine.prompt()).toEqual({
      index: 1,
      total: 5,
      layout: RIGHT_OPEN,
      buttonIndex: 2,
      pitch: 'E5',
      spelling: 'sharp',
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
    expect(engine.prompt()).toEqual({
      index: 2,
      total: 5,
      layout: RIGHT_OPEN,
      buttonIndex: 1,
      pitch: 'D5',
      spelling: 'sharp',
    });
  });

  it('credits the twin when the tap lands there first, then asks for the prompted button', () => {
    const { engine, recorded } = twinRun();

    expect(engine.answer({ tappedIndex: 2, elapsedMs: 1 })).toEqual({ grade: 2, buttonIndex: 2 });
    expect(recorded[0].key).toBe(keyAt(1, 0));
    expect(engine.prompt()).toMatchObject({ buttonIndex: 0, pitch: 'E5', twin: 'follow-up' });

    expect(engine.answer({ tappedIndex: 0, elapsedMs: 1 })).toEqual({ grade: 2, buttonIndex: 0 });
    expect(recorded[1].key).toBe(keyAt(0, 0));
  });

  it('grades the follow-up like any prompt, against the remaining button', () => {
    // Wrong octave: partial credit, keyed to the remaining button.
    const partial = twinRun();
    partial.engine.answer({ tappedIndex: 0, elapsedMs: 1 });
    expect(partial.engine.answer({ tappedIndex: 3, elapsedMs: 1 })).toEqual({
      grade: 1,
      buttonIndex: 2,
    });
    expect(partial.recorded[1]).toMatchObject({ key: keyAt(1, 0), event: { grade: 1 } });

    // Re-tapping the button already credited is not the remaining one: wrong.
    const spent = twinRun();
    spent.engine.answer({ tappedIndex: 0, elapsedMs: 1 });
    expect(spent.engine.answer({ tappedIndex: 0, elapsedMs: 1 })).toEqual({
      grade: 0,
      buttonIndex: 2,
    });
    expect(spent.recorded[1]).toMatchObject({ key: keyAt(1, 0), event: { grade: 0 } });

    // Either way the run moves on with no further follow-up.
    for (const { engine } of [partial, spent]) {
      expect(engine.total).toBe(5);
      expect(engine.prompt()).toEqual({
        index: 2,
        total: 5,
        layout: RIGHT_OPEN,
        buttonIndex: 1,
        pitch: 'D5',
        spelling: 'sharp',
      });
    }
  });

  it('enqueues nothing after a partial or wrong first tap on a twin pitch', () => {
    const { engine, recorded } = twinRun();

    engine.answer({ tappedIndex: 3, elapsedMs: 1 }); // E4 for E5: partial credit

    expect(recorded[0]).toMatchObject({ key: keyAt(0, 0), event: { grade: 1 } });
    expect(engine.total).toBe(4);
    expect(engine.prompt()).toEqual({
      index: 1,
      total: 4,
      layout: RIGHT_OPEN,
      buttonIndex: 1,
      pitch: 'D5',
      spelling: 'sharp',
    });
  });

  it('follows up once per correct twin prompt, so both regular prompts of a pair ask again', () => {
    const { engine, recorded } = twinRun();

    engine.answer({ tappedIndex: 0, elapsedMs: 1 }); // E5 → follow-up for button 2
    engine.answer({ tappedIndex: 2, elapsedMs: 1 });
    engine.answer({ tappedIndex: 1, elapsedMs: 1 }); // D5
    expect(engine.prompt()).toMatchObject({ index: 3, total: 5, buttonIndex: 2, twin: 'expected' });
    engine.answer({ tappedIndex: 0, elapsedMs: 1 }); // the other E5, tapped at button 0
    expect(engine.prompt()).toMatchObject({
      index: 4,
      total: 6,
      layout: RIGHT_OPEN,
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
    const { engine, recorded } = testRun({ grid: TWIN_GRID });

    expect(engine.prompt()).toEqual({
      index: 0,
      total: 4,
      layout: RIGHT_OPEN,
      buttonIndex: 0,
      pitch: 'E5',
      spelling: 'sharp',
    });
    engine.answer({ pitch: 'E5', elapsedMs: 1 });

    expect(engine.total).toBe(4);
    expect(engine.prompt()).toEqual({
      index: 1,
      total: 4,
      layout: RIGHT_OPEN,
      buttonIndex: 1,
      pitch: 'D5',
      spelling: 'sharp',
    });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].key).toBe('rheinische142/right/open/0/0/forward');
  });

  it('detects twins by sounding pitch, spelling aside', () => {
    const { engine } = twinRun({ grid: [['E5', 'Fb5']] });

    expect(engine.prompt()?.twin).toBe('expected');
    engine.answer({ tappedIndex: 1, elapsedMs: 1 });
    expect(engine.prompt()).toMatchObject({ buttonIndex: 0, twin: 'follow-up' });
  });

  it('asks for the other E5 of the 142 right-close layout once the first is found', () => {
    const grid = layoutGrid(instruments.rheinische142, 'right', 'close');
    const buttons = flattenGrid(grid);
    const first = buttons.findIndex((b) => b.pitch === 'E5');
    const second = buttons.findIndex((b, i) => b.pitch === 'E5' && i !== first);
    const { engine, recorded } = testRun({
      grid,
      layout: { side: 'right', direction: 'close' },
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

// A scheduler-drawn session runs the same engine over item keys that may name
// any of the game's four layouts, so the keyboard changes between prompts.
describe('scheduler-drawn session', () => {
  const LAYOUTS = {
    right: { open: [['C4', '']], close: [['D4', 'E4']] },
    left: { open: [['G3']], close: [['A3']] },
  };

  function testSession(draw: string[], overrides: Record<string, unknown> = {}) {
    const recorded: { key: string; event: AnswerEvent }[] = [];
    const engine = createSession({
      layouts: LAYOUTS,
      instrument: 'toy',
      quizDirection: 'forward',
      mode: 'note-game',
      draw,
      record: (key, event) => recorded.push({ key, event }),
      now: () => 1_000,
      ...overrides,
    });
    return { engine, recorded };
  }

  it('prompts the drawn items in order, naming each one’s layout', () => {
    const { engine } = testSession([
      'toy/left/close/0/0/forward',
      'toy/right/close/0/1/forward',
      'toy/right/open/0/0/forward',
    ]);

    expect(engine.total).toBe(3);
    expect(engine.prompt()).toEqual({
      index: 0,
      total: 3,
      layout: { side: 'left', direction: 'close' },
      buttonIndex: 0,
      pitch: 'A3',
      spelling: 'sharp',
    });

    engine.answer({ pitch: 'A3', elapsedMs: 500 });
    expect(engine.prompt()).toMatchObject({
      layout: { side: 'right', direction: 'close' },
      buttonIndex: 1,
      pitch: 'E4',
      spelling: 'sharp',
    });

    engine.answer({ pitch: 'E4', elapsedMs: 500 });
    expect(engine.prompt()).toMatchObject({ layout: RIGHT_OPEN, pitch: 'C4' });

    engine.answer({ pitch: 'C4', elapsedMs: 500 });
    expect(engine.prompt()).toBeNull();
  });

  it('records each answer under the drawn key, graded by the same rule', () => {
    const { engine, recorded } = testSession([
      'toy/right/close/0/1/forward',
      'toy/left/open/0/0/forward',
    ]);

    engine.answer({ pitch: 'E5', elapsedMs: 400 }); // E4 prompted: pitch class only
    engine.answer({ pitch: 'G3', elapsedMs: 900 });

    expect(recorded.map((r) => [r.key, r.event.grade])).toEqual([
      ['toy/right/close/0/1/forward', 1],
      ['toy/left/open/0/0/forward', 2],
    ]);
    expect(recorded[0].event).toEqual({
      grade: 1,
      timestamp: 1_000,
      responseMs: 400,
      mode: 'note-game',
    });
  });

  it('inserts a duplicate-pitch follow-up inside the prompt’s own layout', () => {
    const twinLayouts = {
      right: { open: [['E5', 'D5', 'E5']], close: [['C4']] },
      left: { open: [['G3']], close: [['A3']] },
    };
    const { engine, recorded } = testSession(
      ['toy/right/open/0/0/forward', 'toy/left/close/0/0/forward'],
      { layouts: twinLayouts, quizDirection: 'reverse', mode: 'staff-game' },
    );

    expect(engine.prompt()).toMatchObject({ total: 2, buttonIndex: 0, twin: 'expected' });

    // Tapping the twin credits the tapped button and asks for the other one.
    expect(engine.answer({ tappedIndex: 2, elapsedMs: 300 })).toEqual({
      grade: 2,
      buttonIndex: 2,
    });
    expect(recorded[0].key).toBe('toy/right/open/0/2/reverse');
    expect(engine.total).toBe(3);
    expect(engine.prompt()).toMatchObject({
      index: 1,
      total: 3,
      layout: RIGHT_OPEN,
      buttonIndex: 0,
      twin: 'follow-up',
    });

    engine.answer({ tappedIndex: 0, elapsedMs: 300 });
    expect(recorded[1].key).toBe('toy/right/open/0/0/reverse');
    expect(engine.prompt()).toMatchObject({
      layout: { side: 'left', direction: 'close' },
      pitch: 'A3',
      spelling: 'sharp',
    });
  });
});

// Spelling (ADR 0004): a prompt names its accidental as a sharp or as a flat.
// The grid keeps its own spelling either way; only the prompt is stamped.
describe('spelling', () => {
  const ACCIDENTAL_GRID = [['C4', 'C#4', 'D#4']];
  // C#5 sounds on two buttons, so a correct tap inserts a follow-up.
  const TWIN_ACCIDENTAL_GRID = [
    ['C#5', 'D5'],
    ['C#5', 'E4'],
  ];

  // Every prompt of a run, answered unreadably so nothing is inserted behind it.
  function allPrompts(engine: SessionEngine): Prompt[] {
    const prompts: Prompt[] = [];
    for (let prompt = engine.prompt(); prompt; prompt = engine.prompt()) {
      prompts.push(prompt);
      engine.answer({ pitch: 'nope', elapsedMs: 1 });
    }
    return prompts;
  }

  const named = (prompts: Prompt[], pitch: string) =>
    prompts.filter((prompt) => prompt.pitch === pitch).map((prompt) => prompt.spelling);

  it('spells every prompt with sharps by default', () => {
    const { engine } = testRun({ grid: ACCIDENTAL_GRID });

    expect(allPrompts(engine).map((prompt) => [prompt.pitch, prompt.spelling])).toEqual([
      ['C4', 'sharp'],
      ['C#4', 'sharp'],
      ['D#4', 'sharp'],
    ]);
  });

  it('stamps a flat run flat, leaving the grid’s own spelling on the pitch', () => {
    const { engine } = testRun({ grid: ACCIDENTAL_GRID, spelling: 'flat' });

    expect(allPrompts(engine).map((prompt) => [prompt.pitch, prompt.spelling])).toEqual([
      ['C4', 'flat'],
      ['C#4', 'flat'],
      ['D#4', 'flat'],
    ]);
  });

  it('grades a flat run by sounding pitch, so either name of the prompt is right', () => {
    const answeredFlat = testRun({ grid: [['C#4']], spelling: 'flat' });
    const answeredSharp = testRun({ grid: [['C#4']], spelling: 'flat' });

    expect(answeredFlat.engine.answer({ pitch: 'Db4', elapsedMs: 1 }).grade).toBe(2);
    expect(answeredSharp.engine.answer({ pitch: 'C#4', elapsedMs: 1 }).grade).toBe(2);
  });

  it('asks each item once under “both”, naming each accidental one way for the run', () => {
    const { engine } = testRun({ grid: ACCIDENTAL_GRID, spelling: 'both', random: seeded(1) });
    expect(engine.total).toBe(3);

    const prompts = allPrompts(engine);

    expect(named(prompts, 'C4')).toEqual(['sharp']);
    expect(named(prompts, 'C#4')).toHaveLength(1);
    expect(named(prompts, 'D#4')).toHaveLength(1);
    for (const prompt of prompts) expect(['sharp', 'flat']).toContain(prompt.spelling);
  });

  it('draws the spelling per accidental and per run, so both names come up', () => {
    const drawn = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const { engine } = testRun({ grid: ACCIDENTAL_GRID, spelling: 'both', random: seeded(seed) });
      const prompts = allPrompts(engine);
      const [cSharp] = named(prompts, 'C#4');
      const [dSharp] = named(prompts, 'D#4');
      drawn.add(`C#4 ${cSharp}`);
      drawn.add(`D#4 ${dSharp}`);
      // Two accidentals in one run can disagree: it is a draw per item, not per run.
      if (cSharp !== dSharp) drawn.add('mixed');
    }
    expect([...drawn].sort()).toEqual(['C#4 flat', 'C#4 sharp', 'D#4 flat', 'D#4 sharp', 'mixed']);
  });

  it('gives a twin follow-up the spelling of the prompt that triggered it', () => {
    const covered = new Set<Spelling>();
    for (let seed = 1; seed <= 20; seed++) {
      const { engine } = testRun({
        grid: TWIN_ACCIDENTAL_GRID,
        quizDirection: 'reverse',
        mode: 'staff-game',
        spelling: 'both',
        random: seeded(seed),
      });

      // Scan the draw for a twin prompt; every other prompt is answered with
      // D5, which is never a twin, so no follow-up is inserted.
      let triggered: Prompt | null = null;
      for (let prompt = engine.prompt(); prompt; prompt = engine.prompt()) {
        if (prompt.twin === 'expected') {
          engine.answer({ tappedIndex: prompt.buttonIndex, elapsedMs: 1 });
          triggered = prompt;
          break;
        }
        engine.answer({ tappedIndex: 1, elapsedMs: 1 });
      }

      expect(triggered, `seed ${seed}`).not.toBeNull();
      const spelling = (triggered as Prompt).spelling;
      expect(engine.prompt()).toMatchObject({ pitch: 'C#5', spelling, twin: 'follow-up' });
      covered.add(spelling);
    }
    // Across these seeds the twin was named both ways, so both were inherited.
    expect([...covered].sort()).toEqual(['flat', 'sharp']);
  });
});
