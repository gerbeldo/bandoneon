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

export interface Prompt {
  index: number;
  total: number;
  buttonIndex: number;
}

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
  answer(input: { pitch: string; elapsedMs: number }): AnswerOutcome;
}

export function createSweep(options: SweepOptions): SessionEngine {
  const buttons = flattenGrid(options.grid);
  const order = options.order?.(buttons.length) ?? buttons.map((_, i) => i);
  let index = 0;

  return {
    total: buttons.length,

    prompt() {
      if (index >= buttons.length) return null;
      return { index, total: buttons.length, buttonIndex: order[index] };
    },

    answer({ pitch, elapsedMs }) {
      if (index >= buttons.length) throw new Error('sweep is done');
      const buttonIndex = order[index];
      const button = buttons[buttonIndex];
      const grade: Grade = scoreTap(button.pitch, pitch) ?? 0;
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
          responseMs: Math.min(Math.max(elapsedMs, 0), RESPONSE_MS_CAP),
          mode: options.mode,
        },
      );
      index += 1;
      return { grade, buttonIndex };
    },
  };
}
