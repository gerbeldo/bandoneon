// Scheduler: picks which items a session draws. Games and the engine see only
// `Scheduler`, so the sampling behind it can be replaced by a spaced-repetition
// model without touching them.

import type { Grade, ItemRecord } from '../stores/practice';
import type { Direction, Side } from './session';
import { parseItemKey, shuffled } from './session';

// Fixed constants, not settings: prompts per session, never-seen items per
// local calendar day per game, answers in the error tally.
export const SESSION_SIZE = 20;
export const DAILY_NEW_ITEMS = 3;
const TALLY_WINDOW = 5;
const TALLY_WEIGHT: Record<Grade, number> = { 2: 0, 1: 0.5, 0: 1 };
const DAY_MS = 86_400_000;

// Error tally: the item's recent-error score over its last 5 answers.
export function errorTally(record: ItemRecord): number {
  return record.answers
    .slice(-TALLY_WINDOW)
    .reduce((sum, answer) => sum + TALLY_WEIGHT[answer.grade], 0);
}

// Sampling weight of a seen item: fractional days since its last answer times
// (1 + error tally). Fractional days keep a second same-day session sensible —
// just-answered items weigh little instead of being excluded.
export function itemWeight(record: ItemRecord, now: number): number {
  const lastSeen = record.answers[record.answers.length - 1]?.timestamp ?? now;
  const days = Math.max(0, now - lastSeen) / DAY_MS;
  return days * (1 + errorTally(record));
}

// Session scope: all four layouts of the game, or one side + direction.
export type SessionScope = 'all' | { side: Side; direction: Direction };

export interface SchedulerInput {
  // Every item of one game (instrument × quiz direction), in introduction
  // order. The daily new-item cap is counted over this whole pool.
  pool: string[];
  // Practice memory: the per-item answer records.
  memory: Record<string, ItemRecord>;
  scope: SessionScope;
  now: number;
}

export interface Scheduler {
  // A fixed session draw: item keys, shuffled, each at most once.
  draw(input: SchedulerInput): string[];
}

interface Weighted {
  key: string;
  weight: number;
}

function seen(record: ItemRecord | undefined): record is ItemRecord {
  return !!record && record.answers.length > 0;
}

function inScope(key: string, scope: SessionScope): boolean {
  if (scope === 'all') return true;
  const { side, direction } = parseItemKey(key);
  return side === scope.side && direction === scope.direction;
}

function sameLocalDay(a: number, b: number): boolean {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

// Items introduced today are those first seen on the local calendar day of
// `now` — derived from history, so a sweep's introductions count too.
function introducedToday({ pool, memory, now }: SchedulerInput): number {
  return pool.filter((key) => {
    const record = memory[key];
    return seen(record) && sameLocalDay(record.firstSeen, now);
  }).length;
}

export function createWeightedScheduler(random: () => number = Math.random): Scheduler {
  // Weighted sampling without replacement. Once only weightless items remain
  // (everything just answered), the rest are drawn evenly rather than skipped.
  function sample(candidates: Weighted[], count: number): string[] {
    const remaining = [...candidates];
    const picked: string[] = [];
    while (picked.length < count && remaining.length > 0) {
      const total = remaining.reduce((sum, c) => sum + c.weight, 0);
      let index: number;
      if (total > 0) {
        let r = random() * total;
        index = remaining.findIndex((c) => (r -= c.weight) < 0);
        if (index < 0) index = remaining.length - 1;
      } else {
        index = Math.floor(random() * remaining.length);
      }
      picked.push(remaining.splice(index, 1)[0].key);
    }
    return picked;
  }

  return {
    draw(input) {
      const { pool, memory, scope, now } = input;
      // The cap is per game, so it is counted over the whole pool even when
      // the draw is scoped to one layout.
      const budget = Math.max(0, DAILY_NEW_ITEMS - introducedToday(input));
      const scoped = pool.filter((key) => inScope(key, scope));
      const fresh = scoped.filter((key) => !seen(memory[key])).slice(0, budget);
      const review = scoped
        .filter((key) => seen(memory[key]))
        .map((key) => ({ key, weight: itemWeight(memory[key], now) }));
      return shuffled([...fresh, ...sample(review, SESSION_SIZE - fresh.length)], random);
    },
  };
}
