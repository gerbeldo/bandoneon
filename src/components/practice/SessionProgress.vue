<template>
  <Progress :values="values" />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { SCORE_COLORS } from '../../utils/game';
import Progress from '../Progress.vue';

// The run's answers as one bar: correct, partial, and wrong shares of the draw.
const props = defineProps<{ counts: readonly [number, number, number]; total: number }>();

const values = computed(() =>
  props.total === 0
    ? []
    : [2, 1, 0].map((grade) => ({
        value: props.counts[grade] / props.total,
        color: SCORE_COLORS[grade],
      })),
);
</script>
