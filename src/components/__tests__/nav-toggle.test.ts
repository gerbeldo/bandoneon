// @vitest-environment jsdom
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { createApp, h, nextTick } from 'vue';

import { useStore } from '../../stores/main';
import NavDisplay from '../NavDisplay.vue';
import NavTonic from '../NavTonic.vue';

const mount = (component: unknown, props: Record<string, unknown> = {}) => {
  const pinia = createPinia();
  const app = createApp({ render: () => h(component as never, props) });
  app.use(pinia);
  const el = document.createElement('div');
  app.mount(el);
  return { store: useStore(pinia), el };
};

const click = async (el: HTMLElement, text: string) => {
  const button = [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!button) throw new Error(`no button "${text}"`);
  button.click();
  await nextTick();
};

describe('NavTonic', () => {
  it('selects a tonic and toggles it off on re-click', async () => {
    const { store, el } = mount(NavTonic);

    await click(el, 'C');
    expect(store.tonic).toBe('C');
    expect(store.chordType).toBe('M'); // auto-M behavior

    await click(el, 'C');
    expect(store.tonic).toBeNull();
    expect(store.chordType).toBeNull();
    expect(store.scaleType).toBeNull();
  });

  it('switches directly to a different tonic', async () => {
    const { store, el } = mount(NavTonic);

    await click(el, 'C');
    await click(el, 'D');
    expect(store.tonic).toBe('D');
  });
});

describe('NavDisplay', () => {
  it('toggles the active chord type off, keeping the tonic', async () => {
    const { store, el } = mount(NavDisplay, { modified: false });
    store.setTonic('C'); // auto-selects the M chord
    await nextTick();

    await click(el, 'M');
    expect(store.chordType).toBeNull();
    expect(store.tonic).toBe('C');
  });

  it('toggles the active scale type off, keeping the tonic', async () => {
    const { store, el } = mount(NavDisplay, { modified: false });
    store.setTonic('C');
    await nextTick();

    await click(el, 'maj');
    expect(store.scaleType).toBe('major');

    await click(el, 'maj');
    expect(store.scaleType).toBeNull();
    expect(store.tonic).toBe('C');
  });

  it('switches directly to a different scale or chord type', async () => {
    const { store, el } = mount(NavDisplay, { modified: false });
    store.setTonic('C');
    await nextTick();

    await click(el, 'maj');
    await click(el, 'min');
    expect(store.scaleType).toBe('minor');

    await click(el, 'm7');
    expect(store.chordType).toBe('m7');
    expect(store.scaleType).toBeNull();
  });
});
