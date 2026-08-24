import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { ANSWER_HISTORY_CAP, usePracticeStore } from '../practice';
import type { AnswerEvent } from '../practice';

const answer = (overrides: Partial<AnswerEvent> = {}): AnswerEvent => ({
  grade: 2,
  timestamp: 1_000,
  responseMs: 1_500,
  mode: 'note-game',
  ...overrides,
});

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('practice store', () => {
  it('starts with no items', () => {
    expect(usePracticeStore().items).toEqual({});
  });

  it('records the first answer for an item, stamping firstSeen from its timestamp', () => {
    const practice = usePracticeStore();

    practice.recordAnswer('key-a', answer({ timestamp: 42 }));

    expect(practice.items['key-a']).toEqual({
      firstSeen: 42,
      answers: [answer({ timestamp: 42 })],
    });
  });

  it('caps an item history at the last 50 answers, keeping firstSeen', () => {
    const practice = usePracticeStore();

    for (let i = 1; i <= 55; i++) {
      practice.recordAnswer('key-a', answer({ timestamp: i }));
    }

    const record = practice.items['key-a'];
    expect(record.answers).toHaveLength(ANSWER_HISTORY_CAP);
    expect(record.answers[0].timestamp).toBe(6);
    expect(record.answers[record.answers.length - 1].timestamp).toBe(55);
    expect(record.firstSeen).toBe(1);
  });
});
