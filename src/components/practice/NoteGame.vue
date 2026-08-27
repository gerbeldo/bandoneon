<template>
  <div
    class="game-keyboard relative mx-auto mt-10 flex w-full max-w-4xl shrink-0 items-center justify-center px-2 sm:mt-12 sm:px-6"
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
  <div
    class="mx-auto flex min-h-0 w-full max-w-(--breakpoint-md) flex-1 flex-col px-4 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-6"
  >
    <NoteInput
      class="min-h-0 flex-1"
      :note-pick="notePick"
      :prompt="prompt"
      :feedback="feedback"
      @answer="submit"
    />
    <SessionProgress class="mt-3 shrink-0" :counts="counts" :total="total" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { useNotePick } from '../../composables/useNotePick';
import type { PracticeSession } from '../../composables/useSession';
import { useStore } from '../../stores/main';
import type { Grade } from '../../stores/practice';
import { useSettingsStore } from '../../stores/settings';
import { SCORE_COLORS } from '../../utils/game';
import { octavesOf, pickLabel } from '../../utils/notePick';
import DirectionBadge from '../DirectionBadge.vue';
import SvgButton from '../SvgButton.vue';
import SvgKeyboard from '../SvgKeyboard.vue';
import NoteInput from './NoteInput.vue';
import SessionProgress from './SessionProgress.vue';

// The session engine draws prompts, grades, and records (ADR 0004); this view
// only renders the prompt and captures the named pitch. The pick is its own,
// never Explore's tonic state.
const props = defineProps<{ session: PracticeSession }>();

const { phase, prompt, counts, graded, total, next, answer } = props.session;

const store = useStore();
const { keyPositions } = storeToRefs(store);

const settings = useSettingsStore();
const { pitchNotation } = storeToRefs(settings);

const notePick = useNotePick({ octaves: () => octavesOf(keyPositions.value) });

const PAUSE_MS = 900;

// The last answer's grade, held while the feedback pause runs; input is
// ignored meanwhile. Same rhythm as the staff game.
const result = ref<Grade | null>(null);
let pauseTimer: ReturnType<typeof setTimeout> | null = null;

const feedback = computed(() => (result.value === null ? null : SCORE_COLORS[result.value]));

// While the result shows, the highlight steps aside so the answered button
// wears its grade color and reveals its note.
const currentButton = computed(() =>
  result.value === null ? (prompt.value?.buttonIndex ?? -1) : -1,
);

const fillColor = (idx: number) => {
  const result = graded(idx);
  return result ? SCORE_COLORS[result.grade] + '88' : 'transparent';
};

// The prompted button shows the pick so far, spelled as the player wrote it.
const label = (idx: number) => {
  if (idx === currentButton.value) return pickLabel(notePick.pick, pitchNotation.value);
  if (graded(idx)) return;
  return '?';
};

// A pick belongs to its prompt; the next one starts clean.
watch([phase, prompt], notePick.reset);

// Feedback belongs to the run that produced it.
watch(phase, () => {
  if (pauseTimer) clearTimeout(pauseTimer);
  result.value = null;
});

onUnmounted(() => {
  if (pauseTimer) clearTimeout(pauseTimer);
});

function submit(pitch: string | null) {
  if (!pitch || !prompt.value || result.value !== null) return;
  const outcome = answer({ pitch });
  if (!outcome) return;
  result.value = outcome.grade;
  // Hold the result on screen — the button's grade color, the staff note in
  // green or red — before the next prompt takes over.
  pauseTimer = setTimeout(() => {
    result.value = null;
    next();
  }, PAUSE_MS);
}

// Desktop keys: letters name notes, Shift+letter sharps, # - x set the sign,
// digits pick the octave, Escape clears.
function keydownListener({ key }: KeyboardEvent) {
  if (result.value !== null) return;
  submit(notePick.onKeydown(key));
}
onMounted(() => document.addEventListener('keydown', keydownListener));
onUnmounted(() => document.removeEventListener('keydown', keydownListener));
</script>

<style scoped>
/* The keyboard box is content-sized here (the input below takes the spare
   height), so the drawing needs a viewport cap of its own: SvgKeyboard's
   `max-height: 100%` has nothing definite to resolve against and collapses. */
.game-keyboard :deep(.keyboard) {
  max-height: 45dvh;
}
</style>
