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
import { useSettingsStore } from '../../stores/settings';
import { introductionOrder } from '../../utils/introduction';
import Game from '../game.vue';

const GREEN = '#22c55e88';
const YELLOW = '#eab30888';
const RED = '#ef444488';

let cleanup: (() => void) | null = null;

function mount(legacySettings?: Record<string, unknown>) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useStore();
  const settings = useSettingsStore();
  const practice = usePracticeStore();
  // Mimics App.vue hydrating a persisted blob; stale keys must not change behavior.
  if (legacySettings) settings.$patch(legacySettings as never);

  const i18n = createI18n({ legacy: false, messages: { en }, locale: 'en', fallbackLocale: 'en' });
  const app = createApp({ render: () => h(Game as never) });
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
const octaveButtons = (container: HTMLElement) =>
  buttons(container).filter((b) => /^\d$/.test(b.textContent?.trim() ?? ''));
const noteButton = (container: HTMLElement, pc: string) =>
  buttons(container).find((b) => b.textContent?.trim() === pc.replace('#', '♯'));
const circles = (container: HTMLElement) => [...container.querySelectorAll('.keyboard > g circle')];
const click = (button?: HTMLElement) =>
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const buttonNamed = (container: HTMLElement, text: string) =>
  buttons(container).find((b) => b.textContent?.trim() === text);

// Play never begins without a tap: every test that wants a run starts one from
// the card.
async function startSweep(container: HTMLElement) {
  click(buttonNamed(container, en.one_layout));
  await nextTick();
  click(buttonNamed(container, en.sweep_layout));
  await nextTick();
}

async function startSession(container: HTMLElement) {
  click(buttonNamed(container, en.start_session));
  await nextTick();
}

// Math.random is constant, so the shuffle keeps the layout order and the
// session's first prompt is keyPositions[0].
function firstPrompt(store: ReturnType<typeof useStore>) {
  const solution = store.keyPositions[0][2];
  return { pc: solution.slice(0, -1), octave: solution.slice(-1) };
}

async function answer(container: HTMLElement, store: ReturnType<typeof useStore>, pc: string) {
  click(noteButton(container, pc));
  await nextTick();
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.1);
});

afterEach(() => {
  cleanup?.();
  cleanup = null;
  vi.restoreAllMocks();
});

describe('note game', () => {
  it('always demands the octave, even for a legacy blob that said easy', async () => {
    const { container, store } = mount({ difficulty: 'easy' });
    await startSweep(container);

    expect(octaveButtons(container).length).toBeGreaterThan(0);

    // A note alone must not grade — the prompt waits for the octave.
    await answer(container, store, firstPrompt(store).pc);
    for (const circle of circles(container)) {
      expect([GREEN, YELLOW, RED]).not.toContain(circle.getAttribute('fill'));
    }
  });

  it('keeps octave buttons disabled until a note is picked', async () => {
    const { container, store } = mount();
    await startSweep(container);

    for (const button of octaveButtons(container)) expect(button.disabled).toBe(true);

    await answer(container, store, firstPrompt(store).pc);
    for (const button of octaveButtons(container)) expect(button.disabled).toBe(false);
  });

  it('grades the right note in the wrong octave yellow (partial credit)', async () => {
    const { container, store } = mount();
    await startSweep(container);

    const { pc, octave } = firstPrompt(store);
    await answer(container, store, pc);
    click(octaveButtons(container).find((b) => b.textContent?.trim() !== octave));
    await nextTick();

    expect(circles(container)[0].getAttribute('fill')).toBe(YELLOW);
  });

  it('grades the right note in the right octave green', async () => {
    const { container, store } = mount();
    await startSweep(container);

    const { pc, octave } = firstPrompt(store);
    await answer(container, store, pc);
    click(octaveButtons(container).find((b) => b.textContent?.trim() === octave));
    await nextTick();

    expect(circles(container)[0].getAttribute('fill')).toBe(GREEN);
  });
});

// With the constant-random shuffle the first prompt is the layout's first
// button: rheinische142 right open, row 0, column 2 (B6).
const FIRST_KEY = 'rheinische142/right/open/0/2/forward';

