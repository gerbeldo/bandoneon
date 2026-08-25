// @vitest-environment jsdom
import { createI18n } from 'petite-vue-i18n';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { createApp, h } from 'vue';

import en from '../../locales/en.json';
import { useStore } from '../../stores/main';
import NavVariant from '../NavVariant.vue';

const mount = () => {
  const pinia = createPinia();
  const i18n = createI18n({ legacy: false, messages: { en }, locale: 'en', fallbackLocale: 'en' });
  const app = createApp({ render: () => h(NavVariant as never) });
  app.use(pinia);
  app.use(i18n);
  const container = document.createElement('div');
  app.mount(container);
  const store = useStore(pinia);
  return { container, store };
};

const buttons = (container: HTMLElement) => [...container.querySelectorAll('button')];

describe('NavVariant', () => {
  it('renders enabled buttons that switch side and direction', () => {
    const { container, store } = mount();
    const [left, right, close, open] = buttons(container);

    for (const button of buttons(container)) {
      expect(button.disabled).toBe(false);
    }

    left.click();
    expect(store.side).toBe('left');
    right.click();
    expect(store.side).toBe('right');
    close.click();
    expect(store.direction).toBe('close');
    open.click();
    expect(store.direction).toBe('open');
  });

  it('keeps aria-pressed on the active buttons', () => {
    const { container } = mount();
    const pressed = buttons(container).filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((b) => b.textContent?.trim())).toEqual(['right', 'open']);
  });
});
