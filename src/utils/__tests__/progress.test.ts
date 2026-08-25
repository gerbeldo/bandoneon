import { describe, expect, it } from 'vitest';

import type { Grade, ItemRecord } from '../../stores/practice';
import { itemStatus, statusCounts } from '../progress';

const DAY = 86_400_000;
const NOON = new Date(2026, 7, 24, 12).getTime();

// One answer per day ending yesterday — or, with `sameDay`, all a minute apart
// on one day — with the given grades.
function record(grades: Grade[], sameDay = false): ItemRecord {
  const answers = grades.map((grade, i) => ({
    grade,
    timestamp: sameDay ? NOON - DAY + i * 60_000 : NOON - (grades.length - i) * DAY,
    responseMs: 1_000,
    mode: 'note-game',
  }));
  return { firstSeen: answers[0].timestamp, answers };
}

describe('itemStatus', () => {
  it('is unseen without a record or without answers', () => {
    expect(itemStatus(undefined)).toBe('unseen');
    expect(itemStatus({ firstSeen: NOON, answers: [] })).toBe('unseen');
  });

  it('is learning with a clean tally on fewer than three days', () => {
    expect(itemStatus(record([2]))).toBe('learning');
    expect(itemStatus(record([2, 2]))).toBe('learning');
  });

  it('is retired with a clean tally on three or more days', () => {
    expect(itemStatus(record([2, 2, 2]))).toBe('retired');
  });

  it('reports recent errors while the last five answers hold a red or a yellow', () => {
    expect(itemStatus(record([2, 2, 1]))).toBe('errors');
    expect(itemStatus(record([2, 2, 2, 2, 0]))).toBe('errors');
    // The red has left the window; the greens sit on one day, so not retired yet.
    expect(itemStatus(record([0, 2, 2, 2, 2, 2], true))).toBe('learning');
  });
});

describe('statusCounts', () => {
  it('counts each key under its status', () => {
    const memory = {
      a: record([2, 2, 2]),
      b: record([2]),
      c: record([0]),
    };

    expect(statusCounts(['a', 'b', 'c', 'd', 'e'], memory)).toEqual({
      retired: 1,
      learning: 1,
      errors: 1,
      unseen: 2,
    });
  });
});
