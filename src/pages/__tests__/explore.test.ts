// @vitest-environment jsdom
import { createHead } from '@unhead/vue/client';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick } from 'vue';

import { useStore } from '../../stores/main';
import { usePracticeStore } from '../../stores/practice';
import Index from '../index.vue';

let cleanup: (() => void) | null = null;

function mount() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const practice = usePracticeStore();

  const app = createApp({ render: () => h(Index as never) });
  app.use(pinia);
  app.use(createHead());

  const container = document.createElement('div');
  document.body.append(container);
  app.mount(container);
  cleanup = () => {
    app.unmount();
    container.remove();
  };
  return { container, practice };
}

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('explore', () => {
  it('records nothing in practice memory, however many buttons are tapped', async () => {
    const { container, practice } = mount();
    await nextTick();

    const buttons = [...container.querySelectorAll('.keyboard > g')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons.slice(0, 5)) {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTick();
    }

    // Taps did land (they toggle selection) …
    expect(container.querySelectorAll('.keyboard > g.selected').length).toBeGreaterThan(0);
    // … but Explore never writes practice memory (ADR 0004).
    expect(practice.items).toEqual({});
  });

  it('draws each octave as steps that fade in as the scale rises', async () => {
    const { container } = mount();
    await nextTick();

    const store = useStore();
    store.setTonic('C');
    store.setScaleType('major');
    await nextTick();

    const runs = [...container.querySelectorAll('.scale-path')].map((run) => [
      ...run.querySelectorAll('line'),
    ]);
    // A major octave is seven steps, tonic to tonic.
    const octave = runs.find((lines) => lines.length === 7);
    expect(octave).toBeDefined();

    const opacities = octave!.map((line) => Number(line.getAttribute('stroke-opacity')));
    expect(opacities[0]).toBeCloseTo(0.2);
    expect(opacities[opacities.length - 1]).toBe(1);
    expect(opacities).toEqual([...opacities].sort((a, b) => a - b));

    store.setScaleType('chromatic');
    await nextTick();

    const steps = [...container.querySelectorAll('.scale-path')].map(
      (run) => run.querySelectorAll('line').length,
    );
    expect(steps).toContain(12);
  });
});
