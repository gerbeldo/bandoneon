import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { StorageSpec } from '../utils/storage';

export const practiceStorage: StorageSpec = {
  key: 'practice',
  version: 1,
  migrations: {},
};

// Item keys are grid positions (ADR 0002), so a layout-grid edit re-keys
// stored stats. This pins the grids: the grid-fingerprint test fails on any
// edit until a key-remap migration lands above and this hash is updated. It
// hashes the whole registry, so adding or removing an instrument moves it
// without re-keying anything — that case needs no migration.
export const GRID_FINGERPRINT = '2a34883bc01dbf6f199601af93e6495d6cbbe4bb89b241d109b3993b43019a97';

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
