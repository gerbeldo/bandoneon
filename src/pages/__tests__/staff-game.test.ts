// @vitest-environment jsdom
import { createHead } from '@unhead/vue/client';
import { createI18n } from 'petite-vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';

import { instruments } from '../../data/index';
import en from '../../locales/en.json';
import { useStore } from '../../stores/main';
import { usePracticeStore } from '../../stores/practice';
import StaffGame from '../staff-game.vue';

let cleanup: (() => void) | null = null;

function mount(side: 'left' | 'right', direction: 'open' | 'close') {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useStore();
  const practice = usePracticeStore();
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
  return { container, store, practice };
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

const GREEN = '#22c55e88';
const YELLOW = '#eab30888';
const RED = '#ef444488';

const circles = (container: HTMLElement) => [...container.querySelectorAll('.keyboard > g circle')];
const tap = (container: HTMLElement, idx: number) =>
  keys(container)[idx].dispatchEvent(new MouseEvent('click', { bubbles: true }));
const indexOf = (store: ReturnType<typeof useStore>, tonal: string) =>
  store.keyPositions.findIndex(([, , t]) => t === tonal);

// With the constant-random shuffle the sweep prompts in layout order: first
// B6 (row 0, column 2), then G#6 (row 0, column 3) — the note game's keys,
// but with the reverse quiz direction.
const FIRST_KEY = 'rheinische142/right/open/0/2/reverse';
const SECOND_KEY = 'rheinische142/right/open/0/3/reverse';

describe('staff game recording', () => {
  it('writes one answer event immediately, tagged staff-game; abandoning keeps it', async () => {
    vi.useFakeTimers();
    const { container, practice } = mount('right', 'open');
    await nextTick();

    tap(container, 0); // B6, the prompted button
    await nextTick();

    // Written at the tap, not at round end.
    expect(Object.keys(practice.items)).toEqual([FIRST_KEY]);
    const event = practice.items[FIRST_KEY].answers[0];
    expect(event.grade).toBe(2);
    expect(event.mode).toBe('staff-game');
    expect(circles(container)[0].getAttribute('fill')).toBe(GREEN);

    // Abandon mid-pause: the event stays.
    cleanup?.();
    cleanup = null;
    expect(practice.items[FIRST_KEY].answers).toHaveLength(1);
  });

  it('grades like today: yellow on a pitch-class match, red otherwise', async () => {
    vi.useFakeTimers();
    const { container, store, practice } = mount('right', 'open');
    await nextTick();

    // Prompted B6: B3 shares the pitch class — partial credit.
    tap(container, indexOf(store, 'B3'));
    await nextTick();
    expect(practice.items[FIRST_KEY].answers[0].grade).toBe(1);
    expect(circles(container)[0].getAttribute('fill')).toBe(YELLOW);

    vi.advanceTimersByTime(1_000);
    await nextTick();

    // Prompted G#6: C4 is a different pitch class — wrong.
    tap(container, indexOf(store, 'C4'));
    await nextTick();
    expect(practice.items[SECOND_KEY].answers[0].grade).toBe(0);
    expect(circles(container)[1].getAttribute('fill')).toBe(RED);
  });

  it('starts the response clock when the prompt accepts input, after the pause', async () => {
    vi.useFakeTimers();
    const { container, practice } = mount('right', 'open');
    await nextTick();

    vi.advanceTimersByTime(1_500);
    tap(container, 0);
    expect(practice.items[FIRST_KEY].answers[0].responseMs).toBe(1_500);

    // The 900 ms feedback pause must not count toward the next answer.
    vi.advanceTimersByTime(900);
    await nextTick();
    vi.advanceTimersByTime(700);
    tap(container, 1); // G#6, the next prompted button
    expect(practice.items[SECOND_KEY].answers[0].responseMs).toBe(700);
  });

  it('ignores taps during the feedback pause and writes nothing for them', async () => {
    vi.useFakeTimers();
    const { container, practice } = mount('right', 'open');
    await nextTick();

    tap(container, 0);
    vi.advanceTimersByTime(100); // mid-pause
    tap(container, 5);
    await nextTick();

    expect(Object.values(practice.items).flatMap((item) => item.answers)).toHaveLength(1);
  });
});

// 142 right-close sounds E5 on two buttons (rows 4 and 5). With the
// constant-random shuffle the sweep runs in layout order, so answering every
// earlier prompt correctly reaches the first E5.
describe('staff game duplicate-pitch follow-up', () => {
  const FIRST_E5 = 'rheinische142/right/close/4/5/reverse';
  const SECOND_E5 = 'rheinische142/right/close/5/4/reverse';

  async function answerCorrectly(container: HTMLElement, idx: number) {
    tap(container, idx);
    vi.advanceTimersByTime(1_000);
    await nextTick();
  }

  function e5Twins(store: ReturnType<typeof useStore>) {
    const pitches = store.keyPositions.map(([, , t]) => t);
    return { pitches, first: pitches.indexOf('E5'), second: pitches.lastIndexOf('E5') };
  }

  it('marks the twin prompt, then asks for the other E5 and grows the counter to 39', async () => {
    vi.useFakeTimers();
    const { container, store, practice } = mount('right', 'close');
    await nextTick();
    const text = () => container.textContent ?? '';
    const { first, second } = e5Twins(store);
    expect(text()).toContain(en.hint_staff_game);

    for (let i = 0; i < first; i++) await answerCorrectly(container, i);
    expect(text()).toContain(`${first + 1} / 38`);
    expect(text()).toContain(en.twin_expected);

    await answerCorrectly(container, first);
    expect(circles(container)[first].getAttribute('fill')).toBe(GREEN);
    expect(text()).toContain(`${first + 2} / 39`);
    expect(text()).toContain(en.twin_follow_up);

    tap(container, second);
    await nextTick();
    expect(circles(container)[second].getAttribute('fill')).toBe(GREEN);
    expect(practice.items[FIRST_E5].answers.map((a) => a.grade)).toEqual([2]);
    expect(practice.items[SECOND_E5].answers.map((a) => a.grade)).toEqual([2]);

    vi.advanceTimersByTime(1_000);
    await nextTick();
    expect(text()).toContain(`${first + 3} / 39`);
    expect(text()).toContain(en.hint_staff_game);
    expect(text()).not.toContain(en.twin_follow_up);
  });

  it('counts every answer in the summary: a correct sweep with both follow-ups is 40', async () => {
    vi.useFakeTimers();
    const { container, store } = mount('right', 'close');
    await nextTick();
    const { pitches, first, second } = e5Twins(store);

    for (let i = 0; i < pitches.length; i++) {
      await answerCorrectly(container, i);
      // Each E5 prompt is followed by one for the other E5.
      if (pitches[i] === 'E5') await answerCorrectly(container, i === first ? second : first);
    }

    expect(container.textContent).toContain('40 / 40');
    expect(document.body.textContent).toContain('40 correct');
  });
});
