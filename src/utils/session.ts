// Session engine (ADR 0004): the engine draws each prompt and holds the item
// key; games render prompts and capture answers only. The engine grades with
// the one midi-based rule, stamps the timestamp, and writes one answer event
// per answer, immediately — abandoning mid-sweep loses nothing.

import type { AnswerEvent, Grade } from '../stores/practice';
import { scoreTap } from './game';

export type Side = 'right' | 'left';
export type Direction = 'open' | 'close';
export type QuizDirection = 'forward' | 'reverse';

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

interface GridButton {
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

// Random prompt order for a sweep; sort keys are drawn once per index so the
// comparator stays consistent while sorting.
export function shuffledOrder(count: number): number[] {
  const indices = [...Array(count).keys()];
  const random = indices.map(() => Math.random());
  indices.sort((a, b) => (random[a] ?? 0) - (random[b] ?? 0));
  return indices;
}

export interface Prompt {
  index: number;
  total: number;
  buttonIndex: number;
  // The prompted button's pitch — what the staff game draws.
  pitch: string;
}

// The two answer forms on the seam (ADR 0004): the note game names a pitch;
// the staff game hands back the tapped button's index in render order.
export type AnswerInput =
  | { pitch: string; elapsedMs: number }
  | { tappedIndex: number; elapsedMs: number };

export interface AnswerOutcome {
  grade: Grade;
  buttonIndex: number;
}

export interface SweepOptions {
  grid: string[][];
  instrument: string;
  side: Side;
  direction: Direction;
  quizDirection: QuizDirection;
  mode: string;
  record: (key: string, event: AnswerEvent) => void;
  now: () => number;
  // Permutation of button indices to prompt in; identity when omitted.
  order?: (count: number) => number[];
}

export interface SessionEngine {
  total: number;
  prompt(): Prompt | null;
  answer(input: AnswerInput): AnswerOutcome;
}

export function createSweep(options: SweepOptions): SessionEngine {
  const buttons = flattenGrid(options.grid);
  const order = options.order?.(buttons.length) ?? buttons.map((_, i) => i);
  let index = 0;

  return {
    total: buttons.length,

    prompt() {
      if (index >= buttons.length) return null;
      const buttonIndex = order[index];
      return { index, total: buttons.length, buttonIndex, pitch: buttons[buttonIndex].pitch };
    },

    answer(input) {
      if (index >= buttons.length) throw new Error('sweep is done');
      const buttonIndex = order[index];
      const button = buttons[buttonIndex];
      // A tapped position resolves to its pitch through the same grid it was
      // prompted from; a tap outside the grid grades wrong, not a throw.
      const answered = 'pitch' in input ? input.pitch : (buttons[input.tappedIndex]?.pitch ?? '');
      const grade: Grade = scoreTap(button.pitch, answered) ?? 0;
      options.record(
        itemKey(
          options.instrument,
          options.side,
          options.direction,
          button.row,
          button.column,
          options.quizDirection,
        ),
        {
          grade,
          timestamp: options.now(),
          responseMs: Math.min(Math.max(input.elapsedMs, 0), RESPONSE_MS_CAP),
          mode: options.mode,
        },
      );
      index += 1;
      return { grade, buttonIndex };
    },
  };
}
