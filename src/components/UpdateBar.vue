<template>
  <div
    v-if="open"
    role="status"
    class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
  >
    <div
      class="pointer-events-auto flex items-center gap-4 rounded-lg border border-neutral-300 bg-white py-2 pr-2 pl-4 shadow-lg dark:border-neutral-600 dark:bg-neutral-800"
    >
      <span class="text-sm">New version available</span>
      <button
        type="button"
        class="text-sm text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
        @click="emit('dismiss')"
      >
        Later
      </button>
      <Button primary @click="emit('reload')">Reload</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from './Button.vue';

defineProps<{ open: boolean }>();

const emit = defineEmits<{ reload: []; dismiss: [] }>();
</script>
