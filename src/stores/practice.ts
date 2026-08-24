import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { StorageSpec } from '../utils/storage';

export const practiceStorage: StorageSpec = {
  key: 'practice',
  version: 1,
  migrations: {},
};

// Last-N answers kept per item; firstSeen lives outside the cap so
// "introduced today" stays derivable after pruning.
export const ANSWER_HISTORY_CAP = 50;

export type Grade = 0 | 1 | 2;

export interface AnswerEvent {
  grade: Grade;
  timestamp: number;
  responseMs: number;
  mode: string;
}

export interface ItemRecord {
  firstSeen: number;
  answers: AnswerEvent[];
}

export const usePracticeStore = defineStore('practice', () => {
  const items = ref<Record<string, ItemRecord>>({});

  function recordAnswer(itemKey: string, answer: AnswerEvent) {
    const record = items.value[itemKey];
    if (!record) {
      items.value[itemKey] = { firstSeen: answer.timestamp, answers: [answer] };
      return;
    }
    record.answers.push(answer);
    if (record.answers.length > ANSWER_HISTORY_CAP) {
      record.answers.splice(0, record.answers.length - ANSWER_HISTORY_CAP);
    }
  }

  return { items, recordAnswer };
});
