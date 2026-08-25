// @vitest-environment jsdom
import { createHead } from '@unhead/vue/client';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import App from '../../App.vue';
import { useStore } from '../../stores/main';
import { usePracticeStore } from '../../stores/practice';
import { defaultPracticeSetup, useSettingsStore } from '../../stores/settings';

let cleanup: (() => void) | null = null;

async function mountApp() {
  const pinia = createPinia();
  setActivePinia(pinia);

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => h('div') }) }],
  });
  const app = createApp({ render: () => h(App as never) });
  app.use(pinia);
  app.use(router);
  app.use(createHead());
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

    expect(JSON.parse(localStorage.getItem('settings')!).version).toBe(2);
    expect(JSON.parse(localStorage.getItem('practice')!)).toEqual({ version: 1, items: {} });
  });

  it('migrates a legacy settings blob on boot, dropping difficulty and locale', async () => {
    localStorage.setItem(
      'settings',
      JSON.stringify({ instrument: 'rheinische142', locale: 'es', difficulty: 'easy' }),
    );

    await mountApp();

    const settings = useSettingsStore();
    expect(settings.instrument).toBe('rheinische142');
    expect('difficulty' in settings.$state).toBe(false);
    expect('locale' in settings.$state).toBe(false);
    const persisted = JSON.parse(localStorage.getItem('settings')!);
    expect(persisted.version).toBe(2);
    expect('difficulty' in persisted).toBe(false);
    expect('locale' in persisted).toBe(false);
  });

  it('backs up a corrupt practice blob and starts fresh on boot', async () => {
    localStorage.setItem('practice', '{corrupt');

    await mountApp();

    expect(usePracticeStore().items).toEqual({});
    expect(localStorage.getItem('practice.backup')).toBe('{corrupt');
    expect(JSON.parse(localStorage.getItem('practice')!)).toEqual({ version: 1, items: {} });
  });

  it('falls back field by field when the stored practice setup is garbage', async () => {
    localStorage.setItem(
      'settings',
      JSON.stringify({
        version: 2,
        instrument: 'rheinische142',
        practiceSetup: { game: 'nope', fixedCount: -3, spelling: 'both', layout: 5 },
      }),
    );

    await mountApp();

    // Every unusable field falls back on its own; the one good value stands.
    expect(useSettingsStore().practiceSetup).toEqual({
      ...defaultPracticeSetup(),
      spelling: 'both',
    });
  });

  it('gives a blob with no practice setup the defaults, and persists them', async () => {
    localStorage.setItem('settings', JSON.stringify({ version: 2, instrument: 'rheinische142' }));

    await mountApp();

    expect(useSettingsStore().practiceSetup).toEqual(defaultPracticeSetup());
    expect(JSON.parse(localStorage.getItem('settings')!).practiceSetup).toEqual(
      defaultPracticeSetup(),
    );
  });

  it('persists a nested setup change the moment it is made', async () => {
    await mountApp();

    const settings = useSettingsStore();
    settings.practiceSetup.scope = 'one';
    settings.practiceSetup.layout.side = 'left';

    expect(JSON.parse(localStorage.getItem('settings')!).practiceSetup).toMatchObject({
      scope: 'one',
      layout: { side: 'left', direction: 'open' },
    });
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
