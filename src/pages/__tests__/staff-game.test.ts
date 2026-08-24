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
import { introductionOrder } from '../../utils/introduction';
import StaffGame from '../staff-game.vue';
import { buttonNamed, click, dialog, seed, startSession, startSweep } from './start-card';

let cleanup: (() => void) | null = null;

function mount(
  side: 'left' | 'right',
  direction: 'open' | 'close',
  existing?: ReturnType<typeof createPinia>,
) {
  const pinia = existing ?? createPinia();
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
  return { container, store, practice, pinia };
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

  it('offers the side and direction controls on the card, prefilled with the last layout', async () => {
    const { container } = mount('right', 'open');
    click(buttonNamed(container, en.one_layout));
    await nextTick();

    expect(buttons(container).map((b) => b.textContent?.trim())).toEqual([
      en.all_layouts,
      en.one_layout,
      'left',
      'right',
      'close',
      'open',
      en.start_session,
      en.sweep_layout,
    ]);
    const pressed = buttons(container).filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((b) => b.textContent?.trim())).toEqual([en.one_layout, 'right', 'open']);
    for (const button of buttons(container)) expect(button.disabled).toBe(false);
  });

  it('quizzes only buttons of the chosen layout', async () => {
    const { container, store } = mount('left', 'close');
    await startSweep(container);
    const chosen = layoutNotes('left', 'close');

    expect(store.keyPositions.map(([, , tonal]) => tonal).sort()).toEqual([...chosen].sort());
    expect(keys(container)).toHaveLength(chosen.length);
    // Teeth: the other layout would have quizzed a different set.
    expect([...chosen].sort()).not.toEqual([...layoutNotes('right', 'open')].sort());
  });

  it('follows a change of side or direction on the card onto the new layout', async () => {
    const { container, store } = mount('left', 'close');
    click(buttonNamed(container, en.one_layout));
    await nextTick();
    click(buttonNamed(container, 'right'));
    await nextTick();
    click(buttonNamed(container, en.sweep_layout));
    await nextTick();

    expect(store.side).toBe('right');
    expect(keys(container)).toHaveLength(layoutNotes('right', 'close').length);
  });

  it('shows the run’s layout read-only, so the bellows direction stays visible', async () => {
    vi.useFakeTimers();
    const { container } = mount('right', 'close');
    await startSweep(container);

    expect(buttons(container).map((b) => b.textContent?.trim())).toEqual([
      'left',
      'right',
      'close',
      'open',
    ]);
    const pressed = buttons(container).filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((b) => b.textContent?.trim())).toEqual(['right', 'close']);
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
    await startSweep(container);

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
    await startSweep(container);

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
    await startSweep(container);

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
    await startSweep(container);

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
    await startSweep(container);
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
    await startSweep(container);
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

const text = (container: HTMLElement) => container.textContent ?? '';

// Item keys of one layout, in the grid's own order.
function layoutKeys(side: 'left' | 'right', direction: 'open' | 'close'): string[] {
  const grid = (instruments.rheinische142[side] as Record<string, string[][]>)[direction];
  const found: string[] = [];
  grid.forEach((row, r) =>
    row.forEach((pitch, c) => {
      if (pitch) found.push(`rheinische142/${side}/${direction}/${r}/${c}/reverse`);
    }),
  );
  return found;
}

// Taps the first button of whatever layout is showing until the summary opens.
async function playOut(container: HTMLElement, onPrompt?: () => void) {
  for (let i = 0; i < 40 && !dialog(); i++) {
    onPrompt?.();
    tap(container, 0);
    vi.advanceTimersByTime(1_000);
    await nextTick();
  }
}

describe('start card', () => {
  it('lands on the card and starts nothing until the player taps', async () => {
    const { container, practice } = mount('right', 'open');
    await nextTick();

    expect(text(container)).toContain(en.start_session);
    expect(keys(container)).toHaveLength(0);
    expect(practice.items).toEqual({});
  });

  it('shows the session size, new items left today, and pool coverage', async () => {
    const { container, practice } = mount('right', 'open');
    seed(practice, layoutKeys('right', 'open').slice(0, 5), 'staff-game');
    await nextTick();

    expect(text(container)).toContain('8 prompts · 3 new left today · 5 of 142 seen');
  });

  it('narrows the coverage to the chosen layout, keeping the shared daily cap', async () => {
    const { container, practice } = mount('right', 'open');
    seed(
      practice,
      [...layoutKeys('right', 'open').slice(0, 5), ...layoutKeys('left', 'close').slice(0, 7)],
      'staff-game',
    );
    await nextTick();
    expect(text(container)).toContain('15 prompts · 3 new left today · 12 of 142 seen');

    click(buttonNamed(container, en.one_layout));
    await nextTick();
    expect(text(container)).toContain('8 prompts · 3 new left today · 5 of 38 seen');
  });

  it('offers the sweep only in the one-layout state', async () => {
    const { container } = mount('right', 'open');
    await nextTick();
    expect(buttonNamed(container, en.sweep_layout)).toBeUndefined();

    click(buttonNamed(container, en.one_layout));
    await nextTick();
    expect(buttonNamed(container, en.sweep_layout)).toBeDefined();

    click(buttonNamed(container, en.all_layouts));
    await nextTick();
    expect(buttonNamed(container, en.sweep_layout)).toBeUndefined();
  });

  it('cannot start an empty session when the day’s new items are spent', async () => {
    const { container, practice } = mount('right', 'open');
    // Three items introduced today, none of them on left/close.
    const today = Date.now();
    for (const key of layoutKeys('right', 'open').slice(0, 3)) {
      practice.items[key] = {
        firstSeen: today,
        answers: [{ grade: 2, timestamp: today, responseMs: 1_000, mode: 'staff-game' }],
      };
    }
    await nextTick();
    click(buttonNamed(container, en.one_layout));
    await nextTick();
    click(buttonNamed(container, 'left'));
    click(buttonNamed(container, 'close'));
    await nextTick();

    expect(text(container)).toContain('0 prompts · 0 new left today · 0 of 33 seen');
    expect(buttonNamed(container, en.start_session)?.disabled).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await nextTick();
    expect(keys(container)).toHaveLength(0);

    // The sweep is still open to the player.
    click(buttonNamed(container, en.sweep_layout));
    await nextTick();
    expect(keys(container).length).toBeGreaterThan(0);
  });

  it('starts a session on Enter', async () => {
    const { container } = mount('right', 'open');
    await nextTick();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await nextTick();

    expect(keys(container).length).toBeGreaterThan(0);
    expect(buttonNamed(container, en.start_session)).toBeUndefined();
  });

  it('starts a session on Enter after the player has touched the scope control', async () => {
    const { container } = mount('right', 'open');
    await nextTick();
    const scopeButton = buttonNamed(container, en.one_layout);
    click(scopeButton);
    await nextTick();

    scopeButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nextTick();

    expect(keys(container).length).toBeGreaterThan(0);
  });

  it('leaves Enter on the sweep button to the sweep', async () => {
    const { container, practice } = mount('right', 'open');
    await nextTick();
    click(buttonNamed(container, en.one_layout));
    await nextTick();

    const sweepButton = buttonNamed(container, en.sweep_layout);
    sweepButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nextTick();

    // Nothing started: the button's own Enter would have swept, and jsdom does
    // not synthesize that click, so the card is still up.
    expect(buttonNamed(container, en.start_session)).toBeDefined();
    expect(practice.items).toEqual({});
  });

  it('keeps the scope for this game through the browser session, and resets on a fresh visit', async () => {
    const first = mount('right', 'open');
    click(buttonNamed(first.container, en.one_layout));
    await nextTick();
    expect(first.store.sessionScope).toEqual({ forward: 'all', reverse: 'one' });

    // Coming back to the page in the same browser session.
    cleanup?.();
    const again = mount('right', 'open', first.pinia);
    await nextTick();
    const pressed = buttons(again.container).filter(
      (b) => b.getAttribute('aria-pressed') === 'true',
    );
    expect(pressed.map((b) => b.textContent?.trim())).toContain(en.one_layout);

    // A fresh visit: a new store, back to all layouts.
    cleanup?.();
    const fresh = mount('right', 'open');
    await nextTick();
    expect(fresh.store.sessionScope.reverse).toBe('all');
    expect(buttonNamed(fresh.container, en.sweep_layout)).toBeUndefined();
  });
});

describe('sessions', () => {
  const pool = () =>
    introductionOrder({
      instrument: 'rheinische142',
      layouts: instruments.rheinische142,
      quizDirection: 'reverse',
    });

  it('draws 20 prompts that cross layouts under the default scope', async () => {
    vi.useFakeTimers();
    const { container, store, practice } = mount('right', 'open');
    seed(practice, pool().slice(0, 60), 'staff-game');
    await nextTick();
    await startSession(container);

    expect(text(container)).toContain('1 / 20');

    const layouts = new Set<string>();
    await playOut(container, () => layouts.add(`${store.side}/${store.direction}`));

    expect(layouts.size).toBeGreaterThan(1);
    expect(Object.values(practice.items).flatMap((item) => item.answers)).toHaveLength(80);
  });

  it('shows each prompt’s own layout as a session crosses them', async () => {
    vi.useFakeTimers();
    const { container, store, practice } = mount('right', 'open');
    seed(practice, pool().slice(0, 60), 'staff-game');
    await nextTick();
    await startSession(container);

    const shown = new Set<string>();
    await playOut(container, () => {
      const pressed = buttons(container)
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map((b) => b.textContent?.trim());
      expect(pressed).toEqual([store.side, store.direction]);
      shown.add(pressed.join('/'));
    });

    expect(shown.size).toBeGreaterThan(1);
  });

  it('keeps a scoped session inside its layout', async () => {
    vi.useFakeTimers();
    const { container, store, practice } = mount('left', 'close');
    seed(practice, layoutKeys('left', 'close'), 'staff-game');
    await nextTick();
    click(buttonNamed(container, en.one_layout));
    await nextTick();
    await startSession(container);

    const layouts = new Set<string>();
    await playOut(container, () => layouts.add(`${store.side}/${store.direction}`));

    expect([...layouts]).toEqual(['left/close']);
  });

  it('ends in a summary that starts another session of the same scope, then returns to the card', async () => {
    vi.useFakeTimers();
    const { container, store, practice } = mount('right', 'open');
    seed(practice, layoutKeys('right', 'open').slice(0, 4), 'staff-game');
    await nextTick();
    click(buttonNamed(container, en.one_layout));
    await nextTick();
    await startSession(container);
    await playOut(container);

    expect(dialog()?.textContent).toContain(en.new_session);
    expect(dialog()?.textContent).toMatch(/\d+ correct/);

    // One tap starts the next session, same scope.
    click(buttonNamed(document.body, en.new_session));
    await nextTick();
    expect(dialog()).toBeNull();
    expect(store.sessionScope.reverse).toBe('one');
    expect(keys(container).length).toBeGreaterThan(0);

    // Dismissing the summary hands the page back to the card.
    await playOut(container);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(dialog()).toBeNull();
    expect(text(container)).toContain(en.start_session);
  });

  it('keeps the layout the player picked through a chain of all-layout sessions', async () => {
    vi.useFakeTimers();
    const { container, store, practice } = mount('right', 'open');
    seed(practice, pool().slice(0, 60), 'staff-game');
    await nextTick();
    // Pick a layout, then hand the scope back to all layouts.
    click(buttonNamed(container, en.one_layout));
    await nextTick();
    click(buttonNamed(container, 'left'));
    click(buttonNamed(container, 'close'));
    await nextTick();
    click(buttonNamed(container, en.all_layouts));
    await nextTick();

    await startSession(container);
    await playOut(container);
    // Chaining from the summary must not adopt the last prompt's layout.
    click(buttonNamed(document.body, en.new_session));
    await nextTick();
    await playOut(container);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();

    expect([store.side, store.direction]).toEqual(['left', 'close']);
  });

  it('abandons silently when the player navigates away, keeping the answers', async () => {
    vi.useFakeTimers();
    const { container, practice } = mount('right', 'open');
    seed(practice, pool().slice(0, 60), 'staff-game');
    await nextTick();
    await startSession(container);

    tap(container, 0);
    vi.advanceTimersByTime(1_000);
    await nextTick();
    const answered = Object.values(practice.items).flatMap((item) => item.answers).length;

    cleanup?.();
    cleanup = null;

    expect(dialog()).toBeNull();
    expect(Object.values(practice.items).flatMap((item) => item.answers)).toHaveLength(answered);
  });
});
