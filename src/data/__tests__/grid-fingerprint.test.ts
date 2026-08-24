import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { GRID_FINGERPRINT } from '../../stores/practice';
import { instruments } from '../index';

// Pins the layout grids; why an edit must ship a key-remap migration is
// documented at GRID_FINGERPRINT, beside practiceStorage.migrations.
describe('layout grids', () => {
  it('match the fingerprint recorded beside the practice-memory migrations', () => {
    const fingerprint = createHash('sha256').update(JSON.stringify(instruments)).digest('hex');

    expect(
      fingerprint,
      [
        'A layout grid changed. Positional item keys mean this edit re-keys practice memory:',
        'ship a key-remap migration in practiceStorage.migrations (src/stores/practice.ts),',
        `then set GRID_FINGERPRINT there to '${fingerprint}'.`,
      ].join('\n'),
    ).toBe(GRID_FINGERPRINT);
  });
});
