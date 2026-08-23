import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import GrandStaff from '../GrandStaff.vue';
import StaffLabel from '../StaffLabel.vue';

const render = (component: unknown, props: Record<string, unknown>) =>
  renderToString(createSSRApp({ render: () => h(component as never, props) }));

const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;

describe('StaffLabel', () => {
  it('draws 5 staff lines and a notehead for a note on the staff', async () => {
    const html = await render(StaffLabel, { cx: 29, cy: 29, note: 'B4', side: 'right' });
    expect(count(html, /<line/g)).toBe(5);
    expect(count(html, /<path/g)).toBe(1);
    expect(html).toContain('clip-path');
  });

  it('adds ledger lines and an accidental when the note needs them', async () => {
    const html = await render(StaffLabel, { cx: 29, cy: 29, note: 'C#4', side: 'right' });
    expect(count(html, /<line/g)).toBe(6); // 5 staff lines + 1 ledger for middle C
    expect(count(html, /<path/g)).toBe(2); // notehead + sharp
  });

  it('renders nothing for an invalid note', async () => {
    const html = await render(StaffLabel, { cx: 29, cy: 29, note: 'nope', side: 'right' });
    expect(html).not.toContain('<line');
    expect(html).not.toContain('<path');
  });
});

describe('GrandStaff', () => {
  it('draws both staves, clefs, and the quizzed whole note', async () => {
    const html = await render(GrandStaff, { notes: ['B4'], side: 'right' });
    expect(count(html, /<line/g)).toBe(11); // 10 staff lines + barline
    expect(count(html, /<path/g)).toBe(3); // 2 clefs + notehead
  });

  it('draws the feedback note in its own color', async () => {
    const html = await render(GrandStaff, {
      notes: ['B4'],
      side: 'right',
      color: 'green',
      feedback: { note: 'F#3', color: 'red' },
    });
    expect(html).toContain('color: green');
    expect(html).toContain('color: red');
    expect(count(html, /<path/g)).toBe(5); // 2 clefs + 2 noteheads + sharp
  });

  it('shifts the upper notehead of a second in a chord', async () => {
    const html = await render(GrandStaff, { notes: ['C4', 'D4'], side: 'right' });
    const xs = [...html.matchAll(/translate\((\d+(?:\.\d+)?) /g)].map((m) => Number(m[1]));
    const headXs = xs.filter((x) => x > 100); // notehead translates; clefs sit at x 28
    expect(headXs).toHaveLength(2);
    expect(Math.abs(headXs[1] - headXs[0])).toBeCloseTo(16.88); // one whole-note head width
  });
});
