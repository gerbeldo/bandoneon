<template>
  <div class="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-3 sm:mb-5 sm:gap-x-24 print:hidden">
    <ButtonGroup>
      <Button
        v-for="value in ['left', 'right']"
        :key="value"
        :aria-pressed="side === value"
        class="w-20 sm:w-28"
        @click="side = value === 'left' ? 'left' : 'right'"
      >
        {{ value }}
      </Button>
    </ButtonGroup>
    <ButtonGroup>
      <Button
        v-for="value in ['close', 'open']"
        :key="value"
        :aria-pressed="direction === value"
        class="w-20 sm:w-28"
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
