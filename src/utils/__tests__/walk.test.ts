import { Note } from 'tonal';
import { describe, expect, it } from 'vitest';

import type { Instrument } from '../../data/index';
import { instruments } from '../../data/index';
import type { ItemRecord } from '../../stores/practice';
import { introductionOrder } from '../introduction';
import { CHROMATIC } from '../scale';
import { ALL_LAYOUTS } from '../scheduler';
import type { QuizDirection } from '../session';
import { flattenGrid, itemKey, layoutGrid, layoutKey, parseItemKey, pitchOfKey } from '../session';
import type { WalkInput } from '../walk';
import { previewWalk, walkKeys, WALK_LAYOUT_ORDER } from '../walk';

const DAY = 86_400_000;
// A fixed local calendar day, well away from midnight.
const NOON = new Date(2026, 7, 24, 12).getTime();

function toy(layouts: Partial<Instrument>): Instrument {
  return { right: { open: [], close: [] }, left: { open: [], close: [] }, ...layouts };
}

// Every button of the toy layouts as an item key, in reverse render order —
// nothing musical about it, so the walk's own ordering is what is under test.
function toyPool(layouts: Instrument, quizDirection: QuizDirection): string[] {
  const keys: string[] = [];
  for (const layout of WALK_LAYOUT_ORDER) {
    for (const button of flattenGrid(layoutGrid(layouts, layout.side, layout.direction))) {
      keys.push(
        itemKey('toy', layout.side, layout.direction, button.row, button.column, quizDirection),
      );
    }
  }
  return keys.reverse();
}

function walkInput(layouts: Instrument, overrides: Partial<WalkInput> = {}): WalkInput {
  const quizDirection = overrides.quizDirection ?? 'forward';
  return {
    pool: toyPool(layouts, quizDirection),
    memory: {},
    scope: ALL_LAYOUTS,
    layouts,
    now: NOON,
    quizDirection,
    ...overrides,
  };
}

const walkPitches = (layouts: Instrument, overrides: Partial<WalkInput> = {}) =>
  walkKeys(walkInput(layouts, overrides)).map((key) => pitchOfKey(layouts, key));

// The grid cells a walk visits, as row/column, so twins can be told apart.
const walkCells = (layouts: Instrument, overrides: Partial<WalkInput> = {}) =>
  walkKeys(walkInput(layouts, overrides)).map((key) => {
    const { row, column } = parseItemKey(key);
    return `${row}/${column}`;
  });

// An item answered once yesterday: seen, but not introduced today.
const seenYesterday = (): ItemRecord => ({
  firstSeen: NOON - DAY,
  answers: [{ grade: 2, timestamp: NOON - DAY, responseMs: 1_000, mode: 'note-game' }],
});

describe('walkKeys', () => {
  it('goes up in pitch and back down, repeating the bottom and not the top', () => {
    const layouts = toy({ right: { open: [['C4', 'E4', 'D4', 'G4']], close: [] } });

    expect(walkPitches(layouts)).toEqual(['C4', 'D4', 'E4', 'G4', 'E4', 'D4', 'C4']);
  });

  it('asks 2n−1 prompts for n items, and a single item just once', () => {
    const one = toy({ right: { open: [['C4']], close: [] } });
    const five = toy({ right: { open: [['C4', 'D4', 'E4', 'F4', 'G4']], close: [] } });

    expect(walkPitches(one)).toEqual(['C4']);
    expect(walkKeys(walkInput(five))).toHaveLength(9);
  });

  it('walks nothing when the scope holds no items', () => {
    const layouts = toy({ right: { open: [['C4']], close: [] } });

    expect(walkKeys(walkInput(layouts, { scope: { side: 'left', direction: 'both' } }))).toEqual(
      [],
    );
  });

  const FOUR_LAYOUTS = toy({
    right: { open: [['C4', 'D4']], close: [['E4']] },
    left: { open: [['G3']], close: [['A3']] },
  });

  const layoutsWalked = (overrides: Partial<WalkInput> = {}) => [
    ...new Set(
      walkKeys(walkInput(FOUR_LAYOUTS, overrides)).map((key) => layoutKey(parseItemKey(key))),
    ),
  ];

  it('takes the layouts in walk order: right before left, open before close', () => {
    expect(layoutsWalked()).toEqual(['right/open', 'right/close', 'left/open', 'left/close']);
    expect(WALK_LAYOUT_ORDER.map(layoutKey)).toEqual(layoutsWalked());
  });

  it('walks only the scoped layouts', () => {
    expect(layoutsWalked({ scope: { side: 'right', direction: 'both' } })).toEqual([
      'right/open',
      'right/close',
    ]);
    expect(layoutsWalked({ scope: { side: 'left', direction: 'close' } })).toEqual(['left/close']);
  });

  it('walks one layout at a time, each up and down before the next', () => {
    expect(walkPitches(FOUR_LAYOUTS)).toEqual(['C4', 'D4', 'C4', 'E4', 'G3', 'A3']);
  });

  it('leaves out the notes a keyed scale does not hold', () => {
    const layouts = toy({ right: { open: [['C4', 'C#4', 'D4']], close: [] } });

    expect(walkPitches(layouts, { scale: { kind: 'major', tonic: 0 } })).toEqual([
      'C4',
      'D4',
      'C4',
    ]);
    expect(walkPitches(layouts, { scale: CHROMATIC })).toEqual(['C4', 'C#4', 'D4', 'C#4', 'C4']);
  });
});

