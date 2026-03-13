import {
  getCraftingCatalogCounts,
  getPillRecipeDefinition,
  getWeaponAffixPool,
  getWeaponBlueprint,
  listPillRecipeDefinitions,
  listWeaponBlueprints,
} from '../../data/craftingCatalog.js';

const RARITY_RANK = Object.freeze({
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
});

const QUALITY_LABELS = Object.freeze([
  { min: 1.16, label: '绝品' },
  { min: 1.08, label: '上品' },
  { min: 0.98, label: '精良' },
  { min: 0, label: '凡成' },
]);

const WORKSHOP_ORDER_SLOT_ORDER = Object.freeze(['weapon-basic', 'pill-basic', 'featured']);

const EFFECT_TYPE_LABELS = Object.freeze({
  battleAttack: '攻势',
  battleDefense: '守势',
  battleSustain: '续航',
  battleLoot: '战利',
  unitPowerMultiplier: '兵势',
  resourceMultiplier: '产线',
});

function roundEffectValue(value) {
  return Math.round((Number(value) || 0) * 10000) / 10000;
}

function cloneEffects(effects = []) {
  return effects.map((effect) => ({ ...effect }));
}

function scaleEffects(effects = [], multiplier = 1) {
  return effects.map((effect) => ({
    ...effect,
    value: typeof effect.value === 'number' ? roundEffectValue(effect.value * multiplier) : effect.value,
  }));
}

function scoreEffect(effect = {}) {
  const value = Number(effect.value) || 0;
  switch (effect.type) {
    case 'battleAttack':
      return value * 180;
    case 'battleDefense':
      return value * 160;
    case 'battleSustain':
      return value * 145;
    case 'battleLoot':
      return value * 170;
    case 'unitPowerMultiplier':
      return value * 175;
    case 'resourceMultiplier':
      return value * 105;
    default:
      return value * 60;
  }
}

function getQualityLabel(value = 1) {
  return QUALITY_LABELS.find((entry) => value >= entry.min)?.label ?? QUALITY_LABELS[QUALITY_LABELS.length - 1].label;
}

function getRarityRank(rarity = 'common') {
  return RARITY_RANK[rarity] ?? 1;
}

function getRarityByRank(rank = 1) {
  return Object.entries(RARITY_RANK).find(([, value]) => value === rank)?.[0] ?? 'common';
}

function getRarityLabel(rarity = 'common') {
  switch (rarity) {
    case 'legendary':
      return '传说';
    case 'epic':
      return '史诗';
    case 'rare':
      return '稀有';
    default:
      return '常规';
  }
}

function getEffectTypeLabel(type = null) {
  return type ? (EFFECT_TYPE_LABELS[type] ?? type) : '常备';
}

function getWorkshopSlotSortValue(slotKey = '') {
  const index = WORKSHOP_ORDER_SLOT_ORDER.indexOf(slotKey);
  return index >= 0 ? index : WORKSHOP_ORDER_SLOT_ORDER.length;
}

function hasClearedStage(state, stageId = null) {
  return !stageId || (state.war?.clearedStages ?? []).includes(stageId);
}

function hasNodeUnlocked(state, nodeId = null) {
  return !nodeId || (state.scripture?.unlockedNodes ?? []).includes(nodeId);
}

function meetsDefinitionRequirements(state, definition, branch = 'weapon') {
  const reputation = Math.max(Number(state.commissions?.reputation) || 0, 0);
  const smithyLevel = Math.max(Number(state.buildings?.smithy?.level) || 0, 0);
  const alchemyLevel = Math.max(Number(state.buildings?.alchemy?.level) || 0, 0);
  const requiredWorkshopLevel = branch === 'weapon'
    ? Math.max(Number(definition?.smithyLevel) || 0, 0)
    : Math.max(Number(definition?.alchemyLevel) || 0, 0);
  const currentWorkshopLevel = branch === 'weapon' ? smithyLevel : alchemyLevel;

  return currentWorkshopLevel >= requiredWorkshopLevel
    && reputation >= Math.max(Number(definition?.requiredReputation) || 0, 0)
    && hasClearedStage(state, definition?.requiredStageId ?? null)
    && hasNodeUnlocked(state, definition?.requiredNodeId ?? null);
}

function sortDefinitions(left, right) {
  return (
    (getRarityRank(left.rarity) - getRarityRank(right.rarity))
    || ((left.order ?? 0) - (right.order ?? 0))
    || (left.name ?? '').localeCompare(right.name ?? '')
  );
}

function nextRandom(state) {
  ensureCraftingState(state);
  state.crafting.seed = ((state.crafting.seed ?? 1) * 1664525 + 1013904223) >>> 0;
  return state.crafting.seed / 4294967296;
}

function rollBetween(state, min, max) {
  return min + nextRandom(state) * (max - min);
}

