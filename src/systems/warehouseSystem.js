import {
  getWarehouseEffects,
  getWarehouseSealDefinition,
  getWarehouseSealProgress,
  getWarehouseStorageResourceIds,
  getWarehouseStrategyAvailability,
  listWarehouseSealDefinitions,
  listWarehouseStrategyDefinitions,
  resolveWarehouseActiveStrategyId,
} from '../data/warehouse.js';
import { appendLog } from './shared/logs.js';

const DEFAULT_AUTO_SEAL_INTERVAL_MS = 45 * 1000;

function createWarehouseBaseState() {
  return {
    seals: {},
    activeStrategyId: 'balanced-ledger',
    autoSealEnabled: false,
    nextAutoSealAt: 0,
  };
}

function ensureWarehouseState(state) {
  state.warehouse ??= createWarehouseBaseState();
  state.warehouse.seals ??= {};
  state.warehouse.activeStrategyId = resolveWarehouseActiveStrategyId(
    state.warehouse.activeStrategyId ?? 'balanced-ledger',
    state.warehouse.seals,
  );
  state.warehouse.autoSealEnabled ??= false;
  state.warehouse.nextAutoSealAt ??= 0;
}

function canAffordCost(state, cost = {}) {
  return Object.entries(cost ?? {}).every(([resourceId, amount]) => (
    (state.resources?.[resourceId] ?? 0) >= (Number(amount) || 0)
  ));
}

function payCost(state, cost = {}) {
  for (const [resourceId, amount] of Object.entries(cost ?? {})) {
    state.resources[resourceId] = Math.max((state.resources?.[resourceId] ?? 0) - (Number(amount) || 0), 0);
  }
}

function getStorageMultiplier(state) {
  const effects = getWarehouseEffects(state);
  return 1 + Math.max(effects.storageMultiplier ?? 0, 0);
}

function recalculateWarehouseStorageCaps(state, registries) {
  const storageMultiplier = getStorageMultiplier(state);
  const boostedResourceIds = new Set(getWarehouseStorageResourceIds());

  for (const building of registries.buildings.list()) {
    const level = Math.max(state.buildings?.[building.id]?.level ?? 0, 0);
    const buildingMultiplier = 1.15 ** Math.max(level - 1, 0);
    const warehouseMultiplier = boostedResourceIds.has(building.resourceId) ? storageMultiplier : 1;
    state.storage[building.resourceId] = Math.round(building.baseStorage * buildingMultiplier * warehouseMultiplier);
  }
}

function getResourcePressure(state, resourceId, costAmount = 1) {
  const current = Math.max(state.resources?.[resourceId] ?? 0, 0);
  const cap = Math.max(state.storage?.[resourceId] ?? 0, 0);
  const safeCost = Math.max(Number(costAmount) || 1, 1);

  if (cap > 0 && cap < 1000000) {
    return Math.min(current / cap, 1.4);
  }

  return Math.min(current / (safeCost * 8), 1.2);
}

function getSealPressureScore(state, definition = {}) {
  const trackedResources = definition.trackedResourceIds ?? [];
  if (!trackedResources.length) {
    return 0;
  }

  const total = trackedResources.reduce((sum, resourceId) => (
    sum + getResourcePressure(state, resourceId, definition.cost?.[resourceId] ?? 1)
  ), 0);
  return total / trackedResources.length;
}

function getAutoSealCandidate(state) {
  ensureWarehouseState(state);
  const activeStrategyId = resolveWarehouseActiveStrategyId(
    state.warehouse.activeStrategyId,
    state.warehouse.seals,
  );
  const preferredSealIds = new Set(
    listWarehouseStrategyDefinitions().find((definition) => definition.id === activeStrategyId)?.preferredSealIds ?? [],
  );

  return listWarehouseSealDefinitions()
    .filter((definition) => canAffordCost(state, definition.cost))
    .map((definition) => {
      const progress = getWarehouseSealProgress(definition, state.warehouse.seals?.[definition.id] ?? 0);
      const pressureScore = getSealPressureScore(state, definition);
      const preferenceScore = preferredSealIds.has(definition.id) ? 0.28 : 0;
      const catchUpScore = Math.max(0, (progress.maxLevel - progress.level) * 0.03);
      return {
        definition,
        score: pressureScore + preferenceScore + catchUpScore,
      };
    })
    .sort((left, right) => right.score - left.score)[0]?.definition ?? null;
}

