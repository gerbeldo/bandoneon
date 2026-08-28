<template>
  <div class="flex flex-wrap justify-center gap-x-6 gap-y-3 print:hidden">
    <div class="flex flex-col items-center">
      <div
        class="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase select-none dark:text-neutral-400"
      >
        Scale
      </div>
      <ButtonGroup>
        <Button
          v-for="item in scaleTypes"
          :key="item"
          :aria-pressed="item === scaleType"
          @click.prevent="store.setScaleType(item === scaleType ? null : item)"
        >
          {{ scaleLabels[item] }}
        </Button>
      </ButtonGroup>
    </div>
    <div class="flex flex-col items-center">
      <div
        class="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase select-none dark:text-neutral-400"
      >
        Chord
      </div>
      <ButtonGroup>
        <Button
          v-for="item in chordTypes"
          :key="item"
          :aria-pressed="item === chordType"
          @click.prevent="store.setChordType(item === chordType ? null : item)"
        >
          {{ item }}
        </Button>
      </ButtonGroup>
    </div>
    <div class="flex flex-col items-center">
      <div
        class="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase select-none dark:text-neutral-400"
      >
        Display
      </div>
      <ButtonGroup>
        <Button class="w-9" @click.prevent="showEnharmonics = !showEnharmonics">
          {{ showEnharmonics ? '♯' : '♭' }}
        </Button>
        <Button :aria-pressed="showColors" @click.prevent="showColors = !showColors">
          <IconPalette class="inline-block h-4 w-4 align-[-0.25em]" />
        </Button>
      </ButtonGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { chordTypes, scaleTypes } from '../data/index';
import { useStore } from '../stores/main';
import Button from './Button.vue';
import ButtonGroup from './ButtonGroup.vue';
import IconPalette from './icons/IconPalette.vue';

// Short forms so the three scale buttons fit side by side.
const scaleLabels: Record<string, string> = { major: 'maj', minor: 'min', chromatic: 'chrom' };

const store = useStore();
const { scaleType, showColors, showEnharmonics, chordType } = storeToRefs(store);
</script>
