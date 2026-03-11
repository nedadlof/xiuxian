import {
  clampResource,
  getDormitoryCapacity,
  getDormitoryMaintenancePerHour,
  getLevelMultiplier,
  getUpgradeCost,
  getWorkerEfficiency,
  OFFLINE_REWARD_LIMIT_SECONDS,
} from '../data/balance.js';
import { appendLog } from './shared/logs.js';
import { collectUnlockedEffects, sumEffects } from './shared/effectResolver.js';

function ensureBuildingState(state, registries) {
  for (const building of registries.buildings.list()) {
    if (!state.buildings[building.id]) {
      state.buildings[building.id] = {
        level: building.id === 'mine' || building.id === 'lumber' || building.id === 'herbGarden' ? 1 : 0,
      };
    }
  }
}

function getUnlockedBuildingIds(state, registries) {
  const unlockedNodes = new Set(state.scripture.unlockedNodes);
  const unlocked = new Set(['mine', 'lumber', 'herbGarden']);

  for (const building of registries.buildings.list()) {
    if (!building.unlockNodeId || unlockedNodes.has(building.unlockNodeId)) {
      unlocked.add(building.id);
    }
  }

  return unlocked;
}

function computePopulationCap(housingState) {
  return housingState.dormitories.reduce((total, dormitory) => total + getDormitoryCapacity(dormitory.level), 0);
}

function getAssignedWorkerTotal(workforce) {
  return Object.values(workforce.assignedWorkers).reduce((total, value) => total + value, 0);
}

function getIdleWorkers(workforce) {
  return Math.max(workforce.totalWorkers - getAssignedWorkerTotal(workforce), 0);
}

function getBuildingResourceMultiplier(state, registries, building) {
  const { all } = collectUnlockedEffects(state, registries);
  const resourceBonus = sumEffects(
    all,
    'resourceMultiplier',
    (effect) => effect.resourceId === building.resourceId,
  );

  return 1 + resourceBonus;
}

function updateStorageCaps(state, registries) {
  for (const building of registries.buildings.list()) {
    const level = state.buildings[building.id]?.level ?? 0;
    if (level <= 0) {
      continue;
    }

    state.storage[building.resourceId] = Math.round(building.baseStorage * (1.15 ** Math.max(level - 1, 0)));
  }
}

function payResourceCost(state, costMap) {
  for (const [resourceId, amount] of Object.entries(costMap)) {
    if ((state.resources[resourceId] ?? 0) < amount) {
      return false;
    }
  }

  for (const [resourceId, amount] of Object.entries(costMap)) {
    state.resources[resourceId] -= amount;
  }

  return true;
}

function getBuildingUpgradeCost(building, level) {
  const entries = Object.entries(building.baseCosts).map(([resourceId, baseCost]) => [resourceId, getUpgradeCost(baseCost, level)]);
  return Object.fromEntries(entries);
}

function syncWorkforceState(state) {
  state.workforce.populationCap = computePopulationCap(state.housing);
  state.workforce.totalWorkers = Math.min(state.workforce.totalWorkers, state.workforce.populationCap);
}

