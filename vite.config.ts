import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults } from 'vitest/config';
import VueRouter from 'vue-router/vite';

/** @type {import('vite').UserConfig} */
export default defineConfig({
  // Served from https://gerbeldo.github.io/bandoneon/, not a domain root.
  base: '/bandoneon/',
  test: {
    // Agent worktrees under .claude/ carry their own copies of the tests.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
  plugins: [
    tailwindcss(),
    VueRouter(),
    vue(),
    VitePWA({
      // A new build waits for the Reload tap (UpdateBar) instead of taking over mid-run.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Bandoneon.app',
        short_name: 'Bandoneon',
        display: 'standalone',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