describe('note game recording', () => {
  it('writes one answer event immediately per answer; abandoning keeps them', async () => {
    const { container, store, practice } = mount();
    await startSweep(container);

    const { pc, octave } = firstPrompt(store);
    await answer(container, store, pc);
    click(octaveButtons(container).find((b) => b.textContent?.trim() === octave));
    await nextTick();

    // Written the moment the octave lands, not at sweep end.
    expect(Object.keys(practice.items)).toEqual([FIRST_KEY]);
    const event = practice.items[FIRST_KEY].answers[0];
    expect(event.grade).toBe(2);
    expect(event.mode).toBe('note-game');

    // Abandon mid-sweep: nothing is lost, nothing new appears.
    cleanup?.();
    cleanup = null;
    expect(practice.items[FIRST_KEY].answers).toHaveLength(1);
  });

  it('grades through the engine: wrong octave records a 1, wrong note a 0', async () => {
    const { container, store, practice } = mount();
    await startSweep(container);

    const { pc, octave } = firstPrompt(store);
    await answer(container, store, pc);
    click(octaveButtons(container).find((b) => b.textContent?.trim() !== octave));
    await nextTick();

    expect(practice.items[FIRST_KEY].answers[0].grade).toBe(1);

    // Second prompt is G#6 (row 0, column 3); C is a different pitch class.
    await answer(container, store, 'C');
    click(octaveButtons(container)[0]);
    await nextTick();

    const secondKey = 'rheinische142/right/open/0/3/forward';
    expect(practice.items[secondKey].answers[0].grade).toBe(0);
  });

  it('runs the response clock from prompt rendered to the octave choice', async () => {
    let clock = 100_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const { container, store, practice } = mount();
    await startSweep(container);

    const { pc, octave } = firstPrompt(store);
    clock = 101_234;
    await answer(container, store, pc);
    clock = 102_000;
    click(octaveButtons(container).find((b) => b.textContent?.trim() === octave));
    await nextTick();

    expect(practice.items[FIRST_KEY].answers[0].responseMs).toBe(2_000);
  });
});

const dialog = () => document.querySelector('[role="dialog"]');

// Practice memory for items answered correctly yesterday, so they are seen and
// carry a day's worth of sampling weight.
function seed(practice: ReturnType<typeof usePracticeStore>, keys: string[]) {
  const yesterday = Date.now() - 86_400_000;
  for (const key of keys) {
    practice.items[key] = {
      firstSeen: yesterday,
      answers: [{ grade: 2, timestamp: yesterday, responseMs: 1_000, mode: 'note-game' }],
    };
  }
}

// Names C in whatever octave the layout offers first, so the run advances
// whatever the prompt was.
async function answerAnything(container: HTMLElement) {
  click(noteButton(container, 'C'));
  await nextTick();
  click(octaveButtons(container)[0]);
  await nextTick();
}

describe('note game start card', () => {
  const pool = () =>
    introductionOrder({
      instrument: 'rheinische142',
      layouts: instruments.rheinische142,
      quizDirection: 'forward',
    });

  it('lands on the card and starts nothing until the player taps', async () => {
    const { container, practice } = mount();
    await nextTick();

    expect(container.textContent).toContain(en.start_session);
    expect(circles(container)).toHaveLength(0);
    expect(practice.items).toEqual({});
  });

  it('runs a scheduler-drawn session across layouts and ends in a summary', async () => {
    const { container, store, practice } = mount();
    seed(practice, pool().slice(0, 60));
    await nextTick();
    expect(container.textContent).toContain('20 prompts · 3 new left today · 60 of 142 seen');

    await startSession(container);
    const layouts = new Set<string>();
    for (let i = 0; i < 40 && !dialog(); i++) {
      layouts.add(`${store.side}/${store.direction}`);
      await answerAnything(container);
    }

    expect(layouts.size).toBeGreaterThan(1);
    expect(Object.values(practice.items).flatMap((item) => item.answers)).toHaveLength(80);
    expect(dialog()?.textContent).toContain(en.new_session);

    // Dismissing the summary hands the page back to the card.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(container.textContent).toContain(en.start_session);
  });

  it('labels the sweep’s summary as a repeat, not a new session', async () => {
    const { container } = mount();
    await startSweep(container);

    for (let i = 0; i < 40 && !dialog(); i++) await answerAnything(container);

    expect(dialog()?.textContent).toContain(en.try_again);
    expect(dialog()?.textContent).not.toContain(en.new_session);
  });
});