export function createEconomySystem() {
  return {
    id: 'economy-system',
    setup({ store, bus, registries }) {
      store.update((draft) => {
        ensureBuildingState(draft, registries);
        syncWorkforceState(draft);
        updateStorageCaps(draft, registries);
      }, { type: 'economy/setup' });

      bus.on('action:economy/upgradeBuilding', ({ buildingId }) => {
        upgradeBuilding({ store, bus, registries }, buildingId);
      });

      bus.on('action:economy/assignWorkers', ({ workerKey, amount }) => {
        assignWorkers({ store, bus, registries }, workerKey, amount);
      });

      bus.on('action:economy/recruitWorkers', ({ amount }) => {
        recruitWorkers({ store, bus, registries }, amount);
      });

      bus.on('action:economy/buildDormitory', () => {
        buildDormitory({ store, bus, registries });
      });

      bus.on('action:economy/upgradeDormitory', ({ dormitoryId }) => {
        upgradeDormitory({ store, bus, registries }, dormitoryId);
      });
    },
    tick({ store, registries }, deltaSeconds) {
      store.update((draft) => {
        ensureBuildingState(draft, registries);
        syncWorkforceState(draft);
        updateStorageCaps(draft, registries);

        const unlockedBuildingIds = getUnlockedBuildingIds(draft, registries);

        for (const building of registries.buildings.list()) {
          if (!unlockedBuildingIds.has(building.id)) {
            continue;
          }

          const buildingState = draft.buildings[building.id];
          if (!buildingState || buildingState.level <= 0) {
            continue;
          }

          const workers = draft.workforce.assignedWorkers[building.workerKey] ?? 0;
          if (workers <= 0) {
            continue;
          }

          const perHour = building.baseRatePerHour
            * getLevelMultiplier(buildingState.level)
            * getWorkerEfficiency(workers)
            * getBuildingResourceMultiplier(draft, registries, building);

          const current = draft.resources[building.resourceId] ?? 0;
          const next = current + (perHour * deltaSeconds) / 3600;
          draft.resources[building.resourceId] = clampResource(next, draft.storage[building.resourceId] ?? Number.MAX_SAFE_INTEGER);
        }

        let dormitoryIndex = 0;
        for (const dormitory of draft.housing.dormitories) {
          dormitoryIndex += 1;
          if (dormitoryIndex === 1) {
            continue;
          }

          const upkeep = (getDormitoryMaintenancePerHour(dormitoryIndex) * deltaSeconds) / 3600;
          draft.resources.spiritCrystal = Math.max((draft.resources.spiritCrystal ?? 0) - upkeep, 0);
        }
      }, { type: 'economy/tick', deltaSeconds });
    },
  };
}

export function upgradeBuilding({ store, registries }, buildingId) {
  let success = false;

  store.update((draft) => {
    const building = registries.buildings.get(buildingId);
    if (!building) {
      return;
    }

    const unlockedIds = getUnlockedBuildingIds(draft, registries);
    if (!unlockedIds.has(buildingId)) {
      return;
    }

    ensureBuildingState(draft, registries);
    const currentLevel = draft.buildings[buildingId].level || 0;
    const targetLevel = Math.max(currentLevel, 1);
    const cost = getBuildingUpgradeCost(building, targetLevel);
    if (!payResourceCost(draft, cost)) {
      return;
    }

    draft.buildings[buildingId].level = currentLevel + 1;
    updateStorageCaps(draft, registries);
    appendLog(draft, 'economy', `${building.name} 升至 Lv.${draft.buildings[buildingId].level}`);
    success = true;
  }, { type: 'economy/upgrade-building', buildingId });

  return success;
}

export function assignWorkers({ store }, workerKey, amount) {
  let success = false;

  store.update((draft) => {
    const current = draft.workforce.assignedWorkers[workerKey] ?? 0;
    const next = Math.max(current + amount, 0);
    const delta = next - current;
    const idleWorkers = getIdleWorkers(draft.workforce);

    if (delta > idleWorkers) {
      return;
    }

    draft.workforce.assignedWorkers[workerKey] = next;
    success = true;
  }, { type: 'economy/assign-workers', workerKey, amount });

  return success;
}

export function getRecruitCost(totalWorkers, amount) {
  let cost = 0;
  for (let index = 0; index < amount; index += 1) {
    cost += Math.round(35 * (1.12 ** (totalWorkers + index)));
  }
  return cost;
}

export function recruitWorkers({ store }, amount = 1) {
  let success = false;

  store.update((draft) => {
    const safeAmount = Math.max(1, amount);
    const available = draft.workforce.populationCap - draft.workforce.totalWorkers;
    if (available <= 0) {
      return;
    }

    const actualAmount = Math.min(safeAmount, available);
    const cost = getRecruitCost(draft.workforce.totalWorkers, actualAmount);
    if ((draft.resources.lingStone ?? 0) < cost) {
      return;
    }

    draft.resources.lingStone -= cost;
    draft.workforce.totalWorkers += actualAmount;
    appendLog(draft, 'economy', `招募外门弟子 ${actualAmount} 名`);
    success = true;
  }, { type: 'economy/recruit-workers', amount });

  return success;
}

