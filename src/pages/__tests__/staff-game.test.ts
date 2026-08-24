// @vitest-environment jsdom
import { createHead } from '@unhead/vue/client';
import { createI18n } from 'petite-vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';

import { instruments } from '../../data/index';
import en from '../../locales/en.json';
import { useStore } from '../../stores/main';
import StaffGame from '../staff-game.vue';

let cleanup: (() => void) | null = null;

function mount(side: 'left' | 'right', direction: 'open' | 'close') {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useStore();
  store.$patch({ side, direction });

  const i18n = createI18n({ legacy: false, messages: { en }, locale: 'en', fallbackLocale: 'en' });
  const app = createApp({ render: () => h(StaffGame as never) });
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
  return { container, store };
}

const buttons = (container: HTMLElement) => [...container.querySelectorAll('button')];
const keys = (container: HTMLElement) => [...container.querySelectorAll('.keyboard > g')];

const layoutNotes = (side: 'left' | 'right', direction: 'open' | 'close') =>
  (instruments.rheinische142[side] as Record<string, string[][]>)[direction].flat().filter(Boolean);

beforeEach(() => {
  // Would send the old randomizing newGame() to right/open, whatever the player chose.
  vi.spyOn(Math, 'random').mockReturnValue(0.1);
});

afterEach(() => {
  cleanup?.();
  cleanup = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('staff game', () => {
  it('keeps the side and direction the player chose', () => {
    const { store } = mount('left', 'close');
    expect([store.side, store.direction]).toEqual(['left', 'close']);
  });

  it('renders the side and direction controls, enabled before the first answer', () => {
    const { container } = mount('right', 'open');
    expect(buttons(container).map((b) => b.textContent?.trim())).toEqual([
      'left',
      'right',
      'close',
      'open',
    ]);
    const pressed = buttons(container).filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((b) => b.textContent?.trim())).toEqual(['right', 'open']);
    for (const button of buttons(container)) expect(button.disabled).toBe(false);
  });

  it('quizzes only buttons of the chosen layout', async () => {
    const { container, store } = mount('left', 'close');
    await nextTick();
    const chosen = layoutNotes('left', 'close');

    expect(store.keyPositions.map(([, , tonal]) => tonal).sort()).toEqual([...chosen].sort());
    expect(keys(container)).toHaveLength(chosen.length);
    // Teeth: the other layout would have quizzed a different set.
    expect([...chosen].sort()).not.toEqual([...layoutNotes('right', 'open')].sort());
  });

  it('follows a change of side or direction onto the new layout', async () => {
    const { container, store } = mount('left', 'close');
    store.side = 'right';
    await nextTick();
    expect(keys(container)).toHaveLength(layoutNotes('right', 'close').length);
  });

  it('locks the controls once the round has begun', async () => {
    vi.useFakeTimers();
    const { container } = mount('right', 'open');
    await nextTick();

    keys(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(1000); // past the feedback pause, so currentPosition advances
    await nextTick();

    for (const button of buttons(container)) expect(button.disabled).toBe(true);
  });
});
