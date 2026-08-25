import { createHead } from '@unhead/vue/client';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { routes } from 'vue-router/auto-routes';

import App from './App.vue';

import './style.css';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

const pinia = createPinia();
const head = createHead();

const app = createApp(App);
app.use(pinia);
app.use(head);
app.use(router);
app.mount('#app');
