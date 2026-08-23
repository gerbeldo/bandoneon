# 0001 — Hand-rolled SVG notation

Status: accepted
Date: 2026-08-23

## Context

Staff notation appears in two places: staff labels inside the keyboard buttons (fragments of the existing keyboard `<svg>`) and the grand staff of the staff game (its own component). The keyboard SVG is serialized to a blob and rasterized for the PNG download, so document-loaded fonts don't apply there. Candidate libraries were VexFlow 5, abcjs 6, and OpenSheetMusicDisplay 2 (research: `.scratch/staff-notation/research/notation-rendering.md`).

## Decision

Draw both the staff labels and the grand staff as hand-rolled SVG. The seven glyphs needed (clefs, noteheads, accidentals) are extracted once from the Bravura font at build time (`scripts/extract_staff_glyphs.py`) into checked-in path data (`src/assets/staffGlyphs.ts`, ~2 KB gzipped, SIL OFL 1.1); staff, ledger, and barlines are plain `<line>` elements. Shared note-to-staff math lives in `src/utils/staff.ts`.

## Rejected alternatives

- **VexFlow 5, abcjs, OSMD** all render into their own `<svg>` (or canvas) inside a container element; none can emit fragments into the existing keyboard `<svg>`, which the staff labels require.
- **VexFlow** draws glyphs as `<text>` in the Bravura font, which rasterizes blank in the SVG→PNG download.
- Bundle cost: 92–693 KB gzipped (plus a 247 KB runtime font for VexFlow core) — 45–170× the extracted path data — to redo note-positioning math we need to write anyway.

## Consequences

- No key signatures, rhythm, or multiple voices — only positioned noteheads, accidentals, and ledger lines. Chords on the grand staff are covered by two engraving rules in `staff.ts` (second-interval notehead shift, accidental column stacking).
- If grand-staff needs outgrow this, the named fallback is VexFlow 5 `vexflow/core` for the grand staff only — it lives outside the keyboard SVG, so its font is acceptable there.
- The extracted glyph module must not be named "Bravura" (OFL reserved-name rule) and carries the copyright and license notice in its header.