function pickAffixes(state, blueprint, count) {
  const pool = getWeaponAffixPool(blueprint);
  const pickedIds = new Set();
  const affixes = [];

  while (affixes.length < count && pickedIds.size < pool.length) {
    const candidate = pool[Math.floor(nextRandom(state) * pool.length)] ?? null;
    if (!candidate || pickedIds.has(candidate.id)) {
      continue;
    }
    pickedIds.add(candidate.id);
    affixes.push({
      id: candidate.id,
      name: candidate.name,
      type: candidate.type,
      resourceId: candidate.resourceId ?? null,
      value: roundEffectValue(rollBetween(state, candidate.min, candidate.max)),
    });
  }

  return affixes;
}

function getStrengthenMultiplier(level = 0) {
  return 1 + Math.max(Number(level) || 0, 0) * 0.08;
}

function decorateWeaponInstance(instance = {}, activeIds = new Set()) {
  const blueprint = getWeaponBlueprint(instance.blueprintId);
  if (!blueprint) {
    return null;
  }

  const strengthenLevel = Math.max(Number(instance.strengthenLevel) || 0, 0);
  const strengthenMultiplier = getStrengthenMultiplier(strengthenLevel);
  const baseEffects = scaleEffects(instance.baseEffects ?? blueprint.effects ?? [], strengthenMultiplier);
  const affixEffects = scaleEffects(instance.affixes ?? [], strengthenMultiplier);
  const totalEffects = [...baseEffects, ...affixEffects];
  const score = totalEffects.reduce((sum, effect) => sum + scoreEffect(effect), 0)
    + strengthenLevel * 8
    + (instance.qualityRoll ?? 1) * 24;

  return {
    ...instance,
    blueprint,
    baseEffects,
    affixEffects,
    totalEffects,
    score,
    strengthenLevel,
    qualityRoll: Number(instance.qualityRoll) || 1,
    qualityLabel: instance.qualityLabel ?? getQualityLabel(Number(instance.qualityRoll) || 1),
    active: activeIds.has(instance.id),
  };
}

function decoratePillBatch(batch = {}, activeIds = new Set()) {
  const recipe = getPillRecipeDefinition(batch.recipeId);
  if (!recipe) {
    return null;
  }

  const potencyRoll = Number(batch.potencyRoll) || 1;
  const servings = Math.max(Number(batch.servings) || 1, 1);
  const potencyMultiplier = potencyRoll * (1 + (servings - 1) * 0.03);
  const totalEffects = scaleEffects(batch.baseEffects ?? recipe.effects ?? [], potencyMultiplier);
  const score = totalEffects.reduce((sum, effect) => sum + scoreEffect(effect), 0) + servings * 3 + potencyRoll * 18;

  return {
    ...batch,
    recipe,
    totalEffects,
    potencyRoll,
    potencyLabel: batch.potencyLabel ?? getQualityLabel(potencyRoll),
    servings,
    score,
    active: activeIds.has(batch.id),
  };
}

function buildActiveWeaponIds(decoratedWeapons = [], slotCount = 0) {
  return new Set(
    [...decoratedWeapons]
      .sort((left, right) => (
        (right.score - left.score)
        || (right.strengthenLevel - left.strengthenLevel)
        || ((right.createdAt ?? 0) - (left.createdAt ?? 0))
        || (left.id ?? '').localeCompare(right.id ?? '')
      ))
      .slice(0, Math.max(slotCount, 0))
      .map((weapon) => weapon.id),
  );
}

function buildActivePillIds(decoratedBatches = [], slotCount = 0) {
  return new Set(
    [...decoratedBatches]
      .sort((left, right) => (
        (right.score - left.score)
        || (right.servings - left.servings)
        || ((right.createdAt ?? 0) - (left.createdAt ?? 0))
        || (left.id ?? '').localeCompare(right.id ?? '')
      ))
      .slice(0, Math.max(slotCount, 0))
      .map((batch) => batch.id),
  );
}

export function ensureCraftingState(state) {
  state.crafting ??= {
    seed: 246813579,
    weaponCounter: 0,
    pillCounter: 0,
    orderCounter: 0,
    weaponEssence: 0,
    forgedWeapons: [],
    brewedPills: [],
    workshopOrders: [],
    fulfillmentHistory: [],
  };
  state.crafting.seed = Math.max(Number(state.crafting.seed) || 246813579, 1);
  state.crafting.weaponCounter = Math.max(Number(state.crafting.weaponCounter) || 0, 0);
  state.crafting.pillCounter = Math.max(Number(state.crafting.pillCounter) || 0, 0);
  state.crafting.orderCounter = Math.max(Number(state.crafting.orderCounter) || 0, 0);
  state.crafting.weaponEssence = Math.max(Number(state.crafting.weaponEssence) || 0, 0);
  state.crafting.forgedWeapons ??= [];
  state.crafting.brewedPills ??= [];
  state.crafting.workshopOrders ??= [];
  state.crafting.fulfillmentHistory ??= [];
  return state.crafting;
}

