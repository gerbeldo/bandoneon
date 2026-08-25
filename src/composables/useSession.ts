// What the practice page needs to run practice: the setup screen's numbers,
// the run behind the Start button, and the summary. Game views keep only
// prompt rendering and answer capture (ADR 0004).

import { computed, nextTick, onScopeDispose, ref, shallowRef } from 'vue';

import { instruments } from '../data/index';
import { useStore } from '../stores/main';
import type { Grade } from '../stores/practice';
import { usePracticeStore } from '../stores/practice';
import type { PracticeGame } from '../stores/settings';
import { useSettingsStore } from '../stores/settings';
import { introductionOrder } from '../utils/introduction';
import type { PoolInput, SessionPreview } from '../utils/scheduler';
import {
  createWeightedScheduler,
  fixedRunKeys,
  previewFixedRun,
  scopedPool,
} from '../utils/scheduler';
import type { AnswerOutcome, Layout, Prompt, QuizDirection, RawAnswer } from '../utils/session';
import { createSession, layoutKey, shuffled } from '../utils/session';
import type { Spelling } from '../utils/spelling';

// The setup screen gates play: nothing runs without a tap or Enter, and
// dismissing the summary comes back to it.
export type PracticePhase = 'setup' | 'playing' | 'summary';

// The quiz direction and the mode tag each game records under.
export const GAMES: Record<PracticeGame, { quizDirection: QuizDirection; mode: string }> = {
  note: { quizDirection: 'forward', mode: 'note-game' },
  staff: { quizDirection: 'reverse', mode: 'staff-game' },
};

// One graded answer of the run, as the summary lists it.
export interface AnsweredPrompt {
  pitch: string;
  spelling: Spelling;
  layout: Layout;
  grade: Grade;
}

export type PracticeSession = ReturnType<typeof useSession>;

