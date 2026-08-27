// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import type { PracticeSetup } from '../../stores/settings';
import type { Layout } from '../../utils/session';
import {
  badge,
  buttonIndexOf,
  buttonNamed,
  click,
  dialog,
  DIRECTION_COLORS,
  LABELS,
  mountPractice,
  pitchOf,
  pool,
  press,
  runKeys,
  seed,
  setupRun,
  start,
  unmountPractice,
} from './practice-helpers';

const GREEN = '#22c55e88';
const YELLOW = '#eab30888';
const RED = '#ef444488';

const RIGHT_OPEN: Layout = { side: 'right', direction: 'open' };

// The old sweep: every item of one layout, once. A fixed run wider than any
// layout is the same thing, and ignores the daily cap.
const fixedRun = (layout: Layout, fixedCount = 999): Partial<PracticeSetup> => ({
  game: 'note',
  scope: layout,
  pool: 'fixed',
  fixedCount,
});

const buttons = (container: HTMLElement) => [...container.querySelectorAll('button')];
const octaveButtons = (container: HTMLElement) =>
  buttons(container).filter((b) => /^\d$/.test(b.textContent?.trim() ?? ''));
const letterButton = (container: HTMLElement, letter: string) =>
  container.querySelector<HTMLButtonElement>(
    `[role="group"][aria-label="Letter"] button[aria-label="${letter}"]`,
  );
const accidentalButton = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
const circles = (container: HTMLElement) => [...container.querySelectorAll('.keyboard > g circle')];

// Math.random is constant, so the shuffle keeps the introduction order and a
// fixed run prompts the scoped pool in that order.
const NOTE_KEYS = runKeys('forward', RIGHT_OPEN);
// rheinische142 right open: C4 (row 2, column 1), then B3 (row 3, column 1).
const FIRST_KEY = NOTE_KEYS[0];
const SECOND_KEY = NOTE_KEYS[1];

// The circle of the first prompt's button, wherever it sits on the keyboard.
const promptedCircle = (container: HTMLElement) => circles(container)[buttonIndexOf(FIRST_KEY)];

function firstPrompt() {
  const pitch = pitchOf(FIRST_KEY);
  return { pc: pitch.slice(0, -1), octave: pitch.slice(-1) };
}

// Names a pitch class the letters way: the letter, then the sharp if it has one.
async function answer(container: HTMLElement, pc: string) {
  click(letterButton(container, pc[0]));
  await nextTick();
  if (pc.includes('#')) {
    click(accidentalButton(container, 'Sharp'));
    await nextTick();
  }
}

// Names C in whatever octave the layout offers first, so the run advances
// whatever the prompt was.
async function answerAnything(container: HTMLElement) {
  click(letterButton(container, 'C'));
  await nextTick();
  click(octaveButtons(container)[0]);
  await nextTick();
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.1);
});

afterEach(() => {
  unmountPractice();
  vi.restoreAllMocks();
});

describe('note game', () => {
  it('always demands the octave, even for a legacy blob that said easy', async () => {
    const { container, settings } = mountPractice();
    // Mimics App.vue hydrating a persisted blob; stale keys must not change behavior.
    settings.$patch({ difficulty: 'easy' } as never);
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    expect(octaveButtons(container).length).toBeGreaterThan(0);

    // A note alone must not grade — the prompt waits for the octave.
    await answer(container, firstPrompt().pc);
    for (const circle of circles(container)) {
      expect([GREEN, YELLOW, RED]).not.toContain(circle.getAttribute('fill'));
    }
  });

  it('keeps octave buttons disabled until a note is picked', async () => {
    const { container, settings } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    for (const button of octaveButtons(container)) expect(button.disabled).toBe(true);

    await answer(container, firstPrompt().pc);
    for (const button of octaveButtons(container)) expect(button.disabled).toBe(false);
  });

  it('grades the right note in the wrong octave yellow (partial credit)', async () => {
    const { container, settings } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    const { pc, octave } = firstPrompt();
    await answer(container, pc);
    click(octaveButtons(container).find((b) => b.textContent?.trim() !== octave));
    await nextTick();

    expect(promptedCircle(container).getAttribute('fill')).toBe(YELLOW);
  });

  it('grades the right note in the right octave green', async () => {
    const { container, settings } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    const { pc, octave } = firstPrompt();
    await answer(container, pc);
    click(octaveButtons(container).find((b) => b.textContent?.trim() === octave));
    await nextTick();

    expect(promptedCircle(container).getAttribute('fill')).toBe(GREEN);
  });
});

