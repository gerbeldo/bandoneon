<template>
  <StartCard
    v-if="phase === 'start-card'"
    v-model="scope"
    :preview="preview"
    @start="start"
    @sweep="sweep"
  />
  <div
    v-else
    class="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-2 px-2 pt-2 pb-4 sm:px-6 sm:pt-6 sm:pb-6 md:flex-row md:items-center md:gap-8"
  >
    <!-- Phone: staff beside the progress/hint to keep the page one screen tall.
         md+: everything stacked in a wider column so the staff can fill it. -->
    <div class="mx-auto flex w-full max-w-md shrink-0 flex-wrap items-center gap-x-4 md:w-80">
      <SessionStrip
        class="w-full"
        :prompt-number="promptNumber"
        :total="total"
        :preview="preview"
      />
      <GrandStaff
        class="w-48 shrink-0 md:w-full"
        :notes="quizzedSpelled ? [quizzedSpelled] : []"
        :side="side"
        :color="staffColor"
        :feedback="staffFeedback"
      />
      <div class="min-w-0 flex-1 md:w-full">
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
    <div class="relative flex min-h-0 min-w-0 flex-1 items-center">
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
          :color="fillColor(idx)"
          @click="tap(idx)"
        />
      </SvgKeyboard>
    </div>
  </div>
  <SessionSummary
    :open="phase === 'summary'"
    :counts="counts"
    :ran="ran"
    @again="again"
    @dismiss="toStartCard"
  />
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { useI18n } from 'petite-vue-i18n';
import { storeToRefs } from 'pinia';
import { Note } from 'tonal';
import { computed, onUnmounted, ref, watch } from 'vue';

import DirectionBadge from '../components/DirectionBadge.vue';
import GrandStaff from '../components/GrandStaff.vue';
import Progress from '../components/Progress.vue';
import SessionStrip from '../components/SessionStrip.vue';
import SessionSummary from '../components/SessionSummary.vue';
import StartCard from '../components/StartCard.vue';
import SvgButton from '../components/SvgButton.vue';
import SvgKeyboard from '../components/SvgKeyboard.vue';
import { useSession } from '../composables/useSession';
import { useStore } from '../stores/main';
import type { Grade } from '../stores/practice';

useHead({ title: 'Staff game – Bandoneon.app' });

const SCORE_COLORS = ['#ef4444', '#eab308', '#22c55e'] as const; // red-500, yellow-500, green-500
const FLASH_MS = 700;
const PAUSE_MS = 900;

// The session engine draws each prompt (the pitch this page puts on the staff),
// resolves the tapped position to a pitch, grades, and records (ADR 0004); this
// page only renders prompts and captures taps.
const {
  phase,
  scope,
  preview,
  prompt,
  promptNumber,
  total,
  counts,
  gradeOf,
  ran,
  start,
  sweep,
  again,
  next,
  answer,
  toStartCard,
} = useSession({ quizDirection: 'reverse', mode: 'staff-game' });

// The last tap's result, kept while the feedback pause runs; taps are ignored meanwhile.
const tapResult = ref<{ note: string; score: Grade } | null>(null);
const flash = ref<{ idx: number; score: Grade } | null>(null);
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

const { t } = useI18n();

const store = useStore();
const { side, keyPositions, showEnharmonics } = storeToRefs(store);

const spell = (tonal: string) => (showEnharmonics.value ? Note.enharmonic(tonal) : tonal);

const quizzedSpelled = computed(() => (prompt.value ? spell(prompt.value.pitch) : ''));

// The twin-expected marker takes the hint's place, adding no height on phones.
const hint = computed(() => {
  if (prompt.value?.twin === 'follow-up') return t('twin_follow_up');
  if (prompt.value?.twin === 'expected') return t('twin_expected');
  return t('hint_staff_game');
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
  const grade = gradeOf(idx);
  if (typeof grade === 'number') return SCORE_COLORS[grade] + '88';
  return 'transparent';
};

// Buttons stay blank during play; a quizzed button reveals its note name once scored.
const label = (idx: number) => {
  if (typeof gradeOf(idx) === 'number') return null;
  return '';
};

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
