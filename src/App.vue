<template>
  <!-- dvh, not vh: iOS reports vh as the toolbar-less height, so a 100vh page
       always scrolls by the toolbar height. Insets keep it clear of the notch. -->
  <div
    class="tall:h-dvh tall:overflow-hidden flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
  >
    <AppHeader />
    <RouterView />
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue';

import AppFooter from './components/AppFooter.vue';
import AppHeader from './components/AppHeader.vue';
import { instruments } from './data/index';
import { practiceStorage, usePracticeStore } from './stores/practice';
import { settingsStorage, useSettingsStore } from './stores/settings';
import { persistStore } from './utils/storage';

useHead({ title: 'Bandoneon.app' });

const settings = useSettingsStore();

// Versioned localStorage persistence (ADR 0003): migrations run before hydration.
persistStore(settings, settingsStorage, (blob) => {
  if (!(typeof blob.instrument === 'string' && blob.instrument in instruments)) {
    blob.instrument = 'rheinische142';
  }
});

const practice = usePracticeStore();
persistStore(practice, practiceStorage);
</script>
