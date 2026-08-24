# Positional item keys; layout edits ship migrations

Practice memory keys each item by position — (instrument, side, bellows direction, row, column, quiz direction) — because buttons carry no ids in the layout data. The alternative, adding stable button ids across all six instrument files, was rejected as permanent churn to guard against a rare event. The cost: any layout-grid edit silently re-keys stats, so every grid edit must ship a key-remap migration in the versioned storage chain, and a snapshot test of the grids fails CI when an edit lands without one.