function sealWarehouseInState(state, registries, sealId, { now = Date.now(), origin = 'manual' } = {}) {
  ensureWarehouseState(state);
  const definition = getWarehouseSealDefinition(sealId);
  if (!definition || !canAffordCost(state, definition.cost)) {
    return false;
  }

  const before = getWarehouseSealProgress(definition, state.warehouse.seals?.[definition.id] ?? 0);
  payCost(state, definition.cost);
  state.warehouse.seals[definition.id] = (state.warehouse.seals?.[definition.id] ?? 0) + 1;
  state.warehouse.activeStrategyId = resolveWarehouseActiveStrategyId(state.warehouse.activeStrategyId, state.warehouse.seals);
  state.warehouse.nextAutoSealAt = now + DEFAULT_AUTO_SEAL_INTERVAL_MS;
  recalculateWarehouseStorageCaps(state, registries);

  const after = getWarehouseSealProgress(definition, state.warehouse.seals?.[definition.id] ?? 0);
  appendLog(
    state,
    'economy',
    `${origin === 'auto' ? '仓库自动封存' : '已封存'}：${definition.name}（第 ${after.sealCount} 次）`,
  );
  if (after.level > before.level) {
    appendLog(state, 'economy', `仓库晋阶：${definition.name} 达到 ${after.level} 阶`);
  }

  return true;
}

function runWarehouseAutoSeal(state, registries, now = Date.now()) {
  ensureWarehouseState(state);
  if (!state.warehouse.autoSealEnabled || (state.warehouse.nextAutoSealAt ?? 0) > now) {
    return false;
  }

  const candidate = getAutoSealCandidate(state);
  if (!candidate) {
    state.warehouse.nextAutoSealAt = now + DEFAULT_AUTO_SEAL_INTERVAL_MS;
    return false;
  }

  return sealWarehouseInState(state, registries, candidate.id, { now, origin: 'auto' });
}

export function createWarehouseSystem() {
  return {
    id: 'warehouse-system',
    setup({ store, bus, registries }) {
      store.update((draft) => {
        ensureWarehouseState(draft);
        recalculateWarehouseStorageCaps(draft, registries);
      }, { type: 'warehouse/setup' });

      bus.on('action:warehouse/seal', ({ sealId }) => {
        sealWarehouse({ store, registries }, sealId);
      });

      bus.on('action:warehouse/set-strategy', ({ strategyId }) => {
        setWarehouseStrategy({ store, registries }, strategyId);
      });

      bus.on('action:warehouse/toggle-auto-seal', () => {
        toggleWarehouseAutoSeal({ store });
      });
    },
    tick({ store, registries }) {
      store.update((draft) => {
        ensureWarehouseState(draft);
        runWarehouseAutoSeal(draft, registries, Date.now());
      }, { type: 'warehouse/tick' });
    },
  };
}

export function sealWarehouse({ store, registries }, sealId) {
  let success = false;

  store.update((draft) => {
    success = sealWarehouseInState(draft, registries, sealId, { now: Date.now(), origin: 'manual' });
  }, { type: 'warehouse/seal', sealId });

  return success;
}

export function setWarehouseStrategy({ store, registries }, strategyId) {
  let success = false;

  store.update((draft) => {
    ensureWarehouseState(draft);
    const effects = getWarehouseEffects(draft);
    const definition = listWarehouseStrategyDefinitions().find((item) => item.id === strategyId);
    const availability = getWarehouseStrategyAvailability(definition, effects.totalLevel);
    if (!definition || !availability.unlocked) {
      return;
    }

    draft.warehouse.activeStrategyId = definition.id;
    recalculateWarehouseStorageCaps(draft, registries);
    appendLog(draft, 'economy', `仓策切换为：${definition.name}`);
    success = true;
  }, { type: 'warehouse/set-strategy', strategyId });

  return success;
}

