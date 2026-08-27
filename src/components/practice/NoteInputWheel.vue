<template>
  <svg
    class="mx-auto block min-h-0 w-full select-none"
    viewBox="0 0 320 320"
    role="group"
    aria-label="Wheel"
  >
    <path v-for="(d, i) in ringArcs" :key="i" class="ring" :d="d" />
    <g
      v-for="(value, k) in LETTERS"
      :key="value"
      class="sector"
      :class="{ selected: value === pick.letter }"
      role="button"
      tabindex="0"
      :aria-label="value"
      @click.prevent="emit('letter', value)"
      @keydown.enter.space.prevent="emit('letter', value)"
    >
      <path
        class="hit"
        :d="sectorPath(letterAngle(k) - LETTER_HALF, letterAngle(k) + LETTER_HALF, R_MID, R_OUT)"
      />
      <text
        :x="polar(R_LETTER, letterAngle(k))[0]"
        :y="polar(R_LETTER, letterAngle(k))[1] + 9"
        text-anchor="middle"
        font-size="26"
      >
        {{ formatPitchClass(value, notation) }}
      </text>
    </g>
    <g
      v-for="(value, j) in RING_ACCIDENTALS"
      :key="value"
      class="sector"
      :class="{ selected: value === pick.accidental }"
      role="button"
      tabindex="0"
      :aria-label="ACCIDENTAL_NAMES[value]"
      @click.prevent="emit('accidental', value)"
      @keydown.enter.space.prevent="emit('accidental', value)"
    >
      <path
        class="hit"
        :d="sectorPath(accidentalAngle(j) - 45, accidentalAngle(j) + 45, R_IN, R_MID)"
      />
      <path class="glyph" :d="ACCIDENTAL_GLYPHS[value].d" :transform="glyphAt(value, R_ACCIDENTAL, accidentalAngle(j))" />
    </g>
    <g
      class="sector"
      :class="{ selected: pick.accidental === '' }"
      role="button"
      tabindex="0"
      :aria-label="ACCIDENTAL_NAMES['']"
      @click.prevent="emit('accidental', '')"
      @keydown.enter.space.prevent="emit('accidental', '')"
    >
      <circle class="hit" cx="160" cy="160" :r="R_IN - 4" />
      <path class="glyph" :d="ACCIDENTAL_GLYPHS[''].d" :transform="glyphAt('', 0, 0)" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import type { Accidental, Letter, NotePick } from '../../utils/notePick';
import { ACCIDENTAL_GLYPHS, ACCIDENTAL_NAMES, LETTERS } from '../../utils/notePick';
import { formatPitchClass } from '../../utils/spelling';

// The wheel: seven letters on the outer ring (C at the top, clockwise), the
// four signs on the inner ring (♯ up, ♭ right, 𝄪 down, 𝄫 left), ♮ at the
// center. A tap picks; the octave row below submits.
const CX = 160;
const R_OUT = 158;
const R_MID = 104;
const R_IN = 52;
const R_LETTER = 130;
const R_ACCIDENTAL = 78;
const LETTER_HALF = 360 / 14;
const GLYPH_SCALE = 0.045;

const RING_ACCIDENTALS: Accidental[] = ['#', 'b', '##', 'bb'];

defineProps<{ pick: NotePick; notation: string }>();

const emit = defineEmits<{ letter: [Letter]; accidental: [Accidental] }>();

// SVG angles: 0° points right, and y-down makes positive angles clockwise.
const letterAngle = (k: number) => -90 + (k * 360) / 7;
const accidentalAngle = (j: number) => -90 + j * 90;

function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CX + r * Math.sin(rad)];
}

const point = (r: number, deg: number) => polar(r, deg).join(' ');

// A ring sector between two radii — the tap target, drawn invisibly.
function sectorPath(from: number, to: number, rIn: number, rOut: number): string {
  return (
    `M ${point(rOut, from)} A ${rOut} ${rOut} 0 0 1 ${point(rOut, to)} ` +
    `L ${point(rIn, to)} A ${rIn} ${rIn} 0 0 0 ${point(rIn, from)} Z`
  );
}

const arc = (r: number, from: number, to: number) =>
  `M ${point(r, from)} A ${r} ${r} 0 0 1 ${point(r, to)}`;

// The two rings drawn as thin arcs with gaps around each label.
const ringArcs = [
  ...LETTERS.map((_, k) => arc(R_LETTER, letterAngle(k) + 15, letterAngle(k + 1) - 15)),
  ...RING_ACCIDENTALS.map((_, j) => arc(R_ACCIDENTAL, accidentalAngle(j) + 26, accidentalAngle(j + 1) - 26)),
];

// Centers a glyph's outline on the ring point (or the wheel center for r 0).
function glyphAt(value: Accidental, r: number, deg: number): string {
  const { box } = ACCIDENTAL_GLYPHS[value];
  const [x, y] = r === 0 ? [CX, CX] : polar(r, deg);
  const tx = x - (GLYPH_SCALE * (box[0] + box[2])) / 2;
  const ty = y + (GLYPH_SCALE * (box[1] + box[3])) / 2;
  return `translate(${tx} ${ty}) scale(${GLYPH_SCALE} -${GLYPH_SCALE})`;
}
</script>

<style scoped>
.ring {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  opacity: 0.35;
}

.hit {
  fill: transparent;
}

.sector {
  cursor: pointer;
}

.sector.selected .hit {
  fill: currentColor;
  fill-opacity: 0.1;
}

.sector.selected text {
  font-weight: 700;
}

text,
.glyph {
  fill: currentColor;
}

text {
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
}
</style>
