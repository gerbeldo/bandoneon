import { describe, expect, it } from 'vitest';

import type { AnswerEvent, Grade, ItemRecord } from '../../stores/practice';
import type { SchedulerInput } from '../scheduler';
import {
  createWeightedScheduler,
  errorTally,
  fixedRunKeys,
  isRetired,
  itemWeight,
  previewFixedRun,
  scopedPool,
} from '../scheduler';
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

// An item answered with `grades`, oldest first, each on the matching day of
// `daysAgo` — so several answers may share a day. Each is stamped at noon plus
// a minute per answer, so ordering never crosses a day boundary by accident.
function history(grades: Grade[], daysAgo: number[]): ItemRecord {
  const answers = grades.map((grade, i) => answer(grade, NOON - daysAgo[i] * DAY + i * 60_000));
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

describe('isRetired', () => {
  it('retires an item with a clean tally and greens on three distinct days', () => {
    expect(isRetired(history([2, 2, 2], [2, 1, 0]))).toBe(true);
  });

  it('counts consecutive days: no minimum spread is required', () => {
    expect(isRetired(history([2, 2, 2], [2, 1, 0]))).toBe(true);
    expect(isRetired(history([2, 2, 2], [40, 20, 0]))).toBe(true);
  });

  it('needs three distinct days, not three greens', () => {
    expect(isRetired(history([2, 2, 2, 2, 2], [1, 1, 1, 0, 0]))).toBe(false);
  });

  it('is false for an item never answered, or answered on too few days', () => {
    expect(isRetired({ firstSeen: NOON, answers: [] })).toBe(false);
    expect(isRetired(history([2, 2], [1, 0]))).toBe(false);
  });

  it('separates days by the local calendar, not by 24-hour spans', () => {
    // 23:30 and 00:10 are 40 minutes apart but two different days; 00:10 and
    // 23:50 are most of a day apart but the same one.
    const stamps = [
      new Date(2026, 7, 22, 23, 30),
      new Date(2026, 7, 23, 0, 10),
      new Date(2026, 7, 23, 23, 50),
    ].map((date) => answer(2, date.getTime()));

    expect(isRetired({ firstSeen: stamps[0].timestamp, answers: stamps })).toBe(false);
    expect(
      isRetired({
        firstSeen: stamps[0].timestamp,
        answers: [...stamps, answer(2, new Date(2026, 7, 24, 0, 5).getTime())],
      }),
    ).toBe(true);
  });

  it('counts only the greens after the most recent red', () => {
    // Four green days, then a red, then five greens all on one day: the tally
    // is clean again but only one day has passed since the red.
    const lapsed = history([2, 2, 2, 2, 0, 2, 2, 2, 2, 2], [9, 8, 7, 6, 5, 4, 4, 4, 4, 4]);

    expect(errorTally(lapsed)).toBe(0);
    expect(isRetired(lapsed)).toBe(false);
  });

  it('revives a retired item on a red, whatever mode the red came from', () => {
    const retired = history([2, 2, 2], [5, 4, 3]);
    const sweepRed = { ...answer(0, NOON), mode: 'sweep' };

    expect(isRetired(retired)).toBe(true);
    expect(isRetired({ ...retired, answers: [...retired.answers, sweepRed] })).toBe(false);
  });

  it('does not un-retire on plain age: an item untouched for months stays retired', () => {
    expect(isRetired(history([2, 2, 2], [300, 299, 298]))).toBe(true);
  });

  it('lets a yellow suspend retirement without resetting the day count', () => {
    const suspended = history([2, 2, 2, 1], [5, 4, 3, 2]);
    // The yellow has fallen out of the last-5 window; every green since it is
    // from today, so only the pre-yellow days can carry the count to three.
    const recovered = history([2, 2, 2, 1, 2, 2, 2, 2, 2], [5, 4, 3, 2, 0, 0, 0, 0, 0]);

    expect(isRetired(suspended)).toBe(false);
    expect(errorTally(recovered)).toBe(0);
    expect(isRetired(recovered)).toBe(true);
  });

  it('ignores response times: retirement is judged on accuracy alone', () => {
    const slow = history([2, 2, 2], [2, 1, 0]);
    slow.answers.forEach((event) => (event.responseMs = 60_000));

    expect(isRetired(slow)).toBe(true);
  });
});

describe('itemWeight', () => {
  it('is the days since last seen times one plus the error tally', () => {
    expect(itemWeight(record([2, 2], NOON - 2 * DAY), NOON)).toBe(2);
    expect(itemWeight(record([0, 1, 2], NOON - 2 * DAY), NOON)).toBe(5);
  });

  it('trickles a retired item at a tenth of its normal weight', () => {
    const retired = record([2, 2, 2], NOON - 2 * DAY);
    const notYet = record([2, 2], NOON - 2 * DAY);

    expect(isRetired(retired)).toBe(true);
    expect(itemWeight(notYet, NOON)).toBe(2);
    expect(itemWeight(retired, NOON)).toBeCloseTo(0.2, 10);
  });

  it('drops the trickle the moment a red revives the item', () => {
    const retired = record([2, 2, 2], NOON - DAY);
    const revived = { ...retired, answers: [...retired.answers, answer(0, NOON - DAY)] };

    expect(itemWeight(retired, NOON)).toBe(0.1);
    expect(itemWeight(revived, NOON)).toBe(2);
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

  it('draws the session size it is given instead of the default', () => {
    const pool = layoutKeys('right', 'open', 60);
    const memory = seenBeforeToday(pool.slice(3));

    const draw = scheduler().draw({ pool, memory, scope: 'all', now: NOON, sessionSize: 10 });

    expect(draw).toHaveLength(10);
    expect(new Set(draw).size).toBe(10);
  });

  it('draws the whole pool when the session size outruns it', () => {
    const pool = layoutKeys('right', 'open', 8);
    const memory = seenBeforeToday(pool);

    const draw = scheduler().draw({ pool, memory, scope: 'all', now: NOON, sessionSize: 50 });

    expect([...draw].sort()).toEqual([...pool].sort());
  });
});

describe('draw: daily new items', () => {
  const pool = layoutKeys('right', 'open', 30);

  it('introduces as many never-seen items as the cap it is given', () => {
    const memory = seenBeforeToday(pool.slice(5));

    const draw = scheduler().draw({ pool, memory, scope: 'all', now: NOON, dailyNewItems: 5 });

    expect(draw.filter((key) => !(key in memory)).sort()).toEqual(pool.slice(0, 5).sort());
  });

  it('introduces none under a cap of 0, so a first visit draws nothing at all', () => {
    expect(
      scheduler().draw({ pool, memory: {}, scope: 'all', now: NOON, dailyNewItems: 0 }),
    ).toEqual([]);

    const memory = seenBeforeToday(pool.slice(4));
    const draw = scheduler().draw({ pool, memory, scope: 'all', now: NOON, dailyNewItems: 0 });

    expect(draw.every((key) => key in memory)).toBe(true);
  });

  it('never introduces more than the session size, however high the cap', () => {
    const draw = scheduler().draw({
      pool,
      memory: {},
      scope: 'all',
      now: NOON,
      sessionSize: 5,
      dailyNewItems: 10,
    });

    expect(draw).toHaveLength(5);
    expect([...draw].sort()).toEqual(pool.slice(0, 5).sort());
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
      // Two green days, so the clean set is not retired — otherwise the
      // trickle, not the tally, would be doing the work here.
      ...Object.fromEntries(clean.map((key) => [key, record([2, 2], NOON - DAY)])),
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

  it('trickles retired items: drawn far less often than equally stale unretired ones', () => {
    const retired = layoutKeys('right', 'open', 20);
    const active = layoutKeys('right', 'close', 20);
    // Both sets: a clean tally, last answered a day ago. Only the day counts
    // differ — three distinct green days against two.
    const memory = {
      ...Object.fromEntries(retired.map((key) => [key, record([2, 2, 2], NOON - DAY)])),
      ...Object.fromEntries(active.map((key) => [key, record([2, 2], NOON - DAY)])),
    };

    const counts = drawCounts({ pool: [...retired, ...active], memory, scope: 'all' });

    expect(total(counts, active)).toBeGreaterThan(3 * total(counts, retired));
    expect(total(counts, retired)).toBeGreaterThan(0);
  });

  it('lifts the trickle when a yellow suspends retirement', () => {
    const retired = layoutKeys('right', 'open', 20);
    const suspended = layoutKeys('right', 'close', 20);
    const memory = {
      ...Object.fromEntries(retired.map((key) => [key, record([2, 2, 2], NOON - DAY)])),
      ...Object.fromEntries(suspended.map((key) => [key, record([2, 2, 2, 1], NOON - DAY)])),
    };

    const counts = drawCounts({ pool: [...retired, ...suspended], memory, scope: 'all' });

    expect(total(counts, suspended)).toBeGreaterThan(3 * total(counts, retired));
  });

  it('revives retired items on a red recorded during a sweep', () => {
    const retired = layoutKeys('right', 'open', 20);
    const revived = layoutKeys('right', 'close', 20);
    const clean = record([2, 2, 2], NOON - DAY);
    const sweepRed = { ...answer(0, NOON - DAY), mode: 'sweep' };
    const memory = {
      ...Object.fromEntries(retired.map((key) => [key, clean])),
      ...Object.fromEntries(
        revived.map((key) => [key, { ...clean, answers: [...clean.answers, sweepRed] }]),
      ),
    };

    const counts = drawCounts({ pool: [...retired, ...revived], memory, scope: 'all' });

    expect(total(counts, revived)).toBeGreaterThan(3 * total(counts, retired));
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

// The start card's info line: what starting a session right now would mean.
describe('preview', () => {
  const pool = [...layoutKeys('right', 'open', 30), ...layoutKeys('left', 'close', 30)];

  it('counts the whole pool as unseen on a first visit', () => {
    expect(scheduler().preview({ pool, memory: {}, scope: 'all', now: NOON })).toEqual({
      prompts: 3,
      fresh: 3,
      newToday: 0,
      newCap: 3,
      seen: 0,
      total: 60,
    });
  });

  it('counts prompts as the session size once enough items are seen', () => {
    const memory = Object.fromEntries(
      pool.slice(0, 25).map((key) => [key, record([2], NOON - DAY)]),
    );

    expect(scheduler().preview({ pool, memory, scope: 'all', now: NOON })).toEqual({
      prompts: 20,
      fresh: 3,
      newToday: 0,
      newCap: 3,
      seen: 25,
      total: 60,
    });
  });

  it('spends today’s new-item budget over the whole pool, however the session is scoped', () => {
    const memory = {
      [pool[0]]: record([2], NOON - 3_600_000),
      [pool[1]]: record([2], NOON - 3_600_000),
    };

    expect(scheduler().preview({ pool, memory, scope: 'all', now: NOON }).fresh).toBe(1);
    expect(
      scheduler().preview({ pool, memory, scope: { side: 'left', direction: 'close' }, now: NOON })
        .fresh,
    ).toBe(1);
  });

  it('counts items introduced today, over the cap when a fixed run went past it', () => {
    const introduced = (keys: string[]) =>
      Object.fromEntries(keys.map((key) => [key, record([2], NOON - 3_600_000)]));

    expect(
      scheduler().preview({ pool, memory: introduced(pool.slice(0, 2)), scope: 'all', now: NOON }),
    ).toMatchObject({ newToday: 2, fresh: 1 });
    // A fixed run ignores the daily budget, so the count outruns the cap.
    expect(
      scheduler().preview({ pool, memory: introduced(pool.slice(0, 30)), scope: 'all', now: NOON }),
    ).toMatchObject({ newToday: 30, fresh: 0 });
    // Yesterday's introductions are not today's.
    expect(
      scheduler().preview({
        pool,
        memory: Object.fromEntries(pool.slice(0, 5).map((key) => [key, record([2], NOON - DAY)])),
        scope: 'all',
        now: NOON,
      }),
    ).toMatchObject({ newToday: 0, fresh: 3 });
  });

  it('narrows the seen and pool counts to the chosen layout', () => {
    const memory = Object.fromEntries(
      [...pool.slice(0, 4), ...pool.slice(30, 37)].map((key) => [key, record([2], NOON - DAY)]),
    );

    expect(
      scheduler().preview({ pool, memory, scope: { side: 'left', direction: 'close' }, now: NOON }),
    ).toEqual({ prompts: 10, fresh: 3, newToday: 0, newCap: 3, seen: 7, total: 30 });
  });

  it('reports the session size and daily cap the run would use', () => {
    const memory = seenBeforeToday(pool.slice(5));

    expect(
      scheduler().preview({
        pool,
        memory,
        scope: 'all',
        now: NOON,
        sessionSize: 8,
        dailyNewItems: 5,
      }),
    ).toEqual({ prompts: 8, fresh: 5, newToday: 0, newCap: 5, seen: 55, total: 60 });
  });

  it('caps prompts at the session size, whatever the cap allows', () => {
    const preview = scheduler().preview({
      pool,
      memory: {},
      scope: 'all',
      now: NOON,
      sessionSize: 4,
      dailyNewItems: 10,
    });

    expect(preview.prompts).toBeLessThanOrEqual(4);
    expect(preview).toMatchObject({ prompts: 4, fresh: 4, newCap: 10, seen: 0 });
  });
});

// A fixed run: the first N items of the scoped pool, in introduction order,
// under no daily cap — the sweep is the fixed run over a whole layout.
describe('fixed runs', () => {
  const rightOpen = { side: 'right', direction: 'open' } as const;
  const leftClose = { side: 'left', direction: 'close' } as const;
  const pool = [...layoutKeys('right', 'open', 10), ...layoutKeys('left', 'close', 10)];

  describe('scopedPool', () => {
    it('keeps the whole pool in order when the scope is the whole game', () => {
      expect(scopedPool({ pool, scope: 'all' })).toEqual(pool);
    });

    it('keeps only the chosen layout, in introduction order', () => {
      expect(scopedPool({ pool, scope: leftClose })).toEqual(pool.slice(10));
      expect(scopedPool({ pool, scope: rightOpen })).toEqual(pool.slice(0, 10));
    });
  });

  describe('fixedRunKeys', () => {
    const input = { pool, memory: {}, scope: leftClose, now: NOON };

    it('takes the first N of the scoped pool, unshuffled', () => {
      expect(fixedRunKeys({ ...input, count: 4 })).toEqual(pool.slice(10, 14));
    });

    it('takes the whole scoped pool when N outruns it', () => {
      expect(fixedRunKeys({ ...input, count: 99 })).toEqual(pool.slice(10));
    });

    it('takes nothing for N of 0', () => {
      expect(fixedRunKeys({ ...input, count: 0 })).toEqual([]);
    });

    it('ignores the daily cap and the memory: today’s introductions do not shrink it', () => {
      const memory = Object.fromEntries(pool.map((key) => [key, record([2], NOON - 3_600_000)]));

      expect(fixedRunKeys({ ...input, memory, count: 6 })).toEqual(pool.slice(10, 16));
    });
  });

  describe('previewFixedRun', () => {
    // Three items introduced today, two of them inside the run below.
    const memory = {
      [pool[0]]: record([2], NOON - 3_600_000),
      [pool[10]]: record([2], NOON - 3_600_000),
      [pool[11]]: record([2], NOON - 3_600_000),
    };

    it('counts seen and fresh among exactly the run’s own keys, under no cap', () => {
      expect(previewFixedRun({ pool, memory, scope: leftClose, now: NOON, count: 4 })).toEqual({
        prompts: 4,
        fresh: 2,
        newToday: 3,
        newCap: null,
        seen: 2,
        total: 4,
      });
    });

    it('sizes prompts and total to the keys it would run, not to the pool', () => {
      const preview = previewFixedRun({ pool, memory, scope: leftClose, now: NOON, count: 99 });

      expect(preview.prompts).toBe(10);
      expect(preview.total).toBe(10);
      expect(preview).toMatchObject({ fresh: 8, seen: 2 });
    });

    it('counts introductions today over the whole pool, not over the run', () => {
      expect(
        previewFixedRun({ pool, memory, scope: rightOpen, now: NOON, count: 2 }),
      ).toMatchObject({ newToday: 3, seen: 1, fresh: 1, prompts: 2 });
    });
  });
});
