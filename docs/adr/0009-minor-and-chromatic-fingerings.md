# 0009 — Harmonic minor, melodic minor and chromatic fingerings

Status: accepted
Date: 2026-08-28

## Context

ADR 0008 fingered the major keys (and, through the relative major, the natural minor) and left the harmonic and melodic minors and the chromatic scale for later because Explore had no such scale types. The owner now wants them. Madrigal's method fingers all three: harmonic minors pp. 52–63 (one key per page, two octaves), melodic minors pp. 64–66 (four keys per page, three octaves, natural form on the way down) and the chromatic scale as four whole-compass charts on p. 34 (hand × bellows direction, one finger per note).

## Decision

- `harmonic minor` and `melodic minor` join Explore's scale types (tonal's names; buttons `harm`, `mel`). They are Explore-only; the practice games keep their own `ScaleKind`.
- Each has its own table, transcribed like the majors: scale type → layout → tonic → pitch → finger. The melodic minor shows and fingers the ascending form; its descending (natural) form is Madrigal's descent, which the app does not draw.
- The chromatic scale gets one table per layout, no tonic: `chromatic → layout → pitch → finger`, from the p. 34 charts. Every button of a layout is fingered.
- When a page prints the same pitch twice — a low note the instrument lacks printed an octave up before the real run, or a melodic minor's third octave printed an octave down — the digit from the longest stepwise stretch wins. That is the scale as played through; the short fragments are displaced octaves. The rule replaced "any in-run occurrence" and changed no major-key digit.
- The fingering toggle is enabled whenever a scale is shown; chromatic included.

## Rejected alternatives

- Deriving the harmonic and melodic minors from the relative major's table: they use different buttons (raised 6th and 7th) and Madrigal fingers them differently.
- Fingering the melodic minor's descending form too: it would need a direction selector ADR 0008 rejected, and the app draws one form.
- Building the chromatic table from the twelve major tables: the chromatic chart is a different hand path; Madrigal prints it separately.

## Consequences

- ADR 0008's "harmonic and melodic minor tables now" rejection is superseded.
- The data file grows to four sections; `scaleFingering()` dispatches on the scale type and no longer treats `chromatic` as unfingered.
- The transcription archive (gitignored `resources/scales/madrigal/transcription/`) holds the second pass beside the first.
