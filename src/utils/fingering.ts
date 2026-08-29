import { Note } from 'tonal';

import fingerings, { type ScaleFingering } from '../data/fingerings/rheinische142';
import { notes } from '../data/index';
import type { Direction, Side } from './session';

// The recommended finger per button for a scale shown in Explore. Natural minor
// reads its relative major's table: the same buttons in the same order, only
// starting elsewhere. Chromatic and unknown keys have none.
export function scaleFingering(
  side: Side,
  direction: Direction,
  tonic: string,
  scaleType: string | null,
): ScaleFingering | undefined {
  if (scaleType !== 'major' && scaleType !== 'minor') return undefined;
  const chroma = Note.chroma(tonic);
  if (chroma === undefined) return undefined;
  const majorTonic = notes[(chroma + (scaleType === 'minor' ? 3 : 0)) % notes.length];
  return fingerings[`${side}-${direction}`][majorTonic];
}
