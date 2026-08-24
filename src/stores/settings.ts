import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { StorageSpec } from '../utils/storage';

export const settingsStorage: StorageSpec = {
  key: 'settings',
  version: 1,
  migrations: {
    // v1: easy mode was removed; drop the orphaned difficulty key.
    1: ({ difficulty: _difficulty, ...rest }) => rest,
  },
};

export const useSettingsStore = defineStore('settings', () => {
  const instrument = ref('rheinische142');
  const locale = ref(navigator.language?.split('-')[0] || 'en');
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
    locale,
    pitchNotation,
    userChords,
    saveUserChord,
    resetUserChord,
  };
});
