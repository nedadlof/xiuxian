import { createEventBus } from './core/eventBus.js';
import { createGameEngine } from './core/engine.js';
import { createDefinitionRegistry } from './core/registry.js';
import { createSaveManager } from './core/save.js';
import { createBaseState, createStore, normalizeState } from './core/store.js';
import { registerAllDefinitions } from './data/index.js';
import { createEconomySystem } from './systems/economySystem.js';
import { createScriptureSystem } from './systems/scriptureSystem.js';
import { createDisciplesBeastsSystem } from './systems/disciplesBeastsSystem.js';
import { createTradeSystem } from './systems/tradeSystem.js';
import { createWarSystem } from './systems/warSystem.js?v=20260310-11';
import {
  createCommissionSystem,
  summarizeCommissionOfflineProgress,
} from './systems/commissionSystem.js';

function buildSessionSummary(beforeState, afterState, offlineSeconds) {
  if (offlineSeconds <= 1) {
    return null;
  }

  const commissions = summarizeCommissionOfflineProgress(beforeState, afterState);

  return {
    createdAt: Date.now(),
    offlineSeconds: Math.floor(offlineSeconds),
    commissions,
  };
}

export function createGameApp() {
  const bus = createEventBus();
  const registries = createDefinitionRegistry();
  const store = createStore(createBaseState());
  const saveManager = createSaveManager(store);
  const engine = createGameEngine({ store, bus, registries });
  let autosaveTimerId = null;
  let sessionSummary = null;

  registerAllDefinitions(registries);
  engine.registerSystem(createEconomySystem());
  engine.registerSystem(createScriptureSystem());
  engine.registerSystem(createTradeSystem());
  engine.registerSystem(createWarSystem());
  engine.registerSystem(createDisciplesBeastsSystem());
  engine.registerSystem(createCommissionSystem());

  function hydrate() {
    const savedState = saveManager.load();
    if (!savedState) {
      sessionSummary = null;
      return false;
    }

    const normalizedState = normalizeState(savedState);
    store.reset(normalizedState, { type: 'app/hydrate' });
    const offlineSeconds = engine.simulateOffline(normalizedState.meta?.lastTickAt ?? Date.now());
    sessionSummary = buildSessionSummary(normalizedState, store.getState(), offlineSeconds);

    if (offlineSeconds > 1) {
      store.update((draft) => {
        const completedCount = sessionSummary?.commissions?.newCompletedCount ?? 0;
        const commissionSuffix = completedCount > 0 ? `，委托完成 ${completedCount} 项` : '';
        draft.logs.unshift({
          id: `hydrate-${Date.now()}`,
          category: 'system',
          message: `离线结算完成：${Math.floor(offlineSeconds)} 秒${commissionSuffix}`,
          createdAt: Date.now(),
        });
        draft.logs = draft.logs.slice(0, 80);
      }, { type: 'app/offline-summary' });
    }

    return true;
  }

  function startAutosave(intervalMs = 30000) {
    if (typeof window === 'undefined') {
      return;
    }

    if (autosaveTimerId !== null) {
      clearInterval(autosaveTimerId);
    }

    autosaveTimerId = window.setInterval(() => {
      saveManager.save();
    }, intervalMs);
  }

  function stopAutosave() {
    if (autosaveTimerId !== null) {
      clearInterval(autosaveTimerId);
      autosaveTimerId = null;
    }
  }

  function start() {
    hydrate();
    engine.start(1000);
    startAutosave();
    return { store, bus, engine, registries, saveManager };
  }

  return {
    store,
    bus,
    engine,
    registries,
    saveManager,
    hydrate,
    getSessionSummary: () => sessionSummary,
    start,
    stopAutosave,
  };
}
