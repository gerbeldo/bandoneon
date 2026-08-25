// Scheduler: picks which items a session draws. Games and the engine see only
// `Scheduler`, so the sampling behind it can be replaced by a spaced-repetition
// model without touching them. Fixed runs — the first N items of the
// introduction order, no cap — share the pool and preview vocabulary, as does
// the walk (walk.ts).

import type { Instrument } from '../data/index';
import type { Grade, ItemRecord } from '../stores/practice';
import type { ScaleChoice } from './scale';
import { chromaOf, isKeyed, scaleChromas } from './scale';
import type { Direction, Side } from './session';
import { parseItemKey, pitchOfKey, shuffled } from './session';

// Defaults for the two run parameters the player can change: prompts per
// session and never-seen items per local calendar day per game.
export const SESSION_SIZE = 20;
export const DAILY_NEW_ITEMS = 3;
// Fixed constants, not settings: answers in the error tally and the two
// retirement numbers.
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

// Session scope: the layouts a run draws from, as one value per axis — a side
// or both, a direction or both. Both/both is all four layouts; a Layout is one.
export interface SessionScope {
  side: Side | 'both';
  direction: Direction | 'both';
}

export const ALL_LAYOUTS: Readonly<SessionScope> = { side: 'both', direction: 'both' };

// How many of the four layouts a scope covers.
export function scopeLayoutCount(scope: SessionScope): number {
  return (scope.side === 'both' ? 2 : 1) * (scope.direction === 'both' ? 2 : 1);
}

export interface PoolInput {
  // Every item of one game (instrument × quiz direction), in introduction
  // order. The daily new-item cap is counted over this whole pool.
  pool: string[];
  // Practice memory: the per-item answer records.
  memory: Record<string, ItemRecord>;
  scope: SessionScope;
  // Which notes the run draws from; every note when unset. A keyed scale
  // reads each item's pitch off `layouts`.
  scale?: ScaleChoice;
  layouts?: Instrument;
  now: number;
}

export interface SchedulerInput extends PoolInput {
  // Prompts per session and never-seen items allowed per day; the defaults
  // above when omitted.
  sessionSize?: number;
  dailyNewItems?: number;
}

// What the setup screen's summary and the session strip report: the numbers a
// run started right now would run under.
export interface SessionPreview {
  // How many prompts the draw would hold, before any spelling doubling or
  // twin follow-up — the session size, or less while the pool is small.
  prompts: number;
  // Never-seen items the run would introduce.
  fresh: number;
  // Items first seen today, over the whole pool — what the strip counts.
  newToday: number;
  // The cap newToday is counted against; null when the run has none.
  newCap: number | null;
  // Items already answered at least once, and the pool size, both within what
  // the run draws from.
  seen: number;
  total: number;
}

export interface Scheduler {
  // A fixed session draw: item keys, shuffled, each at most once.
  draw(input: SchedulerInput): string[];
  // What that draw would come to, without making it.
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
  const { side, direction } = parseItemKey(key);
  return (
    (scope.side === 'both' || side === scope.side) &&
    (scope.direction === 'both' || direction === scope.direction)
  );
}

// The pool narrowed to the scope's layouts and, under a keyed scale, to the
// items sounding one of its notes.
export function scopedPool({
  pool,
  scope,
  scale,
  layouts,
}: Pick<PoolInput, 'pool' | 'scope' | 'scale' | 'layouts'>): string[] {
  const inLayouts = pool.filter((key) => inScope(key, scope));
  if (!scale || !isKeyed(scale)) return inLayouts;
  if (!layouts) throw new Error('a keyed scale needs the layouts to read pitches');
  const chromas = scaleChromas(scale);
  return inLayouts.filter((key) => chromas.has(chromaOf(pitchOfKey(layouts, key))));
}

// Items introduced today are those first seen on the local calendar day of
// `now` — derived from history, so a fixed run's introductions count too.
function introducedToday({ pool, memory, now }: PoolInput): number {
  const today = localDay(now);
  return pool.filter((key) => {
    const record = memory[key];
    return seen(record) && localDay(record.firstSeen) === today;
  }).length;
}

// The scoped pool split into what a draw takes from each half, plus the day's
// remaining new-item budget. The cap is per game, so it is counted over the
// whole pool even when the draw is scoped to fewer layouts.
function candidates(input: SchedulerInput) {
  const cap = input.dailyNewItems ?? DAILY_NEW_ITEMS;
  const newToday = introducedToday(input);
  const scoped = scopedPool(input);
  return {
    newToday,
    cap,
    budget: Math.max(0, cap - newToday),
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
      const size = input.sessionSize ?? SESSION_SIZE;
      const { budget, fresh, review } = candidates(input);
      const introduced = fresh.slice(0, Math.min(budget, size));
      const weighted = review.map((key) => ({
        key,
        weight: itemWeight(input.memory[key], input.now),
      }));
      return shuffled([...introduced, ...sample(weighted, size - introduced.length)], random);
    },

    preview(input) {
      const size = input.sessionSize ?? SESSION_SIZE;
      const { newToday, cap, budget, fresh, review } = candidates(input);
      const introduced = Math.min(budget, fresh.length, size);
      return {
        prompts: Math.min(size, introduced + review.length),
        fresh: introduced,
        newToday,
        newCap: cap,
        seen: review.length,
        total: fresh.length + review.length,
      };
    },
  };
}

// A fixed run: the first `count` items of the scoped pool, in introduction
// order, every one asked once, no daily cap. The sweep is the fixed run over a
// whole layout.
export interface FixedRunInput extends PoolInput {
  count: number;
}

export function fixedRunKeys(input: FixedRunInput): string[] {
  return scopedPool(input).slice(0, Math.max(0, input.count));
}

export function previewFixedRun(input: FixedRunInput): SessionPreview {
  return previewRun(fixedRunKeys(input), input);
}

// What a run over `keys` comes to, under no cap. Prompts is the list's length;
// coverage counts `items` — the distinct keys, unless the run covers more than
// it lists (a walk asks each item twice, and reaches a twin through the follow-up).
export function previewRun(
  keys: string[],
  input: PoolInput,
  items: string[] = [...new Set(keys)],
): SessionPreview {
  const seenCount = items.filter((key) => seen(input.memory[key])).length;
  return {
    prompts: keys.length,
    fresh: items.length - seenCount,
    newToday: introducedToday(input),
    newCap: null,
    seen: seenCount,
    total: items.length,
  };
}
