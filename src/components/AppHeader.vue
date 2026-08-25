<template>
  <nav class="mx-auto flex min-h-14 w-full shrink-0 items-center px-2 py-1">
    <!-- Phones have no room for the wordmark beside three links: the icon stands in. -->
    <RouterLink
      class="inline-flex min-h-12 items-center justify-center rounded-lg px-2 text-lg font-semibold select-none sm:px-4 sm:text-xl"
      to="/"
      aria-label="Bandoneon.app"
    >
      <IconBandoneon class="h-8 w-8 sm:hidden" />
      <span class="hidden sm:inline">Bandoneon.app</span>
    </RouterLink>
    <div class="flex flex-1 items-center text-sm">
      <RouterLink
        class="inline-flex min-h-12 items-center justify-center rounded-lg px-1 select-none sm:px-3"
        :class="linkClass('/')"
        to="/"
      >
        Explore
      </RouterLink>
      <RouterLink
        class="inline-flex min-h-12 items-center justify-center rounded-lg px-1 select-none sm:px-3"
        :class="linkClass('/practice')"
        to="/practice"
      >
        Practice
      </RouterLink>
      <RouterLink
        class="inline-flex min-h-12 items-center justify-center rounded-lg px-1 select-none sm:px-3"
        :class="linkClass('/progress')"
        to="/progress"
      >
        Progress
      </RouterLink>
    </div>
    <div class="flex-none">
      <button
        class="inline-flex h-12 w-10 flex-wrap items-center justify-center rounded-lg font-semibold select-none sm:w-12"
        @click.prevent="isDark = !isDark"
      >
        <IconSun v-if="!isDark" class="h-5 w-5" />
        <IconMoon v-else class="h-5 w-5" />
      </button>
      <button
        class="inline-flex h-12 w-10 flex-wrap items-center justify-center rounded-lg font-semibold select-none sm:w-12"
        type="button"
        title="Settings"
        @click.prevent="showMenu = !showMenu"
      >
        <IconBars3 class="h-5 w-5" />
      </button>
    </div>
  </nav>

  <AppSettings v-if="showMenu" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useDark } from '../composables/useDark';
import AppSettings from './AppSettings.vue';
import IconBandoneon from './icons/IconBandoneon.vue';
import IconBars3 from './icons/IconBars3.vue';
import IconMoon from './icons/IconMoon.vue';
import IconSun from './icons/IconSun.vue';

const route = useRoute();
const showMenu = ref(false);

const { isDark } = useDark();

watch(
  () => route.path,
  () => (showMenu.value = false),
);

function linkClass(path: string): string {
  const active = path === '/' ? route.path === '/' : route.path.startsWith(path);
  return active ? 'font-semibold' : 'text-neutral-500 dark:text-neutral-400';
}
</script>
