export function createRegistry() {
  const records = new Map();

  function register(key, definition) {
    if (records.has(key)) {
      throw new Error(`Registry key already exists: ${key}`);
    }

    records.set(key, definition);
    return definition;
  }

  function upsert(key, definition) {
    records.set(key, definition);
    return definition;
  }

  function get(key) {
    return records.get(key);
  }

  function has(key) {
    return records.has(key);
  }

  function remove(key) {
    records.delete(key);
  }

  function list() {
    return [...records.values()];
  }

  function entries() {
    return [...records.entries()];
  }

  return {
    register,
    upsert,
    get,
    has,
    remove,
    list,
    entries,
  };
}

export function createDefinitionRegistry() {
  return {
    buildings: createRegistry(),
    techNodes: createRegistry(),
    units: createRegistry(),
    disciples: createRegistry(),
    beasts: createRegistry(),
    stages: createRegistry(),
    systems: createRegistry(),
  };
}
