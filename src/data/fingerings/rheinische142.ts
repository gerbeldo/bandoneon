// The finger that plays each button of a major scale, by layout and key —
// 2 index, 3 middle, 4 ring, 5 little; the thumb never plays a button.
// Source: Marcos Madrigal, Método para bandoneón (Melos, 2002): the natural
// scale over the whole compass on p. 18, the other keys from the first system
// of pp. 41–51 (outer number rows opening, inner rows closing; the upper digit
// where two are stacked). Buttons the method leaves unfingered are absent.
export type Finger = 2 | 3 | 4 | 5;

// Pitch (sharp spelling, as the layout data spells it) → finger.
export type ScaleFingering = Readonly<Record<string, Finger>>;

// Keyed by the major key's tonic, spelled with sharps like Explore's tonic.
export type LayoutFingerings = Readonly<Record<string, ScaleFingering>>;

export default <
  Record<'right-open' | 'right-close' | 'left-open' | 'left-close', LayoutFingerings>
>{
  'right-open': {},
  'right-close': {},
  'left-open': {},
  'left-close': {},
};