// A twin pitch sounds on two buttons of one layout. The staff game asks for it
// once per pass and the engine follows up for the other button (ADR 0004); the
// note game prompts by button, so both are walked.
describe('walkKeys: twin pitches', () => {
  const TWIN = toy({
    right: {
      open: [
        ['E5', 'D5'],
        ['E5', 'E4'],
      ],
      close: [],
    },
  });

  it('lists both buttons per pass in a button-prompted run, in render order', () => {
    expect(walkCells(TWIN)).toEqual(['1/1', '0/1', '0/0', '1/0', '0/0', '0/1', '1/1']);
    expect(walkCells(toy({ right: { open: [['E5', 'E5']], close: [] } }))).toEqual([
      '0/0',
      '0/1',
      '0/0',
    ]);
  });

  it('lists a twin pitch once per pass in a pitch-prompted run', () => {
    expect(walkCells(TWIN, { quizDirection: 'reverse' })).toEqual([
      '1/1',
      '0/1',
      '0/0',
      '0/1',
      '1/1',
    ]);
  });
});

describe('previewWalk', () => {
  const layouts = toy({ right: { open: [['C4', 'D4', 'E4']], close: [] } });
  const input = walkInput(layouts);

  it('counts prompts over the whole walk and coverage over the items it covers', () => {
    expect(previewWalk({ ...input, memory: { [input.pool[2]]: seenYesterday() } })).toEqual({
      prompts: 5,
      fresh: 2,
      newToday: 0,
      newCap: null,
      seen: 1,
      total: 3,
    });
  });

  it('runs under no daily cap', () => {
    expect(previewWalk(input)).toMatchObject({ prompts: 5, fresh: 3, seen: 0, newCap: null });
  });

  it('counts a twin the walk lists once: the follow-up still reaches it', () => {
    const twin = toy({
      right: {
        open: [
          ['E5', 'D5'],
          ['E5', 'E4'],
        ],
        close: [],
      },
    });

    expect(previewWalk(walkInput(twin, { quizDirection: 'reverse' }))).toMatchObject({
      prompts: 5,
      total: 4,
      fresh: 4,
    });
    expect(previewWalk(walkInput(twin))).toMatchObject({ prompts: 7, total: 4 });
  });
});

// The 142 itself: the walk a player would actually run.
describe('the walk over the Rheinische 142', () => {
  const layouts = instruments.rheinische142;
  const pool = (quizDirection: QuizDirection) =>
    introductionOrder({ instrument: 'rheinische142', layouts, quizDirection });

  it('walks C major up the right/open layout from A3 to B6 and back', () => {
    const keys = walkKeys({
      pool: pool('forward'),
      memory: {},
      scope: { side: 'right', direction: 'open' },
      scale: { kind: 'major', tonic: 0 },
      layouts,
      now: NOON,
      quizDirection: 'forward',
    });
    const pitches = keys.map((key) => pitchOfKey(layouts, key));
    const midi = pitches.map((pitch) => Note.midi(pitch) as number);

    expect(keys).toHaveLength(45);
    expect(pitches[0]).toBe('A3');
    expect(pitches[22]).toBe('B6');
    expect(pitches[44]).toBe('A3');
    for (let i = 1; i <= 22; i++) expect(midi[i], pitches[i]).toBeGreaterThan(midi[i - 1]);
    for (let i = 23; i < midi.length; i++) expect(midi[i], pitches[i]).toBeLessThan(midi[i - 1]);
  });

  it('walks right/close chromatically, the E5 twin once per pass or twice', () => {
    const chromatic = (quizDirection: QuizDirection) =>
      walkKeys({
        pool: pool(quizDirection),
        memory: {},
        scope: { side: 'right', direction: 'close' },
        scale: CHROMATIC,
        layouts,
        now: NOON,
        quizDirection,
      });

    expect(chromatic('reverse')).toHaveLength(73);
    expect(chromatic('forward')).toHaveLength(75);
  });
});
