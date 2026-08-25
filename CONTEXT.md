# Bandoneon

A learning app for bisonoric bandoneon keyboards: it renders each keyboard layout as an SVG of buttons and quizzes the player on where notes live.

## Language

### Instrument and notation

**Instrument**:
The one model the app teaches: the Rheinische 142 — 142 tones, bisonoric, Argentine-style Rheinische Tonlage. Not selectable; it names the item keys practice memory is stored under.
_Avoid_: keyboard (as the model name), model

**Side**:
Which keyboard is shown — left hand or right hand.
_Avoid_: manual, half

**Direction**:
The bellows movement, open or close. A bisonoric button sounds a different note in each direction.
_Avoid_: bellows state

**Layout**:
One side in one direction — the set of button-to-note assignments the player sees at once.

**Keyboard**:
The button field shown for one layout — what the player reads and taps.
_Avoid_: button grid

**Staff label**:
The Alsina-chart rendering of a button: a local five-line staff fragment through the button circle, with a notehead on the note's line or space and ledger lines as needed. Shows one spelling at a time; the enharmonics toggle switches between sharp and flat.
_Avoid_: mini staff, notation label

**Staff mode**:
The pitch-notation setting value that renders staff labels instead of letter names. Sits alongside scientific, Helmholtz, and solfège.
_Avoid_: notation mode

**Grand staff**:
Bass and treble staves shown together. Bandoneon convention fixes the clefs — left hand reads bass, right hand reads treble — so no clef is ever chosen or displayed per button.
_Avoid_: double staff

### Practice

**Explore**:
The free-browsing mode — the keyboard with all labels visible. Tapping here never writes practice memory.
_Avoid_: browse mode

**Note game**:
The game mode that highlights one button and asks the player to name the note it sounds.
_Avoid_: forward game

**Staff game**:
The game mode that shows one note on the grand staff and asks the player to tap the matching button. Any button sounding that pitch counts, regardless of spelling; the right pitch class in the wrong octave earns partial credit.
_Avoid_: reverse game, notation game

**Quiz direction**:
Which way a prompt runs: forward shows a button and asks for its note (Note game); reverse shows a note and asks for its button (Staff game). Part of an item's identity.
_Avoid_: game mode (modes can share a direction)

**Prompt**:
One question put to the player during practice: a button to name, or a note to find on the keyboard.
_Avoid_: question, card

**Answer**:
The player's graded response to one prompt — correct, partial credit, or wrong — recorded with when and how fast it was given.
_Avoid_: guess, result

**Partial credit**:
A guess that matches the pitch class but not the octave — scored yellow, between correct (green) and wrong (red).

**Twin**:
Another button of the same layout sounding exactly the same pitch (the 142 has E5 twice on right-close and E3 twice on left-close). A staff-game prompt whose pitch has a twin carries a twin-expected marker, and a correct tap on either button credits the one tapped.
_Avoid_: duplicate button, doublet

**Follow-up**:
The prompt the session engine inserts right after a correct tap on a pitch with a twin, asking for the remaining button. An ordinary full-weight prompt against that button; it grows the run's prompt count by one. Tapping the already-credited twin again grades wrong. Only pitch-prompted modes ever see one.
_Avoid_: bonus prompt, second ask

**Item**:
The schedulable unit of practice memory: one button, on one side, in one bellows direction, quizzed in one direction. Its key names the instrument it belongs to.
_Avoid_: card, fact

**Practice memory**:
The per-item record of answers that scheduling, retirement, and summaries derive from. Only quiz answers write it.
_Avoid_: stats, progress data

**Session**:
One practice run: a fixed, shuffled draw of prompts assembled at start, each item at most once, ending in a summary.
_Avoid_: round

**Session scope**:
The pool a session draws from — all four layouts of one game by default, optionally narrowed to one side + direction.
_Avoid_: filter, layout selection

**Start card**:
The pre-session screen on a game page: the session scope choice, today's numbers, and the buttons that start a session or a sweep. Play never begins without it.
_Avoid_: start screen, lobby

**Sweep**:
The on-demand run through every button of one layout — the "prove myself" option. Records through the same seam as sessions.
_Avoid_: full-keyboard round

**Session strip**:
The one line of numbers shown during play, where the side + direction pickers sit on the start card: prompt progress, today's new items against the daily cap, and pool coverage. Never a binary "due" count.
_Avoid_: counter row, progress bar, queue display

**Direction badge**:
The pill above the keyboard's top-right corner naming the current prompt's bellows direction, blue for open and orange for close. The word is always inside it, so color never carries the meaning alone. Side needs no badge — the rendered keyboard shows it.
_Avoid_: bellows badge, direction pill

**Session engine**:
The component that runs a session: draws each prompt, hands it to the game, grades the answer, and writes practice memory. Games only render prompts and capture answers.
_Avoid_: game engine

**Scheduler**:
The swappable component that picks which items a session draws, weighting by recency and recent errors.
_Avoid_: queue

**Error tally**:
An item's recent-error score over its last 5 answers: green 0, yellow 0.5, red 1. What the scheduler and retirement read.
_Avoid_: due, miss, error count

**Introduction order**:
The fixed per-layout order in which never-seen items enter sessions. Generated by rule, not hand-authored; starts at the home cluster.
_Avoid_: unlock order

**Home cluster**:
The few buttons an introduction order starts from — those sounding the C-major degrees nearest middle C (right hand) or C3 (left).
_Avoid_: seed, starting position

**Retired**:
A derived status for an item with a clean recent record — error tally 0 and greens on three or more distinct days since its last red. Retired items keep a trickle of scheduling weight; a red revives them.
_Avoid_: mastered, learned
