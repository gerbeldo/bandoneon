<template>
  <g
    v-if="segments.length"
    class="scale-path"
    :stroke="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    fill="none"
  >
    <line
      v-for="(segment, index) in segments"
      :key="index"
      :x1="segment.x1"
      :y1="segment.y1"
      :x2="segment.x2"
      :y2="segment.y2"
      :stroke-opacity="segment.opacity"
    />
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  stroke: string;
  points: [number, number][];
}>();

// One line per step rather than one polyline, each fainter than the next, so the
// scale reads as rising instead of as a shape.
const segments = computed(() => {
  const count = props.points.length - 1;
  return props.points.slice(1).map(([x2, y2], i) => {
    const [x1, y1] = props.points[i];
    const opacity = count === 1 ? 1 : 0.2 + (0.8 * i) / (count - 1);
    return { x1, y1, x2, y2, opacity: Math.round(opacity * 1000) / 1000 };
  });
});
</script>
