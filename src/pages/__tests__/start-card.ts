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

export async function startSweep(container: HTMLElement) {
  click(buttonNamed(container, en.one_layout));
  await nextTick();
  click(buttonNamed(container, en.sweep_layout));
  await nextTick();
}

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
