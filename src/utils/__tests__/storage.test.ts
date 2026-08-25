// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { practiceStorage, usePracticeStore } from '../../stores/practice';
import { settingsStorage, useSettingsStore } from '../../stores/settings';
import { loadBlob, persistStore, saveBlob } from '../storage';

// A blob persisted by the pre-versioning app: no version field, stale difficulty and locale keys.
const legacySettings = {
  instrument: 'rheinische142',
  locale: 'es',
  pitchNotation: 'helmholtz',
  userChords: { right: { C: ['C4', 'E4', 'G4'] } },
  difficulty: 'easy',
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadBlob', () => {
  it('returns null for an absent key without writing a backup', () => {
    expect(loadBlob('settings', 1, {})).toBeNull();
    expect(localStorage.getItem('settings.backup')).toBeNull();
  });

  it('returns a current-version blob unchanged', () => {
    localStorage.setItem('settings', JSON.stringify({ version: 1, locale: 'es' }));
    expect(loadBlob('settings', 1, {})).toEqual({ version: 1, locale: 'es' });
  });

  it('migrates a legacy settings blob, losing difficulty and locale', () => {
    localStorage.setItem('settings', JSON.stringify(legacySettings));

    const migrated = loadBlob('settings', settingsStorage.version, settingsStorage.migrations);

    const { difficulty: _difficulty, locale: _locale, ...kept } = legacySettings;
    expect(migrated).toEqual({ ...kept, version: 2 });
    expect(localStorage.getItem('settings.backup')).toBeNull();
  });

  it('runs migrations stepwise, oldest first', () => {
    localStorage.setItem('practice', JSON.stringify({ version: 1, steps: [] }));

    const migrated = loadBlob('practice', 3, {
      1: () => {
        throw new Error('a v1 blob must not re-run migration 1');
      },
      2: (blob) => ({ ...blob, steps: [...(blob.steps as string[]), '1→2'] }),
      3: (blob) => ({ ...blob, steps: [...(blob.steps as string[]), '2→3'] }),
    });

    expect(migrated).toEqual({ version: 3, steps: ['1→2', '2→3'] });
  });

  it('returns null instead of throwing when storage is unreadable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(loadBlob('settings', 1, {})).toBeNull();
  });
});

describe('loadBlob backup policy — unusable blobs start fresh, nothing is deleted', () => {
  it('copies an unparseable blob to the backup key and returns null', () => {
    localStorage.setItem('practice', '{corrupt');

    expect(loadBlob('practice', 1, {})).toBeNull();
    expect(localStorage.getItem('practice.backup')).toBe('{corrupt');
    expect(localStorage.getItem('practice')).toBe('{corrupt');
  });

  it('backs up a blob whose version is newer than the app (deploy rollback)', () => {
    const future = JSON.stringify({ version: 9, items: {} });
    localStorage.setItem('practice', future);

    expect(loadBlob('practice', 1, {})).toBeNull();
    expect(localStorage.getItem('practice.backup')).toBe(future);
  });

  it('backs up parseable JSON that is not an object', () => {
    localStorage.setItem('practice', '"just a string"');

    expect(loadBlob('practice', 1, {})).toBeNull();
    expect(localStorage.getItem('practice.backup')).toBe('"just a string"');
  });

  it('backs up a blob whose version field is not an integer', () => {
    const malformed = JSON.stringify({ version: '1', items: {} });
    localStorage.setItem('practice', malformed);

    expect(loadBlob('practice', 1, {})).toBeNull();
    expect(localStorage.getItem('practice.backup')).toBe(malformed);
  });

  it('backs up a blob whose migration step is missing', () => {
    const orphan = JSON.stringify({ version: 0 });
    localStorage.setItem('practice', orphan);

    expect(loadBlob('practice', 1, {})).toBeNull();
    expect(localStorage.getItem('practice.backup')).toBe(orphan);
  });

  it('backs up a blob whose migration throws instead of crashing', () => {
    const poison = JSON.stringify({ locale: 'es' });
    localStorage.setItem('settings', poison);

    const result = loadBlob('settings', 1, {
      1: () => {
        throw new Error('boom');
      },
    });

    expect(result).toBeNull();
    expect(localStorage.getItem('settings.backup')).toBe(poison);
  });

  it('still starts fresh when even the backup write fails', () => {
    localStorage.setItem('practice', '{corrupt');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(loadBlob('practice', 1, {})).toBeNull();
  });
});

