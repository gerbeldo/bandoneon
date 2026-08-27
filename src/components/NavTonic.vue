<template>
  <div class="print:hidden">
    <ButtonGroup class="flex" role="group" aria-label="Tonic">
      <Button
        v-for="value in LETTERS"
        :key="value"
        type="button"
        class="min-w-0 flex-1 truncate px-0"
        :aria-label="value"
        :aria-pressed="value === pick.letter"
        @click.prevent="onLetter(value)"
      >
        {{ formatPitchClass(value, settings.pitchNotation) }}
      </Button>
    </ButtonGroup>
    <ButtonGroup class="mt-2 flex" role="group" aria-label="Accidental">
      <Button
        v-for="value in TONIC_ACCIDENTALS"
        :key="value"
        type="button"
        class="min-w-0 flex-1 px-0"
        :aria-label="ACCIDENTAL_NAMES[value]"
        :aria-pressed="value === pick.accidental"
        @click.prevent="onAccidental(value)"
      >
        <AccidentalGlyph :accidental="value" />
      </Button>
    </ButtonGroup>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { Note } from 'tonal';
import { reactive, watch } from 'vue';

import { notes } from '../data/index';
import { useStore } from '../stores/main';
import { useSettingsStore } from '../stores/settings';
import type { Accidental, Letter } from '../utils/notePick';
import { ACCIDENTAL_NAMES, LETTERS } from '../utils/notePick';
import { FLATS, formatPitchClass, SHARPS, spellPitch } from '../utils/spelling';
import AccidentalGlyph from './AccidentalGlyph.vue';
import Button from './Button.vue';
import ButtonGroup from './ButtonGroup.vue';

// The same letters-plus-accidentals control the note game answers with; no
// doubles here, twelve tonics need none. The stored tonic stays the layout
// data's sharp name, so picking B♭ selects the same chords as A♯.
const TONIC_ACCIDENTALS: readonly Accidental[] = ['b', '', '#'];

const store = useStore();
const { tonic, showEnharmonics } = storeToRefs(store);

const settings = useSettingsStore();

// The spelling as the player wrote it (E♯ keeps showing E♯), kept alongside
// the store's normalized name.
const pick = reactive<{ letter: Letter | null; accidental: Accidental }>({
  letter: null,
  accidental: '',
});

const chromaOf = (letter: string, accidental: string) => Note.get(letter + accidental).chroma;

// A tonic set from elsewhere (scale/chord defaults to C) lands in the picker
// spelled by the ♯/♭ toggle; a cleared tonic clears it.
watch(
  tonic,
  (value) => {
    if (!value) {
      pick.letter = null;
      pick.accidental = '';
      return;
    }
    if (pick.letter && chromaOf(pick.letter, pick.accidental) === Note.get(value).chroma) return;
    const name = spellPitch(value, showEnharmonics.value ? FLATS : SHARPS);
    pick.letter = name[0] as Letter;
    pick.accidental = (name.slice(1) || '') as Accidental;
  },
  { immediate: true },
);

const onLetter = (letter: Letter) => {
  const chroma = chromaOf(letter, pick.accidental);
  if (pick.letter === letter && tonic.value && Note.get(tonic.value).chroma === chroma) {
    store.setTonic(null);
    return;
  }
  pick.letter = letter;
  store.setTonic(notes[chroma ?? 0]);
};

const onAccidental = (accidental: Accidental) => {
  pick.accidental = accidental;
  if (pick.letter) store.setTonic(notes[chromaOf(pick.letter, accidental) ?? 0]);
};
</script>
