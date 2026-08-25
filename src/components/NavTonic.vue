<template>
  <div class="mb-3 flex flex-wrap justify-center print:hidden">
    <span v-for="idx in [0, 1]" :key="idx" class="inline-block text-nowrap">
      <Button
        v-for="item in notes.slice(idx * 6, idx * 6 + 6)"
        :key="item"
        class="m-1 w-12"
        :aria-pressed="item === tonic"
        :disabled="disabled"
        @click.prevent="store.setTonic(item === tonic ? null : item)"
      >
        {{ format(item) }}
      </Button>
    </span>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { notes } from '../data/index';
import { useStore } from '../stores/main';
import { useSettingsStore } from '../stores/settings';
import type { Spelling } from '../utils/spelling';
import { displayPitchClass } from '../utils/spelling';
import Button from './Button.vue';

// A run names the palette by its prompt; Explore by its ♯/♭ toggle.
const props = defineProps<{ disabled?: boolean; spelling?: Spelling }>();

const store = useStore();
const { tonic, showEnharmonics } = storeToRefs(store);

const settings = useSettingsStore();

const format = (noteName: string): string =>
  displayPitchClass(
    noteName,
    props.spelling ?? (showEnharmonics.value ? 'flat' : 'sharp'),
    settings.pitchNotation,
  );
</script>
