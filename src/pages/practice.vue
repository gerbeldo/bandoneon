<template>
  <PracticeSetup v-if="phase === 'setup'" :preview="preview" :pool-size="poolSize" @start="start" />
  <NoteGame v-else-if="game === 'note'" :session="session" />
  <StaffGame v-else :session="session" />
  <SessionSummary
    :open="phase === 'summary'"
    :counts="counts"
    :kind="kind"
    :answers="answers"
    @again="start"
    @dismiss="toSetup"
  />
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { computed } from 'vue';

import NoteGame from '../components/practice/NoteGame.vue';
import PracticeSetup from '../components/practice/PracticeSetup.vue';
import StaffGame from '../components/practice/StaffGame.vue';
import SessionSummary from '../components/SessionSummary.vue';
import { useSession } from '../composables/useSession';
import { useSettingsStore } from '../stores/settings';

useHead({ title: 'Practice – Bandoneon.app' });

// One session behind both games: the setup picks the game, the engine runs
// it, and the game view only renders prompts and captures answers (ADR 0004).
const session = useSession();
const { phase, preview, poolSize, counts, kind, answers, start, toSetup } = session;

const settings = useSettingsStore();
const game = computed(() => settings.practiceSetup.game);
</script>
