// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h } from 'vue';

import UpdateBar from '../UpdateBar.vue';

let teardown: (() => void) | null = null;

afterEach(() => {
  teardown?.();
  teardown = null;
});

function mount(open: boolean) {
  const events: string[] = [];
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(UpdateBar as never, {
        open,
        onReload: () => events.push('reload'),
        onDismiss: () => events.push('dismiss'),
      }),
  });
  app.mount(container);
  teardown = () => {
    app.unmount();
    container.remove();
  };
  return { container, events };
}

const buttonNamed = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

describe('UpdateBar', () => {
  it('renders nothing until a new build is waiting', () => {
    const { container } = mount(false);
    expect(container.textContent).toBe('');
  });

  it('offers the new build and reports the tap', () => {
    const { container, events } = mount(true);
    expect(container.textContent).toContain('New version available');

    buttonNamed(container, 'Reload')?.click();
    buttonNamed(container, 'Later')?.click();

    expect(events).toEqual(['reload', 'dismiss']);
  });
});
