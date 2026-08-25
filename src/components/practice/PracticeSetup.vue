<template>
  <!-- The page's own scroller: on tall screens the app locks to one screen, so
       a long form scrolls here while the start bar stays in reach. -->
  <div class="min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 pt-3 sm:gap-9 sm:px-6 sm:pt-6">
      <section>
        <h2 :class="HEADING">Game</h2>
        <div class="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Game">
          <button
            v-for="choice in GAME_CHOICES"
            :key="choice.value"
            type="button"
            role="radio"
            :aria-checked="setup.game === choice.value"
            class="flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors select-none"
            :class="
              setup.game === choice.value
                ? 'border-neutral-900 bg-neutral-100 ring-1 ring-neutral-900 dark:border-neutral-100 dark:bg-neutral-800 dark:ring-neutral-100'
                : 'border-neutral-300 hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800'
            "
            @click="setup.game = choice.value"
          >
            <svg
              v-if="choice.value === 'note'"
              viewBox="0 0 40 40"
              class="h-9 w-9"
              aria-hidden="true"
            >
              <circle cx="20" cy="20" r="16" fill="currentColor" />
              <text
                x="20"
                y="27"
                text-anchor="middle"
                font-size="20"
                font-weight="700"
                class="fill-white dark:fill-neutral-900"
              >
                ?
              </text>
            </svg>
            <svg v-else viewBox="0 0 40 40" class="h-9 w-9" aria-hidden="true">
              <line
                v-for="y in [8, 14, 20, 26, 32]"
                :key="y"
                x1="2"
                :y1="y"
                x2="38"
                :y2="y"
                stroke="currentColor"
                stroke-width="1.2"
              />
              <ellipse
                cx="24"
                cy="17"
                rx="5.5"
                ry="3.8"
                transform="rotate(-20 24 17)"
                fill="currentColor"
              />
            </svg>
            <span class="font-semibold">{{ choice.title }}</span>
            <span class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ choice.description }}
            </span>
          </button>
        </div>
      </section>

      <section>
        <h2 :class="HEADING">Layouts</h2>
        <ChoiceGroup v-model="setup.scope" label="Layouts" :options="SCOPES" />
        <LayoutPicker
          v-if="setup.scope === 'one'"
          v-model:side="setup.layout.side"
          v-model:direction="setup.layout.direction"
          class="mt-3"
        />
      </section>

      <section>
        <h2 :class="HEADING">Items</h2>
        <ChoiceGroup v-model="setup.pool" label="Items" :options="poolOptions" />
        <p :class="HINT">{{ POOL_HINTS[setup.pool] }}</p>
        <div
          v-if="setup.pool === 'scheduled'"
          class="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm"
        >
          <span>Prompts</span>
          <ChoiceGroup v-model="setup.sessionSize" label="Prompts" :options="sizeOptions" />
          <span>New per day</span>
          <ChoiceGroup
            v-model="setup.dailyNewItems"
            label="New items per day"
            :options="dailyOptions"
          />
        </div>
        <div v-else class="mt-4">
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-semibold tabular-nums">{{ shownCount }}</span>
            <span class="text-sm text-neutral-500 dark:text-neutral-400">
              of {{ poolSize }} items
            </span>
          </div>
          <input
            type="range"
            class="h-8 w-full cursor-pointer accent-neutral-800 dark:accent-neutral-200"
            min="1"
            :max="Math.max(1, poolSize)"
            :value="shownCount"
            aria-label="Number of items"
            @input="setup.fixedCount = Number(($event.target as HTMLInputElement).value)"
          />
          <div class="mt-1 flex flex-wrap gap-2">
            <Button
              v-for="pick in quickPicks"
              :key="pick.label"
              type="button"
              class="min-w-12"
              :aria-pressed="shownCount === pick.value"
              @click="setup.fixedCount = pick.value"
            >
              {{ pick.label }}
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h2 :class="HEADING">Accidentals</h2>
        <ChoiceGroup v-model="setup.spelling" label="Accidentals" :options="SPELLING_CHOICES" />
        <p :class="HINT">{{ SPELLING_HINTS[setup.spelling] }}</p>
      </section>
    </div>

    <!-- Follows the form, and sticks to the bottom edge once the form is
         taller than the screen, so Start is always one tap away. -->
    <div class="sticky bottom-0 mt-6 px-4 pb-3 sm:mt-8 sm:px-6 sm:pb-6">
      <div
        class="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:p-4 dark:border-neutral-700 dark:bg-neutral-900/95"
      >
        <div class="min-w-0">
          <p class="font-semibold">{{ headline }}</p>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ detail }}</p>
        </div>
        <Button
          primary
          type="button"
          class="w-28 shrink-0 sm:w-40"
          :disabled="preview.prompts === 0"
          @click="emit('start')"
        >
          Start
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted } from 'vue';

