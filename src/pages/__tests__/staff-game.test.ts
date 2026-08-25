// @vitest-environment jsdom
import { Note } from 'tonal';
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
  layoutButtons,
  mountPractice,
  pitchOf,
  pool,
  press,
  runKeys,
  seed,
  setupRun,
  start,
  strip,
  unmountPractice,
} from './practice-helpers';

const RIGHT_OPEN: Layout = { side: 'right', direction: 'open' };

// The old sweep: every item of one layout, once — a fixed run wider than any
// layout, with no daily cap.
const fixedRun = (layout: Layout, fixedCount = 999): Partial<PracticeSetup> => ({
  game: 'staff',
  scope: 'one',
  layout,
  pool: 'fixed',
  fixedCount,
});

const buttons = (container: HTMLElement) => [...container.querySelectorAll('button')];
const keys = (container: HTMLElement) => [...container.querySelectorAll('.keyboard > g')];
const text = (container: HTMLElement) => container.textContent ?? '';

const layoutPitches = (layout: Layout) =>
  layoutButtons(layout.side, layout.direction).map((button) => button.pitch);

// Item keys of one layout; only their number and their layout matter to the
// tests that seed practice memory.
const layoutKeys = (layout: Layout) => runKeys('reverse', layout);

beforeEach(() => {
  // Would send a randomizing draw to right/open, whatever the player chose.
  vi.spyOn(Math, 'random').mockReturnValue(0.1);
});