export function canAffordCraftCost(state, costMap = {}) {
  ensureCraftingState(state);
  for (const [resourceId, amount] of Object.entries(costMap)) {
    const safeAmount = Math.max(Number(amount) || 0, 0);
    if (safeAmount <= 0) {
      continue;
    }
    if (resourceId === 'weaponEssence' && (state.crafting.weaponEssence ?? 0) < safeAmount) {
      return false;
    }
    if (resourceId === 'affairsCredit' && (state.commissions?.affairsCredit ?? 0) < safeAmount) {
      return false;
    }
    if (!['weaponEssence', 'affairsCredit'].includes(resourceId) && (state.resources?.[resourceId] ?? 0) < safeAmount) {
      return false;
    }
  }
  return true;
}

export function payCraftCost(state, costMap = {}) {
  if (!canAffordCraftCost(state, costMap)) {
    return false;
  }

  for (const [resourceId, amount] of Object.entries(costMap)) {
    const safeAmount = Math.max(Number(amount) || 0, 0);
    if (safeAmount <= 0) {
      continue;
    }
    if (resourceId === 'weaponEssence') {
      state.crafting.weaponEssence -= safeAmount;
    } else if (resourceId === 'affairsCredit') {
      state.commissions.affairsCredit -= safeAmount;
    } else {
      state.resources[resourceId] -= safeAmount;
    }
  }

  return true;
}

export function grantCraftReward(state, rewardMap = {}) {
  ensureCraftingState(state);
  state.commissions ??= {};
  state.commissions.affairsCredit ??= 0;

  for (const [resourceId, amount] of Object.entries(rewardMap)) {
    const safeAmount = Math.max(Number(amount) || 0, 0);
    if (safeAmount <= 0) {
      continue;
    }
    if (resourceId === 'weaponEssence') {
      state.crafting.weaponEssence = (state.crafting.weaponEssence ?? 0) + safeAmount;
    } else if (resourceId === 'affairsCredit') {
      state.commissions.affairsCredit = (state.commissions.affairsCredit ?? 0) + safeAmount;
    } else {
      state.resources[resourceId] = (state.resources?.[resourceId] ?? 0) + safeAmount;
    }
  }
}

export function getUnlockedWeaponBlueprints(state) {
  return listWeaponBlueprints()
    .map((definition) => ({
      ...definition,
      unlocked: meetsDefinitionRequirements(state, definition, 'weapon'),
    }))
    .sort(sortDefinitions);
}

export function getUnlockedPillRecipes(state) {
  return listPillRecipeDefinitions()
    .map((definition) => ({
      ...definition,
      unlocked: meetsDefinitionRequirements(state, definition, 'pill'),
    }))
    .sort(sortDefinitions);
}

export function getWeaponStrengthenCost(instance = {}) {
  const blueprint = getWeaponBlueprint(instance.blueprintId);
  if (!blueprint) {
    return {};
  }

  const level = Math.max(Number(instance.strengthenLevel) || 0, 0);
  const rank = getRarityRank(blueprint.rarity);
  const multiplier = 1.2 ** level;
  const cost = {
    weaponEssence: Math.round((8 + rank * 5 + (instance.affixes?.length ?? 0) * 4) * multiplier),
    lingStone: Math.round(((blueprint.cost.lingStone ?? 60) * 0.42 + rank * 18) * multiplier),
    iron: Math.round(((blueprint.cost.iron ?? 0) * 0.34 + rank * 6) * multiplier),
    wood: Math.round(((blueprint.cost.wood ?? 0) * 0.26) * multiplier),
    herb: Math.round(((blueprint.cost.herb ?? 0) * 0.24) * multiplier),
    pills: Math.round(((blueprint.cost.pills ?? 0) * 0.32) * multiplier),
    talisman: Math.round(((blueprint.cost.talisman ?? 0) * 0.28) * multiplier),
    spiritCrystal: Math.round(((blueprint.cost.spiritCrystal ?? 0) * 0.3 + rank * 4) * multiplier),
    affairsCredit: level >= 4 ? Math.round((rank * 2 + level) * multiplier * 0.4) : 0,
  };

  return Object.fromEntries(Object.entries(cost).filter(([, amount]) => amount > 0));
}

export function getWeaponDismantleReward(instance = {}) {
  const blueprint = getWeaponBlueprint(instance.blueprintId);
  if (!blueprint) {
    return {};
  }

  const level = Math.max(Number(instance.strengthenLevel) || 0, 0);
  const rank = getRarityRank(blueprint.rarity);
  const reward = {
    weaponEssence: 12 + rank * 8 + (instance.affixes?.length ?? 0) * 5 + level * 10,
    lingStone: Math.max(Math.round((blueprint.cost.lingStone ?? 0) * 0.34), 0),
    iron: Math.max(Math.round((blueprint.cost.iron ?? 0) * 0.36), 0),
    wood: Math.max(Math.round((blueprint.cost.wood ?? 0) * 0.32), 0),
    herb: Math.max(Math.round((blueprint.cost.herb ?? 0) * 0.32), 0),
    pills: Math.max(Math.round((blueprint.cost.pills ?? 0) * 0.34), 0),
    talisman: Math.max(Math.round((blueprint.cost.talisman ?? 0) * 0.35), 0),
    spiritCrystal: Math.max(Math.round((blueprint.cost.spiritCrystal ?? 0) * 0.36), 0),
  };

  return Object.fromEntries(Object.entries(reward).filter(([, amount]) => amount > 0));
}

