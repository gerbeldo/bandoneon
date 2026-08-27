# 0007 — Note inputs are a device preference sharing one pick

Status: accepted
Date: 2026-08-26

## Context

The note game answered through Explore's twelve-name palette plus an octave row: twelve buttons carrying little structure, no way to name a double accidental, and the pick stored in Explore's own tonic state, which a run could leave dirty. The owner wants four ways to name a note — letters with an accidental row, a piano octave, a wheel with letters outside and signs inside, and a large tappable staff — switchable per device, phone first.

## Decision

- `noteInput` (letters | piano | wheel | staff) lives beside `pitchNotation` in the settings store and is chosen from the settings panel. It is a device preference, not a run parameter, so it never appears on the practice setup (contrast ADR 0005: run parameters are persisted setup fields).
- One pick — letter, accidental, octave — sits behind all four inputs (`utils/notePick.ts`, `useNotePick`). Widgets are dumb (props in, events out) and every tap or desktop key funnels through one `choose()` that returns the finished pitch and resets. The engine seam (ADR 0004) is untouched: each input submits one spelled pitch string, graded by sound as before.
- The name is the player's own: E♯ submits and displays as E♯, never respelled into the prompt's table. Only the piano names keys for the player, and it does so by the prompt's spelling.
- The staff input keeps ADR 0001's hand-rolled SVG. The accidental is a modifier picked before placing; press puts a notehead on the nearest line or space, dragging slides it, lifting submits — the position names letter and octave at once. The double-accidental outlines are extracted into `staffGlyphs.ts` and drawn everywhere a sign shows on a button face.

## Rejected alternatives

- Offering the input on the practice setup: which widget the thumb likes is not a property of a run, and the setup is already the longest screen.
- Each widget submitting its own answer shape into the engine: four submit paths to test through page mounts; the shared pick keeps ordering rules (octave last, octave disabled until a letter) in one unit-tested place.
- Typing 𝄪/𝄫 as text: the Unicode music block is missing from many phone fonts; drawn outlines render the same everywhere.

## Consequences

- `NavTonic` is Explore's alone; the note game no longer writes `store.tonic`/`chordType`.
- Desktop keys map onto the pick (all seven Shift+letters sharp, `-` flat, `x` double sharp), so shortcuts behave identically under every input. No key maps to double flat — an accepted gap.
- Tests select letters and signs by `aria-label`, no longer by displayed (spelling-dependent) text.
