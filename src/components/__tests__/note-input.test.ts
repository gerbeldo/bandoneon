// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';

import { keySpelling } from '../../utils/scale';
import { FLATS, SHARPS } from '../../utils/spelling';
import NoteInputLetters from '../practice/NoteInputLetters.vue';
import NoteInputPiano from '../practice/NoteInputPiano.vue';
import NoteInputStaff from '../practice/NoteInputStaff.vue';
import NoteInputWheel from '../practice/NoteInputWheel.vue';

type Emitted = [string, unknown][];

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Widgets are dumb: props in, events out — no store, so no pinia.
function mount(component: unknown, props: Record<string, unknown>) {
  const emitted: Emitted = [];
  const record = (event: string) => (payload: unknown) => emitted.push([event, payload]);
  const app = createApp({
    render: () =>
      h(component as never, {
        ...props,
        onLetter: record('letter'),
        onAccidental: record('accidental'),
        onKey: record('key'),
        onPlace: record('place'),
      }),
  });
  const el = document.createElement('div');
  document.body.append(el);
  app.mount(el);
  cleanup = () => {
    app.unmount();
    el.remove();
  };
  return { el, emitted };
}

const click = (target?: Element | null) =>
  target?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const byLabel = (el: HTMLElement, label: string) => el.querySelector(`[aria-label="${label}"]`);

const EMPTY_PICK = { letter: null, accidental: '', octave: null };