export function getWeaponReforgeCost(instance = {}) {
  const blueprint = getWeaponBlueprint(instance.blueprintId);
  if (!blueprint) {
    return {};
  }

  const rank = getRarityRank(blueprint.rarity);
  const reforgeCount = Math.max(Number(instance.reforgeCount) || 0, 0);
  const strengthenLevel = Math.max(Number(instance.strengthenLevel) || 0, 0);
  const multiplier = 1.16 ** reforgeCount;
  const cost = {
    weaponEssence: Math.round((10 + rank * 5 + (instance.affixes?.length ?? 0) * 4 + strengthenLevel * 2) * multiplier),
    lingStone: Math.round(((blueprint.cost.lingStone ?? 60) * 0.28 + rank * 18) * multiplier),
    iron: Math.round(((blueprint.cost.iron ?? 0) * 0.24 + rank * 6) * multiplier),
    wood: Math.round(((blueprint.cost.wood ?? 0) * 0.18) * multiplier),
    pills: Math.round(((blueprint.cost.pills ?? 0) * 0.22) * multiplier),
    talisman: Math.round(((blueprint.cost.talisman ?? 0) * 0.24 + Math.max(rank - 1, 0) * 3) * multiplier),
    spiritCrystal: Math.round(((blueprint.cost.spiritCrystal ?? 0) * 0.26 + rank * 4) * multiplier),
    affairsCredit: strengthenLevel >= 3 ? Math.round((rank + strengthenLevel) * 0.5 * multiplier) : 0,
  };

  return Object.fromEntries(Object.entries(cost).filter(([, amount]) => amount > 0));
}

export function forgeWeaponInState(state, blueprintId) {
  ensureCraftingState(state);
  const blueprint = getWeaponBlueprint(blueprintId);
  if (!blueprint || !meetsDefinitionRequirements(state, blueprint, 'weapon')) {
    return null;
  }

  const qualityRoll = roundEffectValue(rollBetween(state, 0.9, 1.18) + getRarityRank(blueprint.rarity) * 0.005);
  const affixCountBase = blueprint.affixCapacity ?? 1;
  const affixCount = Math.max(
    1,
    Math.min(4, affixCountBase + (qualityRoll >= 1.14 ? 1 : 0) - (qualityRoll < 0.96 ? 1 : 0)),
  );
  const affixes = pickAffixes(state, blueprint, affixCount);
  const baseEffects = scaleEffects(blueprint.effects, qualityRoll);
  const weaponId = `weapon-${++state.crafting.weaponCounter}`;
  const forged = {
    id: weaponId,
    blueprintId,
    name: blueprint.name,
    qualityRoll,
    qualityLabel: getQualityLabel(qualityRoll),
    strengthenLevel: 0,
    baseEffects,
    affixes,
    createdAt: Date.now(),
  };

  state.crafting.forgedWeapons.unshift(forged);
  state.crafting.forgedWeapons = state.crafting.forgedWeapons.slice(0, 60);
  return forged;
}

export function brewPillRecipeInState(state, recipeId) {
  ensureCraftingState(state);
  const recipe = getPillRecipeDefinition(recipeId);
  if (!recipe || !meetsDefinitionRequirements(state, recipe, 'pill')) {
    return null;
  }

  const potencyRoll = roundEffectValue(rollBetween(state, 0.92, 1.18) + getRarityRank(recipe.rarity) * 0.004);
  const servings = Math.max(
    1,
    Math.min(
      (recipe.batchSize ?? 2) + (recipe.rarity === 'legendary' ? 1 : 0),
      1 + Math.floor(rollBetween(state, 1, (recipe.batchSize ?? 2) + 1.999)),
    ),
  );
  const batchId = `pill-${++state.crafting.pillCounter}`;
  const brewed = {
    id: batchId,
    recipeId,
    name: recipe.name,
    potencyRoll,
    potencyLabel: getQualityLabel(potencyRoll),
    servings,
    baseEffects: cloneEffects(recipe.effects),
    createdAt: Date.now(),
  };

  state.crafting.brewedPills.unshift(brewed);
  state.crafting.brewedPills = state.crafting.brewedPills.slice(0, 60);
  return brewed;
}

export function strengthenWeaponInState(state, weaponId) {
  ensureCraftingState(state);
  const weapon = state.crafting.forgedWeapons.find((entry) => entry.id === weaponId);
  if (!weapon) {
    return null;
  }

  weapon.strengthenLevel = Math.max(Number(weapon.strengthenLevel) || 0, 0) + 1;
  return weapon;
}

