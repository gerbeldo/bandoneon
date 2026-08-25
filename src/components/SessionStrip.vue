<template>
  <div
    class="mb-2 flex flex-wrap items-center justify-center gap-x-3 text-sm text-neutral-500 sm:mb-4 dark:text-neutral-400 print:hidden"
  >
    <span>{{ promptText }}</span>
    <span aria-hidden="true">·</span>
    <span>{{ newTodayText }}</span>
    <span aria-hidden="true">·</span>
    <span>{{ seenText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { SessionPreview } from '../utils/scheduler';

// Takes the picker row's place during play. Side is left out on purpose — the
// rendered keyboard shows it; direction lives in DirectionBadge.
const props = defineProps<{
  // 1-based, unlike Prompt.index, and the run's length, which a follow-up grows.
  promptNumber: number;
  total: number;
  // Today's new items and pool coverage, read live so both move with play.
  preview: SessionPreview;
}>();

const promptText = computed(() => `Prompt ${props.promptNumber} of ${props.total}`);

const seenText = computed(() => `${props.preview.seen} of ${props.preview.total} seen`);

// The cap binds scheduled sessions only: a fixed run over an untouched layout
// introduces far more than three, and "38 of 3" would be nonsense. Without a
// cap, or past it, the strip reports the count alone.
const newTodayText = computed(() => {
  const { newToday: count, newCap: cap } = props.preview;
  return cap === null || count > cap ? `${count} new today` : `${count} of ${cap} new today`;
});
</script>
