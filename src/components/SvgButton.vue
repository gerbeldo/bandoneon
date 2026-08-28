<template>
  <g
    :class="{ selected }"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    @click.prevent="emit('click')"
    @keydown.enter.space.prevent="interactive && emit('click')"
  >
    <title v-if="title">{{ title }}</title>
    <circle
      :cx="x + 29"
      :cy="y + 29"
      r="28"
      :fill="fill"
      :stroke="stroke"
      stroke-width="1.5"
      :style="outline && !selected ? { stroke: outline } : undefined"
    />
    <StaffLabel
      v-if="label === null && settings.pitchNotation === 'staff'"
      class="staff-label"
      :cx="x + 29"
      :cy="y + 29"
      :note="spelled"
      :side="store.side"
    />
    <text
      v-else
      :x="x + 29"
      :y="y + 36"
      :fill="selected ? '#fff' : 'currentColor'"
      font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
      font-size="20px"
      text-anchor="middle"
    >
      <template v-if="label !== null">
        {{ label }}
      </template>
      <template v-else>
        <tspan>{{ format[0] }}</tspan>
        <tspan dx="2" font-size="16px">
          {{ format[1] }}
        </tspan>
      </template>
    </text>
    <!-- Finger badge, top right inside the ring; the label's octave digit ends
         just below it. -->
    <g v-if="finger !== undefined" class="finger" pointer-events="none">
      <circle :cx="x + 43" :cy="y + 15" r="7" />
      <text
        :x="x + 43"
        :y="y + 18.5"
        font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
        font-size="10px"
        font-weight="600"
        text-anchor="middle"
      >
        {{ finger }}
      </text>
    </g>
  </g>
</template>

<script setup lang="ts">
import { Note } from 'tonal';
import { computed } from 'vue';

import { useStore } from '../stores/main';
import { useSettingsStore } from '../stores/settings';
import { scientificToHelmholtzNotation } from '../utils/helmholtz';
import { scientificToSolfegeNotation } from '../utils/solfege';
import type { Spelling } from '../utils/spelling';
import { FLATS, SHARPS, spellPitch } from '../utils/spelling';
import StaffLabel from './StaffLabel.vue';

const props = withDefaults(
  defineProps<{
    x: number;
    y: number;
    tonal: string;
    selected?: boolean;
    label?: string | null;
    color?: string;
    // Focusable and operable from the keyboard, with `title` as its name —
    // for pages where the button itself is the thing to inspect.
    interactive?: boolean;
    title?: string;
    // Ring color when not selected; the stylesheet's neutral ring otherwise.
    outline?: string;
    // Names the note this way whatever Explore's ♯/♭ toggle says: a button
    // answered in a run keeps the name it was asked under.
    spelling?: Spelling;
    // Recommended finger (2–5) for this button in the shown scale.
    finger?: number;
  }>(),
  {
    selected: false,
    label: null,
    color: undefined,
    interactive: false,
    title: undefined,
    outline: undefined,
    spelling: undefined,
    finger: undefined,
  },
);

const emit = defineEmits<{ click: [] }>();

const store = useStore();
const settings = useSettingsStore();

const spelled = computed(() =>
  spellPitch(props.tonal, props.spelling ?? (store.showEnharmonics ? FLATS : SHARPS)),
);

const format = computed(() => {
  const note = Note.get(spelled.value);
  if (note.empty) return ['', ''];

  if (settings.pitchNotation === 'helmholtz') {
    return [scientificToHelmholtzNotation(note.name), ''];
  } else if (settings.pitchNotation === 'solfege') {
    return [
      scientificToSolfegeNotation(note.name).slice(0, -1).replace('b', '♭').replace('#', '♯'),
      '' + note.oct,
    ];
  }

  return [note.pc.replace('b', '♭').replace('#', '♯'), '' + note.oct];
});

const fill = computed(() => {
  if (props.selected) return 'currentColor';
  if (props.color) return props.color;
  return 'transparent';
});

const stroke = computed(() => {
  return props.selected ? 'currentColor' : '#000';
});
</script>

<style scoped>
circle {
  stroke: #a3a3a3; /* neutral-400 */
}

.selected circle {
  fill: #262626;
  stroke: #262626;
}

text {
  user-select: none;
  cursor: default;
}

.dark .selected circle {
  fill: #f5f5f5;
  stroke: #f5f5f5;
}

.dark .selected text {
  fill: #262626;
}

/* Staff labels draw in currentColor; invert on selection exactly like text. */
.selected .staff-label {
  color: #fff;
}

.dark .selected .staff-label {
  color: #262626;
}

/* The finger badge is a filled disc in the text color with the digit cut out
   of it, so it reads on a tinted or selected button alike. */
.finger circle {
  fill: currentColor;
  stroke: none;
}

.finger text {
  fill: #fff;
}

.dark .finger text {
  fill: #262626;
}

.selected .finger circle {
  fill: #fff;
}

.dark .selected .finger circle {
  fill: #262626;
}

.selected .finger text {
  fill: #262626;
}

.dark .selected .finger text {
  fill: #f5f5f5;
}
</style>
