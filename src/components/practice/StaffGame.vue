<template>
  <div
    class="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-2 px-2 pt-2 pb-4 sm:px-6 sm:pt-6 sm:pb-6 md:landscape:flex-row md:landscape:items-center md:landscape:gap-8"
  >
    <!-- Portrait (phones, tablets held upright): the keyboard on top — as in
         the note game — with the staff beside the progress/hint below it.
         Landscape from md up: the staff column stands beside the keyboard. -->
    <div
      class="relative flex min-h-0 min-w-0 shrink items-center justify-center pt-7 md:landscape:order-2 md:landscape:flex-1 md:landscape:pt-0"
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
          :color="fillColor(idx)"
          @click="tap(idx)"
        />
      </SvgKeyboard>
    </div>
    <div
      class="mx-auto flex w-full max-w-md flex-1 flex-wrap content-start items-center gap-x-4 md:landscape:w-80 md:landscape:flex-none md:landscape:content-center"
    >
      <GrandStaff
        class="w-48 shrink-0 md:landscape:w-full"
        :notes="quizzedSpelled ? [quizzedSpelled] : []"
        :side="side"
        :color="staffColor"
        :feedback="staffFeedback"
      />
      <div class="min-w-0 flex-1 md:landscape:w-full">
        <Progress
          class="mt-2"
          :values="[
            { value: progress[2], color: SCORE_COLORS[2] },
            { value: progress[1], color: SCORE_COLORS[1] },
            { value: progress[0], color: SCORE_COLORS[0] },
          ]"
        />
        <p
          class="mt-2 text-center text-sm"
          :class="
            prompt?.twin
              ? 'font-medium text-neutral-700 dark:text-neutral-200'
              : 'text-neutral-500 dark:text-neutral-400'
          "
        >
          {{ hint }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onUnmounted, ref, watch } from 'vue';

import type { PracticeSession } from '../../composables/useSession';
import { useStore } from '../../stores/main';
import type { Grade } from '../../stores/practice';
import { SCORE_COLORS } from '../../utils/game';
import { spellPitch } from '../../utils/spelling';
import DirectionBadge from '../DirectionBadge.vue';
import GrandStaff from '../GrandStaff.vue';
import Progress from '../Progress.vue';
import SvgButton from '../SvgButton.vue';
import SvgKeyboard from '../SvgKeyboard.vue';

const FLASH_MS = 700;
const PAUSE_MS = 900;
const STAFF_HINT =
  'Tap the button that sounds this note. Right note in the wrong octave counts as partial credit.';

// The session engine draws each prompt (the pitch this view puts on the staff),
// resolves the tapped position to a pitch, grades, and records (ADR 0004); this
// view only renders prompts and captures taps.
const props = defineProps<{ session: PracticeSession }>();

const { phase, prompt, total, counts, graded, next, answer } = props.session;

// The last tap's result, kept while the feedback pause runs; taps are ignored meanwhile.
const tapResult = ref<{ note: string; score: Grade } | null>(null);
const flash = ref<{ idx: number; score: Grade } | null>(null);
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

const store = useStore();
const { side, keyPositions } = storeToRefs(store);

// Everything on the staff follows the prompt's spelling.
const spell = (tonal: string) => (prompt.value ? spellPitch(tonal, prompt.value.spelling) : tonal);

const quizzedSpelled = computed(() => (prompt.value ? spell(prompt.value.pitch) : ''));

// The twin-expected marker takes the hint's place, adding no height on phones.
const hint = computed(() => {
  if (prompt.value?.twin === 'follow-up') return 'Now tap the other button that sounds this note.';
  if (prompt.value?.twin === 'expected') return 'Two buttons sound this note — tap either one.';
  return STAFF_HINT;
});

// A correct tap recolors the quizzed note green; wrong and partial taps keep it
// in the text color and draw the tapped note next to it in the result color.
const staffColor = computed(() => (tapResult.value?.score === 2 ? SCORE_COLORS[2] : undefined));

const staffFeedback = computed(() =>
  tapResult.value && tapResult.value.score !== 2
    ? { note: tapResult.value.note, color: SCORE_COLORS[tapResult.value.score] }
    : null,
);

const fillColor = (idx: number) => {
  if (flash.value?.idx === idx) return SCORE_COLORS[flash.value.score] + '88';
  const result = graded(idx);
  if (result) return SCORE_COLORS[result.grade] + '88';
  return 'transparent';
};

// Buttons stay blank during play; a quizzed button reveals its note name once
// scored, spelled as it was asked.
const label = (idx: number) => (graded(idx) ? null : '');

function clearTimers() {
  if (pauseTimer) clearTimeout(pauseTimer);
  if (flashTimer) clearTimeout(flashTimer);
}

// Feedback belongs to the run that produced it.
watch(phase, () => {
  clearTimers();
  tapResult.value = null;
  flash.value = null;
});

onUnmounted(() => clearTimers());

function tap(idx: number) {
  if (!prompt.value || tapResult.value) return;

  const outcome = answer({ tappedIndex: idx });
  if (!outcome) return;
  tapResult.value = { note: spell(keyPositions.value[idx][2]), score: outcome.grade };

  if (idx !== outcome.buttonIndex) {
    flash.value = { idx, score: outcome.grade };
    flashTimer = setTimeout(() => {
      if (flash.value?.idx === idx) flash.value = null;
    }, FLASH_MS);
  }

  // Show the feedback, then move on to the next prompt.
  pauseTimer = setTimeout(() => {
    tapResult.value = null;
    next();
  }, PAUSE_MS);
}

const progress = computed<[number, number, number]>((): [number, number, number] => {
  if (total.value === 0) return [0, 0, 0];
  return counts.value.map((value) => value / total.value) as [number, number, number];
});
</script>