afterEach(() => {
  unmountPractice();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('staff game', () => {
  it('keeps the side and direction the player chose', async () => {
    const layout: Layout = { side: 'left', direction: 'close' };
    const { container, store, settings } = mountPractice();
    await setupRun(settings, fixedRun(layout));
    await start(container);

    expect([store.side, store.direction]).toEqual(['left', 'close']);
  });

  it('offers the side and direction controls on the setup, prefilled with the last layout', async () => {
    const { container, settings } = mountPractice({
      setup: { game: 'staff', layout: RIGHT_OPEN },
    });
    click(buttonNamed(container, LABELS.oneLayout));
    await nextTick();

    for (const label of [LABELS.sideLeft, LABELS.sideRight, LABELS.pickOpen, LABELS.pickClose]) {
      expect(buttonNamed(container, label)).toBeDefined();
    }
    const pressed = buttons(container)
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent?.trim());
    expect(pressed).toContain(LABELS.oneLayout);
    expect(pressed).toContain(LABELS.sideRight);
    expect(pressed).toContain(LABELS.pickOpen);
    expect(settings.practiceSetup.layout).toEqual(RIGHT_OPEN);
  });

  it('quizzes only buttons of the chosen layout', async () => {
    const layout: Layout = { side: 'left', direction: 'close' };
    const { container, store, settings } = mountPractice();
    await setupRun(settings, fixedRun(layout));
    await start(container);
    const chosen = layoutPitches(layout);

    expect(store.keyPositions.map(([, , tonal]) => tonal).sort()).toEqual([...chosen].sort());
    expect(keys(container)).toHaveLength(chosen.length);
    // Teeth: the other layout would have quizzed a different set.
    expect([...chosen].sort()).not.toEqual([...layoutPitches(RIGHT_OPEN)].sort());
  });

  it('follows a change of side on the setup onto the new layout', async () => {
    const { container, store, settings } = mountPractice();
    await setupRun(settings, fixedRun({ side: 'left', direction: 'close' }));
    click(buttonNamed(container, LABELS.sideRight));
    await nextTick();
    await start(container);

    expect(store.side).toBe('right');
    expect(keys(container)).toHaveLength(
      layoutPitches({ side: 'right', direction: 'close' }).length,
    );
  });

  it('drops the setup screen during play and names the direction on the badge', async () => {
    vi.useFakeTimers();
    const { container, settings } = mountPractice();
    await setupRun(settings, fixedRun({ side: 'right', direction: 'close' }));
    await start(container);

    // Side is read off the keyboard; direction is the badge's job.
    expect(buttons(container)).toHaveLength(0);
    expect(badge(container)?.textContent).toContain(LABELS.close);
  });
});

const GREEN = '#22c55e88';
const YELLOW = '#eab30888';
const RED = '#ef444488';

const circles = (container: HTMLElement) => [...container.querySelectorAll('.keyboard > g circle')];
const tap = (container: HTMLElement, idx: number) =>
  keys(container)[idx].dispatchEvent(new MouseEvent('click', { bubbles: true }));

const chroma = (pitch: string) => Note.get(pitch).chroma;

// With the constant-random shuffle a fixed run prompts the layout's items in
// introduction order: right open leads with C4, then B3.
const RUN = runKeys('reverse', RIGHT_OPEN);
const FIRST_KEY = RUN[0];
const SECOND_KEY = RUN[1];
const FIRST_BUTTON = buttonIndexOf(FIRST_KEY);
const SECOND_BUTTON = buttonIndexOf(SECOND_KEY);

describe('staff game recording', () => {
  it('writes one answer event immediately, tagged staff-game; abandoning keeps it', async () => {
    vi.useFakeTimers();
    const { container, settings, practice } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    tap(container, FIRST_BUTTON); // the prompted button
    await nextTick();

    // Written at the tap, not at round end.
    expect(Object.keys(practice.items)).toEqual([FIRST_KEY]);
    const event = practice.items[FIRST_KEY].answers[0];
    expect(event.grade).toBe(2);
    expect(event.mode).toBe('staff-game');
    expect(circles(container)[FIRST_BUTTON].getAttribute('fill')).toBe(GREEN);

    // Abandon mid-pause: the event stays.
    unmountPractice();
    expect(practice.items[FIRST_KEY].answers).toHaveLength(1);
  });

  it('grades like today: yellow on a pitch-class match, red otherwise', async () => {
    vi.useFakeTimers();
    const { container, settings, practice } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    const pitches = layoutPitches(RIGHT_OPEN);
    // Prompted C4: another C shares the pitch class — partial credit.
    const otherC = pitches.findIndex(
      (pitch, i) => i !== FIRST_BUTTON && chroma(pitch) === chroma(pitches[FIRST_BUTTON]),
    );
    tap(container, otherC);
    await nextTick();
    expect(practice.items[FIRST_KEY].answers[0].grade).toBe(1);
    expect(circles(container)[FIRST_BUTTON].getAttribute('fill')).toBe(YELLOW);

    vi.advanceTimersByTime(1_000);
    await nextTick();

    // Prompted B3: a button of another pitch class is wrong.
    const otherClass = pitches.findIndex(
      (pitch) => chroma(pitch) !== chroma(pitches[SECOND_BUTTON]),
    );
    tap(container, otherClass);
    await nextTick();
    expect(practice.items[SECOND_KEY].answers[0].grade).toBe(0);
    expect(circles(container)[SECOND_BUTTON].getAttribute('fill')).toBe(RED);
  });

  it('keeps a revealed name as it was asked when the next prompt is spelled the other way', async () => {
    vi.useFakeTimers();
    // A run up to its second accidental: the first is asked as a sharp, the second as a flat.
    const accidentals = RUN.filter((key) => Note.get(pitchOf(key)).acc !== '');
    const count = RUN.indexOf(accidentals[1]) + 1;
    const { container, settings } = mountPractice();
    await setupRun(settings, { ...fixedRun(RIGHT_OPEN, count), spelling: 'both' });
    // The shuffle draws `count` numbers (constant, so the order holds), then one
    // per accidental in draw order: below .5 names it sharp, above names it flat.
    let calls = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => (++calls <= count + 1 ? 0.1 : 0.9));
    await start(container);

    const name = (idx: number) => keys(container)[idx].textContent?.replace(/\s+/g, '') ?? '';
    const first = buttonIndexOf(accidentals[0]);
    const second = buttonIndexOf(accidentals[1]);
    for (let i = 0; i < count - 1; i++) {
      tap(container, buttonIndexOf(RUN[i]));
      await nextTick();
      vi.advanceTimersByTime(1_000);
      await nextTick();
    }

    // The second accidental is now prompted as a flat; the first keeps its sharp.
    expect(name(first)).toContain('♯');
    expect(name(second)).toBe('');
    tap(container, second);
    await nextTick();
    expect(name(second)).toContain('♭');
    expect(name(first)).toContain('♯');
  });

  it('starts the response clock when the prompt accepts input, after the pause', async () => {
    vi.useFakeTimers();
    const { container, settings, practice } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    vi.advanceTimersByTime(1_500);
    tap(container, FIRST_BUTTON);
    expect(practice.items[FIRST_KEY].answers[0].responseMs).toBe(1_500);

    // The 900 ms feedback pause must not count toward the next answer.
    vi.advanceTimersByTime(900);
    await nextTick();
    vi.advanceTimersByTime(700);
    tap(container, SECOND_BUTTON); // the next prompted button
    expect(practice.items[SECOND_KEY].answers[0].responseMs).toBe(700);
  });

  it('ignores taps during the feedback pause and writes nothing for them', async () => {
    vi.useFakeTimers();
    const { container, settings, practice } = mountPractice();
    await setupRun(settings, fixedRun(RIGHT_OPEN));
    await start(container);

    tap(container, FIRST_BUTTON);
    vi.advanceTimersByTime(100); // mid-pause
    tap(container, 5);
    await nextTick();

    expect(Object.values(practice.items).flatMap((item) => item.answers)).toHaveLength(1);
  });
});

