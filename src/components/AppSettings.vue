<template>
  <!-- Last resort on a short screen: scroll the panel rather than clip it. -->
  <div class="min-h-0 overflow-y-auto bg-neutral-100 dark:bg-neutral-800">
    <div class="mx-auto max-w-(--breakpoint-md) p-6">
      <div class="mb-4">
        <label class="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Pitch notation
        </label>
        <div class="mt-1 flex w-full flex-row gap-2">
          <Button
            v-for="value in pitchNotations"
            :key="value"
            class="w-full bg-white dark:bg-neutral-900"
            :aria-pressed="value === pitchNotation"
            @click="pitchNotation = value"
          >
            {{ notationLabels[value] }}
          </Button>
        </div>
      </div>

      <div class="flex justify-end text-sm">
        <a target="_blank" href="https://github.com/gerbeldo/bandoneon">
          <IconGitHub class="h-4 w-4" />
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { pitchNotations } from '../data/index';
import { useSettingsStore } from '../stores/settings';
import Button from './Button.vue';
import IconGitHub from './icons/IconGitHub.vue';

// Each button shows the same note spelled in its own notation.
const notationLabels: Record<(typeof pitchNotations)[number], string> = {
  scientific: 'C♯5',
  helmholtz: 'c♯’’',
  solfege: 'Do♯5',
  staff: 'Staff',
};

const settings = useSettingsStore();

const { pitchNotation } = storeToRefs(settings);
</script>