describe('saveBlob', () => {
  it('persists state with a top-level version that round-trips through loadBlob', () => {
    saveBlob('practice', 1, { items: { 'a-key': { firstSeen: 5, answers: [] } } });

    expect(JSON.parse(localStorage.getItem('practice')!)).toEqual({
      version: 1,
      items: { 'a-key': { firstSeen: 5, answers: [] } },
    });
    expect(loadBlob('practice', 1, {})).toEqual({
      version: 1,
      items: { 'a-key': { firstSeen: 5, answers: [] } },
    });
  });

  it('swallows a failed write instead of crashing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => saveBlob('practice', 1, { items: {} })).not.toThrow();
  });
});

describe('persistStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('persists an empty versioned practice blob on a first visit', () => {
    const practice = usePracticeStore();

    persistStore(practice, practiceStorage);

    expect(JSON.parse(localStorage.getItem('practice')!)).toEqual({ version: 1, items: {} });
  });

  it('hydrates the practice store from a stored versioned blob', () => {
    const stored = {
      version: 1,
      items: { 'key-a': { firstSeen: 7, answers: [] } },
    };
    localStorage.setItem('practice', JSON.stringify(stored));
    const practice = usePracticeStore();

    persistStore(practice, practiceStorage);

    expect(practice.items['key-a']).toEqual({ firstSeen: 7, answers: [] });
  });

  it('writes every change back immediately', () => {
    const practice = usePracticeStore();
    persistStore(practice, practiceStorage);

    practice.recordAnswer('key-a', { grade: 2, timestamp: 9, responseMs: 800, mode: 'note-game' });

    expect(JSON.parse(localStorage.getItem('practice')!)).toEqual({
      version: 1,
      items: {
        'key-a': {
          firstSeen: 9,
          answers: [{ grade: 2, timestamp: 9, responseMs: 800, mode: 'note-game' }],
        },
      },
    });
  });

  it('migrates a legacy settings blob before hydrating and persists the result', () => {
    localStorage.setItem('settings', JSON.stringify(legacySettings));
    const settings = useSettingsStore();

    persistStore(settings, settingsStorage);

    expect(settings.pitchNotation).toBe('helmholtz');
    expect('difficulty' in settings.$state).toBe(false);
    expect('locale' in settings.$state).toBe(false);
    const persisted = JSON.parse(localStorage.getItem('settings')!);
    expect(persisted.version).toBe(2);
    expect('difficulty' in persisted).toBe(false);
    expect('locale' in persisted).toBe(false);
  });

  it('starts fresh over an unusable blob after backing it up', () => {
    localStorage.setItem('practice', '{corrupt');
    const practice = usePracticeStore();

    persistStore(practice, practiceStorage);

    expect(practice.items).toEqual({});
    expect(localStorage.getItem('practice.backup')).toBe('{corrupt');
    expect(JSON.parse(localStorage.getItem('practice')!)).toEqual({ version: 1, items: {} });
  });

  it('lets a sanitize hook fix a hydrated blob before it reaches the store', () => {
    localStorage.setItem(
      'settings',
      JSON.stringify({ version: 1, instrument: 'gone-instrument', locale: 'es' }),
    );
    const settings = useSettingsStore();

    persistStore(settings, settingsStorage, (blob) => {
      if (blob.instrument === 'gone-instrument') blob.instrument = 'rheinische142';
    });

    expect(settings.instrument).toBe('rheinische142');
  });
});