// 142 right-close sounds E5 on two buttons. With the constant-random shuffle
// the fixed run prompts in introduction order, so answering every earlier
// prompt correctly reaches the first E5.
describe('staff game duplicate-pitch follow-up', () => {
  const CLOSE: Layout = { side: 'right', direction: 'close' };
  const ORDER = runKeys('reverse', CLOSE);
  const PITCHES = ORDER.map(pitchOf);
  const FIRST_E5 = PITCHES.indexOf('E5');
  const SECOND_E5 = PITCHES.lastIndexOf('E5');
  const buttonAt = (position: number) => buttonIndexOf(ORDER[position]);

  async function answerCorrectly(container: HTMLElement, idx: number) {
    tap(container, idx);
    vi.advanceTimersByTime(1_000);
    await nextTick();
  }

  it('marks the twin prompt, then asks for the other E5 and grows the counter to 39', async () => {
    vi.useFakeTimers();
    const { container, settings, practice } = mountPractice();
    await setupRun(settings, fixedRun(CLOSE));
    await start(container);
    expect(text(container)).toContain(LABELS.hintStaffGame);

    for (let i = 0; i < FIRST_E5; i++) await answerCorrectly(container, buttonAt(i));
    expect(text(container)).toContain(`Prompt ${FIRST_E5 + 1} of 38`);
    expect(text(container)).toContain(LABELS.twinExpected);

    await answerCorrectly(container, buttonAt(FIRST_E5));
    expect(circles(container)[buttonAt(FIRST_E5)].getAttribute('fill')).toBe(GREEN);
    // The follow-up grew the denominator: 38 prompts became 39.
    expect(text(container)).toContain(`Prompt ${FIRST_E5 + 2} of 39`);
    expect(text(container)).toContain(LABELS.twinFollowUp);

    tap(container, buttonAt(SECOND_E5));
    await nextTick();
    expect(circles(container)[buttonAt(SECOND_E5)].getAttribute('fill')).toBe(GREEN);
    expect(practice.items[ORDER[FIRST_E5]].answers.map((a) => a.grade)).toEqual([2]);
    expect(practice.items[ORDER[SECOND_E5]].answers.map((a) => a.grade)).toEqual([2]);

    vi.advanceTimersByTime(1_000);
    await nextTick();
    expect(text(container)).toContain(`Prompt ${FIRST_E5 + 3} of 39`);
    expect(text(container)).toContain(LABELS.hintStaffGame);
    expect(text(container)).not.toContain(LABELS.twinFollowUp);
  });

  it('counts every answer in the summary: a correct run with both follow-ups is 40', async () => {
    vi.useFakeTimers();
    const { container, settings } = mountPractice();
    await setupRun(settings, fixedRun(CLOSE));
    await start(container);

    for (let i = 0; i < ORDER.length; i++) {
      await answerCorrectly(container, buttonAt(i));
      // Each E5 prompt is followed by one for the other E5.
      if (PITCHES[i] === 'E5') {
        await answerCorrectly(container, buttonAt(i === FIRST_E5 ? SECOND_E5 : FIRST_E5));
      }
    }

    expect(text(container)).toContain('Prompt 40 of 40');
    expect(document.body.textContent).toContain('40 correct');
  });
});

