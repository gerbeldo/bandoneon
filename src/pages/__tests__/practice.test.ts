// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import type { PracticeSetup } from '../../stores/settings';
import type { Layout } from '../../utils/session';
import {
  buttonNamed,
  cardNamed,
  click,
  dialog,
  GROUPS,
  inGroup,
  LABELS,
  mountPractice,
  pitchOf,
  press,
  range,
  runKeys,
  setupRun,
  start,
  strip,
  unmountPractice,
} from './practice-helpers';

const RIGHT_OPEN: Layout = { side: 'right', direction: 'open' };
const RIGHT_OPEN_SIZE = 38;
// One side in both directions, and both sides in one direction.
const RIGHT_SIZE = runKeys('forward', { side: 'right', direction: 'both' }).length;
const CLOSE_SIZE = runKeys('forward', { side: 'both', direction: 'close' }).length;

const noteRun = (extra: Partial<PracticeSetup> = {}): Partial<PracticeSetup> => ({
  game: 'note',
  scope: RIGHT_OPEN,
  pool: 'fixed',
  fixedCount: 999,
  ...extra,
});

const buttons = (container: HTMLElement) => [...container.querySelectorAll('button')];
const octaveButtons = (container: HTMLElement) =>
  buttons(container).filter((b) => /^\d$/.test(b.textContent?.trim() ?? ''));
const keys = (container: HTMLElement) => [...container.querySelectorAll('.keyboard > g')];
// jsdom lowercases attribute names in selectors, so `svg[viewBox=…]` never
// matches; the grand staff is found by reading the attribute instead.
const grandStaff = (container: HTMLElement) =>
  [...container.querySelectorAll('svg')].find(
    (svg) => svg.getAttribute('viewBox') === '0 0 240 260',
  );
const text = (container: HTMLElement) => container.textContent ?? '';

// The note game's first prompt on a right/open fixed run: C4.
const FIRST_PITCH = pitchOf(runKeys('forward', RIGHT_OPEN)[0]);

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.1);
});