import type { PracticeGame, PracticePool } from '../../stores/settings';
import { DAILY_NEW_CHOICES, SESSION_SIZES, useSettingsStore } from '../../stores/settings';
import type { SessionPreview } from '../../utils/scheduler';
import type { SpellingChoice } from '../../utils/spelling';
import Button from '../Button.vue';
import type { Choice } from '../ChoiceGroup.vue';
import ChoiceGroup from '../ChoiceGroup.vue';
import LayoutPicker from './LayoutPicker.vue';

const props = defineProps<{
  // What starting right now would run: the summary line reads it.
  preview: SessionPreview;
  // How many items the chosen layouts hold — the range of "First N".
  poolSize: number;
}>();

const emit = defineEmits<{ start: [] }>();

const { practiceSetup: setup } = storeToRefs(useSettingsStore());

const HEADING =
  'mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400';
const HINT = 'mt-2 text-sm text-neutral-500 dark:text-neutral-400';

const GAME_CHOICES: { value: PracticeGame; title: string; description: string }[] = [
  {
    value: 'note',
    title: 'Note game',
    description: 'A button lights up — name the note it sounds.',
  },
  {
    value: 'staff',
    title: 'Staff game',
    description: 'A note sits on the staff — tap its button.',
  },
];

const SCOPES: Choice<'all' | 'one'>[] = [
  { value: 'all', label: 'All four layouts' },
  { value: 'one', label: 'One layout' },
];

const POOL_HINTS: Record<PracticePool, string> = {
  scheduled:
    'The scheduler picks: recent mistakes and long-unseen items first, plus a few new ones each day.',
  fixed: 'The first items of the learning order, each asked once. The daily cap does not apply.',
};

const SPELLING_CHOICES: Choice<SpellingChoice>[] = [
  { value: 'sharp', label: '♯ Sharps' },
  { value: 'flat', label: '♭ Flats' },
  { value: 'both', label: 'Both' },
];

const SPELLING_HINTS: Record<SpellingChoice, string> = {
  sharp: 'Accidentals are named as sharps (C♯, D♯, F♯…).',
  flat: 'Accidentals are named as flats (D♭, E♭, G♭…).',
  both: 'Each accidental is asked twice — once as a sharp, once as a flat.',
};

const sizeOptions = SESSION_SIZES.map((n) => ({ value: n, label: String(n) }));
const dailyOptions = DAILY_NEW_CHOICES.map((n) => ({ value: n, label: String(n) }));

// A count stored for a bigger scope shows clamped, and comes back whole when
// the scope widens again.
const shownCount = computed(() => Math.min(setup.value.fixedCount, Math.max(1, props.poolSize)));

const poolOptions = computed<Choice<PracticePool>[]>(() => [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'fixed', label: `First ${shownCount.value}` },
]);

const quickPicks = computed(() => [
  ...[5, 10, 20, 50].filter((n) => n < props.poolSize).map((n) => ({ value: n, label: String(n) })),
  { value: props.poolSize, label: 'All' },
]);

const headline = computed(() => {
  const { prompts } = props.preview;
  if (prompts === 0) return 'Nothing to draw';
  if (setup.value.spelling === 'both') return `${prompts} items, both spellings`;
  return prompts === 1 ? '1 prompt' : `${prompts} prompts`;
});

const detail = computed(() => {
  const { prompts, fresh, seen, total } = props.preview;
  if (prompts === 0) {
    return setup.value.pool === 'scheduled'
      ? 'Today’s new items are spent and nothing here has been seen yet.'
      : 'No items in this range.';
  }
  return `${fresh} new · ${seen} of ${total} seen`;
});

// Enter means Start anywhere on the screen, whichever control the player last
// touched. Space still works the buttons.
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || props.preview.prompts === 0) return;
  event.preventDefault();
  emit('start');
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));
</script>
