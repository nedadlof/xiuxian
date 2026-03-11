const SAVE_KEY = 'xiuxian-sect-idle-save';
const SAVE_VERSION = 1;

export function createSaveManager(store, options = {}) {
  const storageKey = options.storageKey ?? SAVE_KEY;
  const migrations = options.migrations ?? [];

  function serialize(state) {
    return JSON.stringify({
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state,
    });
  }

  function deserialize(raw) {
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    let payload = parsed;

    for (const migrate of migrations) {
      payload = migrate(payload);
    }

    return payload;
  }

  function save() {
    const state = store.getState();
    const snapshot = {
      ...state,
      meta: {
        ...state.meta,
        updatedAt: Date.now(),
        lastSavedAt: Date.now(),
      },
    };
    localStorage.setItem(storageKey, serialize(snapshot));
    store.patch({ meta: snapshot.meta }, { type: 'save/meta-sync' });
    return snapshot;
  }

  function load() {
    const raw = localStorage.getItem(storageKey);
    const payload = deserialize(raw);
    return payload?.state ?? null;
  }

  function clear() {
    localStorage.removeItem(storageKey);
  }

  return {
    save,
    load,
    clear,
    storageKey,
  };
}

export { SAVE_KEY, SAVE_VERSION };
