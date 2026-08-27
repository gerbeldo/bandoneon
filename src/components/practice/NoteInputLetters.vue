<template>
  <div>
    <ButtonGroup class="flex" role="group" aria-label="Letter">
      <Button
        v-for="value in LETTERS"
        :key="value"
        type="button"
        class="min-w-0 flex-1 truncate px-0"
        :aria-label="value"
        :aria-pressed="value === pick.letter"
        @click.prevent="emit('letter', value)"
      >
        {{ formatPitchClass(value, notation) }}
      </Button>
    </ButtonGroup>
    <NoteInputAccidentals class="mt-2" :accidental="pick.accidental" @accidental="emit('accidental', $event)" />
  </div>
</template>

<script setup lang="ts">
import type { Accidental, Letter, NotePick } from '../../utils/notePick';
import { LETTERS } from '../../utils/notePick';
import { formatPitchClass } from '../../utils/spelling';
import Button from '../Button.vue';
import ButtonGroup from '../ButtonGroup.vue';
import NoteInputAccidentals from './NoteInputAccidentals.vue';

// Seven letters and the accidental row; the octave row (which submits) is the
// dispatcher's.
defineProps<{ pick: NotePick; notation: string }>();

const emit = defineEmits<{ letter: [Letter]; accidental: [Accidental] }>();
</script>
