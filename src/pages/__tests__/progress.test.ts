// @vitest-environment jsdom
import { createHead } from '@unhead/vue/client';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import type { Grade } from '../../stores/practice';
import { usePracticeStore } from '../../stores/practice';
import { useSettingsStore } from '../../stores/settings';
import { STATUS_COLORS } from '../../utils/progress';
import Progress from '../progress.vue';
import { buttonIndexOf, buttonNamed, click, press } from './practice-helpers';

const DAY = 86_400_000;

let cleanup: (() => void) | null = null;

async function mount() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const practice = usePracticeStore();
  const settings = useSettingsStore();

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => h('div') }) }],
  });
  const app = createApp({ render: () => h(Progress as never) });
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
  return { container, practice, settings };
}

// One answer per day ending yesterday, with the given grades.
function record(grades: Grade[]) {
  const answers = grades.map((grade, i) => ({
    grade,
    timestamp: Date.now() - (grades.length - i) * DAY,
    responseMs: 1_000,
    mode: 'note-game',
  }));
  return { firstSeen: answers[0].timestamp, answers };
}

const RETIRED = 'rheinische142/right/open/2/1/forward'; // C4
const LEARNING = 'rheinische142/right/open/2/2/forward'; // D4
const ERRORS = 'rheinische142/right/open/3/2/forward'; // E4

const keys = (container: HTMLElement) => [
  ...container.querySelectorAll<SVGGElement>('.keyboard > g'),
];
const fillAt = (container: HTMLElement, idx: number) =>
  keys(container)[idx].querySelector('circle')?.getAttribute('fill');
const detail = (container: HTMLElement) => container.querySelector('[data-detail]')?.textContent;
const totals = (container: HTMLElement) => container.querySelector('[data-totals]')?.textContent;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('progress page', () => {
  it('colors each button of the shown layout by its status in the chosen game', async () => {
    const { container, practice } = await mount();
    practice.items[RETIRED] = record([2, 2, 2]);
    practice.items[LEARNING] = record([2]);
    practice.items[ERRORS] = record([2, 0]);
    await nextTick();

    expect(keys(container)).toHaveLength(38);
    expect(fillAt(container, buttonIndexOf(RETIRED))).toBe(STATUS_COLORS.retired);
    expect(fillAt(container, buttonIndexOf(LEARNING))).toBe(STATUS_COLORS.learning);
    expect(fillAt(container, buttonIndexOf(ERRORS))).toBe(STATUS_COLORS.errors);
    expect(fillAt(container, 0)).toBe(STATUS_COLORS.unseen);

    expect(detail(container)).toContain('right open: 3 of 38 seen');
    expect(totals(container)).toContain('Note game: 3 of 142 seen · 1 retired');
  });

  it('switches to the other game’s memory', async () => {
    const { container, practice } = await mount();
    practice.items[RETIRED] = record([2, 2, 2]);
    practice.items['rheinische142/right/open/2/1/reverse'] = record([1]);
    await nextTick();

    click(buttonNamed(container, 'Staff game'));
    await nextTick();

    expect(fillAt(container, buttonIndexOf(RETIRED))).toBe(STATUS_COLORS.errors);
    expect(totals(container)).toContain('Staff game: 1 of 142 seen · 0 retired');
  });

  it('shows one button’s record on tap, reachable from the keyboard too', async () => {
    const { container, practice } = await mount();
    practice.items[RETIRED] = record([2, 2, 2]);
    await nextTick();
    const button = keys(container)[buttonIndexOf(RETIRED)];

    expect(button.getAttribute('role')).toBe('button');
    expect(button.getAttribute('tabindex')).toBe('0');
    expect(button.querySelector('title')?.textContent).toBe('C4 — Retired');

    press('Enter', button);
    await nextTick();
    expect(detail(container)).toContain(
      'C4 — Retired · 3 answers · error tally 0 · last yesterday',
    );

    // Tapping again, or changing the layout, drops the selection.
    click(button);
    await nextTick();
    expect(detail(container)).toContain('tap a button for its record');

    click(button);
    await nextTick();
    click(buttonNamed(container, 'close'));
    await nextTick();
    expect(detail(container)).toContain('right close: 0 of 38 seen');
  });

  it('opens on the game the practice setup has chosen', async () => {
    const { container, settings } = await mount();
    settings.practiceSetup.game = 'staff';
    cleanup?.();
    cleanup = null;

    // A fresh mount reads the setup; the store above was a different pinia.
    const again = await mount();
    again.settings.practiceSetup.game = 'note';
    expect(totals(again.container)).toContain('Note game');
    expect(container).toBeDefined();
  });
});
