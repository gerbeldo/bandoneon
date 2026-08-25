<template>
  <ButtonGroup class="flex" role="group" :aria-label="label">
    <Button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      class="min-w-0 flex-1 truncate"
      :aria-pressed="option.value === model"
      @click="model = option.value"
    >
      <slot :option="option">{{ option.label }}</slot>
    </Button>
  </ButtonGroup>
</template>

<script setup lang="ts" generic="T extends string | number">
import Button from './Button.vue';
import ButtonGroup from './ButtonGroup.vue';

// A segmented control: one pressed option at a time, equal widths.
export interface Choice<T> {
  value: T;
  label: string;
}

defineProps<{ options: Choice<T>[]; label: string }>();

const model = defineModel<T>({ required: true });
</script>
