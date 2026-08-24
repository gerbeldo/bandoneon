import { describe, expect, it } from 'vitest';

import type { AnswerEvent, Grade, ItemRecord } from '../../stores/practice';
import type { SchedulerInput } from '../scheduler';
import { createWeightedScheduler, errorTally, itemWeight } from '../scheduler';
import type { Direction, Side } from '../session';
import { itemKey } from '../session';

const DAY = 86_400_000;
// A fixed local calendar day, well away from midnight.
const NOON = new Date(2026, 7, 24, 12).getTime();

function answer(grade: Grade, timestamp: number): AnswerEvent {
  return { grade, timestamp, responseMs: 1_000, mode: 'note-game' };
}

// An item answered once per day, ending at `lastSeen`, with the given grades.
function record(grades: Grade[], lastSeen: number): ItemRecord {
  const answers = grades.map((grade, i) => answer(grade, lastSeen - (grades.length - 1 - i) * DAY));
  return { firstSeen: answers[0].timestamp, answers };
}

// `count` items of one layout, one per row; a pool's list order is its
// introduction order.
function layoutKeys(side: Side, direction: Direction, count: number): string[] {
  return [...Array(count).keys()].map((row) => itemKey('toy', side, direction, row, 0, 'forward'));
}

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

function scheduler(seed = 1) {
  return createWeightedScheduler(seeded(seed));
}

describe('errorTally', () => {
  it('counts green 0, yellow 0.5, red 1 over the last 5 answers', () => {
    expect(errorTally(record([2, 2, 2, 2, 2], NOON))).toBe(0);
    expect(errorTally(record([2, 1, 2, 0, 2], NOON))).toBe(1.5);
    expect(errorTally(record([0, 0, 0, 0, 0], NOON))).toBe(5);
  });

  it('ignores answers older than the last 5', () => {
    expect(errorTally(record([0, 0, 0, 2, 2, 2, 2, 2], NOON))).toBe(0);
  });

  it('tallies a short history as it is', () => {
    expect(errorTally(record([0, 1], NOON))).toBe(1.5);
  });
});

describe('itemWeight', () => {
  it('is the days since last seen times one plus the error tally', () => {
    expect(itemWeight(record([2, 2, 2], NOON - 2 * DAY), NOON)).toBe(2);
    expect(itemWeight(record([0, 1, 2], NOON - 2 * DAY), NOON)).toBe(5);
  });

  it('counts days fractionally, so an item seen minutes ago weighs little but not nothing', () => {
    expect(itemWeight(record([2], NOON - 12 * 3_600_000), NOON)).toBe(0.5);
    expect(itemWeight(record([2], NOON - 60_000), NOON)).toBeCloseTo(1 / 1440, 6);
  });

  it('treats an answer stamped after now as seen just now', () => {
    expect(itemWeight(record([0], NOON + DAY), NOON)).toBe(0);
  });
});

describe('draw: new items', () => {
  it('introduces at most 3 never-seen items, the first in introduction order', () => {
    const pool = layoutKeys('right', 'open', 10);

    const draw = scheduler().draw({ pool, memory: {}, scope: 'all', now: NOON });

    expect(draw).toHaveLength(3);
    expect([...draw].sort()).toEqual(pool.slice(0, 3).sort());
  });

  it('spends the cap on items already introduced today; an unused cap never rolls over', () => {
    const pool = layoutKeys('right', 'open', 10);
    const memory = {
      [pool[0]]: record([2], NOON - DAY),
      [pool[1]]: record([2], NOON - 3_600_000),
      [pool[2]]: record([0], NOON - 60_000),
    };

    const draw = scheduler().draw({ pool, memory, scope: 'all', now: NOON });

    expect(draw.filter((key) => !(key in memory))).toEqual([pool[3]]);
  });

  it('counts introductions by local calendar day, not by the last 24 hours', () => {
    const pool = layoutKeys('right', 'open', 10);
    const now = new Date(2026, 7, 24, 0, 30).getTime();
    const memory = {
      [pool[0]]: record([2], new Date(2026, 7, 23, 23, 30).getTime()),
      [pool[1]]: record([2], new Date(2026, 7, 24, 0, 10).getTime()),
    };

    const draw = scheduler().draw({ pool, memory, scope: 'all', now });

    expect(draw.filter((key) => !(key in memory)).sort()).toEqual([pool[2], pool[3]]);
  });
});

// Every item seen once, one per day, oldest first — none of them today.
function seenBeforeToday(keys: string[]): Record<string, ItemRecord> {
  return Object.fromEntries(keys.map((key, i) => [key, record([2], NOON - (i + 1) * DAY)]));
}

