// Driving the practice page from a page-mount test: it opens on the setup
// screen, and nothing plays until the setup is used.

import { createHead } from '@unhead/vue/client';
import type { Pinia } from 'pinia';
import { createPinia, setActivePinia } from 'pinia';
import { Note } from 'tonal';
import { createApp, h, nextTick } from 'vue';

import { instruments } from '../../data/index';
import { useStore } from '../../stores/main';
import type { AnswerEvent } from '../../stores/practice';
import { usePracticeStore } from '../../stores/practice';
import type { PracticeSetup } from '../../stores/settings';
import { useSettingsStore } from '../../stores/settings';
import { introductionOrder } from '../../utils/introduction';
import type { ScaleChoice } from '../../utils/scale';
import { CHROMATIC } from '../../utils/scale';
import type { SessionScope } from '../../utils/scheduler';
import { scopedPool } from '../../utils/scheduler';
import type { Direction, QuizDirection, Side } from '../../utils/session';
import { flattenGrid, layoutGrid, parseItemKey } from '../../utils/session';
import { walkKeys } from '../../utils/walk';
import Practice from '../practice.vue';

// The English strings the components render, shared by the tests that match on them.
export const LABELS = {
  start: 'Start',
  // Game cards carry a description too, so these match on `includes`.
  noteGame: 'Note game',
  staffGame: 'Staff game',
  // The scope rows capitalize; the direction badge prints the bare word.
  sideLeft: 'Left',
  sideRight: 'Right',
  pickOpen: 'Open',
  pickClose: 'Close',
  scheduled: 'Scheduled',
  sharps: '♯ Sharps',
  flats: '♭ Flats',
  both: 'Both',
  newSession: 'New session',
  runAgain: 'Run again',
  changeSetup: 'Change setup',
  toWorkOn: 'To work on',
  nothingToDraw: 'Nothing to draw',
  chromatic: 'Chromatic',
  major: 'Major',
  minor: 'Minor',
  upAndDown: 'Up and down',
  // The walk's hint runs on; this much tells it from the other two.
  walkHint: 'Every item in pitch order',
  open: 'open',
  close: 'close',
  twinExpected: 'Two buttons sound this note — tap either one.',
  twinFollowUp: 'Now tap the other button that sounds this note.',
  hintStaffGame:
    'Tap the button that sounds this note. Right note in the wrong octave counts as partial credit.',
} as const;

export const buttonNamed = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

// Game cards print a description under their title, so they match on `includes`.
export const cardNamed = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll<HTMLElement>('[role="radio"]')].find((b) =>
    b.textContent?.includes(text),
  );

// The two number rows read the same as plain digits, so they are told apart by
// the group they sit in.
export const inGroup = (container: HTMLElement, label: string, text: string) =>
  [...container.querySelectorAll<HTMLElement>(`[role="group"][aria-label="${label}"] button`)].find(
    (b) => b.textContent?.trim() === text,
  );

// "Both" heads the Side row, the Direction row, and Accidentals alike, so those
// three are told apart by their group.
export const GROUPS = {
  side: 'Side',
  direction: 'Bellows direction',
  accidentals: 'Accidentals',
  scale: 'Scale',
  key: 'Key',
  items: 'Items',
};

export const range = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="range"][aria-label="Number of items"]');

export const click = (button?: Element) =>
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

export const press = (key: string, target: EventTarget = document) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

// The summary modal teleports to the body, so it is found there, not in the page.
export const dialog = () => document.querySelector('[role="dialog"]');

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

export const pool = (quizDirection: QuizDirection) =>
  introductionOrder({
    instrument: 'rheinische142',
    layouts: instruments.rheinische142,
    quizDirection,
  });

// The item keys a fixed run over a scope prompts, in order: the pool is in
// introduction order, and the constant-random shuffle keeps it.
export const runKeys = (quizDirection: QuizDirection, scope: SessionScope) =>
  scopedPool({ pool: pool(quizDirection), scope });

