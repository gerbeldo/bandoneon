<template>
  <!-- Goes in SvgKeyboard's overlay slot, which tracks the drawing's own box:
       pinned just above its top-right corner, so it costs no layout height and
       covers no button whatever slack the page leaves around the keyboard. -->
  <p
    :data-direction="direction"
    class="pointer-events-none absolute right-1 bottom-full mb-1 rounded-full px-4 py-1.5 text-sm font-bold tracking-wide text-white uppercase select-none print:hidden"
    :class="direction === 'open' ? 'bg-sky-600' : 'bg-orange-600'"
  >
    <!-- The word carries the meaning; the chevrons only mime the bellows. -->
    <span aria-hidden="true">{{ direction === 'open' ? '«' : '»' }}</span>
    {{ t(direction) }}
    <span aria-hidden="true">{{ direction === 'open' ? '»' : '«' }}</span>
  </p>
</template>

<script setup lang="ts">
import { useI18n } from 'petite-vue-i18n';

import type { Direction } from '../utils/session';

defineProps<{ direction: Direction }>();

const { t } = useI18n();
</script>