// Taps the first button of whatever layout is showing until the summary opens.
async function playOut(container: HTMLElement, onPrompt?: () => void) {
  for (let i = 0; i < 40 && !dialog(); i++) {
    onPrompt?.();
    tap(container, 0);
    vi.advanceTimersByTime(1_000);
    await nextTick();
  }
}

describe('staff game setup', () => {
  it('shows the session size, new items left today, and pool coverage', async () => {
    const { container, practice } = mountPractice({ setup: { game: 'staff' } });
    seed(practice, layoutKeys(RIGHT_OPEN).slice(0, 5), 'staff-game');
    await nextTick();

    expect(text(container)).toContain('8 prompts');
    expect(text(container)).toContain('3 new · 5 of 142 seen');
  });

  it('narrows the coverage to the chosen layout, keeping the shared daily cap', async () => {
    const { container, practice } = mountPractice({ setup: { game: 'staff', layout: RIGHT_OPEN } });
    seed(
      practice,
      [
        ...layoutKeys(RIGHT_OPEN).slice(0, 5),
        ...layoutKeys({ side: 'left', direction: 'close' }).slice(0, 7),
      ],
      'staff-game',
    );
    await nextTick();
    expect(text(container)).toContain('15 prompts');
    expect(text(container)).toContain('3 new · 12 of 142 seen');

    click(buttonNamed(container, LABELS.oneLayout));
    await nextTick();
    expect(text(container)).toContain('8 prompts');
    expect(text(container)).toContain('3 new · 5 of 38 seen');
  });

  it('cannot start an empty session when the day’s new items are spent', async () => {
    vi.useFakeTimers();
    const { container, practice } = mountPractice({ setup: { game: 'staff' } });
    // Three items introduced today, none of them on left/close.
    const today = Date.now();
    for (const key of layoutKeys(RIGHT_OPEN).slice(0, 3)) {
      practice.items[key] = {
        firstSeen: today,
        answers: [{ grade: 2, timestamp: today, responseMs: 1_000, mode: 'staff-game' }],
      };
    }
    await nextTick();
    click(buttonNamed(container, LABELS.oneLayout));
    await nextTick();
    click(buttonNamed(container, LABELS.sideLeft));
    await nextTick();
    click(buttonNamed(container, LABELS.pickClose));
    await nextTick();

    expect(text(container)).toContain(LABELS.nothingToDraw);
    expect(buttonNamed(container, LABELS.start)?.disabled).toBe(true);

    press('Enter');
    await nextTick();
    expect(keys(container)).toHaveLength(0);

    // A fixed run is still open to the player.
    click(buttonNamed(container, 'First 20'));
    await nextTick();
    await start(container);
    expect(keys(container).length).toBeGreaterThan(0);
  });

  it('keeps the setup through the browser session, and resets on a fresh visit', async () => {
    const first = mountPractice({ setup: { game: 'staff' } });
    click(buttonNamed(first.container, LABELS.oneLayout));
    await nextTick();
    expect(first.settings.practiceSetup.scope).toBe('one');

    // Coming back to the page in the same browser session.
    first.unmount();
    const again = mountPractice({ pinia: first.pinia });
    await nextTick();
    expect(again.settings.practiceSetup.scope).toBe('one');
    const pressed = buttons(again.container)
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent?.trim());
    expect(pressed).toContain(LABELS.oneLayout);

    // A fresh visit: a new pinia, back to all layouts.
    again.unmount();
    const fresh = mountPractice();
    await nextTick();
    expect(fresh.settings.practiceSetup.scope).toBe('all');
  });
});

