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
One scheduled practice run: a fixed, shuffled draw the scheduler assembles at start under the session size and the daily cap, each item at most once, ending in a summary.
_Avoid_: round

**Session scope**:
The layouts a run draws from — all four layouts of one game by default, optionally narrowed to one side + direction. Chosen on the practice setup and persisted with it.
_Avoid_: filter, layout selection

**Practice setup**:
The screen the practice page opens on: the game, the session scope, the items (scheduled, or the first N), the spelling, a summary line, and Start. Play never begins without it; dismissing the summary returns to it; every choice on it is persisted (ADR 0005).
_Avoid_: start card, start screen, lobby, config screen

**Fixed run**:
A run over the first N items of the introduction order inside the session scope, shuffled, each asked once, with no daily cap. What "First N" on the practice setup starts. "Run" alone means a session or a fixed run.
_Avoid_: drill, ordered run, custom session

**Sweep**:
The fixed run over every item of one layout — "All" on the practice setup with one layout chosen. Records through the same seam as sessions.
_Avoid_: full-keyboard round

**Spelling**:
Which name an accidental goes by in a run: sharps or flats, chosen on the practice setup. Under Both, each accidental item is named as a sharp or a flat, drawn at random when the run starts. Every prompt carries its spelling, and the keyboard's ♯/♭ display follows the prompt.
_Avoid_: enharmonics toggle (that is Explore's ♯/♭ button), notation (that is pitch notation)

**Direction badge**:
The pill above the keyboard's top-right corner naming the current prompt's bellows direction, blue for open and orange for close. The word is always inside it, so color never carries the meaning alone. Side needs no badge — the rendered keyboard shows it.
_Avoid_: bellows badge, direction pill

**Session strip**:
The one line of numbers shown during play: prompt progress, today's new items against the run's daily cap when it has one, and pool coverage. Never a binary "due" count.
_Avoid_: counter row, progress bar, queue display

**Session engine**:
The component that runs a session: draws each prompt, hands it to the game, grades the answer, and writes practice memory. Games only render prompts and capture answers.
_Avoid_: game engine

**Scheduler**:
The swappable component that picks which items a session draws, weighting by recency and recent errors, under the session size and the daily cap.
_Avoid_: queue

**Session size**:
How many items a session draws — 10, 20, 30, or 50 on the practice setup, 20 by default; one prompt each. A fixed run's size is its N.
_Avoid_: session length, round size

**Daily cap**:
How many never-seen items sessions may introduce per local calendar day per game — 0, 3, 5, or 10 on the practice setup, 3 by default. Fixed runs ignore it.
_Avoid_: daily ration, new-item budget

**Introduction order**:
The fixed per-layout order in which never-seen items enter sessions. Generated by rule, not hand-authored; starts at the home cluster.
_Avoid_: unlock order

**Error tally**:
An item's recent-error score over its last 5 answers: green 0, yellow 0.5, red 1. What the scheduler and retirement read.
_Avoid_: due, miss, error count

**Home cluster**:
The few buttons an introduction order starts from — those sounding the C-major degrees nearest middle C (right hand) or C3 (left).
_Avoid_: seed, starting position

**Retired**:
A derived status for an item with a clean recent record — error tally 0 and greens on three or more distinct days since its last red. Retired items keep a trickle of scheduling weight; a red revives them.
_Avoid_: mastered, learned

**Progress page**:
The page that colors every button of one layout by its item's status in one game — retired; learning (seen, clean, not yet retired); recent errors (an error among the last five answers); not yet seen — with the layout's counts, the game's totals, and one button's record on tap.
_Avoid_: heatmap, stats page, mastery map