export function toggleWarehouseAutoSeal({ store }) {
  let enabled = false;

  store.update((draft) => {
    ensureWarehouseState(draft);
    draft.warehouse.autoSealEnabled = !draft.warehouse.autoSealEnabled;
    if (draft.warehouse.autoSealEnabled) {
      draft.warehouse.nextAutoSealAt = Math.min(draft.warehouse.nextAutoSealAt ?? Infinity, Date.now());
    }
    enabled = draft.warehouse.autoSealEnabled;
    appendLog(draft, 'economy', `仓库自动封存已${enabled ? '开启' : '关闭'}`);
  }, { type: 'warehouse/toggle-auto-seal' });

  return enabled;
}

export function getWarehouseSnapshot(state = {}) {
  const safeState = {
    ...state,
    warehouse: {
      ...createWarehouseBaseState(),
      ...(state.warehouse ?? {}),
      seals: {
        ...(state.warehouse?.seals ?? {}),
      },
    },
  };
  safeState.warehouse.activeStrategyId = resolveWarehouseActiveStrategyId(
    safeState.warehouse.activeStrategyId,
    safeState.warehouse.seals,
  );

  const effects = getWarehouseEffects(safeState);
  const pressureEntries = getWarehouseStorageResourceIds()
    .map((resourceId) => {
      const current = Math.max(safeState.resources?.[resourceId] ?? 0, 0);
      const cap = Math.max(safeState.storage?.[resourceId] ?? 0, 0);
      return {
        resourceId,
        current,
        cap,
        ratio: cap > 0 ? current / cap : 0,
      };
    })
    .sort((left, right) => right.ratio - left.ratio);

  return {
    totalLevel: effects.totalLevel,
    autoSealEnabled: Boolean(safeState.warehouse.autoSealEnabled),
    nextAutoSealAt: safeState.warehouse.nextAutoSealAt ?? 0,
    activeStrategy: effects.activeStrategy,
    strategies: listWarehouseStrategyDefinitions().map((definition) => {
      const availability = getWarehouseStrategyAvailability(definition, effects.totalLevel);
      return {
        ...definition,
        unlocked: availability.unlocked,
        requiredLevel: availability.requiredLevel,
        active: effects.activeStrategy?.id === definition.id,
      };
    }),
    seals: listWarehouseSealDefinitions().map((definition) => {
      const progress = getWarehouseSealProgress(definition, safeState.warehouse.seals?.[definition.id] ?? 0);
      return {
        ...definition,
        ...progress,
        progressPercent: Math.round(progress.progressToNext * 100),
        affordable: canAffordCost(safeState, definition.cost),
        pressureScore: getSealPressureScore(safeState, definition),
        currentLevelBonus: effects.sealLevels?.[definition.id] ?? 0,
        resourceEntries: Object.entries(definition.cost ?? {}).map(([resourceId, amount]) => ({
          resourceId,
          amount,
          current: Math.max(safeState.resources?.[resourceId] ?? 0, 0),
          cap: Math.max(safeState.storage?.[resourceId] ?? 0, 0),
        })),
      };
    }),
    pressureEntries,
    bonuses: {
      storageMultiplier: effects.storageMultiplier,
      economyGlobalOutputMultiplier: effects.economyGlobalOutputMultiplier,
      economyOutputByResource: { ...(effects.economyOutputByResource ?? {}) },
      commissionRewardMultiplier: effects.commissionRewardMultiplier,
      commissionReputationFlatBonus: effects.commissionReputationFlatBonus,
      commissionAffairsFlatBonus: effects.commissionAffairsFlatBonus,
      warRewardMultiplier: effects.warRewardMultiplier,
      warLootAmountMultiplier: effects.warLootAmountMultiplier,
    },
  };
}
