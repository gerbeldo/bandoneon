// Scheduler: picks which items a session draws. Games and the engine see only
// `Scheduler`, so the sampling behind it can be replaced by a spaced-repetition
// model without touching them.

import type { Grade, ItemRecord } from '../stores/practice';
import type { Layout } from './session';
import { parseItemKey, shuffled } from './session';

// Fixed constants, not settings: prompts per session, never-seen items per
// local calendar day per game, answers in the error tally, and the two
// retirement numbers.
export const SESSION_SIZE = 20;
export const DAILY_NEW_ITEMS = 3;
const TALLY_WINDOW = 5;
const TALLY_WEIGHT: Record<Grade, number> = { 2: 0, 1: 0.5, 0: 1 };
const RETIREMENT_DAYS = 3;
const TRICKLE_FACTOR = 0.1;
const DAY_MS = 86_400_000;

// A timestamp's local calendar day, as a key two timestamps share only if they
// fall on the same one.
function localDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Error tally: the item's recent-error score over its last 5 answers.
export function errorTally(record: ItemRecord): number {
  return record.answers
    .slice(-TALLY_WINDOW)
    .reduce((sum, answer) => sum + TALLY_WEIGHT[answer.grade], 0);
}

// Retired: a clean error tally plus green answers on 3+ distinct local
// calendar days since the item's most recent red. Read from the kept history
// (last 50 answers) and never stored, so a change to this rule applies
// retroactively — a red pruned by that cap stops counting.
export function isRetired(record: ItemRecord): boolean {
  if (errorTally(record) !== 0) return false;
  const lastRed = record.answers.map((answer) => answer.grade).lastIndexOf(0);
  const greenDays = new Set(
    record.answers
      .slice(lastRed + 1)
      .filter((answer) => answer.grade === 2)
      .map((answer) => localDay(answer.timestamp)),
  );
  return greenDays.size >= RETIREMENT_DAYS;
}

// Sampling weight of a seen item: fractional days since its last answer times
// (1 + error tally), and a tenth of that once the item is retired. Fractional
// days keep a second same-day session sensible — just-answered items weigh
// little instead of being excluded. The trickle keeps retired items in the
// pool rather than out of it, so quiet decay still surfaces eventually.
export function itemWeight(record: ItemRecord, now: number): number {
  const lastSeen = record.answers[record.answers.length - 1]?.timestamp ?? now;
  const days = Math.max(0, now - lastSeen) / DAY_MS;
  const weight = days * (1 + errorTally(record));
  return isRetired(record) ? weight * TRICKLE_FACTOR : weight;
}

// Session scope: all four layouts of the game, or one of them.
export type SessionScope = 'all' | Layout;

export interface SchedulerInput {
  // Every item of one game (instrument × quiz direction), in introduction
  // order. The daily new-item cap is counted over this whole pool.
  pool: string[];
  // Practice memory: the per-item answer records.
  memory: Record<string, ItemRecord>;
  scope: SessionScope;
  now: number;
}

// What the start card's info line reports: the numbers a session started right
// now would run under, adapted to the chosen scope.
export interface SessionPreview {
  // How many prompts the draw would hold — the session size, or less while the
  // pool is still small.
  prompts: number;
  // Never-seen items still allowed today; the cap is per game, so this ignores
  // the scope.
  newLeft: number;
  // Items already answered at least once, and the pool size, both in scope.
  seen: number;
  total: number;
}

export interface Scheduler {
  // A fixed session draw: item keys, shuffled, each at most once.
  draw(input: SchedulerInput): string[];
  // What that draw would come to, without making it — the card's info line.
  preview(input: SchedulerInput): SessionPreview;
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

// Items introduced today are those first seen on the local calendar day of
// `now` — derived from history, so a sweep's introductions count too.
function introducedToday({ pool, memory, now }: SchedulerInput): number {
  const today = localDay(now);
  return pool.filter((key) => {
    const record = memory[key];
    return seen(record) && localDay(record.firstSeen) === today;
  }).length;
}

// The scoped pool split into what a draw takes from each half, plus the day's
// remaining new-item budget. The cap is per game, so it is counted over the
// whole pool even when the draw is scoped to one layout.
function candidates(input: SchedulerInput) {
  const budget = Math.max(0, DAILY_NEW_ITEMS - introducedToday(input));
  const scoped = input.pool.filter((key) => inScope(key, input.scope));
  return {
    budget,
    fresh: scoped.filter((key) => !seen(input.memory[key])),
    review: scoped.filter((key) => seen(input.memory[key])),
  };
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
      const { budget, fresh, review } = candidates(input);
      const introduced = fresh.slice(0, budget);
      const weighted = review.map((key) => ({
        key,
        weight: itemWeight(input.memory[key], input.now),
      }));
      return shuffled(
        [...introduced, ...sample(weighted, SESSION_SIZE - introduced.length)],
        random,
      );
    },

    preview(input) {
      const { budget, fresh, review } = candidates(input);
      return {
        prompts: Math.min(SESSION_SIZE, Math.min(budget, fresh.length) + review.length),
        newLeft: budget,
        seen: review.length,
        total: fresh.length + review.length,
      };
    },
  };
}
