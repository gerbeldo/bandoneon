# Bandoneon

A learning app for bisonoric bandoneon keyboards: it renders each keyboard layout as an SVG of buttons and quizzes the player on where notes live.

## Language

**Side**:
Which keyboard is shown — left hand or right hand.
_Avoid_: manual, half

**Direction**:
The bellows movement, open or close. A bisonoric button sounds a different note in each direction.
_Avoid_: bellows state

**Layout**:
One side in one direction — the set of button-to-note assignments the player sees at once.

**Staff label**:
The Alsina-chart rendering of a button: a local five-line staff fragment through the button circle, with a notehead on the note's line or space and ledger lines as needed. Shows one spelling at a time; the enharmonics toggle switches between sharp and flat.
_Avoid_: mini staff, notation label

**Staff mode**:
The pitch-notation setting value that renders staff labels instead of letter names. Sits alongside scientific, Helmholtz, and solfège.
_Avoid_: notation mode

**Grand staff**:
Bass and treble staves shown together. Bandoneon convention fixes the clefs — left hand reads bass, right hand reads treble — so no clef is ever chosen or displayed per button.
_Avoid_: double staff

**Staff game**:
The game mode that shows one note on the grand staff and asks the player to tap the matching button. Any button sounding that pitch counts, regardless of spelling; the right pitch class in the wrong octave earns partial credit.
_Avoid_: reverse game, notation game

**Partial credit**:
A guess that matches the pitch class but not the octave — scored yellow, between correct (green) and wrong (red).