describe('staff game sessions', () => {
  it('draws 20 prompts that cross layouts under the default scope', async () => {
    vi.useFakeTimers();
    const { container, store, practice } = mountPractice({ setup: { game: 'staff' } });
    seed(practice, pool('reverse').slice(0, 60), 'staff-game');
    await nextTick();
    await start(container);

    expect(text(container)).toContain(strip(1, 20, '0 of 3 new today', 60, 142));

    const layouts = new Set<string>();
    await playOut(container, () => layouts.add(`${store.side}/${store.direction}`));

    expect(layouts.size).toBeGreaterThan(1);
    expect(Object.values(practice.items).flatMap((item) => item.answers)).toHaveLength(80);
  });

  it('moves the badge onto each prompt’s own direction as a session crosses layouts', async () => {
    vi.useFakeTimers();
    const { container, store, practice } = mountPractice({ setup: { game: 'staff' } });
    seed(practice, pool('reverse').slice(0, 60), 'staff-game');
    await nextTick();
    await start(container);

    const shown = new Set<string>();
    await playOut(container, () => {
      const badged = badge(container);
      expect(badged?.getAttribute('data-direction')).toBe(store.direction);
      expect(badged?.textContent).toContain(LABELS[store.direction]);
      expect(badged?.className).toContain(DIRECTION_COLORS[store.direction]);
      shown.add(`${store.side}/${store.direction}`);
    });

    expect(shown.size).toBeGreaterThan(1);
  });

  it('keeps a scoped session inside its layout', async () => {
    vi.useFakeTimers();
    const layout: Layout = { side: 'left', direction: 'close' };
    const { container, store, practice } = mountPractice({ setup: { game: 'staff', layout } });
    seed(practice, layoutKeys(layout), 'staff-game');
    await nextTick();
    click(buttonNamed(container, LABELS.oneLayout));
    await nextTick();
    await start(container);

    const layouts = new Set<string>();
    await playOut(container, () => layouts.add(`${store.side}/${store.direction}`));

    expect([...layouts]).toEqual(['left/close']);
  });

  it('ends in a summary that starts another session of the same scope, then returns to the setup', async () => {
    vi.useFakeTimers();
    const { container, settings, practice } = mountPractice({
      setup: { game: 'staff', layout: RIGHT_OPEN },
    });
    seed(practice, layoutKeys(RIGHT_OPEN).slice(0, 4), 'staff-game');
    await nextTick();
    click(buttonNamed(container, LABELS.oneLayout));
    await nextTick();
    await start(container);
    await playOut(container);

    expect(dialog()?.textContent).toContain(LABELS.newSession);
    expect(dialog()?.textContent).toMatch(/\d+ correct/);

    // One tap starts the next session, same scope.
    click(buttonNamed(document.body, LABELS.newSession));
    await nextTick();
    expect(dialog()).toBeNull();
    expect(settings.practiceSetup.scope).toBe('one');
    expect(keys(container).length).toBeGreaterThan(0);

    // Dismissing the summary hands the page back to the setup.
    await playOut(container);
    press('Escape');
    await nextTick();
    expect(dialog()).toBeNull();
    expect(text(container)).toContain(LABELS.start);
  });

  it('keeps the layout the player picked through a chain of all-layout sessions', async () => {
    vi.useFakeTimers();
    const layout: Layout = { side: 'left', direction: 'close' };
    const { container, settings, practice } = mountPractice({ setup: { game: 'staff' } });
    seed(practice, pool('reverse').slice(0, 60), 'staff-game');
    await nextTick();
    // Pick a layout, then hand the scope back to all layouts.
    click(buttonNamed(container, LABELS.oneLayout));
    await nextTick();
    click(buttonNamed(container, LABELS.sideLeft));
    await nextTick();
    click(buttonNamed(container, LABELS.pickClose));
    await nextTick();
    click(buttonNamed(container, LABELS.allLayouts));
    await nextTick();

    await start(container);
    await playOut(container);
    // Chaining from the summary must not adopt the last prompt's layout.
    click(buttonNamed(document.body, LABELS.newSession));
    await nextTick();
    await playOut(container);
    press('Escape');
    await nextTick();

    expect(settings.practiceSetup.layout).toEqual(layout);
  });

  it('abandons silently when the player navigates away, keeping the answers', async () => {
    vi.useFakeTimers();
    const { container, practice } = mountPractice({ setup: { game: 'staff' } });
    seed(practice, pool('reverse').slice(0, 60), 'staff-game');
    await nextTick();
    await start(container);

    tap(container, 0);
    vi.advanceTimersByTime(1_000);
    await nextTick();
    const answered = Object.values(practice.items).flatMap((item) => item.answers).length;

    unmountPractice();

    expect(dialog()).toBeNull();
    expect(Object.values(practice.items).flatMap((item) => item.answers)).toHaveLength(answered);
  });
});
