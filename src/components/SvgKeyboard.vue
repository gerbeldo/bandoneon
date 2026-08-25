<template>
  <svg
    ref="svgEl"
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
import { ref } from 'vue';

import { useStore } from '../stores/main';

const { keyboardViewBox: viewBox } = storeToRefs(useStore());

const svgEl = ref();

const download = (filename: string) => {
  // https://mybyways.com/blog/convert-svg-to-png-using-your-browser

  const margin = 30;
  const canvas = document.createElement('canvas');
  const { width } = svgEl.value.getBoundingClientRect();
  // The rendered box can be letterboxed, so take the ratio from the viewBox.
  const viewBox = svgEl.value.viewBox.baseVal;
  canvas.width = (width + margin) * 2;
  canvas.height = ((width * viewBox.height) / viewBox.width + margin) * 2;
  const data = new XMLSerializer().serializeToString(svgEl.value);
  const win = window.URL || window.webkitURL || window;
  const img = new Image();
  const blob = new Blob([data], { type: 'image/svg+xml' });
  const url = win.createObjectURL(blob);

  img.addEventListener('load', () => {
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, margin, margin, canvas.width - 2 * margin, canvas.height - 2 * margin);
    win.revokeObjectURL(url);
    const uri = canvas.toDataURL('image/png').replace('image/png', 'octet/stream');
    const a = document.createElement('a');
    document.body.append(a);
    a.style.display = 'none';
    a.href = uri;
    a.download = filename;
    a.click();
    win.revokeObjectURL(uri);
    a.remove();
  });

  img.src = url;
};

defineExpose({ download });
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