export function reforgeWeaponInState(state, weaponId) {
  ensureCraftingState(state);
  const weapon = state.crafting.forgedWeapons.find((entry) => entry.id === weaponId);
  if (!weapon) {
    return null;
  }

  const blueprint = getWeaponBlueprint(weapon.blueprintId);
  if (!blueprint) {
    return null;
  }

  const rank = getRarityRank(blueprint.rarity);
  const reforgeCount = Math.max(Number(weapon.reforgeCount) || 0, 0);
  const qualityFloor = Math.min(1.06, 0.9 + reforgeCount * 0.01 + rank * 0.01);
  const qualityRoll = roundEffectValue(Math.max(qualityFloor, rollBetween(state, 0.9, 1.18) + rank * 0.005));
  const affixCount = Math.max(weapon.affixes?.length ?? 0, Math.min(blueprint.affixCapacity ?? 1, 1));

  weapon.qualityRoll = qualityRoll;
  weapon.qualityLabel = getQualityLabel(qualityRoll);
  weapon.baseEffects = scaleEffects(blueprint.effects, qualityRoll);
  weapon.affixes = pickAffixes(state, blueprint, affixCount);
  weapon.reforgeCount = reforgeCount + 1;
  return weapon;
}

export function dismantleWeaponInState(state, weaponId) {
  ensureCraftingState(state);
  const targetIndex = state.crafting.forgedWeapons.findIndex((entry) => entry.id === weaponId);
  if (targetIndex < 0) {
    return null;
  }

  const [weapon] = state.crafting.forgedWeapons.splice(targetIndex, 1);
  const reward = getWeaponDismantleReward(weapon);
  state.crafting.weaponEssence = (state.crafting.weaponEssence ?? 0) + Math.max(Number(reward.weaponEssence) || 0, 0);
  for (const [resourceId, amount] of Object.entries(reward)) {
    if (resourceId === 'weaponEssence') {
      continue;
    }
    state.resources[resourceId] = (state.resources?.[resourceId] ?? 0) + amount;
  }
  return { weapon, reward };
}

function getUnlockedDefinitionsForOrder(state, kind = 'weapon') {
  return (kind === 'weapon' ? getUnlockedWeaponBlueprints(state) : getUnlockedPillRecipes(state))
    .filter((definition) => definition.unlocked);
}

function getDefinitionFocusPool(definitions = []) {
  return [...new Set(definitions.flatMap((definition) => (definition.effects ?? []).map((effect) => effect.type)).filter(Boolean))];
}

function buildWorkshopReward(kind, tier, state) {
  const reputation = Math.max(Number(state.commissions?.reputation) || 0, 0);
  const depth = kind === 'weapon'
    ? Math.max(Number(state.buildings?.smithy?.level) || 0, 0)
    : Math.max(Number(state.buildings?.alchemy?.level) || 0, 0);
  const base = 160 + tier * 90 + depth * 30 + Math.floor(reputation * 0.8);

  if (kind === 'weapon') {
    return {
      reward: {
        weaponEssence: 8 + tier * 4 + depth * 2,
        lingStone: Math.round(base * 1.35),
        dao: Math.round(base * 0.95),
        spiritCrystal: Math.round(6 + tier * 4 + depth * 2),
      },
      reputationReward: 6 + tier * 4 + Math.floor(depth / 2),
      affairsCreditReward: 3 + tier * 2,
    };
  }

  return {
    reward: {
      lingStone: Math.round(base * 1.15),
      dao: Math.round(base * 1.05),
      talisman: Math.round(6 + tier * 4 + depth * 2),
      spiritCrystal: Math.round(4 + tier * 3 + depth * 2),
    },
    reputationReward: 6 + tier * 4 + Math.floor(depth / 2),
    affairsCreditReward: 4 + tier * 2,
  };
}

function buildWorkshopOrderRequestTitle(kind, focusType = null, template = 'general') {
  if (kind === 'weapon') {
    return template === 'general'
      ? '常备兵器征调'
      : `${getEffectTypeLabel(focusType)}兵器定单`;
  }
  return template === 'general'
    ? '丹房常备调剂'
    : `${getEffectTypeLabel(focusType)}药批征调`;
}

