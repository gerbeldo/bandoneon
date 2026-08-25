// Progress: what practice memory says about each item, for the progress page.
// Derived on read, like retirement — nothing here is stored.

import type { ItemRecord } from '../stores/practice';
import { errorTally, isRetired } from './scheduler';

// Never answered; answered with a clean recent record but not yet retired;
// answered with an error in the last 5; retired.
export type ItemStatus = 'unseen' | 'learning' | 'errors' | 'retired';

export const ITEM_STATUSES: ItemStatus[] = ['retired', 'learning', 'errors', 'unseen'];

export const STATUS_LABELS: Record<ItemStatus, string> = {
  retired: 'Retired',
  learning: 'Learning',
  errors: 'Recent errors',
  unseen: 'Not yet seen',
};

// Grading colors, so the map reads like the games: green is good, yellow is
// partly there, red needs work. Unseen buttons stay unfilled.
export const STATUS_COLORS: Record<ItemStatus, string> = {
  retired: '#22c55ecc',
  learning: '#22c55e55',
  errors: '#eab308aa',
  unseen: 'transparent',
};

// A ring on retired buttons, so retired and learning differ by more than the
// fill's strength.
export const STATUS_OUTLINES: Partial<Record<ItemStatus, string>> = { retired: '#16a34a' };

export function itemStatus(record: ItemRecord | undefined): ItemStatus {
  if (!record || record.answers.length === 0) return 'unseen';
  if (isRetired(record)) return 'retired';
  return errorTally(record) > 0 ? 'errors' : 'learning';
}

export function statusCounts(
  keys: string[],
  memory: Record<string, ItemRecord>,
): Record<ItemStatus, number> {
  const counts: Record<ItemStatus, number> = { retired: 0, learning: 0, errors: 0, unseen: 0 };
  for (const key of keys) counts[itemStatus(memory[key])] += 1;
  return counts;
}