export function getDormitoryBuildCost(index) {
  return {
    lingStone: 500 * index,
    wood: 200 * index,
    spiritCrystal: index >= 2 ? 40 * (index - 1) : 0,
  };
}

export function getDormitoryUpgradeCost(level) {
  return {
    lingStone: getUpgradeCost(140, level),
    wood: getUpgradeCost(60, level),
  };
}

function getBuildingProductionPerHour(state, registries, building, workers, level) {
  if (level <= 0 || workers <= 0) {
    return 0;
  }

  return building.baseRatePerHour
    * getLevelMultiplier(level)
    * getWorkerEfficiency(workers)
    * getBuildingResourceMultiplier(state, registries, building);
}

function accumulateResourceValueMap(buildingSnapshots, valueKey) {
  return buildingSnapshots.reduce((totals, building) => {
    const value = building[valueKey] ?? 0;
    if (value <= 0) {
      return totals;
    }

    totals[building.resourceId] = (totals[building.resourceId] ?? 0) + value;
    return totals;
  }, {});
}

export function getEconomyOverviewSnapshot(state, registries) {
  const recruitOneCost = getRecruitCost(state.workforce.totalWorkers, 1);
  const recruitFiveCost = getRecruitCost(state.workforce.totalWorkers, 5);
  const nextDormitoryIndex = state.housing.dormitories.length + 1;
  const canBuildDormitory = state.housing.dormitories.length < state.housing.maxDormitories;
  const nextDormitoryCost = canBuildDormitory ? getDormitoryBuildCost(nextDormitoryIndex) : {};
  const buildingSnapshots = getEconomySnapshot(state, registries);
  const totalPerHour = buildingSnapshots.reduce((sum, building) => sum + building.productionPerHour, 0);
  const totalOfflineYield = buildingSnapshots.reduce((sum, building) => sum + building.offlineYieldEstimate, 0);
  const assignedWorkers = getAssignedWorkerTotal(state.workforce);
  const idleWorkers = getIdleWorkers(state.workforce);
  const populationCap = state.workforce.populationCap;
  const totalWorkers = state.workforce.totalWorkers;

  return {
    workforce: {
      totalWorkers,
      assignedWorkers,
      idleWorkers,
      populationCap,
      remainingCapacity: Math.max(populationCap - totalWorkers, 0),
    },
    recruitCosts: {
      one: { lingStone: recruitOneCost },
      five: { lingStone: recruitFiveCost },
    },
    dormitoryPlan: {
      canBuild: canBuildDormitory,
      currentCount: state.housing.dormitories.length,
      maxDormitories: state.housing.maxDormitories,
      nextIndex: nextDormitoryIndex,
      nextCost: nextDormitoryCost,
      nextCapacity: canBuildDormitory ? getDormitoryCapacity(1) : 0,
      nextMaintenancePerHour: canBuildDormitory ? getDormitoryMaintenancePerHour(nextDormitoryIndex) : 0,
    },
    nextDormitoryCost,
    dormitorySnapshots: state.housing.dormitories.map((dormitory, index) => {
      const capacity = getDormitoryCapacity(dormitory.level);
      const nextCapacity = getDormitoryCapacity(dormitory.level + 1);
      const maintenancePerHour = dormitory.maintained ? getDormitoryMaintenancePerHour(index + 1) : 0;

      return {
        id: dormitory.id,
        name: `弟子宿舍 ${index + 1}`,
        level: dormitory.level,
        capacity,
        nextCapacity,
        capacityGain: nextCapacity - capacity,
        maintenancePerHour,
        upgradeCost: getDormitoryUpgradeCost(dormitory.level),
      };
    }),
    perHourByResource: accumulateResourceValueMap(buildingSnapshots, 'productionPerHour'),
    perSecondByResource: accumulateResourceValueMap(buildingSnapshots, 'productionPerSecond'),
    offlineYieldByResource: accumulateResourceValueMap(buildingSnapshots, 'offlineYieldEstimate'),
    totalPerHour,
    totalPerSecond: totalPerHour / 3600,
    totalOfflineYield,
    offlineHours: OFFLINE_REWARD_LIMIT_SECONDS / 3600,
  };
}

