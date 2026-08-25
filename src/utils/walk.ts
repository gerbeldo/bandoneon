// Walk: a run over every item in scope in pitch order — up, then back down —
// one layout at a time, the way a scale is played. With no scale chosen it is
// the chromatic walk, which Shalev calls one of the most useful materials for
// learning the 142's keyboard. Shares the pool and preview vocabulary of
// scheduler.ts; records through the same seam as every run.

import { Note } from 'tonal';

import type { Instrument } from '../data/index';
import type { PoolInput, SessionPreview } from './scheduler';
import { previewRun, scopedPool } from './scheduler';
import type { Layout, QuizDirection } from './session';
import { parseItemKey, pitchOfKey } from './session';

// Layouts come in this order: right hand first, open before close — the
// introduction order's precedence.
export const WALK_LAYOUT_ORDER: readonly Layout[] = [
  { side: 'right', direction: 'open' },
  { side: 'right', direction: 'close' },
  { side: 'left', direction: 'open' },
  { side: 'left', direction: 'close' },
];

export interface WalkInput extends PoolInput {
  layouts: Instrument;
  // Pitch-prompted runs list a twin pitch once per pass: the engine asks for
  // the other button as a follow-up (ADR 0004).
  quizDirection: QuizDirection;
}

interface Stop {
  key: string;
  midi: number;
  row: number;
  column: number;
}

// The item keys of a walk, in prompt order. Each layout goes up from its
// lowest scoped pitch to its highest and back down without repeating the top,
// so the bottom note opens and closes the layout as it does a scale.
export function walkKeys(input: WalkInput): string[] {
  const scoped = scopedPool(input);
  const keys: string[] = [];
  for (const layout of WALK_LAYOUT_ORDER) {
    let ascending: Stop[] = [];
    for (const key of scoped) {
      const { side, direction, row, column } = parseItemKey(key);
      if (side !== layout.side || direction !== layout.direction) continue;
      const midi = Note.midi(pitchOfKey(input.layouts, key));
      if (midi !== null) ascending.push({ key, midi, row, column });
    }
    // Ties (twins) fall in render order.
    ascending.sort((a, b) => a.midi - b.midi || a.row - b.row || a.column - b.column);
    if (input.quizDirection === 'reverse') {
      ascending = ascending.filter((stop, i) => i === 0 || stop.midi !== ascending[i - 1].midi);
    }
    const up = ascending.map((stop) => stop.key);
    keys.push(...up, ...up.slice(0, -1).reverse());
  }
  return keys;
}

// Coverage is the whole scoped pool: a twin listed once is still reached
// through the follow-up.
export function previewWalk(input: WalkInput): SessionPreview {
  return previewRun(walkKeys(input), input, scopedPool(input));
}
