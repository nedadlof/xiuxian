import {
  clampResource,
  getDormitoryCapacity,
  getDormitoryMaintenancePerHour,
  getLevelMultiplier,
  getUpgradeCost,
  getWorkerEfficiency,
  OFFLINE_REWARD_LIMIT_SECONDS,
} from '../data/balance.js';
import {
  getBattlePreparationCost,
  listBattlePreparationDefinitions,
} from '../data/battlePreparations.js';
import { getWarehouseEffects, getWarehouseStorageResourceIds } from '../data/warehouse.js';
import { appendLog } from './shared/logs.js';
import {
  brewPillRecipeInState,
  canAffordCraftCost,
  dismantleWeaponInState,
  ensureCraftingState,
  ensureWorkshopOrdersInState,
  fulfillWorkshopOrderInState,
  forgeWeaponInState,
  getCraftingSnapshot,
  getWeaponReforgeCost,
  getWeaponStrengthenCost,
  payCraftCost,
  refreshWorkshopOrdersInState,
  reforgeWeaponInState,
  strengthenWeaponInState,
} from './shared/crafting.js';
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
  const warehouseEffects = getWarehouseEffects(state);
  const warehouseBonus = Math.max(warehouseEffects.economyGlobalOutputMultiplier ?? 0, 0)
    + Math.max(warehouseEffects.economyOutputByResource?.[building.resourceId] ?? 0, 0);

  return 1 + resourceBonus + warehouseBonus;
}

function updateStorageCaps(state, registries) {
  const warehouseEffects = getWarehouseEffects(state);
  const storageMultiplier = 1 + Math.max(warehouseEffects.storageMultiplier ?? 0, 0);
  const boostedResourceIds = new Set(getWarehouseStorageResourceIds());

  for (const building of registries.buildings.list()) {
    const level = Math.max(state.buildings[building.id]?.level ?? 0, 0);
    const buildingMultiplier = 1.15 ** Math.max(level - 1, 0);
    const warehouseMultiplier = boostedResourceIds.has(building.resourceId) ? storageMultiplier : 1;
    state.storage[building.resourceId] = Math.round(building.baseStorage * buildingMultiplier * warehouseMultiplier);
  }
}

