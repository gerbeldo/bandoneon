// @vitest-environment jsdom
import { createHead } from '@unhead/vue/client';
import { createI18n } from 'petite-vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import App from '../../App.vue';
import en from '../../locales/en.json';
import { useStore } from '../../stores/main';
import { usePracticeStore } from '../../stores/practice';
import { useSettingsStore } from '../../stores/settings';

let cleanup: (() => void) | null = null;

async function mountApp() {
  const pinia = createPinia();
  setActivePinia(pinia);

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => h('div') }) }],
  });
  const i18n = createI18n({ legacy: false, messages: { en }, locale: 'en', fallbackLocale: 'en' });

  const app = createApp({ render: () => h(App as never) });
  app.use(pinia);
  app.use(router);
  app.use(createHead());
  app.use(i18n);
  await router.isReady();

  const container = document.createElement('div');
  document.body.append(container);
  app.mount(container);
  cleanup = () => {
    app.unmount();
    container.remove();
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('app boot persistence', () => {
  it('persists both versioned blobs on a first visit', async () => {
    await mountApp();

    expect(JSON.parse(localStorage.getItem('settings')!).version).toBe(1);
    expect(JSON.parse(localStorage.getItem('practice')!)).toEqual({ version: 1, items: {} });
  });

  it('migrates a legacy settings blob on boot, dropping only difficulty', async () => {
    localStorage.setItem(
      'settings',
      JSON.stringify({ instrument: 'rheinische142', locale: 'es', difficulty: 'easy' }),
    );

    await mountApp();

    const settings = useSettingsStore();
    expect(settings.locale).toBe('es');
    expect('difficulty' in settings.$state).toBe(false);
    const persisted = JSON.parse(localStorage.getItem('settings')!);
    expect(persisted.version).toBe(1);
    expect('difficulty' in persisted).toBe(false);
  });

  it('backs up a corrupt practice blob and starts fresh on boot', async () => {
    localStorage.setItem('practice', '{corrupt');

    await mountApp();

    expect(usePracticeStore().items).toEqual({});
    expect(localStorage.getItem('practice.backup')).toBe('{corrupt');
    expect(JSON.parse(localStorage.getItem('practice')!)).toEqual({ version: 1, items: {} });
  });

  it('falls back to the default instrument when the stored one no longer exists', async () => {
    // A stored blob naming an instrument the app no longer has.
    localStorage.setItem('settings', JSON.stringify({ version: 1, instrument: 'rheinische152' }));

    await mountApp();

    expect(useSettingsStore().instrument).toBe('rheinische142');
    // The fallback ran before hydration, so the keyboard has buttons to draw.
    expect(useStore().keyPositions.length).toBeGreaterThan(0);
  });
});
