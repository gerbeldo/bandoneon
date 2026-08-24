<template>
  <div
    class="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-3 sm:mb-5 sm:gap-x-24 print:hidden"
  >
    <ButtonGroup>
      <Button
        v-for="value in ['left', 'right']"
        :key="value"
        :aria-pressed="side === value"
        :disabled="readonly"
        class="w-20 sm:w-28"
        @click="side = value === 'left' ? 'left' : 'right'"
      >
        {{ t(value) }}
      </Button>
    </ButtonGroup>
    <ButtonGroup>
      <Button
        v-for="value in ['close', 'open']"
        :key="value"
        :aria-pressed="direction === value"
        :disabled="readonly"
        class="w-20 sm:w-28"
        @click="direction = value === 'close' ? 'close' : 'open'"
      >
        {{ t(value) }}
      </Button>
    </ButtonGroup>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'petite-vue-i18n';
import { storeToRefs } from 'pinia';

import { useStore } from '../stores/main';
import Button from './Button.vue';
import ButtonGroup from './ButtonGroup.vue';

defineProps<{ readonly?: boolean }>();

const { t } = useI18n();
const store = useStore();
const { side, direction } = storeToRefs(store);
</script>
