// What a game page needs to run practice: the start card's numbers, the
// scheduler-drawn session behind the Start button, and the summary. Pages keep
// only prompt rendering and answer capture (ADR 0004).

import { computed, nextTick, ref, shallowRef } from 'vue';

import { instruments } from '../data/index';
import { useStore } from '../stores/main';
import type { Grade } from '../stores/practice';
import { usePracticeStore } from '../stores/practice';
import { useSettingsStore } from '../stores/settings';
import { introductionOrder } from '../utils/introduction';
import type { SessionScope } from '../utils/scheduler';
import { createWeightedScheduler } from '../utils/scheduler';
import type { AnswerOutcome, Layout, Prompt, QuizDirection, RawAnswer } from '../utils/session';
import { createSession, createSweep, layoutGrid, layoutKey, shuffledOrder } from '../utils/session';

// The start card gates play: nothing runs without a tap or Enter, and
// dismissing the summary comes back to it.
export type SessionPhase = 'start-card' | 'playing' | 'summary';

export function useSession(options: { quizDirection: QuizDirection; mode: string }) {
  const store = useStore();
  const settings = useSettingsStore();
  const practice = usePracticeStore();
  const scheduler = createWeightedScheduler();

  const phase = ref<SessionPhase>('start-card');
  const engine = shallowRef<ReturnType<typeof createSession> | null>(null);
  const prompt = ref<Prompt | null>(null);
  // Re-read after each answer: a duplicate-pitch follow-up grows it mid-run.
  const total = ref(0);
  // Per answer, [wrong, partial, correct]; a follow-up counts as its own answer.
  const counts = ref<[number, number, number]>([0, 0, 0]);
  // Graded buttons of the run so far, keyed by layout: a session moves the
  // keyboard between prompts, so a button index alone would carry colors across.
  const grades = ref<Record<string, Grade>>({});
  // What the summary's primary action repeats.
  const ran = ref<'session' | 'sweep'>('session');
  // The layout the player picked on the card, restored when a session that
  // crossed layouts hands the page back.
  let chosenLayout: Layout = { side: store.side, direction: store.direction };
  let armedAt = 0;

  const scope = computed({
    get: () => store.sessionScope[options.quizDirection],
    set: (value: 'all' | 'one') => {
      store.sessionScope[options.quizDirection] = value;
    },
  });

  const layouts = computed(() => instruments[settings.instrument]);

  const pool = computed(() =>
    layouts.value
      ? introductionOrder({
          instrument: settings.instrument,
          layouts: layouts.value,
          quizDirection: options.quizDirection,
        })
      : [],
  );

  const drawScope = computed<SessionScope>(() =>
    scope.value === 'all' ? 'all' : { side: store.side, direction: store.direction },
  );

  // Stamped when the card appears and again when a run begins, so "today"
  // holds still for as long as one screen is up: the card's info line does not
  // drift while the card sits open, and the strip's day does not turn mid-run.
  const asOf = ref(Date.now());

  // The card's info line and, during play, the session strip. Practice memory
  // is reactive, so an answer that introduces an item moves the strip at once.
  const preview = computed(() =>
    scheduler.preview({
      pool: pool.value,
      memory: practice.items,
      scope: drawScope.value,
      now: asOf.value,
    }),
  );

  // The prompt stays on the answered one while a page runs its feedback pause,
  // so the count advances only when the next prompt appears.
  const answeredCount = computed(() => (prompt.value ? prompt.value.index : total.value));

  // What the strip shows: 1-based, and clamped once the draw is spent.
  const promptNumber = computed(() => Math.min(answeredCount.value + 1, total.value));

  const gradeOf = (buttonIndex: number): Grade | undefined =>
    grades.value[`${store.side}/${store.direction}/${buttonIndex}`];

  function begin(started: ReturnType<typeof createSession>, kind: 'session' | 'sweep') {
    // Only a run started from the card can change the layout the card offers;
    // chaining sessions from the summary must not repoint it.
    if (phase.value === 'start-card') {
      chosenLayout = { side: store.side, direction: store.direction };
    }
    engine.value = started;
    ran.value = kind;
    asOf.value = Date.now();
    counts.value = [0, 0, 0];
    grades.value = {};
    total.value = started.total;
    phase.value = 'playing';
    next();
  }

  function start() {
    if (!layouts.value) return;
    const draw = scheduler.draw({
      pool: pool.value,
      memory: practice.items,
      scope: drawScope.value,
      now: Date.now(),
    });
    begin(
      createSession({
        layouts: layouts.value,
        instrument: settings.instrument,
        quizDirection: options.quizDirection,
        mode: options.mode,
        draw,
        record: practice.recordAnswer,
        now: Date.now,
      }),
      'session',
    );
  }

  function sweep() {
    if (!layouts.value) return;
    const layout = { side: store.side, direction: store.direction };
    begin(
      createSweep({
        grid: layoutGrid(layouts.value, layout.side, layout.direction),
        layout,
        instrument: settings.instrument,
        quizDirection: options.quizDirection,
        mode: options.mode,
        record: practice.recordAnswer,
        now: Date.now,
        order: shuffledOrder,
      }),
      'sweep',
    );
  }

  function again() {
    if (ran.value === 'sweep') sweep();
    else start();
  }

  // The page calls this once its feedback is done; the run ends by itself when
  // the draw is spent.
  function next() {
    prompt.value = engine.value?.prompt() ?? null;
    if (!prompt.value) {
      phase.value = 'summary';
      return;
    }
    // A session draws across layouts, so the keyboard follows the prompt.
    store.side = prompt.value.layout.side;
    store.direction = prompt.value.layout.direction;
    // The response clock starts once the prompt is rendered and accepting input.
    void nextTick(() => {
      armedAt = Date.now();
    });
  }

  function answer(raw: RawAnswer): AnswerOutcome | null {
    if (!engine.value || !prompt.value) return null;
    const layout = prompt.value.layout;
    const outcome = engine.value.answer({ ...raw, elapsedMs: Date.now() - armedAt });
    counts.value[outcome.grade] += 1;
    total.value = engine.value.total;
    grades.value[`${layoutKey(layout)}/${outcome.buttonIndex}`] = outcome.grade;
    return outcome;
  }

  function toStartCard() {
    store.side = chosenLayout.side;
    store.direction = chosenLayout.direction;
    engine.value = null;
    prompt.value = null;
    asOf.value = Date.now();
    phase.value = 'start-card';
  }

  return {
    phase,
    scope,
    preview,
    prompt,
    total,
    counts,
    promptNumber,
    gradeOf,
    ran,
    start,
    sweep,
    again,
    next,
    answer,
    toStartCard,
  };
}
