// Driving the start card from a page-mount test: both game pages open on it,
// and nothing plays until it is used.

import { nextTick } from 'vue';

import en from '../../locales/en.json';
import type { AnswerEvent, usePracticeStore } from '../../stores/practice';

export const buttonNamed = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

export const click = (button?: HTMLElement) =>
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

// The summary modal teleports to the body, so it is found there, not in the page.
export const dialog = () => document.querySelector('[role="dialog"]');

export async function startSession(container: HTMLElement) {
  click(buttonNamed(container, en.start_session));
  await nextTick();
}

// The layout defaults to whatever the store holds; pass a direction to sweep
// the other one.
export async function startSweep(container: HTMLElement, direction?: 'open' | 'close') {
  click(buttonNamed(container, en.one_layout));
  await nextTick();
  if (direction) {
    click(buttonNamed(container, en[direction]));
    await nextTick();
  }
  click(buttonNamed(container, en.sweep_layout));
  await nextTick();
}

// The direction badge, and the colors the spec names for it.
export const badge = (container: HTMLElement) => container.querySelector('[data-direction]');

export const DIRECTION_COLORS = { open: 'bg-sky-600', close: 'bg-orange-600' } as const;

// The session strip's three segments, joined the way the DOM renders them.
export const strip = (
  promptNumber: number,
  total: number,
  newToday: string,
  seen: number,
  pool: number,
) => `Prompt ${promptNumber} of ${total}·${newToday}·${seen} of ${pool} seen`;

// Practice memory for items answered correctly yesterday, so they count as seen
// and carry a day's worth of sampling weight.
export function seed(
  practice: ReturnType<typeof usePracticeStore>,
  keys: string[],
  mode: AnswerEvent['mode'],
) {
  const yesterday = Date.now() - 86_400_000;
  for (const key of keys) {
    practice.items[key] = {
      firstSeen: yesterday,
      answers: [{ grade: 2, timestamp: yesterday, responseMs: 1_000, mode }],
    };
  }
}