function createWorkshopOrder(state, slotKey, now = Date.now()) {
  const weaponDefinitions = getUnlockedDefinitionsForOrder(state, 'weapon');
  const pillDefinitions = getUnlockedDefinitionsForOrder(state, 'pill');
  if (!weaponDefinitions.length && !pillDefinitions.length) {
    return null;
  }

  let kind = 'weapon';
  let template = 'general';
  let focusType = null;
  let minRarity = 'common';
  let minQualityRoll = 0.92;
  let minStrengthenLevel = 0;
  let minServings = 1;
  let minPotencyRoll = 0.94;

  if (slotKey === 'pill-basic') {
    kind = 'pill';
  } else if (slotKey === 'featured') {
    kind = pillDefinitions.length && weaponDefinitions.length
      ? (nextRandom(state) >= 0.5 ? 'weapon' : 'pill')
      : (weaponDefinitions.length ? 'weapon' : 'pill');
    template = 'featured';
    const focusPool = getDefinitionFocusPool(kind === 'weapon' ? weaponDefinitions : pillDefinitions);
    focusType = focusPool[Math.floor(nextRandom(state) * Math.max(focusPool.length, 1))] ?? null;
    minRarity = getRarityByRank(Math.min(3, 1 + Math.floor(nextRandom(state) * 3)));
    minQualityRoll = kind === 'weapon' ? 1.02 + nextRandom(state) * 0.08 : minQualityRoll;
    minPotencyRoll = kind === 'pill' ? 1.02 + nextRandom(state) * 0.08 : minPotencyRoll;
    minStrengthenLevel = kind === 'weapon' ? Math.floor(nextRandom(state) * 2) : 0;
    minServings = kind === 'pill' ? 1 + Math.floor(nextRandom(state) * 2) : 1;
  }

  const tier = Math.max(getRarityRank(minRarity), template === 'featured' ? 2 : 1);
  const rewardBundle = buildWorkshopReward(kind, tier, state);
  const requestedItemCount = kind === 'weapon' ? weaponDefinitions.length : pillDefinitions.length;

  return {
    id: `workshop-order-${++state.crafting.orderCounter}`,
    slotKey,
    kind,
    template,
    focusType,
    minRarity,
    minQualityRoll: kind === 'weapon' ? roundEffectValue(minQualityRoll) : 0,
    minStrengthenLevel: kind === 'weapon' ? minStrengthenLevel : 0,
    minServings: kind === 'pill' ? minServings : 0,
    minPotencyRoll: kind === 'pill' ? roundEffectValue(minPotencyRoll) : 0,
    title: buildWorkshopOrderRequestTitle(kind, focusType, template),
    note: kind === 'weapon'
      ? `宗门军备房准备补充一批${template === 'featured' ? '专项' : '常备'}兵器。`
      : `执务堂正在催收一批${template === 'featured' ? '专项' : '常备'}丹药批次。`,
    reward: rewardBundle.reward,
    reputationReward: rewardBundle.reputationReward,
    affairsCreditReward: rewardBundle.affairsCreditReward,
    createdAt: now,
    referenceCount: requestedItemCount,
  };
}

function sortWorkshopOrders(orders = []) {
  return [...orders].sort((left, right) => (
    getWorkshopSlotSortValue(left.slotKey) - getWorkshopSlotSortValue(right.slotKey)
  ));
}

export function ensureWorkshopOrdersInState(state, now = Date.now()) {
  ensureCraftingState(state);
  const existingKeys = new Set((state.crafting.workshopOrders ?? []).map((order) => order.slotKey));
  for (const slotKey of WORKSHOP_ORDER_SLOT_ORDER) {
    if (existingKeys.has(slotKey)) {
      continue;
    }
    const order = createWorkshopOrder(state, slotKey, now);
    if (order) {
      state.crafting.workshopOrders.push(order);
    }
  }
  state.crafting.workshopOrders = sortWorkshopOrders(state.crafting.workshopOrders).slice(0, WORKSHOP_ORDER_SLOT_ORDER.length);
}

export function getWorkshopOrderRefreshCost(state) {
  ensureCraftingState(state);
  const reputation = Math.max(Number(state.commissions?.reputation) || 0, 0);
  return {
    affairsCredit: 4 + Math.floor(reputation / 40),
    dao: 240 + Math.floor(reputation * 1.6),
  };
}

export function refreshWorkshopOrdersInState(state, now = Date.now()) {
  ensureCraftingState(state);
  state.crafting.workshopOrders = [];
  ensureWorkshopOrdersInState(state, now);
  return state.crafting.workshopOrders;
}

function matchesOrderRarity(itemRarity, requiredRarity) {
  return getRarityRank(itemRarity) >= getRarityRank(requiredRarity);
}

function weaponMatchesWorkshopOrder(weapon, order) {
  return matchesOrderRarity(weapon.blueprint?.rarity ?? 'common', order.minRarity)
    && (weapon.qualityRoll ?? 1) >= (order.minQualityRoll ?? 0)
    && (weapon.strengthenLevel ?? 0) >= (order.minStrengthenLevel ?? 0)
    && (!order.focusType || weapon.totalEffects.some((effect) => effect.type === order.focusType));
}

function pillMatchesWorkshopOrder(batch, order) {
  return matchesOrderRarity(batch.recipe?.rarity ?? 'common', order.minRarity)
    && (batch.potencyRoll ?? 1) >= (order.minPotencyRoll ?? 0)
    && (batch.servings ?? 1) >= (order.minServings ?? 1)
    && (!order.focusType || batch.totalEffects.some((effect) => effect.type === order.focusType));
}