function ensurePreparationState(state) {
  state.preparations ??= { levels: {} };
  state.preparations.levels ??= {};
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
        ensurePreparationState(draft);
        ensureCraftingState(draft);
        ensureWorkshopOrdersInState(draft);
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

      bus.on('action:economy/refinePreparation', ({ preparationId }) => {
        refineBattlePreparation({ store, registries }, preparationId);
      });

      bus.on('action:economy/forgeWeapon', ({ blueprintId }) => {
        forgeWeapon({ store }, blueprintId);
      });

      bus.on('action:economy/strengthenWeapon', ({ weaponId }) => {
        strengthenWeapon({ store }, weaponId);
      });

      bus.on('action:economy/reforgeWeapon', ({ weaponId }) => {
        reforgeWeapon({ store }, weaponId);
      });

      bus.on('action:economy/dismantleWeapon', ({ weaponId }) => {
        dismantleWeapon({ store }, weaponId);
      });

      bus.on('action:economy/brewPill', ({ recipeId }) => {
        brewPill({ store }, recipeId);
      });

      bus.on('action:economy/refreshWorkshopOrders', () => {
        refreshWorkshopOrders({ store });
      });

      bus.on('action:economy/fulfillWorkshopOrder', ({ orderId }) => {
        fulfillWorkshopOrder({ store }, orderId);
      });
    },
    tick({ store, registries }, deltaSeconds) {
      store.update((draft) => {
        ensureBuildingState(draft, registries);
        ensurePreparationState(draft);
        ensureCraftingState(draft);
        ensureWorkshopOrdersInState(draft);
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
  const preparations = getBattlePreparationSnapshot(state, registries);
  const crafting = getManufacturingSnapshot(state, registries);

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
    preparations,
    crafting,
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

export function refineBattlePreparation({ store, registries }, preparationId) {
  let success = false;

  store.update((draft) => {
    ensureBuildingState(draft, registries);
    ensurePreparationState(draft);
    const definition = listBattlePreparationDefinitions().find((item) => item.id === preparationId);
    if (!definition) {
      return;
    }

    const unlockedBuildingIds = getUnlockedBuildingIds(draft, registries);
    if (!unlockedBuildingIds.has(definition.buildingId)) {
      return;
    }

    const currentLevel = draft.preparations.levels?.[preparationId] ?? 0;
    const maxLevel = definition.maxLevel ?? 10;
    if (currentLevel >= maxLevel) {
      return;
    }

    const cost = getBattlePreparationCost(preparationId, currentLevel);
    if (!payResourceCost(draft, cost)) {
      return;
    }

    draft.preparations.levels[preparationId] = currentLevel + 1;
    appendLog(draft, 'economy', `${definition.name} 提升至 Lv.${currentLevel + 1}`);
    success = true;
  }, { type: 'economy/refine-preparation', preparationId });

  return success;
}

export function getBattlePreparationSnapshot(state, registries) {
  ensurePreparationState(state);
  const unlockedBuildingIds = getUnlockedBuildingIds(state, registries);

  return listBattlePreparationDefinitions().map((definition) => {
    const level = state.preparations.levels?.[definition.id] ?? 0;
    const maxLevel = definition.maxLevel ?? 10;
    const totalEffects = (definition.effects ?? []).map((effect) => ({
      ...effect,
      value: typeof effect.value === 'number' ? effect.value * level : effect.value,
    }));

    return {
      ...definition,
      unlocked: unlockedBuildingIds.has(definition.buildingId),
      buildingName: registries.buildings.get(definition.buildingId)?.name ?? definition.buildingId,
      level,
      maxLevel,
      nextCost: getBattlePreparationCost(definition.id, level),
      canRefine: unlockedBuildingIds.has(definition.buildingId) && level < maxLevel,
      totalEffects,
    };
  });
}

function getCraftRequirementLines(definition, registries, branch = 'weapon') {
  const lines = [];
  const workshopLevel = branch === 'weapon'
    ? Math.max(Number(definition?.smithyLevel) || 0, 0)
    : Math.max(Number(definition?.alchemyLevel) || 0, 0);
  if (workshopLevel > 0) {
    lines.push(`${branch === 'weapon' ? '锻炉' : '丹房'}等级 ${workshopLevel}`);
  }
  if ((definition?.requiredReputation ?? 0) > 0) {
    lines.push(`委托声望 ${definition.requiredReputation}`);
  }
  if (definition?.requiredStageId) {
    lines.push(`关卡 ${registries.stages.get(definition.requiredStageId)?.name ?? definition.requiredStageId}`);
  }
  if (definition?.requiredNodeId) {
    lines.push(`科技 ${registries.techNodes.get(definition.requiredNodeId)?.name ?? definition.requiredNodeId}`);
  }
  return lines;
}

function decorateManufacturingDefinition(definition, registries, branch = 'weapon') {
  return {
    ...definition,
    requirements: getCraftRequirementLines(definition, registries, branch),
  };
}

export function getManufacturingSnapshot(state, registries) {
  const snapshot = getCraftingSnapshot(state);
  const unlockedBlueprints = snapshot.arsenal.blueprints
    .filter((definition) => definition.unlocked)
    .map((definition) => decorateManufacturingDefinition(definition, registries, 'weapon'));
  const lockedBlueprints = snapshot.arsenal.blueprints
    .filter((definition) => !definition.unlocked)
    .map((definition) => decorateManufacturingDefinition(definition, registries, 'weapon'));
  const unlockedRecipes = snapshot.alchemy.recipes
    .filter((definition) => definition.unlocked)
    .map((definition) => decorateManufacturingDefinition(definition, registries, 'pill'));
  const lockedRecipes = snapshot.alchemy.recipes
    .filter((definition) => !definition.unlocked)
    .map((definition) => decorateManufacturingDefinition(definition, registries, 'pill'));

  return {
    arsenal: {
      ...snapshot.arsenal,
      unlockedBlueprints,
      lockedBlueprints: lockedBlueprints.slice(0, 6),
    },
    alchemy: {
      ...snapshot.alchemy,
      unlockedRecipes,
      lockedRecipes: lockedRecipes.slice(0, 6),
    },
    workshop: {
      ...snapshot.workshop,
    },
  };
}

export function forgeWeapon({ store }, blueprintId) {
  let success = false;

  store.update((draft) => {
    ensureCraftingState(draft);
    const snapshot = getCraftingSnapshot(draft);
    const blueprint = snapshot.arsenal.blueprints.find((entry) => entry.id === blueprintId);
    if (!blueprint?.unlocked || !payCraftCost(draft, blueprint.cost)) {
      return;
    }

    const forged = forgeWeaponInState(draft, blueprintId);
    if (!forged) {
      return;
    }

    appendLog(
      draft,
      'economy',
      `锻成 ${forged.name} · ${forged.qualityLabel}，附带 ${forged.affixes?.map((effect) => effect.name).join('、') || '无词条'}`,
    );
    success = true;
  }, { type: 'economy/forge-weapon', blueprintId });

  return success;
}

export function strengthenWeapon({ store }, weaponId) {
  let success = false;

  store.update((draft) => {
    ensureCraftingState(draft);
    ensureWorkshopOrdersInState(draft);
    const snapshot = getCraftingSnapshot(draft);
    const weapon = snapshot.arsenal.inventory.find((entry) => entry.id === weaponId);
    if (!weapon) {
      return;
    }

    const cost = getWeaponStrengthenCost(weapon);
    if (!payCraftCost(draft, cost)) {
      return;
    }

    const updated = strengthenWeaponInState(draft, weaponId);
    if (!updated) {
      return;
    }

    appendLog(draft, 'economy', `${weapon.name} 强化至 +${(updated.strengthenLevel ?? 0)}`);
    success = true;
  }, { type: 'economy/strengthen-weapon', weaponId });

  return success;
}

export function reforgeWeapon({ store }, weaponId) {
  let success = false;

  store.update((draft) => {
    ensureCraftingState(draft);
    ensureWorkshopOrdersInState(draft);
    const snapshot = getCraftingSnapshot(draft);
    const weapon = snapshot.arsenal.inventory.find((entry) => entry.id === weaponId);
    if (!weapon) {
      return;
    }

    const cost = getWeaponReforgeCost(weapon);
    if (!payCraftCost(draft, cost)) {
      return;
    }

    const updated = reforgeWeaponInState(draft, weaponId);
    if (!updated) {
      return;
    }

    appendLog(
      draft,
      'economy',
      `${weapon.name} 重铸洗练完成，当前 ${updated.qualityLabel}，词条改为 ${updated.affixes?.map((effect) => effect.name).join('、') || '无词条'}`,
    );
    success = true;
  }, { type: 'economy/reforge-weapon', weaponId });

  return success;
}

export function dismantleWeapon({ store }, weaponId) {
  let success = false;

  store.update((draft) => {
    ensureCraftingState(draft);
    const result = dismantleWeaponInState(draft, weaponId);
    if (!result) {
      return;
    }

    appendLog(
      draft,
      'economy',
      `分解 ${result.weapon.name}，回收器魂 ${result.reward.weaponEssence ?? 0}`,
    );
    success = true;
  }, { type: 'economy/dismantle-weapon', weaponId });

  return success;
}

export function brewPill({ store }, recipeId) {
  let success = false;

  store.update((draft) => {
    ensureCraftingState(draft);
    ensureWorkshopOrdersInState(draft);
    const snapshot = getCraftingSnapshot(draft);
    const recipe = snapshot.alchemy.recipes.find((entry) => entry.id === recipeId);
    if (!recipe?.unlocked || !payCraftCost(draft, recipe.cost)) {
      return;
    }

    const brewed = brewPillRecipeInState(draft, recipeId);
    if (!brewed) {
      return;
    }

    appendLog(
      draft,
      'economy',
      `炼成 ${brewed.name} · ${brewed.potencyLabel}，可供 ${brewed.servings ?? 1} 次调剂`,
    );
    success = true;
  }, { type: 'economy/brew-pill', recipeId });

  return success;
}

export function refreshWorkshopOrders({ store }) {
  let success = false;

  store.update((draft) => {
    ensureCraftingState(draft);
    ensureWorkshopOrdersInState(draft);
    const snapshot = getCraftingSnapshot(draft);
    if (!payCraftCost(draft, snapshot.workshop.refreshCost)) {
      return;
    }

    refreshWorkshopOrdersInState(draft);
    appendLog(draft, 'economy', '已刷新本轮工坊订单');
    success = true;
  }, { type: 'economy/refresh-workshop-orders' });

  return success;
}

export function fulfillWorkshopOrder({ store }, orderId) {
  let success = false;

  store.update((draft) => {
    ensureCraftingState(draft);
    ensureWorkshopOrdersInState(draft);
    const result = fulfillWorkshopOrderInState(draft, orderId);
    if (!result) {
      return;
    }

    appendLog(
      draft,
      'economy',
      `完成工坊订单：${result.order.title}，交付 ${result.order.bestMatchName ?? result.submitted?.name ?? '成品'}，声望 +${result.order.reputationReward ?? 0}`,
    );
    success = true;
  }, { type: 'economy/fulfill-workshop-order', orderId });

  return success;
}


