<template>
  <Teleport to="body">
    <div v-if="modelValue" class="relative z-50" role="dialog" aria-modal="true">
      <div class="fixed inset-0 bg-neutral-200/75 dark:bg-neutral-800/75"></div>
      <div class="fixed inset-0 overflow-y-auto">
        <div
          class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
          @click.self="close"
        >
          <div
            class="relative w-full overflow-hidden rounded-lg bg-white text-left shadow-xl sm:my-8 sm:max-w-lg dark:bg-neutral-900"
          >
            <slot />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watchEffect } from 'vue';

const props = defineProps<{ modelValue: boolean }>();

const emit = defineEmits<{ 'update:modelValue': [boolean] }>();

const close = () => emit('update:modelValue', false);

function onKeydown({ key }: KeyboardEvent) {
  if (props.modelValue && key === 'Escape') close();
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));

function preventScroll() {
  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
}

function allowScroll() {
  document.documentElement.style.overflow = 'auto';
  document.documentElement.style.paddingRight = '0';
}

watchEffect(() => {
  if (props.modelValue) {
    preventScroll();
  } else {
    allowScroll();
  }
});
</script>