// How many items a scope holds under a scale — what the Scale hint counts and
// what the fixed-run slider ranges over.
export const scaleItems = (
  quizDirection: QuizDirection,
  scope: SessionScope,
  scale: ScaleChoice = CHROMATIC,
) =>
  scopedPool({ pool: pool(quizDirection), scope, scale, layouts: instruments.rheinische142 })
    .length;

// The item keys a walk prompts, in order: up through the scope's pitches and
// back down, one layout at a time.
export const walkOrder = (
  quizDirection: QuizDirection,
  scope: SessionScope,
  scale: ScaleChoice = CHROMATIC,
) =>
  walkKeys({
    pool: pool(quizDirection),
    memory: {},
    scope,
    scale,
    layouts: instruments.rheinische142,
    now: 0,
    quizDirection,
  });

const grid = (side: Side, direction: Direction) =>
  layoutGrid(instruments.rheinische142, side, direction);

// Buttons of one layout in the keyboard's own render order — the order
// keyPositions and the rendered `.keyboard > g` nodes share.
export const layoutButtons = (side: Side, direction: Direction) =>
  flattenGrid(grid(side, direction));

// One layout's pitches lowest first — the order a walk climbs them in.
export const ascendingPitches = (side: Side, direction: Direction) =>
  layoutButtons(side, direction)
    .map((button) => button.pitch)
    .sort((a, b) => (Note.midi(a) ?? 0) - (Note.midi(b) ?? 0));

// The pitch the note game is asking for: the highlighted button, read off the
// keyboard the store draws.
export function promptedPitch(container: HTMLElement, store: ReturnType<typeof useStore>) {
  const rendered = [...container.querySelectorAll('.keyboard > g')];
  const index = rendered.findIndex((button) => button.classList.contains('selected'));
  return index < 0 ? undefined : store.keyPositions[index][2];
}

// Where on the keyboard an item key's button sits.
export function buttonIndexOf(key: string): number {
  const { side, direction, row, column } = parseItemKey(key);
  return layoutButtons(side, direction).findIndex((b) => b.row === row && b.column === column);
}

// The pitch an item key names, as the layout data spells it.
export function pitchOf(key: string): string {
  const { side, direction, row, column } = parseItemKey(key);
  return grid(side, direction)[row][column];
}

// Patches the stored setup, the way the setup screen's controls do. The scope
// is copied in, so a later tap on a row never edits a test's shared constant.
function patchSetup(
  settings: ReturnType<typeof useSettingsStore>,
  partial: Partial<PracticeSetup>,
) {
  Object.assign(settings.practiceSetup, partial, partial.scope && { scope: { ...partial.scope } });
}

export async function setupRun(
  settings: ReturnType<typeof useSettingsStore>,
  partial: Partial<PracticeSetup>,
) {
  patchSetup(settings, partial);
  await nextTick();
}

export async function start(container: HTMLElement) {
  click(buttonNamed(container, LABELS.start));
  await nextTick();
}

const mounted = new Set<() => void>();

// Unmounts everything this file mounted; tests call it from afterEach, and
// mid-test to abandon a run.
export function unmountPractice() {
  for (const teardown of mounted) teardown();
}

export interface MountOptions {
  // Reuse a pinia to come back to the page in the same browser session.
  pinia?: Pinia;
  setup?: Partial<PracticeSetup>;
  store?: { side: Side; direction: Direction };
}

export function mountPractice(options: MountOptions = {}) {
  const pinia = options.pinia ?? createPinia();
  setActivePinia(pinia);
  const store = useStore();
  const settings = useSettingsStore();
  const practice = usePracticeStore();
  if (options.setup) patchSetup(settings, options.setup);
  if (options.store) store.$patch(options.store);

  // The page reads no route, so no router is installed.
  const app = createApp({ render: () => h(Practice as never) });
  app.use(pinia);
  app.use(createHead());

  const container = document.createElement('div');
  document.body.append(container);
  app.mount(container);

  const unmount = () => {
    if (!mounted.has(unmount)) return;
    mounted.delete(unmount);
    app.unmount();
    container.remove();
  };
  mounted.add(unmount);

  return { container, store, settings, practice, pinia, unmount };
}
