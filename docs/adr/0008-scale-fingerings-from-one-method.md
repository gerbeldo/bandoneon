# 0008 — Scale fingerings: one method, one finger per button

Status: accepted
Date: 2026-08-28

## Context

The owner wants recommended fingerings on the scale buttons in Explore, from the best published source, preferring Rodolfo Daluisio's school. The research (`.scratch/fingerings/spec.md`, sources in the gitignored `resources/`) found: every Argentine source numbers fingers 2–5 on both hands, the thumb never playing a button; Daluisio published no scale-fingering table and fingers by phrase, not by button; complete fingered scale sets exist in Madrigal (2002), Marcucci–Lípesker (1944) and Ambros; the sources agree on right/close and left/open and split into two schools on right/open; ascending and descending fingerings are the same finger per note wherever both are printed.

## Decision

- The data is a lookup, not a rule: `src/data/fingerings/rheinische142.ts` maps layout → major key → pitch → finger, transcribed from one method, Madrigal's _Método para bandoneón_ (Melos, 2002). Mixing methods would blend two schools of right-hand-opening fingering into a sequence nobody teaches.
- One finger per button. The sources mirror up and down, so there is no up/down selector; where Madrigal stacks two digits, the upper one is kept.
- Natural minor reads its relative major's table. Explore's `minor` is the natural minor, which no method fingers; it uses exactly the relative major's buttons.
- Buttons outside the two octaves a page fingers stay blank. C major alone covers the whole compass, from the method's natural-scale chart.
- The toggle is Explore display state (`showFingering` in the Explore store), session-only like the ♯/♭ toggle, and the badge is drawn by `SvgButton` from a `finger` prop — the games never pass one.

## Rejected alternatives

- Deriving fingerings from a hand-position rule: the 142's four layouts have no repeating shape ("four different maps"); every published fingering is a per-key table.
- Composing a consensus fingering across methods: right/open differs between schools note by note; a consensus is a third fingering with no source.
- Harmonic and melodic minor tables now: Explore has no such scale types; adding them means new scale types first.

## Consequences

- Chords show no fingering; the only fingered chord source is a paid book.
- Changing the source school means re-transcribing one table, not touching code.
- The PNG export left with the pin and undo buttons, so ADR 0001's rasterization argument no longer binds; its decision stands on the fragments-in-one-`<svg>` reason alone.
