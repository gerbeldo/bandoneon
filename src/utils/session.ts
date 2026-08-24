// Session engine (ADR 0004): the engine draws each prompt and holds the item
// key; games render prompts and capture answers only. The engine grades with
// the one midi-based rule, stamps the timestamp, and writes one answer event
// per answer, immediately — abandoning mid-run loses nothing.

import { Note } from 'tonal';

import type { Instrument } from '../data/index';
import type { AnswerEvent, Grade } from '../stores/practice';
import { scoreTap } from './game';

export type Side = 'right' | 'left';
export type Direction = 'open' | 'close';
export type QuizDirection = 'forward' | 'reverse';

// One side in one direction — the set of buttons the player sees at once.
export interface Layout {
  side: Side;
  direction: Direction;
}

export function layoutKey(layout: Layout): string {
  return `${layout.side}/${layout.direction}`;
}

// Fixed constant, not a setting: response times longer than this record as
// exactly 60 s (the player walked away, not a 4-minute think).
export const RESPONSE_MS_CAP = 60_000;

// Positional item key (ADR 0002): row/column are 0-based grid indices.
export function itemKey(
  instrument: string,
  side: Side,
  direction: Direction,
  row: number,
  column: number,
  quizDirection: QuizDirection,
): string {
  return `${instrument}/${side}/${direction}/${row}/${column}/${quizDirection}`;
}

export interface ItemKeyParts {
  instrument: string;
  side: Side;
  direction: Direction;
  row: number;
  column: number;
  quizDirection: QuizDirection;
}

export function parseItemKey(key: string): ItemKeyParts {
  const [instrument, side, direction, row, column, quizDirection] = key.split('/');
  return {
    instrument,
    side: side as Side,
    direction: direction as Direction,
    row: Number(row),
    column: Number(column),
    quizDirection: quizDirection as QuizDirection,
  };
}

// An instrument nests grids per direction, except when one grid serves both
// directions (peguri146 stores a flat array per side).
export function layoutGrid(
  instrument: Record<string, Record<string, string[][]> | string[][]>,
  side: Side,
  direction: Direction,
): string[][] {
  const keys = instrument[side];
  if (Array.isArray(keys)) return keys;
  return keys?.[direction] ?? [];
}

export interface GridButton {
  row: number;
  column: number;
  pitch: string;
}

// Row-major, skipping empty cells — the same order the keyboard renders its
// buttons in, so a button index addresses the same button on both sides of
// the seam.
export function flattenGrid(grid: string[][]): GridButton[] {
  const buttons: GridButton[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row].length; column++) {
      const pitch = grid[row][column];
      if (pitch) buttons.push({ row, column, pitch });
    }
  }
  return buttons;
}

// Buttons of one layout sounding the same pitch (midi-equal, spelling aside),
// as groups of button indices in render order. Real layouts carry pairs at most.
export function twinGroups(buttons: GridButton[]): number[][] {
  const byMidi = new Map<number, number[]>();
  buttons.forEach((button, index) => {
    const midi = Note.midi(button.pitch);
    if (midi === null) return;
    const group = byMidi.get(midi);
    if (group) group.push(index);
    else byMidi.set(midi, [index]);
  });
  return [...byMidi.values()].filter((group) => group.length > 1);
}

// Shuffled copy: one sort key is drawn per item so the comparator stays
// consistent while sorting; `random` is injectable so draws are repeatable.
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const keys = items.map(() => random());
  return items
    .map((_, index) => index)
    .sort((a, b) => keys[a] - keys[b])
    .map((index) => items[index]);
}

// Random prompt order for a sweep.
export function shuffledOrder(count: number): number[] {
  return shuffled([...Array(count).keys()]);
}

export interface Prompt {
  index: number;
  total: number;
  // A sweep never leaves its layout; a scheduler-drawn session crosses all
  // four layouts of the game.
  layout: Layout;
  buttonIndex: number;
  // The prompted button's pitch — what the staff game draws.
  pitch: string;
  // Duplicate-pitch marker (ADR 0004), only in pitch-prompted modes: 'expected'
  // when the pitch also sounds on another button of this layout, 'follow-up' on
  // the prompt the engine inserts for the remaining button.
  twin?: 'expected' | 'follow-up';
}

// The two answer forms on the seam (ADR 0004): the note game names a pitch;
// the staff game hands back the tapped button's index in render order.
export type RawAnswer = { pitch: string } | { tappedIndex: number };

// What a game hands back: the raw answer plus how long the player took.
export type AnswerInput = RawAnswer & { elapsedMs: number };

export interface AnswerOutcome {
  grade: Grade;
  // The button the answer was credited to: the prompted one, or on a correct
  // tap of a twin pitch, the button actually tapped.
  buttonIndex: number;
}

export interface SessionEngine {
  // Grows by one per follow-up inserted.
  total: number;
  prompt(): Prompt | null;
  answer(input: AnswerInput): AnswerOutcome;
}

interface RunOptions {
  instrument: string;
  quizDirection: QuizDirection;
  mode: string;
  record: (key: string, event: AnswerEvent) => void;
  now: () => number;
}

export interface SweepOptions extends RunOptions {
  grid: string[][];
  layout: Layout;
  // Permutation of button indices to prompt in; identity when omitted.
  order?: (count: number) => number[];
}

