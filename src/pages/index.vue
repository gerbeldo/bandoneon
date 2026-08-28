<template>
  <div
    class="mx-auto flex min-h-0 w-full max-w-4xl flex-1 items-center px-2 pt-2 pb-2 sm:px-6 sm:pt-6 sm:pb-4"
  >
    <SvgKeyboard>
      <!-- Scale paths before the buttons so labels always paint on top. -->
      <SvgPath
        v-for="(path, index) in scalePaths"
        :key="index"
        :stroke="getScaleColor(index)"
        :d="path"
      />
      <SvgButton
        v-for="([x, y, tonal], idx) in keyPositions"
        :key="idx"
        :selected="selected[tonal]"
        :x="x"
        :y="y"
        :tonal="tonal"
        :color="color(tonal)"
        @click="toggle(tonal)"
      />
    </SvgKeyboard>
  </div>
  <div
    class="mx-auto flex w-full max-w-(--breakpoint-md) shrink-0 flex-col gap-3 px-4 pb-4 sm:gap-4 sm:px-6 sm:pb-6"
  >
    <NavVariant />
    <NavTonic />
    <NavDisplay />
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { storeToRefs } from 'pinia';
import { Note, Scale } from 'tonal';
import { computed, onMounted, ref, watch } from 'vue';

import NavDisplay from '../components/NavDisplay.vue';
import NavTonic from '../components/NavTonic.vue';
import NavVariant from '../components/NavVariant.vue';
import SvgButton from '../components/SvgButton.vue';
import SvgKeyboard from '../components/SvgKeyboard.vue';
import SvgPath from '../components/SvgPath.vue';
import { useKeyboard } from '../composables/useKeyboard';
import { colors } from '../data/index';
import { useStore } from '../stores/main';

useHead({ title: 'Bandoneon keyboard, chords and scales – Bandoneon.app' });

useKeyboard();

const store = useStore();
const { chordNotes, chordType, keyPositions, scaleType, showColors, side, tonic } =
  storeToRefs(store);

const isModified = ref(false);
const userSelection = ref<Record<string, boolean>>({});

const getScaleColor = (octave: number) => {
  return colors[(octave - 1) % colors.length] || '';
};

const scalePaths = computed(() => {
  if (!tonic.value || !scaleType.value) return [];
  const { intervals, empty } = Scale.get(scaleType.value);
  if (empty) return [];
  const paths = [];
  for (let o = -1; o < 7; o++) {
    const scaleNotes = intervals.map((i) => Note.transpose(`${tonic.value}${o}`, i));
    scaleNotes.push(`${tonic.value}${o + 1}`);
    let pathString = '';
    for (const note of scaleNotes) {
      const no = Note.get(note);
      const pos = keyPositions.value.find((v) => Note.get(v[2]).height === no.height);
      if (pos) {
        pathString += `${pathString === '' ? 'M' : 'L'}${pos[0] + 30},${pos[1] + 30}`;
      }
    }
    paths.push(pathString);
  }
  return paths;
});

const resetUserSelection = () => {
  userSelection.value = {};
  isModified.value = false;
};

watch([side, tonic, chordType], resetUserSelection);

const selected = computed(() => {
  if (isModified.value) return userSelection.value;

  const result: Record<string, boolean> = {};

  const chord = chordNotes.value;
  if (chord) {
    for (let i = 0; i <= chord.length; i++) {
      if (chord[i]) result[chord[i] || ''] = true;
    }
  }
  return result;
});

function color(tonal: string) {
  if (showColors.value) {
    let octave = +tonal.slice(1);
    if (tonal[1] === '#') octave = +tonal.slice(2);
    return colors[octave % colors.length] + '80';
  }
  return 'transparent';
}

const toggle = (tonal: string) => {
  if (!isModified.value) {
    userSelection.value = { ...selected.value };
    isModified.value = true;
  }
  if (userSelection.value[tonal]) {
    delete userSelection.value[tonal];
  } else {
    userSelection.value[tonal] = true;
  }
};

onMounted(() => store.$reset());
</script>
