// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';

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
  // The staff is 320×224 with the middle line at y 136 and 8 px per step; an
  // exact-ratio rect keeps the test math the drawing's own.
  const rect = { top: 0, left: 0, width: 320, height: 224 } as DOMRect;
  const yOf = (p: number) => 136 - p * 8;

  function stage(side: 'right' | 'left', accidental = '') {
    const mounted = mount(NoteInputStaff, { accidental, side, notation: 'scientific' });
    const svg = mounted.el.querySelector('svg.staff') as SVGSVGElement;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(rect);
    const pointer = (type: string, clientY: number) =>
      svg.dispatchEvent(new PointerEvent(type, { clientY, bubbles: true }));
    return { ...mounted, svg, pointer };
  }

  it('places on press, follows the drag, and submits on lift', async () => {
    const { emitted, svg, pointer } = stage('right');

    pointer('pointerdown', yOf(0)); // the middle line: B4
    await nextTick();
    expect(svg.textContent).toContain('B4');
    expect(emitted).toEqual([]);

    pointer('pointermove', yOf(3)); // up to E5
    await nextTick();
    expect(svg.textContent).toContain('E5');

    pointer('pointerup', yOf(3));
    expect(emitted).toEqual([['place', { letter: 'E', octave: 5 }]]);
  });

  it('clamps to the side’s range: nothing above B6, below A3', () => {
    const { emitted, pointer } = stage('right');

    pointer('pointerdown', yOf(40));
    pointer('pointerup', yOf(40));
    pointer('pointerdown', yOf(-40));
    pointer('pointerup', yOf(-40));

    expect(emitted).toEqual([
      ['place', { letter: 'B', octave: 6 }],
      ['place', { letter: 'A', octave: 3 }],
    ]);
  });

  it('reads the bass staff on the left side', () => {
    const { emitted, pointer } = stage('left');

    pointer('pointerdown', yOf(0)); // bass middle line: D3
    pointer('pointerup', yOf(0));
    expect(emitted).toEqual([['place', { letter: 'D', octave: 3 }]]);
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
    await nextTick();
    expect(svg.querySelector('path[d*="M97"]')).toBeNull(); // no notehead
    expect(emitted).toEqual([]);
  });
});
