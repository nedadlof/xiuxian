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
    weaponEssence: 0,
    forgedWeapons: [],
    brewedPills: [],
  };
  state.crafting.seed = Math.max(Number(state.crafting.seed) || 246813579, 1);
  state.crafting.weaponCounter = Math.max(Number(state.crafting.weaponCounter) || 0, 0);
  state.crafting.pillCounter = Math.max(Number(state.crafting.pillCounter) || 0, 0);
  state.crafting.weaponEssence = Math.max(Number(state.crafting.weaponEssence) || 0, 0);
  state.crafting.forgedWeapons ??= [];
  state.crafting.brewedPills ??= [];
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
      dismantleReward: getWeaponDismantleReward(entry),
      canStrengthen: canAffordCraftCost(state, getWeaponStrengthenCost(entry)),
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