describe('note game recording', () => {
  it('writes one answer event immediately per answer; abandoning keeps them', async () => {
    const { container, settings, practice } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    const { pc, octave } = firstPrompt();
    await answer(container, pc);
    click(octaveButtons(container).find((b) => b.textContent?.trim() === octave));
    await nextTick();

    // Written the moment the octave lands, not at the end of the run.
    expect(Object.keys(practice.items)).toEqual([FIRST_KEY]);
    const event = practice.items[FIRST_KEY].answers[0];
    expect(event.grade).toBe(2);
    expect(event.mode).toBe('note-game');

    // Abandon mid-run: nothing is lost, nothing new appears.
    unmountPractice();
    expect(practice.items[FIRST_KEY].answers).toHaveLength(1);
  });

  it('grades through the engine: wrong octave records a 1, wrong note a 0', async () => {
    const { container, settings, practice } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    const { pc, octave } = firstPrompt();
    await answer(container, pc);
    click(octaveButtons(container).find((b) => b.textContent?.trim() !== octave));
    await nextTick();

    expect(practice.items[FIRST_KEY].answers[0].grade).toBe(1);

    // Second prompt is B3; C is a different pitch class.
    await answer(container, 'C');
    click(octaveButtons(container)[0]);
    await nextTick();

    expect(practice.items[SECOND_KEY].answers[0].grade).toBe(0);
  });

  it('runs the response clock from prompt rendered to the octave choice', async () => {
    let clock = 100_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const { container, settings, practice } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    const { pc, octave } = firstPrompt();
    clock = 101_234;
    await answer(container, pc);
    clock = 102_000;
    click(octaveButtons(container).find((b) => b.textContent?.trim() === octave));
    await nextTick();

    expect(practice.items[FIRST_KEY].answers[0].responseMs).toBe(2_000);
  });
});

describe('note game runs', () => {
  it('runs a scheduler-drawn session across layouts and ends in a summary', async () => {
    const { container, store, practice } = mountPractice();
    seed(practice, pool('forward').slice(0, 60), 'note-game');
    await nextTick();
    expect(container.textContent).toContain('20 prompts');
    expect(container.textContent).toContain('3 new · 60 of 142 seen');

    await start(container);
    const layouts = new Set<string>();
    for (let i = 0; i < 40 && !dialog(); i++) {
      layouts.add(`${store.side}/${store.direction}`);
      await answerAnything(container);
    }

    expect(layouts.size).toBeGreaterThan(1);
    expect(Object.values(practice.items).flatMap((item) => item.answers)).toHaveLength(80);
    expect(dialog()?.textContent).toContain(LABELS.newSession);

    // Dismissing the summary hands the page back to the setup.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(container.textContent).toContain(LABELS.start);
  });

  it('labels a fixed run’s summary as a repeat, not a new session', async () => {
    const { container, settings } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    for (let i = 0; i < 60 && !dialog(); i++) await answerAnything(container);

    expect(dialog()?.textContent).toContain(LABELS.runAgain);
    expect(dialog()?.textContent).not.toContain(LABELS.newSession);
  });
});

