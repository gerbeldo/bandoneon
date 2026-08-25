<template>
  <div class="flex flex-wrap gap-3">
    <ChoiceGroup v-model="side" class="min-w-40 flex-1" label="Side" :options="SIDES" />
    <ChoiceGroup
      v-model="direction"
      class="min-w-40 flex-1"
      label="Bellows direction"
      :options="DIRECTIONS"
    />
  </div>
</template>

<script setup lang="ts">
import type { Direction, Side } from '../../utils/session';
import type { Choice } from '../ChoiceGroup.vue';
import ChoiceGroup from '../ChoiceGroup.vue';

const SIDES: Choice<Side>[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];
const DIRECTIONS: Choice<Direction>[] = [
  { value: 'open', label: 'Open' },
  { value: 'close', label: 'Close' },
];

const side = defineModel<Side>('side', { required: true });
const direction = defineModel<Direction>('direction', { required: true });
</script>