afterEach(() => {
  unmountPractice();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('practice setup', () => {
  it('lands on the setup and starts nothing until the player taps', async () => {
    const { container, practice } = mountPractice();
    await nextTick();

    expect(text(container)).toContain(LABELS.start);
    expect(keys(container)).toHaveLength(0);
    expect(practice.items).toEqual({});
  });

  it('mounts the game the player picked', async () => {
    const { container, settings } = mountPractice();
    click(cardNamed(container, LABELS.staffGame));
    await nextTick();
    expect(settings.practiceSetup.game).toBe('staff');

    await start(container);
    // The staff game draws a grand staff; the note game a note palette.
    expect(grandStaff(container)).toBeDefined();
    expect(buttonNamed(container, 'C')).toBeUndefined();
  });

  it('mounts the note game with its palette', async () => {
    const { container } = mountPractice();
    click(cardNamed(container, LABELS.noteGame));
    await nextTick();
    await start(container);

    expect(buttonNamed(container, 'C')).toBeDefined();
    expect(grandStaff(container)).toBeUndefined();
  });

  it('opens on all four layouts, and narrows them one axis at a time', async () => {
    const { container, settings } = mountPractice();
    await nextTick();
    const pressed = (group: string) =>
      inGroup(container, group, LABELS.both)?.getAttribute('aria-pressed');
    expect(pressed(GROUPS.side)).toBe('true');
    expect(pressed(GROUPS.direction)).toBe('true');
    expect(text(container)).toContain('4 layouts · 142 items');

    // A side alone keeps both of its directions.
    click(buttonNamed(container, LABELS.sideRight));
    await nextTick();
    expect(settings.practiceSetup.scope).toEqual({ side: 'right', direction: 'both' });
    expect(text(container)).toContain(`2 layouts · ${RIGHT_SIZE} items`);

    // A side and a direction is one layout.
    click(buttonNamed(container, LABELS.pickOpen));
    await nextTick();
    expect(settings.practiceSetup.scope).toEqual(RIGHT_OPEN);
    expect(text(container)).toContain(`1 layout · ${RIGHT_OPEN_SIZE} items`);

    // Either axis widens again on its own.
    click(inGroup(container, GROUPS.side, LABELS.both));
    await nextTick();
    expect(settings.practiceSetup.scope).toEqual({ side: 'both', direction: 'open' });
    expect(text(container)).toContain('2 layouts');
  });
});

describe('practice setup, fixed runs', () => {
  it('bypasses the daily cap: First 20 draws twenty prompts from an untouched pool', async () => {
    const { container } = mountPractice();
    click(buttonNamed(container, 'First 20'));
    await nextTick();

    // Scheduled would offer three — the day's new items — not twenty.
    expect(text(container)).toContain('20 prompts');

    await start(container);
    expect(text(container)).toContain(strip(1, 20, '0 new today', 0, 20));
  });

  it('ranges the slider over the chosen layouts', async () => {
    const { container } = mountPractice({ setup: { pool: 'fixed' } });
    await nextTick();
    expect(range(container)?.max).toBe('142');

    click(buttonNamed(container, LABELS.pickClose));
    await nextTick();
    expect(range(container)?.max).toBe(String(CLOSE_SIZE));

    click(buttonNamed(container, LABELS.sideRight));
    await nextTick();
    expect(range(container)?.max).toBe(
      String(runKeys('forward', { side: 'right', direction: 'close' }).length),
    );
  });

  it('sweeps the whole layout with the slider at its far end, with no quick picks', async () => {
    const { container, settings } = mountPractice({
      setup: { pool: 'fixed', scope: RIGHT_OPEN },
    });
    await nextTick();
    expect(buttonNamed(container, 'All')).toBeUndefined();

    const slider = range(container)!;
    slider.value = slider.max;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    expect(settings.practiceSetup.fixedCount).toBe(RIGHT_OPEN_SIZE);
    expect(text(container)).toContain(`${RIGHT_OPEN_SIZE} prompts`);
  });
});

describe('practice setup, scheduled runs', () => {
  it('writes the two scheduler numbers and previews the draw', async () => {
    const { container, settings } = mountPractice();
    click(inGroup(container, 'Prompts', '10'));
    await nextTick();
    click(inGroup(container, 'New items per day', '5'));
    await nextTick();

    expect(settings.practiceSetup.sessionSize).toBe(10);
    expect(settings.practiceSetup.dailyNewItems).toBe(5);
    // Nothing seen yet, so the day's five new items are the whole draw.
    expect(text(container)).toContain('5 prompts');
  });

  it('has nothing to draw with no new items allowed and nothing seen', async () => {
    const { container } = mountPractice();
    click(inGroup(container, 'New items per day', '0'));
    await nextTick();

    expect(text(container)).toContain(LABELS.nothingToDraw);
    expect(buttonNamed(container, LABELS.start)?.disabled).toBe(true);
  });
});

describe('practice setup, accidentals', () => {
  it('names accidentals as flats through the run', async () => {
    const { container, settings } = mountPractice();
    await setupRun(settings, noteRun({ spelling: 'flat' }));
    click(buttonNamed(container, LABELS.flats));
    await nextTick();
    await start(container);

    expect(buttonNamed(container, 'D♭')).toBeDefined();
    expect(buttonNamed(container, 'C♯')).toBeUndefined();
  });

  it('asks each item once under Both, whichever way it is named', async () => {
    const { container, settings } = mountPractice();
    await setupRun(settings, noteRun());
    click(inGroup(container, GROUPS.accidentals, LABELS.both));
    await nextTick();

    expect(settings.practiceSetup.spelling).toBe('both');
    expect(text(container)).toContain(`${RIGHT_OPEN_SIZE} prompts`);

    await start(container);
    expect(text(container)).toContain(`of ${RIGHT_OPEN_SIZE}`);
  });

  it('leaves the explore screen’s ♯/♭ toggle alone: a sharp run names sharps regardless', async () => {
    const { container, store, settings } = mountPractice();
    store.showEnharmonics = true;
    await setupRun(settings, noteRun({ fixedCount: 1 }));
    await start(container);

    expect(buttonNamed(container, 'C♯')).toBeDefined();
    expect(store.showEnharmonics).toBe(true);

    await answerNote(container, 'C', 0);
    press('Escape');
    await nextTick();

    expect(text(container)).toContain(LABELS.start);
    expect(store.showEnharmonics).toBe(true);
  });
});

describe('practice setup, starting', () => {
  it('starts a run on Enter', async () => {
    const { container } = mountPractice();
    await nextTick();

    press('Enter');
    await nextTick();

    expect(keys(container).length).toBeGreaterThan(0);
    expect(buttonNamed(container, LABELS.start)).toBeUndefined();
  });

  it('starts on Enter after the player has touched a control', async () => {
    const { container } = mountPractice();
    await nextTick();
    const scopeButton = buttonNamed(container, LABELS.sideLeft);
    click(scopeButton);
    await nextTick();

    press('Enter', scopeButton!);
    await nextTick();

    expect(keys(container).length).toBeGreaterThan(0);
  });
});

// Names a note and an octave, the note game's two taps.
async function answerNote(container: HTMLElement, pc: string, octaveIndex: number) {
  click(buttonNamed(container, pc.replace('#', '♯')));
  await nextTick();
  click(octaveButtons(container)[octaveIndex]);
  await nextTick();
}

describe('practice summary', () => {
  // One prompt, answered in the wrong octave: partial credit, and the item
  // lands on the list to work on.
  async function runOnePrompt(extra: Partial<PracticeSetup> = {}) {
    const mounted = mountPractice();
    await setupRun(mounted.settings, noteRun({ fixedCount: 1, ...extra }));
    await start(mounted.container);

    const octave = FIRST_PITCH.slice(-1);
    const wrong = octaveButtons(mounted.container).findIndex(
      (b) => b.textContent?.trim() !== octave,
    );
    await answerNote(mounted.container, FIRST_PITCH.slice(0, -1), wrong);
    return mounted;
  }

  it('lists the missed item and repeats a fixed run', async () => {
    const { container } = await runOnePrompt();

    const summary = dialog() as HTMLElement;
    expect(summary.textContent).toContain('Run complete');
    expect(summary.textContent).toContain('1 partial credit');
    expect(summary.textContent).toContain(LABELS.toWorkOn);
    const chip = [...summary.querySelectorAll('li')].map((li) => li.textContent ?? '');
    expect(chip.some((entry) => entry.includes(FIRST_PITCH))).toBe(true);
    expect(buttonNamed(summary, LABELS.runAgain)).toBeDefined();
    expect(buttonNamed(summary, LABELS.newSession)).toBeUndefined();

    // Change setup hands the page back without starting anything.
    click(buttonNamed(summary, LABELS.changeSetup));
    await nextTick();
    expect(dialog()).toBeNull();
    expect(text(container)).toContain(LABELS.start);
  });

  it('offers a new session after a scheduled run', async () => {
    const { container } = mountPractice();
    press('Enter');
    await nextTick();

    // The default draw is the day's three new items.
    for (let i = 0; i < 5 && !dialog(); i++) await answerNote(container, 'C', 0);

    const summary = dialog() as HTMLElement;
    expect(summary.textContent).toContain('Session complete');
    expect(buttonNamed(summary, LABELS.newSession)).toBeDefined();
    expect(buttonNamed(summary, LABELS.runAgain)).toBeUndefined();
  });
});