function sortWorkshopCandidates(left, right) {
  return (
    Number(Boolean(left.active)) - Number(Boolean(right.active))
    || (left.score - right.score)
    || ((left.createdAt ?? 0) - (right.createdAt ?? 0))
    || (left.id ?? '').localeCompare(right.id ?? '')
  );
}

function getWorkshopOrderCandidates(order, weaponInventory = [], pillInventory = []) {
  const pool = order.kind === 'weapon'
    ? weaponInventory.filter((item) => weaponMatchesWorkshopOrder(item, order))
    : pillInventory.filter((item) => pillMatchesWorkshopOrder(item, order));
  return [...pool].sort(sortWorkshopCandidates);
}

function describeWorkshopOrder(order) {
  const parts = [];
  parts.push(`${getRarityLabel(order.minRarity)}以上`);
  if (order.kind === 'weapon') {
    parts.push(`${getQualityLabel(order.minQualityRoll ?? 0)}以上`);
    if ((order.minStrengthenLevel ?? 0) > 0) {
      parts.push(`强化 +${order.minStrengthenLevel}`);
    }
  } else {
    parts.push(`${getQualityLabel(order.minPotencyRoll ?? 0)}以上`);
    if ((order.minServings ?? 1) > 1) {
      parts.push(`至少 ${order.minServings} 份`);
    }
  }
  if (order.focusType) {
    parts.push(`${getEffectTypeLabel(order.focusType)}取向`);
  }
  return parts.join(' · ');
}

function decorateWorkshopOrder(order, weaponInventory = [], pillInventory = []) {
  const candidates = getWorkshopOrderCandidates(order, weaponInventory, pillInventory);
  const bestMatch = candidates[0] ?? null;
  return {
    ...order,
    kindLabel: order.kind === 'weapon' ? '兵器' : '丹药',
    minRarityLabel: getRarityLabel(order.minRarity),
    focusTypeLabel: order.focusType ? getEffectTypeLabel(order.focusType) : '常备',
    requestSummary: describeWorkshopOrder(order),
    eligibleCount: candidates.length,
    canFulfill: Boolean(bestMatch),
    bestMatchId: bestMatch?.id ?? null,
    bestMatchName: bestMatch?.name ?? null,
  };
}

export function fulfillWorkshopOrderInState(state, orderId) {
  ensureCraftingState(state);
  ensureWorkshopOrdersInState(state);
  const snapshot = getCraftingSnapshot(state);
  const order = snapshot.workshop.orders.find((entry) => entry.id === orderId);
  if (!order?.canFulfill) {
    return null;
  }

  let submitted = null;
  if (order.kind === 'weapon') {
    const index = state.crafting.forgedWeapons.findIndex((entry) => entry.id === order.bestMatchId);
    if (index < 0) {
      return null;
    }
    [submitted] = state.crafting.forgedWeapons.splice(index, 1);
  } else {
    const index = state.crafting.brewedPills.findIndex((entry) => entry.id === order.bestMatchId);
    if (index < 0) {
      return null;
    }
    [submitted] = state.crafting.brewedPills.splice(index, 1);
  }

  grantCraftReward(state, order.reward);
  state.commissions.reputation = (state.commissions?.reputation ?? 0) + Math.max(Number(order.reputationReward) || 0, 0);
  state.commissions.affairsCredit = (state.commissions?.affairsCredit ?? 0) + Math.max(Number(order.affairsCreditReward) || 0, 0);
  state.crafting.workshopOrders = (state.crafting.workshopOrders ?? []).filter((entry) => entry.id !== orderId);
  state.crafting.fulfillmentHistory.unshift({
    id: `workshop-history-${Date.now()}`,
    orderId,
    title: order.title,
    kind: order.kind,
    submittedName: order.bestMatchName ?? submitted?.name ?? null,
    reward: { ...(order.reward ?? {}) },
    reputationReward: order.reputationReward ?? 0,
    affairsCreditReward: order.affairsCreditReward ?? 0,
    fulfilledAt: Date.now(),
  });
  state.crafting.fulfillmentHistory = state.crafting.fulfillmentHistory.slice(0, 8);
  ensureWorkshopOrdersInState(state);
  return {
    order,
    submitted,
  };
}

export function getWeaponActiveSlotCount(state) {
  const smithyLevel = Math.max(Number(state.buildings?.smithy?.level) || 0, 0);
  if (smithyLevel <= 0) {
    return 0;
  }
  const hasShenbing = (state.scripture?.unlockedNodes ?? []).includes('shenbing-bailian');
  const hasTiangong = (state.scripture?.unlockedNodes ?? []).includes('tian-gong-fuling');
  return Math.min(6, 1 + smithyLevel + (hasShenbing ? 1 : 0) + (hasTiangong ? 1 : 0));
}

