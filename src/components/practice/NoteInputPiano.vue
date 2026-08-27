<template>
  <svg
    class="mx-auto block h-auto w-full max-w-sm select-none"
    viewBox="0 0 280 122"
    role="group"
    aria-label="Piano"
  >
    <g
      v-for="(chroma, index) in WHITE_CHROMAS"
      :key="chroma"
      class="white-key"
      :class="{ pressed: pressed(chroma) }"
      role="button"
      tabindex="0"
      :aria-label="name(chroma)"
      @click.prevent="tap(chroma)"
      @keydown.enter.space.prevent="tap(chroma)"
    >
      <rect :x="index * 40 + 1" y="1" width="38" height="120" rx="3" stroke-width="1.5" />
      <text :x="index * 40 + 20" y="112" text-anchor="middle" font-size="13">
        {{ label(chroma) }}
      </text>
    </g>
    <g
      v-for="{ chroma, cx } in BLACK_KEYS"
      :key="chroma"
      class="black-key"
      :class="{ pressed: pressed(chroma) }"
      role="button"
      tabindex="0"
      :aria-label="name(chroma)"
      @click.prevent="tap(chroma)"
      @keydown.enter.space.prevent="tap(chroma)"
    >
      <rect :x="cx - 13" y="1" width="26" height="76" rx="3" />
      <text :x="cx" y="66" text-anchor="middle" font-size="10">{{ label(chroma) }}</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { Note } from 'tonal';

import type { Accidental, Letter, NotePick } from '../../utils/notePick';
import type { Spelling } from '../../utils/spelling';
import { displayPitchClass, SHARPS, spellPitch } from '../../utils/spelling';

// One octave; a key names its pitch class in the prompt's spelling, and a tap
// hands over exactly the letter and accidental it shows (D♭ taps as D-flat,
// never C-sharp). The octave row below submits.
const WHITE_CHROMAS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_KEYS = [
  { chroma: 1, cx: 40 },
  { chroma: 3, cx: 80 },
  { chroma: 6, cx: 160 },
  { chroma: 8, cx: 200 },
  { chroma: 10, cx: 240 },
];

const props = defineProps<{ pick: NotePick; spelling: Spelling; notation: string }>();

const emit = defineEmits<{ key: [{ letter: Letter; accidental: Accidental }] }>();

const name = (chroma: number) => spellPitch(SHARPS[chroma], props.spelling);
const label = (chroma: number) => displayPitchClass(SHARPS[chroma], props.spelling, props.notation);

// The picked pitch class lights its key, wherever the pick came from.
const pressed = (chroma: number) =>
  props.pick.letter !== null && Note.chroma(props.pick.letter + props.pick.accidental) === chroma;

function tap(chroma: number) {
  const note = Note.get(name(chroma));
  emit('key', { letter: note.letter as Letter, accidental: note.acc as Accidental });
}
</script>

<style scoped>
text {
  cursor: default;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
}

/* A tap must not draw the browser's focus box; keyboard focus keeps a mark. */
g:focus {
  outline: none;
}

g:focus-visible rect {
  stroke: #0284c7; /* sky-600 */
  stroke-width: 2.5;
}

/* A piano keeps its colors in both themes; only the pressed tint changes. */
.white-key rect {
  fill: #fff;
  stroke: #a3a3a3; /* neutral-400 */
}

.white-key.pressed rect {
  fill: #d4d4d4; /* neutral-300 */
}

.white-key text {
  fill: #262626; /* neutral-800 */
}

.black-key rect {
  fill: #262626;
}

.black-key.pressed rect {
  fill: #525252; /* neutral-600 */
}

.black-key text {
  fill: #f5f5f5; /* neutral-100 */
}
</style>
