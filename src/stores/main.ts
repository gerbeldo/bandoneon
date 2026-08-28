import { defineStore } from 'pinia';

import chords from '../data/chords';
import { instruments } from '../data/index';
import { useSettingsStore } from './settings';

export const useStore = defineStore('main', {
  state: () => ({
    showColors: false,
    showEnharmonics: false,
    showFingering: false,
    side: 'right' as 'right' | 'left',
    direction: 'open' as 'open' | 'close',
    tonic: null as null | string,
    chordType: null as null | string,
    scaleType: null as null | string,
  }),

  getters: {
    chordName(state) {
      if (state.tonic && state.chordType) {
        return `${state.tonic}${state.chordType}`;
      }
      return null;
    },

    chordNotes(): string[] {
      if (this.side && this.direction && this.chordName) {
        return chords[`${this.side}-${this.direction}`][this.chordName];
      }
      return [];
    },

    keyPositions(state): [number, number, string][] {
      const settings = useSettingsStore();

      const keys = instruments[settings.instrument]?.[state.side]?.[state.direction];
      if (!keys) return [];

      const positions: [number, number, string][] = [];
      let offsetX = 0;
      let offsetY = 0;

      // Center
      const cols = Math.max(...keys.map((row) => row.length));
      const rows = keys.reduce((acc, row) => acc + (row.length > 0 ? 1 : 0), 0);
      if (cols < 9) offsetX += 39 * (9 - cols);
      if (rows < 6) offsetY -= 32 * (6 - rows);
      let gapX = 79;
      if (cols >= 10) gapX = 65; // TODO: improve calculation

      for (let row = 0; row < keys.length; row++) {
        for (let col = 0; col < keys[row].length; col++) {
          const tonal = keys[row][col];
          if (tonal) {
            const x = offsetX + col * gapX + 40 - (row % 2) * 40;
            const y =
              offsetY +
              // row:
              row * 60 +
              // curvature:
              (row / 2 + 1) * 15 * (1 - Math.sin(((x / 320) * Math.PI) / 2));
            positions.push([x, y, tonal]);
          }
        }
      }

      return positions;
    },

    // Tight frame around the current layout so small layouts render as large
    // as the widest one. 58 = button cell size in viewBox units.
    keyboardViewBox(): { x: number; y: number; width: number; height: number } {
      const positions = this.keyPositions;
      if (positions.length === 0) return { x: 0, y: 0, width: 690, height: 410 };

      const xs = positions.map(([x]) => x);
      const ys = positions.map(([, y]) => y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);

      return {
        x: minX,
        y: minY,
        width: Math.max(...xs) + 58 - minX,
        height: Math.max(...ys) + 58 - minY,
      };
    },
  },

  actions: {
    setTonic(tonic: string | null) {
      if (tonic) {
        this.tonic = tonic;
        if (!this.scaleType && !this.chordType) {
          this.chordType = 'M';
        }
      } else {
        this.tonic = null;
        this.chordType = null;
        this.scaleType = null;
      }
    },

    setScaleType(scaleType: string | null) {
      if (this.chordType) this.chordType = null;
      if (!this.tonic) this.tonic = 'C';
      this.scaleType = scaleType;
    },

    setChordType(chordType: string | null) {
      if (this.scaleType) this.scaleType = null;
      if (!this.tonic) this.tonic = 'C';
      this.chordType = chordType;
    },
  },
});
