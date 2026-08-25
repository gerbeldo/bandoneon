<template>
  <div
    class="relative mx-auto flex min-h-0 w-full max-w-4xl flex-1 items-center px-2 pt-2 pb-2 sm:mt-9 sm:px-6 sm:pt-2 sm:pb-4 portrait:mt-9"
  >
    <SvgKeyboard>
      <template v-if="prompt" #overlay>
        <DirectionBadge :direction="prompt.layout.direction" />
      </template>
      <SvgButton
        v-for="([x, y, tonal], idx) in keyPositions"
        :key="idx"
        :x="x"
        :y="y"
        :tonal="tonal"
        :label="label(idx)"
        :spelling="graded(idx)?.spelling"
        :selected="idx === currentButton"
        :color="fillColor(idx)"
      />
    </SvgKeyboard>
  </div>
  <div class="mx-auto max-w-(--breakpoint-md) shrink-0 px-6 pb-4 sm:pb-6">
    <SessionStrip :prompt-number="promptNumber" :total="total" :preview="preview" />
    <p class="mb-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
      Name the highlighted button — pick the note, then the octave.
    </p>
    <p class="mb-2 hidden text-center text-sm text-neutral-500 sm:block dark:text-neutral-400">
      Keyboard: letters for notes, hold Shift for sharps, digits for the octave.
    </p>
    <NavTonic :spelling="prompt?.spelling" />
    <div class="mb-2 flex flex-wrap justify-center">
      <Button
        v-for="octave in octaves"
        :key="octave"
        class="m-1 w-12"
        :disabled="!tonic"
        @click.prevent="oct = octave"
      >
        {{ formatOctave(octave) }}
      </Button>
    </div>
    <Progress
      class="mt-2 sm:mt-6"
      :values="[
        { value: progress[2], color: SCORE_COLORS[2] },
        { value: progress[1], color: SCORE_COLORS[1] },
        { value: progress[0], color: SCORE_COLORS[0] },
      ]"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { useKeyboard } from '../../composables/useKeyboard';
import type { PracticeSession } from '../../composables/useSession';
import { useStore } from '../../stores/main';
import { useSettingsStore } from '../../stores/settings';
import { SCORE_COLORS } from '../../utils/game';
import { displayPitchClass } from '../../utils/spelling';
import Button from '../Button.vue';
import DirectionBadge from '../DirectionBadge.vue';
import NavTonic from '../NavTonic.vue';
import Progress from '../Progress.vue';
import SessionStrip from '../SessionStrip.vue';
import SvgButton from '../SvgButton.vue';
import SvgKeyboard from '../SvgKeyboard.vue';

// The session engine draws prompts, grades, and records (ADR 0004); this view
// only renders the prompt and captures the named pitch.
const props = defineProps<{ session: PracticeSession }>();

const { phase, preview, prompt, promptNumber, total, counts, graded, next, answer } = props.session;

useKeyboard({ keys: 'tonic' });

const oct = ref<number | null>(null);

const store = useStore();
const { tonic, keyPositions } = storeToRefs(store);

const settings = useSettingsStore();
const { pitchNotation } = storeToRefs(settings);

const currentButton = computed(() => prompt.value?.buttonIndex ?? -1);

const formatOctave = (octave: number) => {
  if (pitchNotation.value !== 'helmholtz') {
    return '' + octave;
  }
  const noteName = tonic.value || 'X';
  return (
    (octave < 3 ? noteName : noteName.toLowerCase()) +
    (octave > 3 ? '’'.repeat(octave - 3) : '') +
    (octave < 2 ? ','.repeat(-(octave - 2)) : '')
  );
};

const fillColor = (idx: number) => {
  const result = graded(idx);
  return result ? SCORE_COLORS[result.grade] + '88' : 'transparent';
};

// The prompted button shows the note picked so far, in the prompt's spelling.
const label = (idx: number) => {
  if (idx === currentButton.value) {
    return tonic.value && prompt.value
      ? displayPitchClass(tonic.value, prompt.value.spelling, pitchNotation.value)
      : '?';
  }
  if (graded(idx)) return;
  return '?';
};

const octaves = computed(() => {
  return [
    ...new Set(
      keyPositions.value.map((position) => {
        const name = position[2];
        return name[name.length - 1] || '';
      }),
    ),
  ]
    .map((item) => Number.parseInt(item, 10))
    .sort();
});

// Drops a half-made answer: the note without its octave, or both once graded.
function clearPick() {
  oct.value = null;
  store.setTonic(null);
}

watch(phase, clearPick);
onUnmounted(clearPick);

function submit() {
  if (!prompt.value || !tonic.value || !oct.value) return;

  const outcome = answer({ pitch: tonic.value + oct.value });
  if (!outcome) return;

  clearPick();
  next();
}

watch([tonic, oct], () => {
  if (tonic.value && oct.value) {
    submit();
  }
});

const progress = computed<[number, number, number]>((): [number, number, number] => {
  if (total.value === 0) return [0, 0, 0];
  return counts.value.map((value) => value / total.value) as [number, number, number];
});

// Keyboard shortcuts for octave
function keydownListener({ key }: { key: string }) {
  if (!tonic.value) return;
  for (const octave of octaves.value) {
    if (key === '' + octave) oct.value = octave;
  }
}
onMounted(() => document.addEventListener('keydown', keydownListener));
onUnmounted(() => document.removeEventListener('keydown', keydownListener));
</script>
