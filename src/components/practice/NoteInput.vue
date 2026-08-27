<template>
  <div class="flex min-h-0 flex-col">
    <NoteInputLetters
      v-if="noteInput === 'letters'"
      :pick="notePick.pick"
      :notation="pitchNotation"
      @letter="onLetter"
      @accidental="onAccidental"
    />
    <NoteInputPiano
      v-else-if="noteInput === 'piano'"
      :pick="notePick.pick"
      :spelling="spelling"
      :notation="pitchNotation"
      @key="onKey"
    />
    <NoteInputWheel
      v-else-if="noteInput === 'wheel'"
      class="min-h-0 flex-1"
      :pick="notePick.pick"
      :notation="pitchNotation"
      @letter="onLetter"
      @accidental="onAccidental"
    />
    <NoteInputStaff
      v-else
      class="min-h-0 flex-1"
      :accidental="notePick.pick.accidental"
      :side="side"
      :notation="pitchNotation"
      @accidental="onAccidental"
      @place="onPlace"
    />
    <!-- The octave tap completes the pick and submits; the staff needs none,
         its vertical position already names the octave. -->
    <div v-if="noteInput !== 'staff'" class="mt-1 flex flex-wrap justify-center">
      <Button
        v-for="octave in octaves"
        :key="octave"
        class="m-1 w-12"
        :aria-label="`Octave ${octave}`"
        :disabled="!notePick.pick.letter"
        @click.prevent="onOctave(octave)"
      >
        {{ formatOctave(pickClass, octave, pitchNotation) }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import type { UseNotePick } from '../../composables/useNotePick';
import { useStore } from '../../stores/main';
import { useSettingsStore } from '../../stores/settings';
import type { Accidental, Letter } from '../../utils/notePick';
import { formatOctave } from '../../utils/notePick';
import type { Prompt } from '../../utils/session';
import { SHARPS } from '../../utils/spelling';
import Button from '../Button.vue';
import NoteInputLetters from './NoteInputLetters.vue';
import NoteInputPiano from './NoteInputPiano.vue';
import NoteInputStaff from './NoteInputStaff.vue';
import NoteInputWheel from './NoteInputWheel.vue';

// Shows the input the settings panel chose; every tap funnels into the shared
// pick, and the finished pitch goes up as one answer event.
const props = defineProps<{ notePick: UseNotePick; prompt: Prompt | null }>();

const emit = defineEmits<{ answer: [pitch: string] }>();

const store = useStore();
const settings = useSettingsStore();
const { noteInput, pitchNotation } = storeToRefs(settings);

const side = computed(() => store.side);
const octaves = computed(() => props.notePick.octaves.value);
// The piano names its keys by the prompt's spelling, so a flat run shows D♭.
const spelling = computed(() => props.prompt?.spelling ?? SHARPS);
const pickClass = computed(() => {
  const { letter, accidental } = props.notePick.pick;
  return letter ? letter + accidental : '';
});

function submitIfAny(pitch: string | null) {
  if (pitch) emit('answer', pitch);
}

const onLetter = (letter: Letter) => submitIfAny(props.notePick.choose({ letter }));
const onAccidental = (accidental: Accidental) => submitIfAny(props.notePick.choose({ accidental }));
const onKey = (key: { letter: Letter; accidental: Accidental }) =>
  submitIfAny(props.notePick.choose(key));
const onOctave = (octave: number) => submitIfAny(props.notePick.choose({ octave }));
const onPlace = (placed: { letter: Letter; octave: number }) =>
  submitIfAny(props.notePick.choose(placed));
</script>
