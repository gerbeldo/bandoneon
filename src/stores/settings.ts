import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { StorageSpec } from '../utils/storage';

export const settingsStorage: StorageSpec = {
  key: 'settings',
  version: 2,
  migrations: {
    // v1: easy mode was removed; drop the orphaned difficulty key.
    1: ({ difficulty: _difficulty, ...rest }) => rest,
    // v2: the app is English-only now; drop the orphaned locale key.
    2: ({ locale: _locale, ...rest }) => rest,
  },
};

export const useSettingsStore = defineStore('settings', () => {
  const instrument = ref('rheinische142');
  const pitchNotation = ref<'scientific' | 'helmholtz' | 'solfege' | 'staff'>('scientific');
  const userChords = ref<Record<string, Record<string, string[]>>>({});

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
    saveUserChord,
    resetUserChord,
  };
});
