import { Note } from 'tonal';

/** Tap score: 2 green (correct), 1 yellow (partial credit), 0 red (wrong). */
export type TapScore = 0 | 1 | 2;

/** Score a staff-game tap by comparing sounded pitches, independent of spelling. */
export function scoreTap(quizzed: string, tapped: string): TapScore | null {
  const quizzedMidi = Note.midi(quizzed);
  const tappedMidi = Note.midi(tapped);
  if (quizzedMidi === null || tappedMidi === null) return null;
  if (tappedMidi === quizzedMidi) return 2;
  if (tappedMidi % 12 === quizzedMidi % 12) return 1;
  return 0;
}
