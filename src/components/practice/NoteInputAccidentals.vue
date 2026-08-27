<template>
  <ButtonGroup class="flex" role="group" aria-label="Accidental">
    <Button
      v-for="value in ACCIDENTALS"
      :key="value"
      type="button"
      class="min-w-0 flex-1 px-0"
      :aria-label="ACCIDENTAL_NAMES[value]"
      :aria-pressed="value === accidental"
      @click.prevent="emit('accidental', value)"
    >
      <AccidentalGlyph :accidental="value" />
    </Button>
  </ButtonGroup>
</template>

<script setup lang="ts">
import type { Accidental } from '../../utils/notePick';
import { ACCIDENTAL_NAMES, ACCIDENTALS } from '../../utils/notePick';
import AccidentalGlyph from '../AccidentalGlyph.vue';
import Button from '../Button.vue';
import ButtonGroup from '../ButtonGroup.vue';

// 𝄫 ♭ ♮ ♯ 𝄪 — natural pressed by default; picking one respells the letter,
// it never submits by itself.
defineProps<{ accidental: Accidental }>();

const emit = defineEmits<{ accidental: [Accidental] }>();
</script>