export interface SessionOptions extends RunOptions {
  layouts: Instrument;
  // The scheduler's draw: item keys, already shuffled, in prompt order.
  draw: string[];
}

interface DrawnPrompt {
  layout: Layout;
  buttonIndex: number;
  // Set on a follow-up: the twin already credited, which this prompt must not accept again.
  followUpOf?: number;
}

interface EngineCore extends RunOptions {
  buttonsFor: (layout: Layout) => GridButton[];
  draw: DrawnPrompt[];
}

function createEngine(core: EngineCore): SessionEngine {
  const { draw } = core;
  let index = 0;

  // Only a pitch-prompted mode can be ambiguous; the note game prompts by button.
  const twinsByLayout = new Map<string, Map<number, number[]>>();
  function twinsFor(layout: Layout): Map<number, number[]> {
    let twins = twinsByLayout.get(layoutKey(layout));
    if (!twins) {
      twins = new Map();
      if (core.quizDirection === 'reverse') {
        for (const group of twinGroups(core.buttonsFor(layout))) {
          for (const i of group) twins.set(i, group);
        }
      }
      twinsByLayout.set(layoutKey(layout), twins);
    }
    return twins;
  }

  const key = (layout: Layout, button: GridButton) =>
    itemKey(
      core.instrument,
      layout.side,
      layout.direction,
      button.row,
      button.column,
      core.quizDirection,
    );

  return {
    get total() {
      return draw.length;
    },

    prompt() {
      const drawn = draw[index];
      if (!drawn) return null;
      const buttons = core.buttonsFor(drawn.layout);
      const prompt: Prompt = {
        index,
        total: draw.length,
        layout: drawn.layout,
        buttonIndex: drawn.buttonIndex,
        pitch: buttons[drawn.buttonIndex].pitch,
      };
      if (drawn.followUpOf !== undefined) prompt.twin = 'follow-up';
      else if (twinsFor(drawn.layout).has(drawn.buttonIndex)) prompt.twin = 'expected';
      return prompt;
    },

    answer(input) {
      const drawn = draw[index];
      if (!drawn) throw new Error('the run is done');
      const buttons = core.buttonsFor(drawn.layout);
      const target = buttons[drawn.buttonIndex];
      const group = twinsFor(drawn.layout).get(drawn.buttonIndex);
      let credited = drawn.buttonIndex;
      let grade: Grade;

      if ('pitch' in input) {
        grade = scoreTap(target.pitch, input.pitch) ?? 0;
      } else if (input.tappedIndex === drawn.followUpOf) {
        // The follow-up asks for the remaining button; the one already credited is spent.
        grade = 0;
      } else {
        // A tapped position resolves to its pitch through the same grid it was
        // prompted from; a tap outside the grid grades wrong, not a throw.
        grade = scoreTap(target.pitch, buttons[input.tappedIndex]?.pitch ?? '') ?? 0;
        // A correct tap on a twin pitch landed on the target or its twin:
        // credit the button actually tapped.
        if (grade === 2 && group) credited = input.tappedIndex;
      }

      core.record(key(drawn.layout, buttons[credited]), {
        grade,
        timestamp: core.now(),
        responseMs: Math.min(Math.max(input.elapsedMs, 0), RESPONSE_MS_CAP),
        mode: core.mode,
      });

      // A correct first answer on a twin pitch asks for the other button next.
      if (grade === 2 && group && drawn.followUpOf === undefined) {
        const other = group.find((i) => i !== credited);
        if (other !== undefined) {
          draw.splice(index + 1, 0, {
            layout: drawn.layout,
            buttonIndex: other,
            followUpOf: credited,
          });
        }
      }

      index += 1;
      return { grade, buttonIndex: credited };
    },
  };
}

// The on-demand run through every button of one layout.
export function createSweep(options: SweepOptions): SessionEngine {
  const buttons = flattenGrid(options.grid);
  const order = options.order?.(buttons.length) ?? buttons.map((_, i) => i);

  return createEngine({
    ...options,
    buttonsFor: () => buttons,
    draw: order.map((buttonIndex) => ({ layout: options.layout, buttonIndex })),
  });
}

// A scheduler-drawn session: the draw names items across the game's layouts,
// so the keyboard changes between prompts.
export function createSession(options: SessionOptions): SessionEngine {
  const buttonsByLayout = new Map<string, GridButton[]>();
  const buttonsFor = (layout: Layout) => {
    let buttons = buttonsByLayout.get(layoutKey(layout));
    if (!buttons) {
      buttons = flattenGrid(layoutGrid(options.layouts, layout.side, layout.direction));
      buttonsByLayout.set(layoutKey(layout), buttons);
    }
    return buttons;
  };

  // The draw comes from a pool built off these same grids (ADR 0002 keeps keys
  // and grids in step), so every key names a button that is there.
  const draw = options.draw.map((key): DrawnPrompt => {
    const { side, direction, row, column } = parseItemKey(key);
    const layout = { side, direction };
    const buttonIndex = buttonsFor(layout).findIndex(
      (button) => button.row === row && button.column === column,
    );
    return { layout, buttonIndex };
  });

  return createEngine({ ...options, buttonsFor, draw });
}