export function getPillActiveSlotCount(state) {
  const alchemyLevel = Math.max(Number(state.buildings?.alchemy?.level) || 0, 0);
  if (alchemyLevel <= 0) {
    return 0;
  }
  const hasDanxin = (state.scripture?.unlockedNodes ?? []).includes('danxin-dao');
  const hasTiangong = (state.scripture?.unlockedNodes ?? []).includes('tian-gong-fuling');
  return Math.min(6, 1 + alchemyLevel + (hasDanxin ? 1 : 0) + (hasTiangong ? 1 : 0));
}

export function getCraftingSnapshot(state) {
  ensureCraftingState(state);
  const catalogCounts = getCraftingCatalogCounts();
  const weaponDefinitions = getUnlockedWeaponBlueprints(state);
  const pillDefinitions = getUnlockedPillRecipes(state);

  const initialWeapons = (state.crafting?.forgedWeapons ?? [])
    .map((entry) => decorateWeaponInstance(entry))
    .filter(Boolean);
  const weaponActiveIds = buildActiveWeaponIds(initialWeapons, getWeaponActiveSlotCount(state));
  const weaponInventory = initialWeapons
    .map((entry) => decorateWeaponInstance(entry, weaponActiveIds))
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      strengthenCost: getWeaponStrengthenCost(entry),
      reforgeCost: getWeaponReforgeCost(entry),
      dismantleReward: getWeaponDismantleReward(entry),
      canStrengthen: canAffordCraftCost(state, getWeaponStrengthenCost(entry)),
      canReforge: canAffordCraftCost(state, getWeaponReforgeCost(entry)),
    }))
    .sort((left, right) => (
      Number(Boolean(right.active)) - Number(Boolean(left.active))
      || (right.score - left.score)
      || ((right.createdAt ?? 0) - (left.createdAt ?? 0))
      || (left.id ?? '').localeCompare(right.id ?? '')
    ));

  const initialBatches = (state.crafting?.brewedPills ?? [])
    .map((entry) => decoratePillBatch(entry))
    .filter(Boolean);
  const pillActiveIds = buildActivePillIds(initialBatches, getPillActiveSlotCount(state));
  const pillInventory = initialBatches
    .map((entry) => decoratePillBatch(entry, pillActiveIds))
    .filter(Boolean)
    .sort((left, right) => (
      Number(Boolean(right.active)) - Number(Boolean(left.active))
      || (right.score - left.score)
      || ((right.createdAt ?? 0) - (left.createdAt ?? 0))
      || (left.id ?? '').localeCompare(right.id ?? '')
    ));
  const workshopOrders = sortWorkshopOrders(state.crafting.workshopOrders ?? [])
    .map((order) => decorateWorkshopOrder(order, weaponInventory, pillInventory));

  return {
    arsenal: {
      weaponEssence: state.crafting.weaponEssence ?? 0,
      slotCount: getWeaponActiveSlotCount(state),
      totalBlueprintCount: catalogCounts.weaponBlueprints,
      unlockedBlueprintCount: weaponDefinitions.filter((definition) => definition.unlocked).length,
      blueprints: weaponDefinitions.map((definition) => ({
        ...definition,
        craftable: definition.unlocked && canAffordCraftCost(state, definition.cost),
      })),
      inventory: weaponInventory,
      activeWeapons: weaponInventory.filter((entry) => entry.active),
    },
    alchemy: {
      slotCount: getPillActiveSlotCount(state),
      totalRecipeCount: catalogCounts.pillRecipes,
      unlockedRecipeCount: pillDefinitions.filter((definition) => definition.unlocked).length,
      recipes: pillDefinitions.map((definition) => ({
        ...definition,
        craftable: definition.unlocked && canAffordCraftCost(state, definition.cost),
      })),
      inventory: pillInventory,
      activeBatches: pillInventory.filter((entry) => entry.active),
    },
    workshop: {
      orders: workshopOrders,
      refreshCost: getWorkshopOrderRefreshCost(state),
      canRefresh: canAffordCraftCost(state, getWorkshopOrderRefreshCost(state)),
      history: (state.crafting.fulfillmentHistory ?? []).slice(0, 6).map((entry) => ({
        ...entry,
        reward: { ...(entry.reward ?? {}) },
      })),
    },
  };
}

export function getCraftingEffects(state) {
  const snapshot = getCraftingSnapshot(state);
  const weaponEffects = snapshot.arsenal.activeWeapons.flatMap((weapon) => weapon.totalEffects.map((effect) => ({
    ...effect,
    source: weapon.name,
    sourceId: weapon.id,
    sourceType: 'forged-weapon',
    rarity: weapon.blueprint?.rarity ?? 'common',
  })));
  const pillEffects = snapshot.alchemy.activeBatches.flatMap((batch) => batch.totalEffects.map((effect) => ({
    ...effect,
    source: batch.name,
    sourceId: batch.id,
    sourceType: 'crafted-pill',
    rarity: batch.recipe?.rarity ?? 'common',
  })));

  return {
    snapshot,
    weaponEffects,
    pillEffects,
    all: [...weaponEffects, ...pillEffects],
  };
}
