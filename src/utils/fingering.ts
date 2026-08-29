import { Note } from 'tonal';

import fingerings, { type ScaleFingering } from '../data/fingerings/rheinische142';
import { notes } from '../data/index';
import type { Direction, Side } from './session';

// The recommended finger per button for a scale shown in Explore. Natural minor
// reads its relative major's table: the same buttons in the same order, only
// starting elsewhere. The chromatic run is one table per layout, no tonic
// (ADR 0009). Anything else — no scale, a chord — has none.
export function scaleFingering(
  side: Side,
  direction: Direction,
  tonic: string,
  scaleType: string | null,
): ScaleFingering | undefined {
  const layout = `${side}-${direction}` as const;
  if (scaleType === 'chromatic') return fingerings.chromatic[layout];
  const keyed =
    scaleType === 'major' || scaleType === 'minor'
      ? fingerings.major
      : scaleType === 'harmonic minor' || scaleType === 'melodic minor'
        ? fingerings[scaleType]
        : undefined;
  if (!keyed) return undefined;
  const chroma = Note.chroma(tonic);
  if (chroma === undefined) return undefined;
  const key = notes[(chroma + (scaleType === 'minor' ? 3 : 0)) % notes.length];
  return keyed[layout][key];
}
