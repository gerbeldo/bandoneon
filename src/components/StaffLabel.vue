<template>
  <g v-if="geo" pointer-events="none">
    <clipPath :id="clipId">
      <circle :cx="cx" :cy="cy" :r="CLIP_R" />
    </clipPath>
    <g :clip-path="`url(#${clipId})`">
      <line
        v-for="k in [-2, -1, 0, 1, 2]"
        :key="'line' + k"
        :x1="cx - LINE_HALF"
        :x2="cx + LINE_HALF"
        :y1="cy + geo.mid + k * SP"
        :y2="cy + geo.mid + k * SP"
        stroke="currentColor"
        :stroke-width="0.13 * SP"
      />
      <line
        v-for="q in geo.ledgers"
        :key="'ledger' + q"
        :x1="geo.nx - LEDGER / 2"
        :x2="geo.nx + LEDGER / 2"
        :y1="cy + geo.mid - q * STEP"
        :y2="cy + geo.mid - q * STEP"
        stroke="currentColor"
        :stroke-width="0.16 * SP"
      />
      <path
        :d="staffGlyphs.noteheadBlack.d"
        :transform="`translate(${geo.nx - headHalf} ${geo.ny}) scale(${S} ${-S})`"
        fill="currentColor"
      />
      <path
        v-if="geo.acc"
        :d="accidentalGlyphs[geo.acc].d"
        :transform="`translate(${geo.ax} ${geo.ny}) scale(${S} ${-S})`"
        fill="currentColor"
      />
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';

import { FONT_UNITS_PER_STAFF_SPACE, staffGlyphs } from '../assets/staffGlyphs';
import { accidentalOf, ledgerSteps, staffPosition, type Side } from '../utils/staff';

// A sliding staff fragment inside a keyboard button (circle r 28 at cx, cy):
// the notehead stays within ±MAX_NOTE_OFFSET of the circle center and the
// staff slides by the remainder, so far notes show a partial staff plus
// ledger lines, clipped to the circle.
const SP = 6; // staff space, px
const STEP = SP / 2; // one diatonic step
const S = SP / FONT_UNITS_PER_STAFF_SPACE; // glyph scale, font units -> px
const CLIP_R = 27;
const LINE_HALF = 24; // staff lines 48 px wide
const LEDGER = 12; // ledger line length, px
const MAX_NOTE_OFFSET = 16;
const ACCIDENTAL_GAP = 0.35 * SP; // accidental right edge to notehead left edge

const accidentalGlyphs = {
  '#': staffGlyphs.accidentalSharp,
  b: staffGlyphs.accidentalFlat,
} as const;

const props = defineProps<{
  cx: number;
  cy: number;
  /** Scientific note name, already enharmonic-adjusted by the caller. */
  note: string;
  side: Side;
}>();

const clipId = useId();

const headHalf = (staffGlyphs.noteheadBlack.w * SP) / 2;

const geo = computed(() => {
  const p = staffPosition(props.note, props.side);
  if (p === null) return null;

  const noteOffset = Math.max(-MAX_NOTE_OFFSET, Math.min(MAX_NOTE_OFFSET, -STEP * p));
  const mid = noteOffset + STEP * p; // middle staff line, relative to the circle center

  const nx = props.cx + STEP; // off-center to leave room for the accidental
  const acc = accidentalOf(props.note);
  const ax = acc ? nx - headHalf - ACCIDENTAL_GAP - accidentalGlyphs[acc].w * SP : 0;

  return { mid, ny: props.cy + noteOffset, nx, ledgers: ledgerSteps(p), acc, ax };
});
</script>
