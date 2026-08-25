import { Note } from 'tonal';

/** Tap score: 2 green (correct), 1 yellow (partial credit), 0 red (wrong). */
export type TapScore = 0 | 1 | 2;

/** The color of each score, by score: red-500, yellow-500, green-500. */
export const SCORE_COLORS = ['#ef4444', '#eab308', '#22c55e'] as const;

/** Score a staff-game tap by comparing sounded pitches, independent of spelling. */
export function scoreTap(quizzed: string, tapped: string): TapScore | null {
  const quizzedMidi = Note.midi(quizzed);
  const tappedMidi = Note.midi(tapped);
  if (quizzedMidi === null || tappedMidi === null) return null;
  if (tappedMidi === quizzedMidi) return 2;
  if (tappedMidi % 12 === quizzedMidi % 12) return 1;
  return 0;
}
