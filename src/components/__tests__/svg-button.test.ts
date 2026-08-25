import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { staffGlyphs } from '../../assets/staffGlyphs';
import { useStore } from '../../stores/main';
import { useSettingsStore } from '../../stores/settings';
import SvgButton from '../SvgButton.vue';

interface State {
  pitchNotation?: 'scientific' | 'helmholtz' | 'solfege' | 'staff';
  showEnharmonics?: boolean;
}

const render = (props: Record<string, unknown>, state: State = {}) => {
  const pinia = createPinia();
  const app = createSSRApp({ render: () => h(SvgButton as never, props) });
  app.use(pinia);
  const settings = useSettingsStore(pinia);
  const main = useStore(pinia);
  if (state.pitchNotation) settings.pitchNotation = state.pitchNotation;
  if (state.showEnharmonics !== undefined) main.showEnharmonics = state.showEnharmonics;
  return renderToString(app);
};

describe('SvgButton', () => {
  it('renders the note name as text by default', async () => {
    const html = await render({ x: 0, y: 0, tonal: 'C#5' });
    expect(html).toContain('<text');
    expect(html).toContain('C♯');
    expect(html).not.toContain('clip-path');
  });

  it('renders a staff label instead of text in staff mode', async () => {
    const html = await render({ x: 0, y: 0, tonal: 'B4' }, { pitchNotation: 'staff' });
    expect(html).not.toContain('<text');
    expect(html).toContain('clip-path');
    expect(html).toContain(staffGlyphs.noteheadBlack.d);
    expect(html).toContain('class="staff-label"');
  });

  it('still renders an explicit label as text in staff mode', async () => {
    const html = await render({ x: 0, y: 0, tonal: 'B4', label: '?' }, { pitchNotation: 'staff' });
    expect(html).toContain('<text');
    expect(html).toContain('?');
    expect(html).not.toContain('clip-path');
  });

  it('switches the staff-label spelling with the enharmonics toggle', async () => {
    const sharp = await render({ x: 0, y: 0, tonal: 'A#4' }, { pitchNotation: 'staff' });
    expect(sharp).toContain(staffGlyphs.accidentalSharp.d);

    const flat = await render(
      { x: 0, y: 0, tonal: 'A#4' },
      { pitchNotation: 'staff', showEnharmonics: true },
    );
    expect(flat).toContain(staffGlyphs.accidentalFlat.d);
  });

  it('names the note in the given spelling, whatever the toggle says', async () => {
    const flat = await render({ x: 0, y: 0, tonal: 'A#4', spelling: 'flat' });
    expect(flat).toContain('B♭');

    const sharp = await render(
      { x: 0, y: 0, tonal: 'A#4', spelling: 'sharp' },
      { showEnharmonics: true },
    );
    expect(sharp).toContain('A♯');
    expect(sharp).not.toContain('B♭');
  });

  it('keeps the selected class so the staff label inverts like text', async () => {
    const html = await render(
      { x: 0, y: 0, tonal: 'B4', selected: true },
      { pitchNotation: 'staff' },
    );
    expect(html).toMatch(/class="[^"]*selected/);
    expect(html).toContain('class="staff-label"');
  });
});
