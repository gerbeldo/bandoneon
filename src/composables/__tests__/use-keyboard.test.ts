// @vitest-environment jsdom
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h } from 'vue';

import { useStore } from '../../stores/main';
import { useKeyboard } from '../useKeyboard';

let cleanup: (() => void) | null = null;

function mount() {
  const pinia = createPinia();
  const app = createApp(
    defineComponent({
      setup() {
        useKeyboard();
        return () => h('div');
      },
    }),
  );
  app.use(pinia);
  const el = document.createElement('div');
  document.body.append(el);
  app.mount(el);
  cleanup = () => {
    app.unmount();
    el.remove();
  };
  return useStore(pinia);
}

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key }));

describe('useKeyboard', () => {
  it('binds all shortcuts by default', () => {
    const store = mount();

    press('L');
    expect(store.side).toBe('left');
    expect(store.direction).toBe('close');

    press('c');
    expect(store.tonic).toBe('C');

    press('G');
    expect(store.tonic).toBe('G#');

    press('m');
    expect(store.chordType).toBe('m');

    press('Escape');
    expect(store.tonic).toBe(null);
  });

  it('removes the listener on unmount', () => {
    const store = mount();
    cleanup?.();
    cleanup = null;

    press('c');
    expect(store.tonic).toBe(null);
  });
});
