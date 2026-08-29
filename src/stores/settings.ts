import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { ScaleChoice } from '../utils/scale';
import { CHROMA_COUNT, CHROMATIC, SCALE_KINDS } from '../utils/scale';
import type { SessionScope } from '../utils/scheduler';
import { ALL_LAYOUTS, DAILY_NEW_ITEMS, SESSION_SIZE } from '../utils/scheduler';
import type { SpellingChoice } from '../utils/spelling';
import { SPELLINGS } from '../utils/spelling';
import type { StorageSpec } from '../utils/storage';

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

export const settingsStorage: StorageSpec = {
  key: 'settings',
  version: 4,
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
    // v4: saved voicings were removed; drop the orphaned userChords key.
    4: ({ userChords: _userChords, ...rest }) => rest,
  },
};

// How the note game captures the answer. A device preference, chosen from the
// settings panel — never a run parameter on the practice setup (ADR 0007).
export type NoteInput = 'letters' | 'piano' | 'wheel' | 'staff';
export const NOTE_INPUTS: NoteInput[] = ['letters', 'piano', 'wheel', 'staff'];

export type PracticeGame = 'note' | 'staff';
// Scheduled: the scheduler draws under the daily cap. Fixed: the first N items
// of the introduction order, shuffled. Walk: every item in pitch order, up and
// back down, one layout at a time. Neither of the last two has a cap.
export type PracticePool = 'scheduled' | 'fixed' | 'walk';
export const PRACTICE_POOLS: PracticePool[] = ['scheduled', 'fixed', 'walk'];

// Everything the practice setup screen chooses; persisted so a run can be
// repeated tomorrow without setting anything again.
export interface PracticeSetup {
  game: PracticeGame;
  // The layouts a run draws from: a side or both, a direction or both.
  scope: SessionScope;
  // The notes a run draws from: every note, or one key's major or minor scale.
  scale: ScaleChoice;
  pool: PracticePool;
  // The N of a fixed run.
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
    scale: { ...CHROMATIC },
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
  const scale = asRecord(stored.scale);
  const tonic = scale.tonic;
  const count = stored.fixedCount;
  return {
    game: oneOf(stored.game, ['note', 'staff'], fallback.game),
    scope: {
      side: oneOf(scope.side, ['both', 'right', 'left'], fallback.scope.side),
      direction: oneOf(scope.direction, ['both', 'open', 'close'], fallback.scope.direction),
    },
    scale: {
      kind: oneOf(scale.kind, SCALE_KINDS, fallback.scale.kind),
      tonic:
        typeof tonic === 'number' && Number.isInteger(tonic) && tonic >= 0 && tonic < CHROMA_COUNT
          ? tonic
          : fallback.scale.tonic,
    },
    pool: oneOf(stored.pool, PRACTICE_POOLS, fallback.pool),
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
  const noteInput = ref<NoteInput>('letters');
  const practiceSetup = ref<PracticeSetup>(defaultPracticeSetup());

  return { instrument, pitchNotation, noteInput, practiceSetup };
});
