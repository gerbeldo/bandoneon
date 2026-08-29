<template>
  <svg
    class="keyboard"
    :viewBox="`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`"
    :width="viewBox.width"
    :height="viewBox.height"
  >
    <slot />
  </svg>
  <!-- An empty box the same size and place as the drawing, so an overlay can be
       pinned to the keyboard's own corners rather than to whatever slack the
       page leaves around it. Needs a `relative` parent. -->
  <div
    v-if="$slots.overlay"
    class="keyboard keyboard-ghost"
    :style="{ aspectRatio: `${viewBox.width} / ${viewBox.height}` }"
  >
    <div
      class="keyboard-ghost-inner"
      :style="{ aspectRatio: `${viewBox.width} / ${viewBox.height}` }"
    >
      <slot name="overlay" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { useStore } from '../stores/main';

const { keyboardViewBox: viewBox } = storeToRefs(useStore());
</script>

<style scoped>
.keyboard {
  width: 100%;
  /* Height tracks the width/height attributes' ratio; a cap only binds when the
     drawing is taller than its box, and then it centers horizontally inside it. */
  height: auto;
  max-height: calc(90dvh - 5em);
}

/* Tall screens lock the app to one screen (see the `tall` variant in style.css):
   the flex parent has a definite height, so fit the drawing into it. */
@media (min-height: 600px) {
  .keyboard {
    max-height: 100%;
  }
}

/* An empty stand-in for the drawing, in two boxes because CSS clamps only one
   axis at a time. The outer shares `.keyboard`'s width and cap, so its height
   lands on the drawing's height; the inner takes that height back through the
   viewBox ratio, so its width narrows with the drawing when the cap binds and
   the svg letterboxes. */
.keyboard-ghost {
  position: absolute;
  top: 50%;
  left: 0;
  translate: 0 -50%;
  pointer-events: none;
}

.keyboard-ghost-inner {
  position: relative;
  width: auto;
  height: 100%;
  margin-inline: auto;
}
</style>
