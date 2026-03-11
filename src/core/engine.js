function clampOfflineSeconds(milliseconds, limitSeconds) {
  return Math.min(Math.max(milliseconds / 1000, 0), limitSeconds);
}

export function createGameEngine({ store, bus, registries, maxOfflineSeconds = 60 * 60 * 8 }) {
  const systems = [];
  let timerId = null;
  let lastFrameAt = Date.now();

  function getContext() {
    return {
      store,
      bus,
      registries,
      get state() {
        return store.getState();
      },
    };
  }

  function registerSystem(system) {
    systems.push(system);
    if (typeof system.setup === 'function') {
      system.setup(getContext());
    }
    return system;
  }

  function runTick(deltaSeconds, source = 'runtime') {
    const context = getContext();

    for (const system of systems) {
      if (typeof system.tick === 'function') {
        system.tick(context, deltaSeconds, source);
      }
    }

    store.update((draft) => {
      draft.meta.lastTickAt = Date.now();
      draft.meta.updatedAt = Date.now();
    }, { type: 'engine/tick', source, deltaSeconds });

    bus.emit('engine:ticked', { deltaSeconds, source, state: store.getState() });
  }

  function simulateOffline(lastTimestamp) {
    const offlineSeconds = clampOfflineSeconds(Date.now() - lastTimestamp, maxOfflineSeconds);
    if (offlineSeconds <= 1) {
      return 0;
    }

    const chunkSize = 30;
    let remaining = offlineSeconds;

    while (remaining > 0) {
      const delta = Math.min(chunkSize, remaining);
      runTick(delta, 'offline');
      remaining -= delta;
    }

    bus.emit('engine:offline-simulated', { offlineSeconds });
    return offlineSeconds;
  }

  function start(intervalMs = 1000) {
    stop();
    lastFrameAt = Date.now();
    timerId = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = Math.max((now - lastFrameAt) / 1000, 0.25);
      lastFrameAt = now;
      runTick(deltaSeconds, 'runtime');
    }, intervalMs);

    bus.emit('engine:started', { intervalMs });
  }

  function stop() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
      bus.emit('engine:stopped');
    }
  }

  return {
    registerSystem,
    runTick,
    simulateOffline,
    start,
    stop,
    getContext,
  };
}
