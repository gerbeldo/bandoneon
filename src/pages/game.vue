<template>
  <SessionStart
    v-if="phase === 'card'"
    v-model="scope"
    :preview="preview"
    @start="start"
    @sweep="sweep"
  />
  <template v-else>
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
  </template>
  <Modal :model-value="phase === 'summary'" @update:model-value="toCard">
    <div class="px-4 py-8 text-center">
      <p class="mb-8">
        <strong>{{ counts[2] }}</strong> {{ t('correct') }} · <strong>{{ counts[1] }}</strong>
        {{ t('partial_credit') }} · <strong>{{ counts[0] }}</strong> {{ t('wrong') }}
      </p>
      <Button primary @click.prevent="again()">
        {{ ran === 'sweep' ? t('try_again') : t('new_session') }}
      </Button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { useI18n } from 'petite-vue-i18n';
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import Button from '../components/Button.vue';
import Modal from '../components/Modal.vue';
import NavTonic from '../components/NavTonic.vue';
import Progress from '../components/Progress.vue';
import SessionStart from '../components/SessionStart.vue';
import SvgButton from '../components/SvgButton.vue';
import SvgKeyboard from '../components/SvgKeyboard.vue';
import { useKeyboard } from '../composables/useKeyboard';
import { useSession } from '../composables/useSession';
import { useStore } from '../stores/main';
import type { Grade } from '../stores/practice';
import { useSettingsStore } from '../stores/settings';

useHead({ title: 'Play a game! – Bandoneon.app' });

useKeyboard({ keys: 'tonic' });

// The session engine draws prompts, grades, and records (ADR 0004); this page
// only renders the prompt and captures the named pitch.
const {
  phase,
  scope,
  preview,
  prompt,
  total,
  counts,
  ran,
  start,
  sweep,
  again,
  next,
  answer,
  toCard,
} = useSession({ quizDirection: 'forward', mode: 'note-game' });

// Graded buttons keyed by layout: a session moves the keyboard between prompts,
// so a button index alone would carry colors across.
const grades = ref<Record<string, Grade>>({});
const oct = ref<number | null>(null);

const { t } = useI18n();

const store = useStore();
const { tonic, side, direction, keyPositions } = storeToRefs(store);

const settings = useSettingsStore();
const { pitchNotation } = storeToRefs(settings);

const currentButton = computed(() => prompt.value?.buttonIndex ?? -1);

const gradeKey = (idx: number) => `${side.value}/${direction.value}/${idx}`;

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
  const grade = grades.value[gradeKey(idx)];
  if (grade === 2) return '#22c55e88'; // green-500
  if (grade === 1) return '#eab30888'; // yellow-500
  if (grade === 0) return '#ef444488'; // red-500
  return 'transparent';
};

const label = (idx: number) => {
  if (idx === currentButton.value) return tonic.value || '?';
  if (typeof grades.value[gradeKey(idx)] === 'number') return;
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

function reset() {
  oct.value = null;
  store.setTonic(null);
}

// Starting a run clears the board; the card owns when that happens.
watch(phase, (value) => {
  if (value === 'playing') grades.value = {};
  reset();
});

function submit() {
  if (!prompt.value || !tonic.value || !oct.value) return;

  const outcome = answer({ pitch: tonic.value + oct.value });
  if (!outcome) return;
  grades.value[gradeKey(outcome.buttonIndex)] = outcome.grade;

  reset();
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
