<template>
  <div class="flex min-h-0 flex-col">
    <svg
      ref="svgEl"
      class="staff mx-auto block max-h-[45dvh] min-h-0 w-full flex-1 select-none"
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
          :stroke="noteColor"
          :stroke-width="0.16 * SP"
        />
        <path
          v-if="accidental"
          :d="ACCIDENTAL_GLYPHS[accidental].d"
          :transform="`translate(${accidentalX} ${preview.y}) scale(${S} ${-S})`"
          :fill="noteColor"
        />
        <path
          :d="staffGlyphs.noteheadBlack.d"
          :transform="`translate(${NX - headHalf} ${preview.y}) scale(${S} ${-S})`"
          :fill="noteColor"
        />
        <text :x="STAFF_X2" :y="lineY(13)" text-anchor="end" font-size="15" :fill="noteColor">
          {{ preview.name }}
        </text>
      </g>
    </svg>
    <NoteInputAccidentals
      class="mt-2 shrink-0"
      :accidental="accidental"
      @accidental="emit('accidental', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';

import { staffGlyphs } from '../../assets/staffGlyphs';
import type { Accidental, Letter } from '../../utils/notePick';
import { ACCIDENTAL_GLYPHS, pickLabel } from '../../utils/notePick';
import type { Side } from '../../utils/staff';
import { ledgerSteps, MIDDLE_LINE_STEP, noteAtStep } from '../../utils/staff';
import NoteInputAccidentals from './NoteInputAccidentals.vue';

// One large staff in the side's clef. The accidental is picked first (♮ by
// default); pressing places a notehead on the nearest line or space, dragging
// slides it, and lifting lets it rest briefly — touching again picks it back
// up, and after the rest it submits letter, accidental, and octave at once.
const SP = 24; // staff space, viewBox px
const STEP = SP / 2; // one diatonic step
const S = SP / 250; // glyph scale, font units -> px
const VIEW_W = 320;
// One window for both sides, p -9…15: room for the treble's B6 and the bass's C2.
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

// A finger hides what it touches, so on touch the note rides above it.
const TOUCH_OFFSET = 2 * SP;
// A fingertip rolls as it lifts; drift under LIFT_SLOP inside the last
// LIFT_WINDOW_MS is that roll, not intent, and falls back to the held position.
const LIFT_WINDOW_MS = 80;
const LIFT_SLOP = SP;
// How long a lifted note rests before it submits itself.
const GRACE_MS = 500;

const headHalf = (staffGlyphs.noteheadBlack.w * SP) / 2;

const props = defineProps<{
  accidental: Accidental;
  side: Side;
  notation: string;
  // What the layout can sound, as staff positions [lowest, highest]; taps
  // clamp to it, so the staff never names a note the keyboard lacks.
  range: readonly [number, number];
  // The graded answer's color, set while the game shows the outcome. While
  // set the staff ignores the pointer; clearing it clears the placed note.
  feedback?: string | null;
}>();

const emit = defineEmits<{
  accidental: [Accidental];
  place: [{ letter: Letter; octave: number }];
}>();

const svgEl = ref<SVGSVGElement>();
const dragging = ref(false);
const previewP = ref<number | null>(null);
let samples: { t: number; y: number }[] = [];
let graceTimer: ReturnType<typeof setTimeout> | null = null;

const lineY = (p: number) => MID_Y - p * STEP;

const noteColor = computed(() => props.feedback ?? 'currentColor');

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
    name:
      pickLabel(
        { letter: letter as Letter, accidental: props.accidental, octave: null },
        props.notation,
      ) + octave,
  };
});

// Pointer y -> viewBox y; 'meet' letterboxing means the element box can be
// taller (or wider) than the drawing, so map through the drawn area, not the
// box.
function viewY(event: PointerEvent): number {
  const rect = svgEl.value!.getBoundingClientRect();
  const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
  const offsetY = (rect.height - VIEW_H * scale) / 2;
  const y = (event.clientY - rect.top - offsetY) / scale;
  return event.pointerType === 'touch' ? y - TOUCH_OFFSET : y;
}

// The nearest line or space, kept inside the layout's range.
function snap(y: number): number {
  const p = Math.round((MID_Y - y) / STEP);
  return Math.max(props.range[0], Math.min(props.range[1], p));
}

function track(event: PointerEvent) {
  samples.push({ t: event.timeStamp, y: viewY(event) });
  // Keep the lift window plus one older sample to fall back on.
  while (samples.length > 1 && samples[1].t <= event.timeStamp - LIFT_WINDOW_MS) samples.shift();
  previewP.value = snap(samples[samples.length - 1].y);
}

function down(event: PointerEvent) {
  if (props.feedback) return;
  event.preventDefault();
  if (graceTimer) {
    // A resting note is picked back up instead of submitting.
    clearTimeout(graceTimer);
    graceTimer = null;
  }
  dragging.value = true;
  samples = [];
  track(event);
  try {
    svgEl.value?.setPointerCapture(event.pointerId);
  } catch {
    // jsdom and older browsers have no pointer capture; window-less drags
    // then end at the svg's edge, which is fine.
  }
}

function move(event: PointerEvent) {
  if (!dragging.value) return;
  track(event);
}

function up(event: PointerEvent) {
  if (!dragging.value || samples.length === 0) return;
  dragging.value = false;
  const last = samples[samples.length - 1];
  const held =
    [...samples].reverse().find((s) => s.t <= event.timeStamp - LIFT_WINDOW_MS) ?? samples[0];
  previewP.value = snap(Math.abs(last.y - held.y) < LIFT_SLOP ? held.y : last.y);
  graceTimer = setTimeout(place, GRACE_MS);
}

// The note stays on the staff after submitting; the feedback watcher below
// clears it once the game has shown the outcome.
function place() {
  graceTimer = null;
  if (!preview.value) return;
  const { letter, octave } = preview.value;
  emit('place', { letter, octave });
}

function cancel() {
  if (graceTimer) clearTimeout(graceTimer);
  graceTimer = null;
  dragging.value = false;
  previewP.value = null;
  samples = [];
}

// A sign tap while the note rests restarts its clock, leaving time to look.
watch(
  () => props.accidental,
  () => {
    if (!graceTimer) return;
    clearTimeout(graceTimer);
    graceTimer = setTimeout(place, GRACE_MS);
  },
);

// The game clearing its result means the next prompt is up.
watch(
  () => props.feedback,
  (now, before) => {
    if (before && !now) cancel();
  },
);

onUnmounted(() => {
  if (graceTimer) clearTimeout(graceTimer);
});
</script>

<style scoped>
/* A drag must place the note, not scroll the page. */
.staff {
  touch-action: none;
}
</style>
