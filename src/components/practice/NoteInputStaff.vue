<template>
  <div class="flex min-h-0 flex-col">
    <svg
      ref="svgEl"
      class="staff mx-auto block min-h-0 w-full flex-1 select-none"
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      aria-label="Staff"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="cancel"
    >
      <line
        v-for="p in LINE_PS"
        :key="p"
        :x1="STAFF_X1"
        :x2="STAFF_X2"
        :y1="lineY(p)"
        :y2="lineY(p)"
        stroke="currentColor"
        :stroke-width="0.13 * SP"
      />
      <line
        :x1="STAFF_X1"
        :x2="STAFF_X1"
        :y1="lineY(4)"
        :y2="lineY(-4)"
        stroke="currentColor"
        :stroke-width="0.16 * SP"
      />
      <path
        v-if="side === 'right'"
        :d="staffGlyphs.gClef.d"
        :transform="`translate(${CLEF_X} ${lineY(-2)}) scale(${S} ${-S})`"
        fill="currentColor"
      />
      <path
        v-else
        :d="staffGlyphs.fClef.d"
        :transform="`translate(${CLEF_X} ${lineY(2)}) scale(${S} ${-S})`"
        fill="currentColor"
      />
      <g v-if="preview">
        <line
          v-for="(y, i) in preview.ledgerYs"
          :key="i"
          :x1="NX - LEDGER / 2"
          :x2="NX + LEDGER / 2"
          :y1="y"
          :y2="y"
          stroke="currentColor"
          :stroke-width="0.16 * SP"
        />
        <path
          v-if="accidental"
          :d="ACCIDENTAL_GLYPHS[accidental].d"
          :transform="`translate(${accidentalX} ${preview.y}) scale(${S} ${-S})`"
          fill="currentColor"
        />
        <path
          :d="staffGlyphs.noteheadBlack.d"
          :transform="`translate(${NX - headHalf} ${preview.y}) scale(${S} ${-S})`"
          fill="currentColor"
        />
        <text :x="STAFF_X2" :y="lineY(13)" text-anchor="end" font-size="15" fill="currentColor">
          {{ preview.name }}
        </text>
      </g>
    </svg>
    <NoteInputAccidentals class="mt-2" :accidental="accidental" @accidental="emit('accidental', $event)" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { staffGlyphs } from '../../assets/staffGlyphs';
import type { Accidental, Letter } from '../../utils/notePick';
import { ACCIDENTAL_GLYPHS } from '../../utils/notePick';
import type { Side } from '../../utils/staff';
import { ledgerSteps, MIDDLE_LINE_STEP, noteAtStep, staffPosition } from '../../utils/staff';
import { formatPitchClass } from '../../utils/spelling';
import NoteInputAccidentals from './NoteInputAccidentals.vue';

// One large staff in the side's clef. The accidental is picked first (♮ by
// default); pressing places a notehead on the nearest line or space, dragging
// slides it, and lifting submits letter, accidental, and octave at once.
const SP = 16; // staff space, viewBox px
const STEP = SP / 2; // one diatonic step
const S = SP / 250; // glyph scale, font units -> px
const VIEW_W = 320;
// One window for both sides, p -9…15: room for A3–B6 treble and C2–G♯4 bass.
const P_TOP = 15;
const P_BOTTOM = -9;
const VIEW_H = (P_TOP - P_BOTTOM) * STEP + 2 * SP;
const MID_Y = SP + P_TOP * STEP;
const LINE_PS = [-4, -2, 0, 2, 4];
const STAFF_X1 = 8;
const STAFF_X2 = 312;
const CLEF_X = 14;
const NX = 208; // notehead center column
const LEDGER = 2.2 * SP;
const ACCIDENTAL_GAP = 0.35 * SP;

// What each side's keyboard can sound; taps clamp to it.
const RANGE: Record<Side, [string, string]> = { right: ['A3', 'B6'], left: ['C2', 'G4'] };

const headHalf = (staffGlyphs.noteheadBlack.w * SP) / 2;

const props = defineProps<{ accidental: Accidental; side: Side; notation: string }>();

const emit = defineEmits<{
  accidental: [Accidental];
  place: [{ letter: Letter; octave: number }];
}>();

const svgEl = ref<SVGSVGElement>();
const dragging = ref(false);
const previewP = ref<number | null>(null);

const bounds = computed<[number, number]>(() => {
  const [low, high] = RANGE[props.side];
  return [staffPosition(low, props.side)!, staffPosition(high, props.side)!];
});

const lineY = (p: number) => MID_Y - p * STEP;

const accidentalX = computed(() =>
  props.accidental
    ? NX - headHalf - ACCIDENTAL_GAP - ACCIDENTAL_GLYPHS[props.accidental].w * SP
    : 0,
);

const preview = computed(() => {
  if (previewP.value === null) return null;
  const p = previewP.value;
  const { letter, octave } = noteAtStep(p + MIDDLE_LINE_STEP[props.side]);
  return {
    y: lineY(p),
    ledgerYs: ledgerSteps(p).map(lineY),
    letter: letter as Letter,
    octave,
    name: formatPitchClass(letter + props.accidental, props.notation) + octave,
  };
});

// The nearest line or space under the pointer; 'meet' letterboxing means the
// element box can be taller (or wider) than the drawing, so map through the
// drawn area, not the box.
function positionAt(clientY: number): number {
  const rect = svgEl.value!.getBoundingClientRect();
  const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
  const offsetY = (rect.height - VIEW_H * scale) / 2;
  const y = (clientY - rect.top - offsetY) / scale;
  const p = Math.round((MID_Y - y) / STEP);
  return Math.max(bounds.value[0], Math.min(bounds.value[1], p));
}

function down(event: PointerEvent) {
  event.preventDefault();
  dragging.value = true;
  previewP.value = positionAt(event.clientY);
  try {
    svgEl.value?.setPointerCapture(event.pointerId);
  } catch {
    // jsdom and older browsers have no pointer capture; window-less drags
    // then end at the svg's edge, which is fine.
  }
}

function move(event: PointerEvent) {
  if (!dragging.value) return;
  previewP.value = positionAt(event.clientY);
}

function up() {
  if (!dragging.value || preview.value === null) return;
  const { letter, octave } = preview.value;
  cancel();
  emit('place', { letter, octave });
}

function cancel() {
  dragging.value = false;
  previewP.value = null;
}
</script>

<style scoped>
/* A drag must place the note, not scroll the page. */
.staff {
  touch-action: none;
}
</style>
