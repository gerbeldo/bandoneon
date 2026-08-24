// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h } from 'vue';

import Modal from '../Modal.vue';

let cleanup: (() => void) | null = null;

function mount(modelValue = true) {
  const updates: boolean[] = [];
  const app = createApp({
    render: () =>
      h(Modal, { modelValue, 'onUpdate:modelValue': (value: boolean) => updates.push(value) }, () =>
        h('p', { id: 'content' }, 'content'),
      ),
  });
  const el = document.createElement('div');
  document.body.append(el);
  app.mount(el);
  cleanup = () => {
    app.unmount();
    el.remove();
  };
  return updates;
}

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

const pressEscape = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('Modal', () => {
  it('closes on Escape while open', () => {
    const updates = mount(true);
    pressEscape();
    expect(updates).toEqual([false]);
  });

  it('does not emit on Escape while closed', () => {
    const updates = mount(false);
    pressEscape();
    expect(updates).toEqual([]);
  });

  it('closes on backdrop click', () => {
    const updates = mount(true);
    const overlay = document.querySelector('[role="dialog"] .flex.min-h-full');
    expect(overlay).not.toBe(null);
    overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(updates).toEqual([false]);
  });

  it('does not close on a click inside the dialog', () => {
    const updates = mount(true);
    const content = document.querySelector('#content');
    expect(content).not.toBe(null);
    content?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(updates).toEqual([]);
  });
});
