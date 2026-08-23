<template>
  <svg viewBox="0 0 240 260">
    <g>
      <line
        v-for="y in LINE_YS"
        :key="y"
        :x1="MARGIN_X"
        :x2="240 - MARGIN_X"
        :y1="y"
        :y2="y"
        stroke="currentColor"
        :stroke-width="0.13 * SP"
      />
      <line
        :x1="MARGIN_X"
        :x2="MARGIN_X"
        :y1="LINE_YS[0]"
        :y2="LINE_YS[9]"
        stroke="currentColor"
        :stroke-width="0.16 * SP"
      />
      <path
        :d="staffGlyphs.gClef.d"
        :transform="`translate(${CLEF_X} ${G4_LINE_Y}) scale(${S} ${-S})`"
        fill="currentColor"
      />
      <path
        :d="staffGlyphs.fClef.d"
        :transform="`translate(${CLEF_X} ${F3_LINE_Y}) scale(${S} ${-S})`"
        fill="currentColor"
      />
    </g>
    <g
      v-for="(group, gi) in groups"
      :key="gi"
      :style="group.color ? `color: ${group.color}` : undefined"
    >
      <g v-for="(n, i) in group.laid" :key="i">
        <line
          v-for="(y, j) in n.ledgerYs"
          :key="j"
          :x1="n.headX + headWidth / 2 - LEDGER / 2"
          :x2="n.headX + headWidth / 2 + LEDGER / 2"
          :y1="y"
          :y2="y"
          stroke="currentColor"
          :stroke-width="0.16 * SP"
        />
        <path
          v-if="n.acc"
          :d="accidentalGlyphs[n.acc].d"
          :transform="`translate(${n.accX} ${n.y}) scale(${S} ${-S})`"
          fill="currentColor"
        />
        <path
          :d="staffGlyphs.noteheadWhole.d"
          :transform="`translate(${n.headX} ${n.y}) scale(${S} ${-S})`"
          fill="currentColor"
        />
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { FONT_UNITS_PER_STAFF_SPACE, staffGlyphs } from '../assets/staffGlyphs';
import {
  ACCIDENTAL_COLUMN_OFFSET_SP,
  accidentalOf,
  type ChordNote,
  chordLayout,
  ledgerSteps,
  MIDDLE_LINE_STEP,
  type Side,
  type StaffAccidental,
  stepIndex,
} from '../utils/staff';

// Fixed 240×260 drawing area sized so the full A#1–B6 range of all six
// instruments fits and the staff never moves between rounds.
const SP = 10; // staff space, px
const STEP = SP / 2; // one diatonic step
const S = SP / FONT_UNITS_PER_STAFF_SPACE; // glyph scale, font units -> px
const MARGIN_X = 20;
const CLEF_X = 28;
// Treble F5..E4 on y 70..110, a 6-staff-space gap, bass A3..G2 on y 170..210.
const LINE_YS = [70, 80, 90, 100, 110, 170, 180, 190, 200, 210];
const G4_LINE_Y = 100;
const F3_LINE_Y = 180;
const MIDDLE_LINE_Y: Record<Side, number> = { left: 190, right: 90 };
const QUIZZED_X = 140;
const FEEDBACK_X = 185;
const LEDGER = 25; // ledger line length, px
const ACCIDENTAL_GAP = 0.35 * SP; // column 0 right edge to leftmost notehead left edge

const accidentalGlyphs = {
  '#': staffGlyphs.accidentalSharp,
  b: staffGlyphs.accidentalFlat,
} as const;

const headWidth = staffGlyphs.noteheadWhole.w * SP;

const props = withDefaults(
  defineProps<{
    /** The quizzed note(s), spelled scientific names; more than one lays out as a chord. */
    notes: string[];
    /** Which staff the notes go on: left hand reads bass, right reads treble. */
    side: Side;
    /** Color of the quizzed note(s); inherits the text color when unset. */
    color?: string;
    /** An optional second note drawn next to the quizzed one, in its own color. */
    feedback?: { note: string; color: string } | null;
  }>(),
  { color: undefined, feedback: null },
);

interface LaidNote {
  y: number;
  headX: number;
  ledgerYs: number[];
  acc: StaffAccidental;
  accX: number;
}

/** Whole notes at nx on the side's staff, chords engraved per the staff.ts rules. */
function layOut(names: string[], nx: number): LaidNote[] {
  const midY = MIDDLE_LINE_Y[props.side];
  const midStep = MIDDLE_LINE_STEP[props.side];

  const parsed = names
    .map((name) => ({ step: stepIndex(name), accidental: accidentalOf(name) }))
    .filter((n): n is ChordNote => n.step !== null);
  const layout = chordLayout(parsed);
  const leftHeadEdge = nx - headWidth / 2;

  return parsed.map((n, i) => {
    const p = n.step - midStep;
    const accColumn = layout[i].accidentalColumn;
    return {
      y: midY - STEP * p,
      headX: leftHeadEdge + layout[i].headShift * headWidth,
      ledgerYs: ledgerSteps(p).map((q) => midY - STEP * q),
      acc: n.accidental,
      accX:
        n.accidental && accColumn !== null
          ? leftHeadEdge -
            ACCIDENTAL_GAP -
            accColumn * ACCIDENTAL_COLUMN_OFFSET_SP * SP -
            accidentalGlyphs[n.accidental].w * SP
          : 0,
    };
  });
}

const groups = computed(() => {
  const list = [{ laid: layOut(props.notes, QUIZZED_X), color: props.color }];
  if (props.feedback) {
    list.push({ laid: layOut([props.feedback.note], FEEDBACK_X), color: props.feedback.color });
  }
  return list;
});
</script>
