<template>
  <div
    class="mx-auto flex min-h-0 w-full max-w-4xl flex-1 items-center px-2 pt-2 pb-2 sm:px-6 sm:pt-6 sm:pb-4"
  >
    <SvgKeyboard>
      <SvgButton
        v-for="([x, y, tonal], idx) in keyPositions"
        :key="idx"
        :x="x"
        :y="y"
        :tonal="tonal"
        :label="label(idx)"
        :selected="idx === currentButton"
        :color="fillColor(idx)"
      />
    </SvgKeyboard>
  </div>
  <div class="mx-auto max-w-(--breakpoint-md) shrink-0 px-6 pb-4 sm:pb-6">
    <NavVariant :readonly="answeredCount > 0" />
    <p class="mb-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
      {{ t('hint_game') }}
    </p>
    <p class="mb-2 hidden text-center text-sm text-neutral-500 sm:block dark:text-neutral-400">
      {{ t('hint_game_keyboard') }}
    </p>
    <NavTonic />
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
        { value: progress[2], color: '#22c55e' /* green-500 */ },
        { value: progress[1], color: '#eab308' /* yellow-500 */ },
        { value: progress[0], color: '#ef4444' /* red-500 */ },
      ]"
    />
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
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';

import Button from '../components/Button.vue';
import Modal from '../components/Modal.vue';
import NavTonic from '../components/NavTonic.vue';
import NavVariant from '../components/NavVariant.vue';
import Progress from '../components/Progress.vue';
import SvgButton from '../components/SvgButton.vue';
import SvgKeyboard from '../components/SvgKeyboard.vue';
import { useKeyboard } from '../composables/useKeyboard';
import { instruments } from '../data/index';
import { useStore } from '../stores/main';
import type { Grade } from '../stores/practice';
import { usePracticeStore } from '../stores/practice';
import { useSettingsStore } from '../stores/settings';
import type { Prompt, SessionEngine } from '../utils/session';
import { createSweep, layoutGrid } from '../utils/session';

useHead({ title: 'Play a game! – Bandoneon.app' });

useKeyboard({ keys: 'tonic' });

// The sweep runs through the session engine (ADR 0004): it draws prompts,
// grades, and records; this page only renders prompts and captures answers.
const engine = shallowRef<SessionEngine | null>(null);
const prompt = ref<Prompt | null>(null);
const grades = ref<Record<number, Grade>>({});
const oct = ref<number | null>(null);
const isModalOpen = ref(false);
let promptArmedAt = 0;

const { t } = useI18n();

const store = useStore();
const { tonic, side, direction, keyPositions } = storeToRefs(store);

const settings = useSettingsStore();
const { pitchNotation } = storeToRefs(settings);

const practice = usePracticeStore();

const currentButton = computed(() => prompt.value?.buttonIndex ?? -1);
const answeredCount = computed(() =>
  prompt.value ? prompt.value.index : (engine.value?.total ?? 0),
);

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
  if (grades.value[idx] === 2) return '#22c55e88'; // green-500
  if (grades.value[idx] === 1) return '#eab30888'; // yellow-500
  if (grades.value[idx] === 0) return '#ef444488'; // red-500
  return 'transparent';
};

const label = (idx: number) => {
  if (idx === currentButton.value) return tonic.value || '?';
  if (typeof grades.value[idx] === 'number') return;
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

// Random prompt order per sweep; sort keys are drawn once per index so the
// comparator stays consistent while sorting.
function shuffledOrder(count: number): number[] {
  const indices = [...Array(count).keys()];
  const random = indices.map(() => Math.random());
  indices.sort((a, b) => (random[a] ?? 0) - (random[b] ?? 0));
  return indices;
}

// The response clock starts once the prompt is rendered and accepting input.
function armClock() {
  void nextTick(() => {
    promptArmedAt = Date.now();
  });
}

function resetGame() {
  oct.value = null;
  grades.value = {};
  store.setTonic(null);

  const instrumentData = instruments[settings.instrument];
  engine.value = instrumentData
    ? createSweep({
        grid: layoutGrid(instrumentData, side.value, direction.value),
        instrument: settings.instrument,
        side: side.value,
        direction: direction.value,
        quizDirection: 'forward',
        mode: 'note-game',
        record: practice.recordAnswer,
        now: Date.now,
        order: shuffledOrder,
      })
    : null;
  prompt.value = engine.value?.prompt() ?? null;
  armClock();
}

// Side and direction stay as the player left them elsewhere; NavVariant changes
// them, and the keyPositions watcher restarts the sweep on the new layout.
onMounted(() => resetGame());
watch(keyPositions, () => resetGame());

function submit() {
  if (!engine.value || !prompt.value || !tonic.value || !oct.value) return;

  const outcome = engine.value.answer({
    pitch: tonic.value + oct.value,
    elapsedMs: Date.now() - promptArmedAt,
  });
  grades.value[outcome.buttonIndex] = outcome.grade;

  // Proceed to next prompt
  store.setTonic(null);
  oct.value = null;
  prompt.value = engine.value.prompt();
  if (prompt.value) {
    armClock();
  } else {
    isModalOpen.value = true;
  }
}

watch([tonic, oct], () => {
  if (tonic.value && oct.value) {
    submit();
  }
});

// Counts per tier: [wrong, partial, correct].
const counts = computed<[number, number, number]>((): [number, number, number] => {
  const result: [number, number, number] = [0, 0, 0];

  for (const g of Object.values(grades.value)) {
    if (g === 2) result[2]++;
    else if (g === 1) result[1]++;
    else if (g === 0) result[0]++;
  }

  return result;
});

const progress = computed<[number, number, number]>((): [number, number, number] => {
  if (keyPositions.value.length === 0) return [0, 0, 0];
  return counts.value.map((value) => value / keyPositions.value.length) as [number, number, number];
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