describe('NoteInputLetters', () => {
  it('offers the seven letters and emits the tapped one', () => {
    const { el, emitted } = mount(NoteInputLetters, { pick: EMPTY_PICK, notation: 'scientific' });

    const letters = el.querySelectorAll('[role="group"][aria-label="Letter"] button');
    expect([...letters].map((b) => b.textContent?.trim())).toEqual([
      'C',
      'D',
      'E',
      'F',
      'G',
      'A',
      'B',
    ]);

    click(byLabel(el, 'E'));
    expect(emitted).toEqual([['letter', 'E']]);
  });

  it('speaks solfège when the notation asks for it', () => {
    const { el } = mount(NoteInputLetters, { pick: EMPTY_PICK, notation: 'solfege' });
    const letters = el.querySelectorAll('[role="group"][aria-label="Letter"] button');
    expect([...letters].map((b) => b.textContent?.trim())).toEqual([
      'Do',
      'Re',
      'Mi',
      'Fa',
      'Sol',
      'La',
      'Si',
    ]);
  });

  it('emits accidentals from the glyph row and presses the picked ones', () => {
    const { el, emitted } = mount(NoteInputLetters, {
      pick: { letter: 'E', accidental: '#', octave: null },
      notation: 'scientific',
    });

    click(byLabel(el, 'Double flat'));
    expect(emitted).toEqual([['accidental', 'bb']]);

    expect(byLabel(el, 'E')?.getAttribute('aria-pressed')).toBe('true');
    expect(byLabel(el, 'Sharp')?.getAttribute('aria-pressed')).toBe('true');
    expect(byLabel(el, 'Natural')?.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('NoteInputPiano', () => {
  it('names black keys by the prompt spelling and taps them as written', () => {
    const sharps = mount(NoteInputPiano, {
      pick: EMPTY_PICK,
      spelling: SHARPS,
      notation: 'scientific',
    });
    click(byLabel(sharps.el, 'C#'));
    expect(sharps.emitted).toEqual([['key', { letter: 'C', accidental: '#' }]]);
    cleanup?.();

    const flats = mount(NoteInputPiano, {
      pick: EMPTY_PICK,
      spelling: FLATS,
      notation: 'scientific',
    });
    expect(byLabel(flats.el, 'C#')).toBeNull();
    click(byLabel(flats.el, 'Db'));
    expect(flats.emitted).toEqual([['key', { letter: 'D', accidental: 'b' }]]);
  });

  it('taps a white key as its natural', () => {
    const { el, emitted } = mount(NoteInputPiano, {
      pick: EMPTY_PICK,
      spelling: SHARPS,
      notation: 'scientific',
    });
    click(byLabel(el, 'F'));
    expect(emitted).toEqual([['key', { letter: 'F', accidental: '' }]]);
  });

  it('follows a key spelling: F♯ major names its E♯ key so', () => {
    const spelling = keySpelling({ kind: 'major', tonic: 6 })!;
    const { el, emitted } = mount(NoteInputPiano, {
      pick: EMPTY_PICK,
      spelling,
      notation: 'scientific',
    });

    click(byLabel(el, 'E#'));
    expect(emitted).toEqual([['key', { letter: 'E', accidental: '#' }]]);
  });

  it('lights the key of the picked pitch class, spelled either way', () => {
    const { el } = mount(NoteInputPiano, {
      pick: { letter: 'E', accidental: '#', octave: null },
      spelling: SHARPS,
      notation: 'scientific',
    });
    // E# sounds F: the F key carries the pressed tint.
    expect(byLabel(el, 'F')?.classList.contains('pressed')).toBe(true);
  });
});

describe('NoteInputWheel', () => {
  it('offers the seven letters outside and the signs inside', () => {
    const { el, emitted } = mount(NoteInputWheel, { pick: EMPTY_PICK, notation: 'scientific' });

    click(byLabel(el, 'G'));
    click(byLabel(el, 'Double sharp'));
    click(byLabel(el, 'Natural'));
    expect(emitted).toEqual([
      ['letter', 'G'],
      ['accidental', '##'],
      ['accidental', ''],
    ]);
  });

  it('marks the picked letter and sign', () => {
    const { el } = mount(NoteInputWheel, {
      pick: { letter: 'A', accidental: 'b', octave: null },
      notation: 'scientific',
    });
    expect(byLabel(el, 'A')?.classList.contains('selected')).toBe(true);
    expect(byLabel(el, 'Flat')?.classList.contains('selected')).toBe(true);
    expect(byLabel(el, 'Natural')?.classList.contains('selected')).toBe(false);
  });
});

describe('NoteInputStaff', () => {
  // The staff is 320×336 with the middle line at y 204 and 12 px per step; an
  // exact-ratio rect keeps the test math the drawing's own.
  const rect = { top: 0, left: 0, width: 320, height: 336 } as DOMRect;
  const yOf = (p: number) => 204 - p * 12;
  // Past the 500 ms rest a lifted note takes before it submits itself.
  const REST = 600;

  // The real layouts' compasses as staff positions, as NoteInput derives them.
  const RANGES = { right: [-8, 14], left: [-8, 12] } as const;

  function stage(side: 'right' | 'left', accidental = '') {
    vi.useFakeTimers();
    const props = reactive({
      accidental,
      side,
      notation: 'scientific',
      range: RANGES[side],
      feedback: null as string | null,
    });
    const mounted = mount(NoteInputStaff, props);
    const svg = mounted.el.querySelector('svg.staff') as SVGSVGElement;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(rect);
    const pointer = (
      type: string,
      clientY: number,
      init: { pointerType?: string; timeStamp?: number } = {},
    ) => {
      const event = new PointerEvent(type, { clientY, bubbles: true });
      if (init.pointerType)
        Object.defineProperty(event, 'pointerType', { value: init.pointerType });
      if (init.timeStamp !== undefined)
        Object.defineProperty(event, 'timeStamp', { value: init.timeStamp });
      svg.dispatchEvent(event);
    };
    // A press-and-lift at one spot, rested out so it submits.
    const tap = (clientY: number) => {
      pointer('pointerdown', clientY);
      pointer('pointerup', clientY);
      vi.advanceTimersByTime(REST);
    };
    return { ...mounted, svg, pointer, tap, props };
  }

  it('places on press, follows the drag, and rests on lift before submitting', async () => {
    const { emitted, svg, pointer } = stage('right');

    pointer('pointerdown', yOf(0)); // the middle line: B4
    await nextTick();
    expect(svg.textContent).toContain('B4');
    expect(emitted).toEqual([]);

    pointer('pointermove', yOf(3)); // up to E5
    await nextTick();
    expect(svg.textContent).toContain('E5');

    // Lifting leaves the note resting on the staff; the rest running out submits.
    pointer('pointerup', yOf(3));
    await nextTick();
    expect(svg.textContent).toContain('E5');
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(REST);
    expect(emitted).toEqual([['place', { letter: 'E', octave: 5 }]]);
  });

  it('lets a resting note be picked back up before it submits', async () => {
    const { emitted, svg, pointer } = stage('right');

    pointer('pointerdown', yOf(0));
    pointer('pointerup', yOf(0));
    vi.advanceTimersByTime(300); // inside the rest: not yet submitted
    expect(emitted).toEqual([]);

    pointer('pointerdown', yOf(5)); // pick it back up somewhere else
    await nextTick();
    expect(svg.textContent).toContain('G5');
    pointer('pointerup', yOf(5));
    vi.advanceTimersByTime(REST);

    expect(emitted).toEqual([['place', { letter: 'G', octave: 5 }]]);
  });

  it('shrugs off the fingertip’s roll in the moment of lifting', () => {
    const { emitted, pointer } = stage('right');

    pointer('pointerdown', yOf(3), { timeStamp: 0 });
    pointer('pointermove', yOf(3), { timeStamp: 500 }); // held on E5
    pointer('pointermove', yOf(2), { timeStamp: 960 }); // the roll, one step down
    pointer('pointerup', yOf(2), { timeStamp: 1000 });
    vi.advanceTimersByTime(REST);

    expect(emitted).toEqual([['place', { letter: 'E', octave: 5 }]]);
  });

  it('keeps a deliberate last-moment slide', () => {
    const { emitted, pointer } = stage('right');

    pointer('pointerdown', yOf(0), { timeStamp: 0 });
    pointer('pointermove', yOf(5), { timeStamp: 970 }); // a real move, five steps
    pointer('pointerup', yOf(5), { timeStamp: 1000 });
    vi.advanceTimersByTime(REST);

    expect(emitted).toEqual([['place', { letter: 'G', octave: 5 }]]);
  });

  it('rides the preview above a touching finger', async () => {
    const { svg, pointer } = stage('right');

    // The finger sits two staff spaces (48 px) below the note it steers.
    pointer('pointerdown', yOf(0) + 48, { pointerType: 'touch' });
    await nextTick();
    expect(svg.textContent).toContain('B4');
  });

  it('colors the placed note while feedback shows, and clears it after', async () => {
    const { emitted, svg, pointer, tap, props } = stage('right');

    tap(yOf(0));
    expect(emitted).toEqual([['place', { letter: 'B', octave: 4 }]]);

    props.feedback = '#22c55e';
    await nextTick();
    expect(svg.querySelector('path[fill="#22c55e"]')).not.toBeNull();

    // The pointer is dead while the result shows.
    pointer('pointerdown', yOf(5));
    await nextTick();
    expect(svg.textContent).toContain('B4');
    expect(svg.textContent).not.toContain('G5');

    props.feedback = null;
    await nextTick();
    expect(svg.textContent).not.toContain('B4');
    expect(svg.querySelector('path[fill="#22c55e"]')).toBeNull();
  });

  it('clamps to the side’s range: nothing above B6, below A3', () => {
    const { emitted, tap } = stage('right');

    tap(yOf(40));
    tap(yOf(-40));

    expect(emitted).toEqual([
      ['place', { letter: 'B', octave: 6 }],
      ['place', { letter: 'A', octave: 3 }],
    ]);
  });

  it('reads the bass staff on the left side', () => {
    const { emitted, tap } = stage('left');

    tap(yOf(0)); // bass middle line: D3
    expect(emitted).toEqual([['place', { letter: 'D', octave: 3 }]]);
  });

  it('reaches the left hand’s top: B4 places, nothing above it', () => {
    const { emitted, tap } = stage('left');

    tap(yOf(40));
    expect(emitted).toEqual([['place', { letter: 'B', octave: 4 }]]);
  });

  it('shows the chosen sign on the preview and emits row taps', async () => {
    const { el, emitted, svg, pointer } = stage('right', 'b');

    pointer('pointerdown', yOf(1));
    await nextTick();
    expect(svg.textContent).toContain('C♭5');

    click(byLabel(el, 'Double sharp'));
    expect(emitted).toEqual([['accidental', '##']]);
  });

  it('moving without pressing places nothing', async () => {
    const { emitted, svg, pointer } = stage('right');

    pointer('pointermove', yOf(2));
    pointer('pointerup', yOf(2));
    vi.advanceTimersByTime(REST);
    await nextTick();
    expect(svg.querySelector('path[d*="M97"]')).toBeNull(); // no notehead
    expect(emitted).toEqual([]);
  });
});