export function useSession() {
  const store = useStore();
  const settings = useSettingsStore();
  const practice = usePracticeStore();
  const scheduler = createWeightedScheduler();

  const setup = computed(() => settings.practiceSetup);
  const game = computed(() => GAMES[setup.value.game]);

  const phase = ref<PracticePhase>('setup');
  const engine = shallowRef<ReturnType<typeof createSession> | null>(null);
  const prompt = ref<Prompt | null>(null);
  // Re-read after each answer: a duplicate-pitch follow-up grows it mid-run.
  const total = ref(0);
  // Per answer, [wrong, partial, correct]; a follow-up counts as its own answer.
  const counts = ref<[number, number, number]>([0, 0, 0]);
  // Graded buttons of the run so far, keyed by layout: a session moves the
  // keyboard between prompts, so a button index alone would carry colors across.
  // Each keeps the spelling it was asked under, so a revealed name holds still
  // while later prompts are spelled the other way.
  const results = ref<Record<string, { grade: Grade; spelling: Spelling }>>({});
  // Every answer of the run, in order, for the summary.
  const answers = ref<AnsweredPrompt[]>([]);
  // Which kind of run is on: what the summary's primary action repeats.
  const kind = ref<'scheduled' | 'fixed'>('scheduled');
  let armedAt = 0;

  const layouts = computed(() => instruments[settings.instrument]);

  const pool = computed(() =>
    layouts.value
      ? introductionOrder({
          instrument: settings.instrument,
          layouts: layouts.value,
          quizDirection: game.value.quizDirection,
        })
      : [],
  );

  // Stamped when the setup appears and again when a run begins, so "today"
  // holds still for as long as one screen is up: the summary line does not
  // drift while the setup sits open, and the strip's day does not turn mid-run.
  const asOf = ref(Date.now());

  const poolInput = computed<PoolInput>(() => ({
    pool: pool.value,
    memory: practice.items,
    scope: setup.value.scope,
    now: asOf.value,
  }));

  // How many items the chosen layouts hold — the fixed-run slider's range.
  const poolSize = computed(() => scopedPool(poolInput.value).length);

  // The setup screen's summary line and, during play, the session strip.
  // Practice memory is reactive, so an answer that introduces an item moves
  // the strip at once.
  const preview = computed<SessionPreview>(() =>
    setup.value.pool === 'fixed'
      ? previewFixedRun({ ...poolInput.value, count: setup.value.fixedCount })
      : scheduler.preview({
          ...poolInput.value,
          sessionSize: setup.value.sessionSize,
          dailyNewItems: setup.value.dailyNewItems,
        }),
  );

  // The prompt stays on the answered one while a page runs its feedback pause,
  // so the count advances only when the next prompt appears.
  const answeredCount = computed(() => (prompt.value ? prompt.value.index : total.value));

  // What the strip shows: 1-based, and clamped once the draw is spent.
  const promptNumber = computed(() => Math.min(answeredCount.value + 1, total.value));

  const graded = (buttonIndex: number) =>
    results.value[`${store.side}/${store.direction}/${buttonIndex}`];

  // A setup left open across midnight would keep yesterday's numbers (and a
  // spent cap) until the page reloads; coming back to the tab re-stamps it.
  function refreshDay() {
    if (document.visibilityState === 'visible' && phase.value === 'setup') {
      asOf.value = Date.now();
    }
  }
  document.addEventListener('visibilitychange', refreshDay);
  onScopeDispose(() => document.removeEventListener('visibilitychange', refreshDay));

  function start() {
    if (!layouts.value) return;
    const input = { ...poolInput.value, now: Date.now() };
    const draw =
      setup.value.pool === 'fixed'
        ? shuffled(fixedRunKeys({ ...input, count: setup.value.fixedCount }))
        : scheduler.draw({
            ...input,
            sessionSize: setup.value.sessionSize,
            dailyNewItems: setup.value.dailyNewItems,
          });
    engine.value = createSession({
      layouts: layouts.value,
      instrument: settings.instrument,
      quizDirection: game.value.quizDirection,
      mode: game.value.mode,
      draw,
      spelling: setup.value.spelling,
      record: practice.recordAnswer,
      now: Date.now,
    });
    kind.value = setup.value.pool;
    asOf.value = Date.now();
    counts.value = [0, 0, 0];
    results.value = {};
    answers.value = [];
    total.value = engine.value.total;
    phase.value = 'playing';
    next();
  }

  // The page calls this once its feedback is done; the run ends by itself when
  // the draw is spent.
  function next() {
    prompt.value = engine.value?.prompt() ?? null;
    if (!prompt.value) {
      phase.value = 'summary';
      return;
    }
    // The keyboard follows the prompt across layouts. Spelling travels with the
    // prompt and with each graded button, not with Explore's ♯/♭ toggle.
    store.side = prompt.value.layout.side;
    store.direction = prompt.value.layout.direction;
    // The response clock starts once the prompt is rendered and accepting input.
    void nextTick(() => {
      armedAt = Date.now();
    });
  }

  function answer(raw: RawAnswer): AnswerOutcome | null {
    if (!engine.value || !prompt.value) return null;
    const { layout, pitch, spelling } = prompt.value;
    const outcome = engine.value.answer({ ...raw, elapsedMs: Date.now() - armedAt });
    counts.value[outcome.grade] += 1;
    total.value = engine.value.total;
    results.value[`${layoutKey(layout)}/${outcome.buttonIndex}`] = {
      grade: outcome.grade,
      spelling,
    };
    answers.value.push({ pitch, spelling, layout, grade: outcome.grade });
    return outcome;
  }

  function toSetup() {
    engine.value = null;
    prompt.value = null;
    asOf.value = Date.now();
    phase.value = 'setup';
  }

  return {
    phase,
    preview,
    poolSize,
    prompt,
    total,
    counts,
    answers,
    promptNumber,
    graded,
    kind,
    start,
    next,
    answer,
    toSetup,
  };
}
