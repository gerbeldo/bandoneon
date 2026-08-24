// What a game page needs to run practice: the start card's numbers, the
// scheduler-drawn session behind the Start button, and the summary. Pages keep
// only prompt rendering and answer capture (ADR 0004).

import { computed, nextTick, ref, shallowRef } from 'vue';

import { instruments } from '../data/index';
import { useStore } from '../stores/main';
import { usePracticeStore } from '../stores/practice';
import { useSettingsStore } from '../stores/settings';
import { introductionOrder } from '../utils/introduction';
import type { SessionScope } from '../utils/scheduler';
import { createWeightedScheduler, sessionPreview } from '../utils/scheduler';
import type { AnswerOutcome, Prompt, QuizDirection, SessionEngine } from '../utils/session';
import { createSession, createSweep, layoutGrid, shuffledOrder } from '../utils/session';

// The card gates play: nothing starts without a tap or Enter, and dismissing
// the summary comes back here.
export type SessionPhase = 'card' | 'playing' | 'summary';

// A page hands back what the player did, not how long it took — the composable
// holds the response clock.
export type Response = { pitch: string } | { tappedIndex: number };

export function useSession(options: { quizDirection: QuizDirection; mode: string }) {
  const store = useStore();
  const settings = useSettingsStore();
  const practice = usePracticeStore();

  const phase = ref<SessionPhase>('card');
  const engine = shallowRef<SessionEngine | null>(null);
  const prompt = ref<Prompt | null>(null);
  // Re-read after each answer: a duplicate-pitch follow-up grows it mid-run.
  const total = ref(0);
  // Per answer, [wrong, partial, correct]; a follow-up counts as its own answer.
  const counts = ref<[number, number, number]>([0, 0, 0]);
  // What the summary's primary action repeats.
  const ran = ref<'session' | 'sweep'>('session');
  // The layout the player picked on the card, restored when a session that
  // crossed layouts hands the page back.
  let chosenLayout = { side: store.side, direction: store.direction };
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

  // Stamped when the card appears, so the info line reads as of that moment
  // rather than silently drifting while the card sits open.
  const shownAt = ref(Date.now());

  const preview = computed(() =>
    sessionPreview({
      pool: pool.value,
      memory: practice.items,
      scope: drawScope.value,
      now: shownAt.value,
    }),
  );

  // The prompt stays on the answered one while a page runs its feedback pause,
  // so the count advances only when the next prompt appears.
  const answeredCount = computed(() => (prompt.value ? prompt.value.index : total.value));

  function begin(started: SessionEngine, kind: 'session' | 'sweep') {
    chosenLayout = { side: store.side, direction: store.direction };
    engine.value = started;
    ran.value = kind;
    counts.value = [0, 0, 0];
    total.value = started.total;
    phase.value = 'playing';
    next();
  }

  function start() {
    if (!layouts.value) return;
    const draw = createWeightedScheduler().draw({
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
    begin(
      createSweep({
        grid: layoutGrid(layouts.value, store.side, store.direction),
        instrument: settings.instrument,
        side: store.side,
        direction: store.direction,
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
    store.side = prompt.value.side;
    store.direction = prompt.value.direction;
    // The response clock starts once the prompt is rendered and accepting input.
    void nextTick(() => {
      armedAt = Date.now();
    });
  }

  function answer(response: Response): AnswerOutcome | null {
    if (!engine.value || !prompt.value) return null;
    const outcome = engine.value.answer({ ...response, elapsedMs: Date.now() - armedAt });
    counts.value[outcome.grade] += 1;
    total.value = engine.value.total;
    return outcome;
  }

  function toCard() {
    store.side = chosenLayout.side;
    store.direction = chosenLayout.direction;
    engine.value = null;
    prompt.value = null;
    shownAt.value = Date.now();
    phase.value = 'card';
  }

  return {
    phase,
    scope,
    preview,
    prompt,
    total,
    counts,
    answeredCount,
    ran,
    start,
    sweep,
    again,
    next,
    answer,
    toCard,
  };
}
