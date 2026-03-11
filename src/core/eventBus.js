export function createEventBus() {
  const listeners = new Map();

  function on(eventName, handler) {
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }

    listeners.get(eventName).add(handler);

    return () => off(eventName, handler);
  }

  function once(eventName, handler) {
    const unsubscribe = on(eventName, (payload) => {
      unsubscribe();
      handler(payload);
    });

    return unsubscribe;
  }

  function off(eventName, handler) {
    const bucket = listeners.get(eventName);
    if (!bucket) {
      return;
    }

    bucket.delete(handler);
    if (bucket.size === 0) {
      listeners.delete(eventName);
    }
  }

  function emit(eventName, payload) {
    const bucket = listeners.get(eventName);
    if (!bucket) {
      return;
    }

    for (const handler of bucket) {
      handler(payload);
    }
  }

  return {
    on,
    once,
    off,
    emit,
  };
}
