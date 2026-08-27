<template>
  <div class="flex gap-3 sm:gap-4 print:hidden">
    <ButtonGroup class="flex flex-1">
      <Button
        v-for="value in ['left', 'right']"
        :key="value"
        :aria-pressed="side === value"
        class="min-w-0 flex-1"
        @click="side = value === 'left' ? 'left' : 'right'"
      >
        {{ value }}
      </Button>
    </ButtonGroup>
    <ButtonGroup class="flex flex-1">
      <Button
        v-for="value in ['open', 'close']"
        :key="value"
        :aria-pressed="direction === value"
        class="min-w-0 flex-1"
        @click="direction = value === 'close' ? 'close' : 'open'"
      >
        {{ value }}
      </Button>
    </ButtonGroup>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { useStore } from '../stores/main';
import Button from './Button.vue';
import ButtonGroup from './ButtonGroup.vue';

const store = useStore();
const { side, direction } = storeToRefs(store);
</script>
