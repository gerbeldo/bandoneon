import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { SessionScope } from '../utils/scheduler';
import { ALL_LAYOUTS, DAILY_NEW_ITEMS, SESSION_SIZE } from '../utils/scheduler';
import type { SpellingChoice } from '../utils/spelling';
import { SPELLINGS } from '../utils/spelling';
import type { StorageSpec } from '../utils/storage';

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

export const settingsStorage: StorageSpec = {
  key: 'settings',
  version: 3,
  migrations: {
    // v1: easy mode was removed; drop the orphaned difficulty key.
    1: ({ difficulty: _difficulty, ...rest }) => rest,
    // v2: the app is English-only now; drop the orphaned locale key.
    2: ({ locale: _locale, ...rest }) => rest,
    // v3: the scope names both axes itself; 'one' + layout becomes that layout.
    3: ({ practiceSetup, ...rest }) => {
      if (practiceSetup === undefined) return rest;
      const { scope, layout, ...setup } = asRecord(practiceSetup);
      return {
        ...rest,
        practiceSetup: { ...setup, scope: scope === 'one' ? layout : { ...ALL_LAYOUTS } },
      };
    },
  },
};

export type PracticeGame = 'note' | 'staff';
export type PracticePool = 'scheduled' | 'fixed';

// Everything the practice setup screen chooses; persisted so a run can be
// repeated tomorrow without setting anything again.
export interface PracticeSetup {
  game: PracticeGame;
  // The layouts a run draws from: a side or both, a direction or both.
  scope: SessionScope;
  // Scheduled: the scheduler draws under the daily cap. Fixed: the first
  // `fixedCount` items of the introduction order, each asked once, no cap.
  pool: PracticePool;
  fixedCount: number;
  sessionSize: number;
  dailyNewItems: number;
  spelling: SpellingChoice;
}

// The choices the setup screen offers for the two scheduler numbers.
export const SESSION_SIZES = [10, 20, 30, 50];
export const DAILY_NEW_CHOICES = [0, 3, 5, 10];

export function defaultPracticeSetup(): PracticeSetup {
  return {
    game: 'note',
    scope: { ...ALL_LAYOUTS },
    pool: 'scheduled',
    fixedCount: 20,
    sessionSize: SESSION_SIZE,
    dailyNewItems: DAILY_NEW_ITEMS,
    spelling: 'sharp',
  };
}

const oneOf = <T>(candidate: unknown, allowed: readonly T[], otherwise: T): T =>
  allowed.includes(candidate as T) ? (candidate as T) : otherwise;

// A stored setup falls back field by field, so one value the app no longer
// offers never resets the rest of it.
export function sanitizePracticeSetup(value: unknown): PracticeSetup {
  const fallback = defaultPracticeSetup();
  const stored = asRecord(value);
  const scope = asRecord(stored.scope);
  const count = stored.fixedCount;
  return {
    game: oneOf(stored.game, ['note', 'staff'], fallback.game),
    scope: {
      side: oneOf(scope.side, ['both', 'right', 'left'], fallback.scope.side),
      direction: oneOf(scope.direction, ['both', 'open', 'close'], fallback.scope.direction),
    },
    pool: oneOf(stored.pool, ['scheduled', 'fixed'], fallback.pool),
    fixedCount:
      typeof count === 'number' && Number.isInteger(count) && count >= 1
        ? count
        : fallback.fixedCount,
    sessionSize: oneOf(stored.sessionSize, SESSION_SIZES, fallback.sessionSize),
    dailyNewItems: oneOf(stored.dailyNewItems, DAILY_NEW_CHOICES, fallback.dailyNewItems),
    spelling: oneOf(stored.spelling, SPELLINGS, fallback.spelling),
  };
}

export const useSettingsStore = defineStore('settings', () => {
  const instrument = ref('rheinische142');
  const pitchNotation = ref<'scientific' | 'helmholtz' | 'solfege' | 'staff'>('scientific');
  const userChords = ref<Record<string, Record<string, string[]>>>({});
  const practiceSetup = ref<PracticeSetup>(defaultPracticeSetup());

  function saveUserChord(side: string, chordName: string, notes: string[]) {
    if (!userChords.value[side]) userChords.value[side] = {};
    userChords.value[side][chordName] = [...notes];
  }

  function resetUserChord(side: string, chordName: string) {
    if (userChords.value[side]) delete userChords.value[side][chordName];
  }

  return {
    instrument,
    pitchNotation,
    userChords,
    practiceSetup,
    saveUserChord,
    resetUserChord,
  };
});
