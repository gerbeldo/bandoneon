// @vitest-environment jsdom
import { createHead } from '@unhead/vue/client';
import { createI18n } from 'petite-vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick } from 'vue';

import en from '../../locales/en.json';
import { usePracticeStore } from '../../stores/practice';
import Index from '../index.vue';

let cleanup: (() => void) | null = null;

function mount() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const practice = usePracticeStore();

  const i18n = createI18n({ legacy: false, messages: { en }, locale: 'en', fallbackLocale: 'en' });
  const app = createApp({ render: () => h(Index as never) });
  app.use(pinia);
  app.use(createHead());
  app.use(i18n);

  const container = document.createElement('div');
  document.body.append(container);
  app.mount(container);
  cleanup = () => {
    app.unmount();
    container.remove();
  };
  return { container, practice };
}

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('explore', () => {
  it('records nothing in practice memory, however many buttons are tapped', async () => {
    const { container, practice } = mount();
    await nextTick();

    const buttons = [...container.querySelectorAll('.keyboard > g')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons.slice(0, 5)) {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTick();
    }

    // Taps did land (they toggle selection) …
    expect(container.querySelectorAll('.keyboard > g.selected').length).toBeGreaterThan(0);
    // … but Explore never writes practice memory (ADR 0004).
    expect(practice.items).toEqual({});
  });
});
