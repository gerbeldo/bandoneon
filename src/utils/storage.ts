// Versioned localStorage blobs (ADR 0003): stepwise migrations before hydration;
// an unusable blob is copied to `<key>.backup` and the app starts fresh.

export type StoredBlob = Record<string, unknown>;
export type Migration = (blob: StoredBlob) => StoredBlob;
export type Migrations = Record<number, Migration>;

export interface StorageSpec {
  key: string;
  version: number;
  migrations: Migrations;
}

export function loadBlob(
  key: string,
  currentVersion: number,
  migrations: Migrations,
): StoredBlob | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const backUpAndStartFresh = () => {
    try {
      localStorage.setItem(`${key}.backup`, raw);
    } catch {
      // The backup is best-effort; the fresh start must happen regardless.
    }
    return null;
  };

  let blob: unknown;
  try {
    blob = JSON.parse(raw);
  } catch {
    return backUpAndStartFresh();
  }
  if (typeof blob !== 'object' || blob === null || Array.isArray(blob)) {
    return backUpAndStartFresh();
  }

  const record = blob as StoredBlob;
  // A pre-versioning blob (today's settings) counts as version 0; a version
  // field that is present but not an integer marks the blob unusable.
  let version = 0;
  if ('version' in record) {
    if (typeof record.version !== 'number' || !Number.isInteger(record.version)) {
      return backUpAndStartFresh();
    }
    version = record.version;
  }
  if (version > currentVersion) return backUpAndStartFresh();

  let migrated = record;
  while (version < currentVersion) {
    version += 1;
    const step = migrations[version];
    if (!step) return backUpAndStartFresh();
    try {
      migrated = step(migrated);
    } catch {
      return backUpAndStartFresh();
    }
  }
  return { ...migrated, version: currentVersion };
}

export function saveBlob(key: string, currentVersion: number, state: object): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...state, version: currentVersion }));
  } catch {
    // Quota or disabled storage — never a hard failure (ADR 0003); the app
    // runs on with in-memory state.
  }
}

interface PersistableStore {
  $patch(partial: object): void;
  $subscribe(
    callback: (mutation: unknown, state: object) => void,
    options?: { flush?: 'sync' },
  ): void;
  $state: object;
}

// Hydrate a Pinia store from its versioned blob and keep the blob current:
// migrations run inside loadBlob before the $patch, the (possibly fresh or
// migrated) state is written back immediately, then every mutation persists.
export function persistStore(
  store: PersistableStore,
  spec: StorageSpec,
  sanitize?: (blob: StoredBlob) => void,
): void {
  const blob = loadBlob(spec.key, spec.version, spec.migrations);
  if (blob) {
    delete blob.version;
    sanitize?.(blob);
    store.$patch(blob);
  }
  saveBlob(spec.key, spec.version, store.$state);
  // flush: 'sync' — an answer must hit localStorage the moment it is recorded,
  // so abandoning a session by navigating away loses nothing.
  store.$subscribe((_mutation, state) => saveBlob(spec.key, spec.version, state), {
    flush: 'sync',
  });
}