describe('draw: session size', () => {
  it('draws 20 prompts, each item at most once: the new items plus seen items for the rest', () => {
    const pool = layoutKeys('right', 'open', 60);
    const memory = seenBeforeToday(pool.slice(3));

    const draw = scheduler().draw({ pool, memory, scope: 'all', now: NOON });

    expect(draw).toHaveLength(20);
    expect(new Set(draw).size).toBe(20);
    expect(draw.filter((key) => !(key in memory)).sort()).toEqual(pool.slice(0, 3).sort());
  });

  it('draws a shorter session from a small pool instead of repeating items', () => {
    const pool = layoutKeys('right', 'open', 8);
    const memory = seenBeforeToday(pool);

    const draw = scheduler().draw({ pool, memory, scope: 'all', now: NOON });

    expect([...draw].sort()).toEqual([...pool].sort());
  });
});

describe('draw: scope', () => {
  const pool = [...layoutKeys('right', 'open', 10), ...layoutKeys('left', 'close', 10)];
  const leftClose = { side: 'left', direction: 'close' } as const;

  it('scoped to one layout, draws only its items and introduces its first never-seen ones', () => {
    const memory = seenBeforeToday([...pool.slice(0, 3), ...pool.slice(10, 13)]);

    const draw = scheduler().draw({ pool, memory, scope: leftClose, now: NOON });

    expect(draw).toHaveLength(6);
    expect(draw.every((key) => key.startsWith('toy/left/close/'))).toBe(true);
    expect(draw.filter((key) => !(key in memory)).sort()).toEqual(pool.slice(13, 16).sort());
  });

  it('shares the daily cap across layouts: introductions elsewhere today leave none here', () => {
    const memory = Object.fromEntries(
      pool.slice(0, 3).map((key) => [key, record([2], NOON - 60_000)]),
    );

    const draw = scheduler().draw({ pool, memory, scope: leftClose, now: NOON });

    expect(draw).toEqual([]);
  });
});

// How often each key was drawn over `runs` seeded draws.
function drawCounts(input: Omit<SchedulerInput, 'now'>, runs = 50): Map<string, number> {
  const counts = new Map<string, number>();
  for (let seed = 1; seed <= runs; seed++) {
    for (const key of scheduler(seed).draw({ ...input, now: NOON })) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function total(counts: Map<string, number>, keys: string[]): number {
  return keys.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
}

describe('draw: weighting', () => {
  it('favors items with recent errors over clean ones seen equally long ago', () => {
    const clean = layoutKeys('right', 'open', 20);
    const red = layoutKeys('right', 'close', 20);
    const memory = {
      ...Object.fromEntries(clean.map((key) => [key, record([2, 2, 2, 2, 2], NOON - DAY)])),
      ...Object.fromEntries(red.map((key) => [key, record([0, 0, 0, 0, 0], NOON - DAY)])),
    };

    const counts = drawCounts({ pool: [...clean, ...red], memory, scope: 'all' });

    expect(total(counts, red)).toBeGreaterThan(2 * total(counts, clean));
    expect(total(counts, clean)).toBeGreaterThan(0);
  });

  it('makes a second same-day session mostly review what the first one did not touch', () => {
    const yesterday = layoutKeys('right', 'open', 20);
    const justNow = layoutKeys('right', 'close', 20);
    const memory = {
      ...Object.fromEntries(yesterday.map((key) => [key, record([2], NOON - DAY)])),
      ...Object.fromEntries(justNow.map((key) => [key, record([2], NOON - 60_000)])),
    };

    const counts = drawCounts({ pool: [...yesterday, ...justNow], memory, scope: 'all' });

    expect(total(counts, justNow)).toBeLessThan(10);
    expect(total(counts, yesterday)).toBeGreaterThan(990);
  });

  it('still draws items answered this very instant once nothing else is left', () => {
    const pool = layoutKeys('right', 'open', 25);
    const memory = Object.fromEntries(
      pool.map((key) => [key, { firstSeen: NOON - DAY, answers: [answer(2, NOON)] }]),
    );

    const draw = scheduler().draw({ pool, memory, scope: 'all', now: NOON });

    expect(draw).toHaveLength(20);
    expect(new Set(draw).size).toBe(20);
  });
});

describe('draw: order and determinism', () => {
  const pool = layoutKeys('right', 'open', 30);
  const memory = seenBeforeToday(pool.slice(3));

  it('shuffles the draw: new items are not pinned to the front', () => {
    const firsts = [...Array(20).keys()].map(
      (seed) => scheduler(seed + 1).draw({ pool, memory, scope: 'all', now: NOON })[0],
    );

    expect(firsts.some((key) => key in memory)).toBe(true);
  });

  it('is repeatable for one random source and differs between sources', () => {
    const small = pool.slice(0, 12);
    const input = { pool: small, memory: seenBeforeToday(small), scope: 'all' as const, now: NOON };

    const first = scheduler(7).draw(input);
    const again = scheduler(7).draw(input);
    const other = scheduler(8).draw(input);

    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
    expect([...other].sort()).toEqual([...first].sort());
  });
});
