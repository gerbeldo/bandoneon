<template>
  <Modal :model-value="open" @update:model-value="emit('dismiss')">
    <div class="px-6 py-8">
      <h2 class="text-center text-lg font-semibold">
        {{ kind === 'scheduled' ? 'Session complete' : 'Run complete' }}
      </h2>
      <p class="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
        <span
          v-for="grade in [2, 1, 0] as const"
          :key="grade"
          class="inline-flex items-center gap-1.5"
        >
          <span
            class="inline-block h-2.5 w-2.5 rounded-full"
            :style="{ backgroundColor: SCORE_COLORS[grade] }"
            aria-hidden="true"
          ></span>
          <strong>{{ counts[grade] }}</strong> {{ GRADE_NAMES[grade] }}
        </span>
      </p>

      <div v-if="missed.length" class="mt-6">
        <p
          class="text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
        >
          To work on
        </p>
        <ul class="mt-2 flex flex-wrap gap-2">
          <li
            v-for="item in missed.slice(0, MISSED_SHOWN)"
            :key="item.key"
            class="rounded-md border px-2 py-1 text-sm"
            :class="
              item.grade === 1
                ? 'border-yellow-500/70 bg-yellow-500/10'
                : 'border-red-500/70 bg-red-500/10'
            "
          >
            <strong>{{ item.name }}</strong>
            <span class="text-neutral-500 dark:text-neutral-400">
              · {{ item.layout.side }} {{ item.layout.direction }}
            </span>
          </li>
          <li v-if="missed.length > MISSED_SHOWN" class="px-1 py-1 text-sm text-neutral-500">
            +{{ missed.length - MISSED_SHOWN }} more
          </li>
        </ul>
      </div>

      <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
        <Button type="button" @click.prevent="emit('dismiss')">Change setup</Button>
        <Button primary type="button" @click.prevent="emit('again')">
          {{ kind === 'scheduled' ? 'New session' : 'Run again' }}
        </Button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { AnsweredPrompt } from '../composables/useSession';
import type { Grade } from '../stores/practice';
import type { PracticePool } from '../stores/settings';
import { SCORE_COLORS } from '../utils/game';
import { layoutKey } from '../utils/session';
import { accidentalGlyphs, spellPitch } from '../utils/spelling';
import Button from './Button.vue';
import Modal from './Modal.vue';

const MISSED_SHOWN = 12;
const GRADE_NAMES: Record<Grade, string> = { 2: 'correct', 1: 'partial credit', 0: 'wrong' };

// The primary action repeats what was just run; dismissing returns to the setup.
const props = defineProps<{
  open: boolean;
  counts: [number, number, number];
  kind: PracticePool;
  answers: AnsweredPrompt[];
}>();

const emit = defineEmits<{ again: []; dismiss: [] }>();

// Wrong and partial answers, one entry per item (its worst grade), wrong first.
const missed = computed(() => {
  const byItem = new Map<
    string,
    { key: string; name: string; layout: AnsweredPrompt['layout']; grade: Grade }
  >();
  for (const answer of props.answers) {
    if (answer.grade === 2) continue;
    const key = `${layoutKey(answer.layout)}/${answer.pitch}`;
    const known = byItem.get(key);
    if (!known || answer.grade < known.grade) {
      byItem.set(key, {
        key,
        name: accidentalGlyphs(spellPitch(answer.pitch, answer.spelling)),
        layout: answer.layout,
        grade: answer.grade,
      });
    }
  }
  return [...byItem.values()].sort((a, b) => a.grade - b.grade);
});
</script>
