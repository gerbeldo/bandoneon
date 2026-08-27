<template>
  <svg
    class="pointer-events-none inline-block h-6"
    :viewBox="`${-PAD} ${-HEIGHT / 2} ${width + 2 * PAD} ${HEIGHT}`"
    aria-hidden="true"
  >
    <path
      :d="glyph.d"
      :transform="`translate(${-glyph.box[0]} ${middle}) scale(1 -1)`"
      fill="currentColor"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { Accidental } from '../utils/notePick';
import { ACCIDENTAL_GLYPHS } from '../utils/notePick';

// One shared box height (font units), so the five signs keep their true
// relative sizes; PAD keeps thin outlines off the viewBox edge.
const HEIGHT = 760;
const PAD = 40;

const props = defineProps<{ accidental: Accidental }>();

const glyph = computed(() => ACCIDENTAL_GLYPHS[props.accidental]);
const width = computed(() => glyph.value.box[2] - glyph.value.box[0]);
// Puts the outline's vertical midpoint on y 0, so flats do not ride high.
const middle = computed(() => (glyph.value.box[1] + glyph.value.box[3]) / 2);
</script>
