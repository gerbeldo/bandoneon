<template>
  <div
    class="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-2 px-2 pt-2 pb-4 sm:px-6 sm:pt-6 sm:pb-6 md:flex-row md:items-center md:gap-8"
  >
    <!-- Phone: staff beside the counter/progress/hint to keep the page one screen tall.
         md+: everything stacked in a wider column so the staff can fill it. -->
    <div class="mx-auto flex w-full max-w-md shrink-0 flex-wrap items-center gap-x-4 md:w-80">
      <NavVariant class="w-full" :readonly="answeredCount > 0" />
      <GrandStaff
        class="w-48 shrink-0 md:w-full"
        :notes="quizzedSpelled ? [quizzedSpelled] : []"
        :side="side"
        :color="staffColor"
        :feedback="staffFeedback"
      />
      <div class="min-w-0 flex-1 md:w-full">
        <p class="text-center text-sm text-neutral-500 dark:text-neutral-400">
          {{ Math.min(answeredCount + 1, total) }} / {{ total }}
        </p>
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
    <div class="flex min-h-0 min-w-0 flex-1 items-center">
      <SvgKeyboard>
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
  <Modal v-model="isModalOpen">
    <div class="px-4 py-8 text-center">
      <p class="mb-8">
        <strong>{{ counts[2] }}</strong> {{ t('correct') }} · <strong>{{ counts[1] }}</strong>
        {{ t('partial_credit') }} · <strong>{{ counts[0] }}</strong> {{ t('wrong') }}
      </p>
      <Button
        @click.prevent="
          isModalOpen = false;
          resetGame();
        "
      >
        {{ t('try_again') }}
      </Button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { useI18n } from 'petite-vue-i18n';
import { storeToRefs } from 'pinia';
import { Note } from 'tonal';
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';

import Button from '../components/Button.vue';
import GrandStaff from '../components/GrandStaff.vue';
import Modal from '../components/Modal.vue';
import NavVariant from '../components/NavVariant.vue';
import Progress from '../components/Progress.vue';
import SvgButton from '../components/SvgButton.vue';
import SvgKeyboard from '../components/SvgKeyboard.vue';
import { instruments } from '../data/index';
import { useStore } from '../stores/main';
import type { Grade } from '../stores/practice';
import { usePracticeStore } from '../stores/practice';
import { useSettingsStore } from '../stores/settings';
import type { Prompt, SessionEngine } from '../utils/session';
import { createSweep, layoutGrid, shuffledOrder } from '../utils/session';

useHead({ title: 'Staff game – Bandoneon.app' });

const SCORE_COLORS = ['#ef4444', '#eab308', '#22c55e'] as const; // red-500, yellow-500, green-500
const FLASH_MS = 700;
const PAUSE_MS = 900;

// The sweep runs through the session engine (ADR 0004): it draws each prompt
// (the pitch this page puts on the staff), resolves the tapped position to a
// pitch, grades, and records; this page only renders prompts and captures taps.
const engine = shallowRef<SessionEngine | null>(null);
const prompt = ref<Prompt | null>(null);
const grades = ref<Record<number, Grade>>({});
// Per answer, [wrong, partial, correct]: a follow-up grades a button a second time.
const counts = ref<[number, number, number]>([0, 0, 0]);
// The last tap's result, kept while the feedback pause runs; taps are ignored meanwhile.
const tapResult = ref<{ note: string; score: Grade } | null>(null);
const flash = ref<{ idx: number; score: Grade } | null>(null);
const isModalOpen = ref(false);
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let promptArmedAt = 0;

const { t } = useI18n();

const store = useStore();
const { side, direction, keyPositions, showEnharmonics } = storeToRefs(store);

const settings = useSettingsStore();
const practice = usePracticeStore();

const spell = (tonal: string) => (showEnharmonics.value ? Note.enharmonic(tonal) : tonal);

// Re-read from the engine after each answer: a follow-up grows it mid-run.
const total = ref(0);
// The prompt ref stays on the answered prompt while the feedback pause runs,
// so the count advances only when the next prompt appears.
const answeredCount = computed(() => (prompt.value ? prompt.value.index : total.value));

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
  if (typeof grades.value[idx] === 'number') return SCORE_COLORS[grades.value[idx]] + '88';
  return 'transparent';
};

// Buttons stay blank during play; a quizzed button reveals its note name once scored.
const label = (idx: number) => {
  if (typeof grades.value[idx] === 'number') return null;
  return '';
};

function clearTimers() {
  if (pauseTimer) clearTimeout(pauseTimer);
  if (flashTimer) clearTimeout(flashTimer);
}

// The response clock starts once the prompt is rendered and accepting input.
function armClock() {
  void nextTick(() => {
    promptArmedAt = Date.now();
  });
}

function resetGame() {
  clearTimers();
  grades.value = {};
  counts.value = [0, 0, 0];
  tapResult.value = null;
  flash.value = null;

  const instrumentData = instruments[settings.instrument];
  engine.value = instrumentData
    ? createSweep({
        grid: layoutGrid(instrumentData, side.value, direction.value),
        instrument: settings.instrument,
        side: side.value,
        direction: direction.value,
        quizDirection: 'reverse',
        mode: 'staff-game',
        record: practice.recordAnswer,
        now: Date.now,
        order: shuffledOrder,
      })
    : null;
  total.value = engine.value?.total ?? 0;
  prompt.value = engine.value?.prompt() ?? null;
  armClock();
}

// Side and direction stay as the player left them elsewhere; NavVariant changes
// them, and the keyPositions watcher restarts the sweep on the new layout.
onMounted(() => resetGame());
onUnmounted(() => clearTimers());
watch(keyPositions, () => resetGame());

function tap(idx: number) {
  if (!engine.value || !prompt.value || tapResult.value) return;

  const outcome = engine.value.answer({
    tappedIndex: idx,
    elapsedMs: Date.now() - promptArmedAt,
  });
  grades.value[outcome.buttonIndex] = outcome.grade;
  counts.value[outcome.grade] += 1;
  total.value = engine.value.total;
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
    prompt.value = engine.value?.prompt() ?? null;
    if (prompt.value) {
      armClock();
    } else {
      isModalOpen.value = true;
    }
  }, PAUSE_MS);
}

const progress = computed<[number, number, number]>((): [number, number, number] => {
  if (total.value === 0) return [0, 0, 0];
  return counts.value.map((value) => value / total.value) as [number, number, number];
});
</script>
