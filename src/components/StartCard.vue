<template>
  <div
    class="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-8"
  >
    <ButtonGroup>
      <Button
        v-for="value in ['all', 'one'] as const"
        :key="value"
        :aria-pressed="scope === value"
        class="w-32 sm:w-40"
        @click="scope = value"
      >
        {{ value === 'all' ? t('all_layouts') : t('one_layout') }}
      </Button>
    </ButtonGroup>

    <!-- The one-layout state doubles as the sweep's layout picker. -->
    <NavVariant v-if="scope === 'one'" class="w-full" />

    <p class="text-center text-sm text-neutral-500 dark:text-neutral-400">
      {{
        t('session_info', {
          prompts: preview.prompts,
          newLeft: preview.newLeft,
          seen: preview.seen,
          total: preview.total,
        })
      }}
    </p>

    <!-- Nothing to draw: the day's new items are spent and this scope holds
         nothing seen yet. The sweep still works. -->
    <Button primary class="w-48" :disabled="preview.prompts === 0" @click="emit('start')">
      {{ t('start_session') }}
    </Button>
    <Button v-if="scope === 'one'" data-sweep @click="emit('sweep')">
      {{ t('sweep_layout') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'petite-vue-i18n';
import { onMounted, onUnmounted } from 'vue';

import type { SessionPreview } from '../utils/scheduler';
import Button from './Button.vue';
import ButtonGroup from './ButtonGroup.vue';
import NavVariant from './NavVariant.vue';

const props = defineProps<{ preview: SessionPreview }>();

const emit = defineEmits<{ start: []; sweep: [] }>();

const scope = defineModel<'all' | 'one'>({ required: true });

const { t } = useI18n();

// Enter means Start anywhere on the card, whichever control the player last
// touched — only the sweep keeps its own. Space still works the scope buttons.
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || props.preview.prompts === 0) return;
  if (event.target instanceof HTMLElement && event.target.hasAttribute('data-sweep')) return;
  event.preventDefault();
  emit('start');
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));
</script>
