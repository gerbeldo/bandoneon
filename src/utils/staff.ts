import { Note } from 'tonal';

export type Side = 'left' | 'right';
export type StaffAccidental = '#' | 'b' | null;

// Bandoneon convention: the left hand always reads bass, the right hand treble.
// Middle lines: bass D3, treble B4.
export const MIDDLE_LINE_STEP: Record<Side, number> = { left: 22, right: 34 };

/** Sharp bounding-box height in staff spaces; used as the vertical footprint of any accidental. */
const ACCIDENTAL_HEIGHT_SP = 2.79;

/** Each accidental column sits this much further left of the leftmost notehead, in staff spaces. */
export const ACCIDENTAL_COLUMN_OFFSET_SP = 1.2;

/** Diatonic step number of a note: C0 = 0, one step per staff line or space. */
export function stepIndex(name: string): number | null {
  const note = Note.get(name);
  if (note.empty || note.oct === undefined) return null;
  return 'CDEFGAB'.indexOf(note.letter) + 7 * note.oct;
}

/** Steps above the middle line of the side's staff; negative below. */
export function staffPosition(name: string, side: Side): number | null {
  const step = stepIndex(name);
  return step === null ? null : step - MIDDLE_LINE_STEP[side];
}

/** Ledger-line positions for a note at staff position p: even steps between staff edge and note. */
export function ledgerSteps(p: number): number[] {
  const steps: number[] = [];
  if (p >= 6) for (let q = 6; q <= p; q += 2) steps.push(q);
  if (p <= -6) for (let q = -6; q >= p; q -= 2) steps.push(q);
  return steps;
}

/** The accidental of the spelled note: '#', 'b', or null for naturals. */
export function accidentalOf(name: string): StaffAccidental {
  const acc = Note.get(name).acc;
  return acc === '#' || acc === 'b' ? acc : null;
}

export interface ChordNote {
  step: number;
  accidental: StaffAccidental;
}

export interface ChordNoteLayout {
  /** Notehead x shift in notehead widths: 0, or 1 for the upper note of a second. */
  headShift: 0 | 1;
  /** Accidental column, 0 = rightmost, or null when the note has no accidental. */
  accidentalColumn: number | null;
}

/** Engraving layout for one chord on one staff; results align with the input order. */
export function chordLayout(notes: ChordNote[]): ChordNoteLayout[] {
  const layouts: ChordNoteLayout[] = notes.map(() => ({ headShift: 0, accidentalColumn: null }));
  const ascending = [...notes.keys()].sort((a, b) => notes[a].step - notes[b].step);

  // Noteheads a second apart collide: shift the upper one right, alternating up a cluster.
  for (let k = 1; k < ascending.length; k++) {
    const isSecond = notes[ascending[k]].step - notes[ascending[k - 1]].step === 1;
    if (isSecond && layouts[ascending[k - 1]].headShift === 0) {
      layouts[ascending[k]].headShift = 1;
    }
  }

  // Accidentals go top-down into the rightmost column with vertical room.
  const lastStepPerColumn: number[] = [];
  for (const i of [...ascending].reverse()) {
    if (!notes[i].accidental) continue;
    let column = lastStepPerColumn.findIndex(
      (last) => (last - notes[i].step) / 2 >= ACCIDENTAL_HEIGHT_SP,
    );
    if (column === -1) column = lastStepPerColumn.length;
    lastStepPerColumn[column] = notes[i].step;
    layouts[i].accidentalColumn = column;
  }

  return layouts;
}
