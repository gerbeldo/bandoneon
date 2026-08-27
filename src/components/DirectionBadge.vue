<template>
  <!-- Goes in SvgKeyboard's overlay slot, which tracks the drawing's own box:
       a thin rule across its top edge with the word inside, so it costs no
       keyboard width and covers no button. The word carries the meaning;
       color and chevrons only underline it. -->
  <p
    :data-direction="direction"
    class="pointer-events-none absolute inset-x-0 bottom-full mb-1.5 flex items-center gap-3 text-xs font-bold tracking-wide uppercase select-none print:hidden"
    :class="
      direction === 'open'
        ? 'text-sky-600 dark:text-sky-500'
        : 'text-orange-600 dark:text-orange-500'
    "
  >
    <span class="h-0.5 min-w-4 flex-1 rounded-full bg-current" aria-hidden="true" />
    <span>
      <span aria-hidden="true">{{ direction === 'open' ? '«' : '»' }}</span>
      {{ direction }}
      <span aria-hidden="true">{{ direction === 'open' ? '»' : '«' }}</span>
    </span>
    <span class="h-0.5 min-w-4 flex-1 rounded-full bg-current" aria-hidden="true" />
  </p>
</template>

<script setup lang="ts">
import type { Direction } from '../utils/session';

defineProps<{ direction: Direction }>();
</script>
