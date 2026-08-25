import { createHead } from '@unhead/vue/client';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { routes } from 'vue-router/auto-routes';

import App from './App.vue';

import './style.css';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // The two game pages merged into /practice; old links still land there.
  routes: [
    ...routes,
    { path: '/game', redirect: '/practice' },
    { path: '/staff-game', redirect: '/practice' },
  ],
});

const pinia = createPinia();
const head = createHead();

const app = createApp(App);
app.use(pinia);
app.use(head);
app.use(router);
app.mount('#app');