export function buildDormitory({ store }) {
  let success = false;

  store.update((draft) => {
    const currentCount = draft.housing.dormitories.length;
    if (currentCount >= draft.housing.maxDormitories) {
      return;
    }

    const targetIndex = currentCount + 1;
    const cost = getDormitoryBuildCost(targetIndex);
    if (!payResourceCost(draft, cost)) {
      return;
    }

    draft.housing.dormitories.push({
      id: `dorm-${targetIndex}`,
      level: 1,
      maintained: true,
    });
    syncWorkforceState(draft);
    appendLog(draft, 'economy', `新建第 ${targetIndex} 座弟子宿舍`);
    success = true;
  }, { type: 'economy/build-dormitory' });

  return success;
}

export function upgradeDormitory({ store }, dormitoryId) {
  let success = false;

  store.update((draft) => {
    const dormitory = draft.housing.dormitories.find((item) => item.id === dormitoryId);
    if (!dormitory) {
      return;
    }

    const cost = getDormitoryUpgradeCost(dormitory.level);
    if (!payResourceCost(draft, cost)) {
      return;
    }

    dormitory.level += 1;
    syncWorkforceState(draft);
    appendLog(draft, 'economy', `${dormitory.id} 升至 Lv.${dormitory.level}`);
    success = true;
  }, { type: 'economy/upgrade-dormitory', dormitoryId });

  return success;
}

export function getEconomySnapshot(state, registries) {
  const unlockedBuildingIds = getUnlockedBuildingIds(state, registries);

  return registries.buildings.list().map((building) => {
    const level = state.buildings[building.id]?.level ?? 0;
    const workers = state.workforce.assignedWorkers[building.workerKey] ?? 0;
    const productionPerHour = getBuildingProductionPerHour(state, registries, building, workers, level);
    const storageCap = state.storage[building.resourceId] ?? building.baseStorage;
    const currentStored = state.resources[building.resourceId] ?? 0;
    const remainingStorage = Math.max(storageCap - currentStored, 0);
    const offlineHours = OFFLINE_REWARD_LIMIT_SECONDS / 3600;
    const offlineYieldEstimate = Math.min(Math.round(productionPerHour * offlineHours), remainingStorage);
    const nextLevel = Math.max(level, 0) + 1;
    const nextProductionPerHour = getBuildingProductionPerHour(state, registries, building, workers, nextLevel);
    const unlocked = unlockedBuildingIds.has(building.id);

    return {
      ...building,
      level,
      workers,
      unlocked,
      unlockNodeName: building.unlockNodeId ? (registries.techNodes.get(building.unlockNodeId)?.name ?? building.unlockNodeId) : null,
      nextCost: getBuildingUpgradeCost(building, Math.max(level, 1)),
      currentStored,
      storageUsed: currentStored,
      storageCap,
      remainingStorage,
      storageUsageRatio: storageCap > 0 ? currentStored / storageCap : 0,
      productionPerHour,
      productionPerSecond: productionPerHour / 3600,
      nextLevel,
      nextProductionPerHour,
      nextProductionPerSecond: nextProductionPerHour / 3600,
      productionGainPerHour: Math.max(nextProductionPerHour - productionPerHour, 0),
      productionGainPerSecond: Math.max((nextProductionPerHour - productionPerHour) / 3600, 0),
      offlineHours,
      offlineYieldEstimate,
    };
  });
}


