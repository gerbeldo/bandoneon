<template>
  <div
    class="relative mx-auto flex min-h-0 w-full max-w-4xl flex-1 items-center px-2 pt-2 pb-2 sm:px-6 sm:pt-6 sm:pb-4"
  >
    <SvgKeyboard>
      <SvgButton
        v-for="([x, y, tonal], idx) in keyPositions"
        :key="idx"
        :x="x"
        :y="y"
        :tonal="tonal"
        :selected="idx === selected"
        :color="STATUS_COLORS[statusOf(idx)]"
        @click="selected = selected === idx ? null : idx"
      />
    </SvgKeyboard>
  </div>
  <div class="mx-auto w-full max-w-(--breakpoint-md) shrink-0 px-6 pb-4 sm:pb-6">
    <p class="mb-3 text-center text-sm text-neutral-700 dark:text-neutral-200" data-detail>
      {{ detail }}
    </p>
    <ul class="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
      <li v-for="status in ITEM_STATUSES" :key="status" class="inline-flex items-center gap-1.5">
        <span
          class="inline-block h-3 w-3 rounded-full border border-neutral-400"
          :style="{ backgroundColor: STATUS_COLORS[status] }"
          aria-hidden="true"
        ></span>
        <span>{{ STATUS_LABELS[status] }}</span>
        <span class="text-neutral-500 dark:text-neutral-400">{{ layoutCounts[status] }}</span>
      </li>
    </ul>
    <div class="mb-4 flex justify-center">
      <ChoiceGroup v-model="game" class="w-full max-w-sm" label="Game" :options="GAME_CHOICES" />
    </div>
    <NavVariant />
    <p class="text-center text-sm text-neutral-500 dark:text-neutral-400" data-totals>
      {{ totals }} ·
      <RouterLink class="underline" to="/practice">Practice</RouterLink>
    </p>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import ChoiceGroup from '../components/ChoiceGroup.vue';
import type { Choice } from '../components/ChoiceGroup.vue';
import NavVariant from '../components/NavVariant.vue';
import SvgButton from '../components/SvgButton.vue';
import SvgKeyboard from '../components/SvgKeyboard.vue';
import { GAMES } from '../composables/useSession';
import { instruments } from '../data/index';
import { useStore } from '../stores/main';
import { usePracticeStore } from '../stores/practice';
import type { PracticeGame } from '../stores/settings';
import { useSettingsStore } from '../stores/settings';
import {
  ITEM_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  itemStatus,
  statusCounts,
} from '../utils/progress';
import { errorTally } from '../utils/scheduler';
import { layoutItemKeys } from '../utils/session';
import { accidentalGlyphs, spellPitch } from '../utils/spelling';

useHead({ title: 'Progress – Bandoneon.app' });

const GAME_CHOICES: Choice<PracticeGame>[] = [
  { value: 'note', label: 'Note game' },
  { value: 'staff', label: 'Staff game' },
];

const store = useStore();
const { side, direction, keyPositions, showEnharmonics } = storeToRefs(store);
const settings = useSettingsStore();
const practice = usePracticeStore();

// Which game's memory to show; opens on the one the practice setup has chosen.
const game = ref<PracticeGame>(settings.practiceSetup.game);
const selected = ref<number | null>(null);

watch([game, side, direction], () => (selected.value = null));

const layouts = computed(() => instruments[settings.instrument]);
const quizDirection = computed(() => GAMES[game.value].quizDirection);

// Item keys of the shown layout, in the keyboard's render order.
const layoutKeys = computed(() =>
  layouts.value
    ? layoutItemKeys(
        settings.instrument,
        layouts.value,
        { side: side.value, direction: direction.value },
        quizDirection.value,
      )
    : [],
);

const gameKeys = computed(() =>
  layouts.value
    ? (['right', 'left'] as const).flatMap((s) =>
        (['open', 'close'] as const).flatMap((d) =>
          layoutItemKeys(
            settings.instrument,
            layouts.value!,
            { side: s, direction: d },
            quizDirection.value,
          ),
        ),
      )
    : [],
);

const statusOf = (idx: number) => itemStatus(practice.items[layoutKeys.value[idx]]);

const layoutCounts = computed(() => statusCounts(layoutKeys.value, practice.items));

const totals = computed(() => {
  const counts = statusCounts(gameKeys.value, practice.items);
  const seen = gameKeys.value.length - counts.unseen;
  return `${GAME_CHOICES.find((c) => c.value === game.value)?.label}: ${seen} of ${gameKeys.value.length} seen · ${counts.retired} retired`;
});

function daysAgo(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// One button's record when tapped; the layout's headline otherwise.
const detail = computed(() => {
  if (selected.value === null) {
    const seen = layoutKeys.value.length - layoutCounts.value.unseen;
    return `${side.value} ${direction.value}: ${seen} of ${layoutKeys.value.length} seen — tap a button for its record`;
  }
  const idx = selected.value;
  const pitch = keyPositions.value[idx]?.[2] ?? '';
  const name = accidentalGlyphs(spellPitch(pitch, showEnharmonics.value ? 'flat' : 'sharp'));
  const record = practice.items[layoutKeys.value[idx]];
  const status = STATUS_LABELS[itemStatus(record)];
  if (!record || record.answers.length === 0) return `${name} — ${status}`;
  const last = record.answers[record.answers.length - 1];
  const count = record.answers.length;
  return `${name} — ${status} · ${count} answer${count === 1 ? '' : 's'} · error tally ${errorTally(record)} · last ${daysAgo(last.timestamp)}`;
});
</script>
