<template>
  <div
    class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-2 px-2 pt-2 pb-4 sm:px-6 sm:pt-6 sm:pb-6 md:flex-row md:items-center md:gap-8"
  >
    <!-- Phone: staff beside the counter/progress/hint to keep the page one screen tall.
         md+: everything stacked in a wider column so the staff can fill it. -->
    <div class="mx-auto flex w-full max-w-md shrink-0 flex-wrap items-center gap-x-4 md:w-80">
      <p class="w-full text-center text-lg font-medium capitalize">
        {{ t(side) }} · {{ t(direction) }}
      </p>
      <GrandStaff
        class="w-48 shrink-0 md:w-full"
        :notes="quizzedSpelled ? [quizzedSpelled] : []"
        :side="side"
        :color="staffColor"
        :feedback="staffFeedback"
      />
      <div class="min-w-0 flex-1 md:w-full">
        <p class="text-center text-sm text-neutral-500 dark:text-neutral-400">
          {{ Math.min(currentPosition + 1, positions.length) }} / {{ positions.length }}
        </p>
        <Progress
          class="mt-2"
          :values="[
            { value: progress[2], color: SCORE_COLORS[2] },
            { value: progress[1], color: SCORE_COLORS[1] },
            { value: progress[0], color: SCORE_COLORS[0] },
          ]"
        />
        <p class="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {{ t('hint_staff_game') }}
        </p>
      </div>
    </div>
    <div class="min-w-0 flex-1">
      <SvgKeyboard>
        <SvgButton
          v-for="([x, y, tonal], idx) in positions"
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
          newGame();
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import Button from '../components/Button.vue';
import GrandStaff from '../components/GrandStaff.vue';
import Modal from '../components/Modal.vue';
import Progress from '../components/Progress.vue';
import SvgButton from '../components/SvgButton.vue';
import SvgKeyboard from '../components/SvgKeyboard.vue';
import { useStore } from '../stores/main';
import { scoreTap, type TapScore } from '../utils/game';

useHead({ title: 'Staff game – Bandoneon.app' });

const SCORE_COLORS = ['#ef4444', '#eab308', '#22c55e'] as const; // red-500, yellow-500, green-500
const FLASH_MS = 700;
const PAUSE_MS = 900;

const currentPosition = ref(0);
const guessed = ref<TapScore[]>([]);
const positions = ref<[number, number, string][]>([]);
// The last tap's result, kept while the feedback pause runs; taps are ignored meanwhile.
const tapResult = ref<{ note: string; score: TapScore } | null>(null);
const flash = ref<{ idx: number; score: TapScore } | null>(null);
const isModalOpen = ref(false);
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

const { t } = useI18n();

const store = useStore();
const { side, direction, keyPositions, showEnharmonics } = storeToRefs(store);

const spell = (tonal: string) => (showEnharmonics.value ? Note.enharmonic(tonal) : tonal);

const quizzedSpelled = computed(() => {
  const tonal = positions.value[Math.min(currentPosition.value, positions.value.length - 1)]?.[2];
  return tonal ? spell(tonal) : '';
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
  if (typeof guessed.value[idx] === 'number') return SCORE_COLORS[guessed.value[idx]] + '88';
  return 'transparent';
};

// Buttons stay blank during play; a quizzed button reveals its note name once scored.
const label = (idx: number) => {
  if (typeof guessed.value[idx] === 'number') return null;
  return '';
};

function clearTimers() {
  if (pauseTimer) clearTimeout(pauseTimer);
  if (flashTimer) clearTimeout(flashTimer);
}

function resetGame() {
  clearTimers();
  currentPosition.value = 0;
  guessed.value = [];
  tapResult.value = null;
  flash.value = null;

  // Randomize position order
  const array = [...keyPositions.value];
  const random = array.map(() => Math.random());
  array.sort((a, b) => (random[array.indexOf(a)] || 0) - (random[array.indexOf(b)] || 0));
  positions.value = array;
}

function newGame() {
  // Randomize side, direction
  store.$patch({
    side: Math.random() < 0.5 ? 'right' : 'left',
    direction: Math.random() < 0.5 ? 'open' : 'close',
  });

  resetGame();
}

onMounted(() => newGame());
onUnmounted(() => clearTimers());
watch(keyPositions, () => resetGame());

function tap(idx: number) {
  if (tapResult.value || currentPosition.value >= positions.value.length) return;

  const score = scoreTap(positions.value[currentPosition.value][2], positions.value[idx][2]);
  if (score === null) return;

  guessed.value[currentPosition.value] = score;
  tapResult.value = { note: spell(positions.value[idx][2]), score };

  if (idx !== currentPosition.value) {
    flash.value = { idx, score };
    flashTimer = setTimeout(() => {
      if (flash.value?.idx === idx) flash.value = null;
    }, FLASH_MS);
  }

  // Show the feedback, then proceed to the next position
  pauseTimer = setTimeout(() => {
    tapResult.value = null;
    currentPosition.value++;

    // Game is done
    if (currentPosition.value >= positions.value.length) {
      isModalOpen.value = true;
    }
  }, PAUSE_MS);
}

// Counts per tier: [wrong, partial, correct], matching the progress bar segments.
const counts = computed<[number, number, number]>((): [number, number, number] => {
  const result: [number, number, number] = [0, 0, 0];

  for (const g of guessed.value) {
    if (g === 2) result[2]++;
    else if (g === 1) result[1]++;
    else if (g === 0) result[0]++;
  }

  return result;
});

const progress = computed<[number, number, number]>((): [number, number, number] => {
  if (positions.value.length === 0) return [0, 0, 0];
  return counts.value.map((value) => value / positions.value.length) as [number, number, number];
});
</script>