describe('note game direction badge', () => {
  it('replaces the setup screen with the game alone — no strip, no hint text', async () => {
    const { container, practice } = mountPractice();
    seed(practice, pool('forward').slice(0, 60), 'note-game');
    await nextTick();
    await start(container);

    // The setup's controls are gone; only the input rows remain.
    expect(buttonNamed(container, LABELS.sideLeft)).toBeUndefined();
    expect(buttonNamed(container, LABELS.start)).toBeUndefined();
    expect(container.textContent).not.toContain('Prompt 1 of');
    expect(container.textContent).not.toContain('Name the highlighted button');
  });

  it('badges an open prompt in blue, with the word inside', async () => {
    const { container, settings } = mountPractice();
    await setupRun(settings, fixedRun({ side: 'right', direction: 'open' }));
    await start(container);

    expect(badge(container)?.getAttribute('data-direction')).toBe('open');
    expect(badge(container)?.textContent).toContain(LABELS.open);
    expect(badge(container)?.className).toContain(DIRECTION_COLORS.open);
  });

  it('badges a close prompt in orange, with the word inside', async () => {
    const { container, settings } = mountPractice();
    await setupRun(settings, fixedRun({ side: 'right', direction: 'close' }));
    await start(container);

    expect(badge(container)?.getAttribute('data-direction')).toBe('close');
    expect(badge(container)?.textContent).toContain(LABELS.close);
    expect(badge(container)?.className).toContain(DIRECTION_COLORS.close);
  });

  // Pinned to a box that tracks the drawing, not to the page's spare room —
  // that is what keeps it off the buttons whatever slack the layout leaves.
  it('hangs the badge off the keyboard’s own box, not the page’s spare room', async () => {
    const { container, settings } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    expect(badge(container)?.closest('.keyboard-ghost')).not.toBeNull();
  });
});

describe('note game inputs', () => {
  it('grades by sound: B♯3 answers a C4 prompt green', async () => {
    const { container, settings, practice } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    // First prompt is C4; B♯3 sounds the very same pitch.
    await answer(container, 'B#');
    click(octaveButtons(container).find((b) => b.textContent?.trim() === '3'));
    await nextTick();

    expect(promptedCircle(container).getAttribute('fill')).toBe(GREEN);
    expect(practice.items[FIRST_KEY].answers[0].grade).toBe(2);
  });

  it('shows the pick on the prompted button as the player wrote it', async () => {
    const { container, settings } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    await answer(container, 'E');
    click(accidentalButton(container, 'Sharp'));
    await nextTick();

    const prompted = [...container.querySelectorAll('.keyboard > g')].find((key) =>
      key.classList.contains('selected'),
    );
    expect(prompted?.textContent?.replace(/\s+/g, '')).toBe('E♯');
  });

  it('answers from the desktop keys: letter, then digit', async () => {
    const { container, settings, practice } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    const { pc, octave } = firstPrompt();
    press(pc[0].toLowerCase());
    await nextTick();
    press(octave);
    await nextTick();

    expect(practice.items[FIRST_KEY].answers[0].grade).toBe(2);
  });

  it('the staff input places by position and needs no octave row', async () => {
    const { container, settings, practice } = mountPractice();
    settings.noteInput = 'staff';
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    expect(octaveButtons(container)).toHaveLength(0);
    const staff = container.querySelector('svg.staff') as SVGSVGElement;
    vi.spyOn(staff, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 0,
      width: 320,
      height: 224,
    } as DOMRect);

    // The staff is 320×224, middle line (B4) at y 136, 8 px per step; C4 sits
    // six steps below it. Press and lift there: the first prompt answered green.
    const y = 136 + 6 * 8;
    staff.dispatchEvent(new PointerEvent('pointerdown', { clientY: y, bubbles: true }));
    staff.dispatchEvent(new PointerEvent('pointerup', { clientY: y, bubbles: true }));
    await nextTick();

    expect(practice.items[FIRST_KEY].answers[0].grade).toBe(2);
  });
});
