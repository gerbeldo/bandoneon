<template>
  <!-- Last resort on a short screen: scroll the panel rather than clip it. -->
  <div class="min-h-0 overflow-y-auto bg-neutral-100 dark:bg-neutral-800">
    <div class="mx-auto max-w-(--breakpoint-md) p-6">
      <div class="mb-4">
        <label class="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {{ t('pitch_notation') }}
        </label>
        <div class="mt-1 flex w-full flex-row gap-2">
          <Button
            v-for="value in pitchNotations"
            :key="value"
            class="w-full bg-white dark:bg-neutral-900"
            :aria-pressed="value === pitchNotation"
            @click="pitchNotation = value"
          >
            {{ t(value) }}
          </Button>
        </div>
      </div>

      <div class="mb-4">
        <label class="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {{ t('language') }}
        </label>
        <div class="mt-1 flex w-full flex-row gap-2">
          <Button
            v-for="value in availableLocales"
            :key="value"
            class="w-full bg-white dark:bg-neutral-900"
            :aria-pressed="value === locale"
            @click="locale = value"
          >
            {{ t('language-' + value) }}
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
import { useI18n } from 'petite-vue-i18n';
import { storeToRefs } from 'pinia';

import { pitchNotations } from '../data/index';
import { useSettingsStore } from '../stores/settings';
import Button from './Button.vue';
import IconGitHub from './icons/IconGitHub.vue';

const settings = useSettingsStore();

const { pitchNotation, locale } = storeToRefs(settings);

const { availableLocales, t } = useI18n({ useScope: 'global' });
</script>
