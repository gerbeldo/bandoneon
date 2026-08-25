<template>
  <div
    class="mb-2 flex flex-wrap items-center justify-center gap-x-3 text-sm text-neutral-500 sm:mb-4 dark:text-neutral-400 print:hidden"
  >
    <span>{{ t('strip_prompt', { index: promptNumber, total }) }}</span>
    <span aria-hidden="true">·</span>
    <span>{{ newTodayText }}</span>
    <span aria-hidden="true">·</span>
    <span>{{ t('strip_seen', { seen: preview.seen, total: preview.total }) }}</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'petite-vue-i18n';
import { computed } from 'vue';

import type { SessionPreview } from '../utils/scheduler';
import { DAILY_NEW_ITEMS } from '../utils/scheduler';

// Takes the picker row's place during play. Side is left out on purpose — the
// rendered keyboard shows it; direction lives in DirectionBadge.
const props = defineProps<{
  // 1-based, unlike Prompt.index, and the run's length, which a follow-up grows.
  promptNumber: number;
  total: number;
  // Today's new items and pool coverage, read live so both move with play.
  preview: SessionPreview;
}>();

const { t } = useI18n();

// The cap binds sessions, not sweeps: a sweep of an untouched layout introduces
// far more than three, and "38 of 3" would be nonsense. Past the cap the strip
// reports the count alone.
const newTodayText = computed(() => {
  const count = props.preview.newToday;
  return count > DAILY_NEW_ITEMS
    ? t('strip_new_today_over', { count })
    : t('strip_new_today', { count, cap: DAILY_NEW_ITEMS });
});
</script>
