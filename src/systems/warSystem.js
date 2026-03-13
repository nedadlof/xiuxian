import { appendLog } from './shared/logs.js';
import { collectUnlockedEffects, sumEffects } from './shared/effectResolver.js';
import { listBattlePreparationDefinitions } from '../data/battlePreparations.js';
import { resolveFormationSynergies } from '../data/formationSynergies.js';
import { getWarehouseEffects } from '../data/warehouse.js';

const BATTLE_PACING = {
  maxRounds: 10,
  playerHpMultiplier: 8.4,
  enemyHpMultiplier: 15,
  globalDamageMultiplier: 0.62,
};

const MAX_BATTLE_ROUNDS = BATTLE_PACING.maxRounds;
const ROW_ORDER = [1, 2, 3, 4, 5, 6];

const ROW_MODIFIERS = {
  1: { attack: -0.08, defense: 0.2, sustain: 0.02 },
  2: { attack: 0.01, defense: 0.12, sustain: 0.02 },
  3: { attack: 0.06, defense: 0.04, sustain: 0.02 },
  4: { attack: 0.1, defense: 0, sustain: 0.03 },
  5: { attack: 0.12, defense: -0.04, sustain: 0.02 },
  6: { attack: -0.03, defense: -0.02, sustain: 0.12 },
};

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function randomFactor() {
  return 0.92 + Math.random() * 0.16;
}

function canUseUnit(state, unit) {
  return !unit.unlockNodeId || state.scripture.unlockedNodes.includes(unit.unlockNodeId);
}

function canAfford(state, costMap, count) {
  for (const [resourceId, amount] of Object.entries(costMap)) {
    if ((state.resources[resourceId] ?? 0) < amount * count) {
      return false;
    }
  }

  return true;
}

function payCost(state, costMap, count) {
  for (const [resourceId, amount] of Object.entries(costMap)) {
    state.resources[resourceId] -= amount * count;
  }
}

function getAvailableUnits(state, registries) {
  return registries.units.list().filter((unit) => canUseUnit(state, unit));
}

function getFormation(registries, formationId) {
  return (registries.systems.get('formations') ?? []).find((item) => item.id === formationId);
}

function getDefaultRow(unit) {
  if (unit.role === 'frontline' || unit.tags.includes('defense')) return 1;
  if (unit.role === 'midline' || unit.tags.includes('burst') || unit.tags.includes('dot')) return 3;
  if (unit.tags.includes('support') || unit.tags.includes('sustain')) return 6;
  if (unit.role === 'backline' || unit.tags.includes('ranged') || unit.tags.includes('flying')) return 5;
  return 4;
}

function ensureFormationRows(state, registries) {
  state.war.formationRows ??= {};
  for (const unit of registries.units.list()) {
    if (!state.war.formationRows[unit.id]) {
      state.war.formationRows[unit.id] = getDefaultRow(unit);
    }
  }
}

function getUnitRow(state, registries, unit) {
  ensureFormationRows(state, registries);
  return state.war.formationRows[unit.id] ?? getDefaultRow(unit);
}

function getRowModifier(row) {
  return ROW_MODIFIERS[row] ?? ROW_MODIFIERS[4];
}

function getTerrainModifier(stage, unit) {
  const terrain = stage?.terrain ?? '';
  if (terrain === '\u8ff7\u96fe' && unit.tags.includes('control')) return 0.12;
  if (terrain === '\u7194\u5ca9' && unit.tags.includes('fire')) return 0.15;
  if (terrain === '\u9ad8\u7a7a' && unit.tags.includes('flying')) return 0.18;
  if (terrain === '\u77ff\u6d1e' && unit.tags.includes('pierce')) return 0.1;
  if (terrain === '\u53e4\u6218\u573a' && unit.tags.includes('undead')) return 0.12;
  if (terrain === '\u5be8\u5899' && unit.tags.includes('defense')) return 0.12;
  if (terrain === '\u4ed9\u95e8' && unit.tags.includes('magic')) return 0.1;
  return 0;
}

function getCounterModifier(unit, enemyTags = []) {
  const enemySet = new Set(enemyTags);
  const counterHits = (unit.counters ?? []).filter((tag) => enemySet.has(tag)).length;
  const weakHits = (unit.weakAgainst ?? []).filter((tag) => enemySet.has(tag)).length;
  return counterHits * 0.12 - weakHits * 0.1;
}

function getCounterScore(unit, enemyTags = []) {
  const enemySet = new Set(enemyTags);
  const counterHits = (unit.counters ?? []).filter((tag) => enemySet.has(tag));
  const weakHits = (unit.weakAgainst ?? []).filter((tag) => enemySet.has(tag));
  return {
    counterHits,
    weakHits,
    score: counterHits.length * 2 - weakHits.length * 1.5,
  };
}

function getStatusLabel(statusType) {
  return {
    poison: '\u4e2d\u6bd2',
    fire: '\u707c\u70e7',
    confuse: '\u6df7\u4e71',
    confused: '\u6df7\u4e71',
    skillSeal: '\u5c01\u6280',
    armorBreak: '\u7834\u7532',
    morale: '\u58eb\u6c14',
    attackBuff: '\u653b\u52bf',
    defenseBuff: '\u5b88\u52bf',
    sustainBuff: '\u7eed\u822a',
    attackDebuff: '\u538b\u5236',
    tenacity: '\u97e7\u6027',
    shield: '\u62a4\u76fe',
  }[statusType] ?? statusType;
}

function formatStatusList(statusTypes = []) {
  return statusTypes.map((statusType) => getStatusLabel(statusType)).join('\u3001');
}

function resolveBattlePacing(stage = null) {
  return {
    ...BATTLE_PACING,
    ...(stage?.battlePacing ?? {}),
  };
}

function getBattleRoundLimit(playerTeam, enemyTeam) {
  return Math.max(playerTeam?.battlePacing?.maxRounds ?? 0, enemyTeam?.battlePacing?.maxRounds ?? 0, BATTLE_PACING.maxRounds);
}

function isStageUnlocked(state, stage) {
  const stageReady = !stage.requiredStageId || state.war.clearedStages.includes(stage.requiredStageId);
  const nodeReady = !stage.requiredNodeId || state.scripture.unlockedNodes.includes(stage.requiredNodeId);
  return stageReady && nodeReady;
}

function getStageLockReasons(state, registries, stage) {
  const reasons = [];
  if (stage.requiredStageId && !state.war.clearedStages.includes(stage.requiredStageId)) {
    const requiredStage = registries.stages.get(stage.requiredStageId);
    reasons.push(`需先通关 ${requiredStage?.name ?? stage.requiredStageId}`);
  }
  if (stage.requiredNodeId && !state.scripture.unlockedNodes.includes(stage.requiredNodeId)) {
    const requiredNode = registries.techNodes.get(stage.requiredNodeId);
    reasons.push(`需先参悟 ${requiredNode?.name ?? stage.requiredNodeId}`);
  }
  return reasons;
}

function getNextStageId(registries, currentStageId) {
  const stages = registries.stages.list();
  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId);
  if (currentIndex === -1 || currentIndex >= stages.length - 1) {
    return currentStageId;
  }

  return stages[currentIndex + 1].id;
}

function addResourceMap(target, source = {}) {
  for (const [resourceId, amount] of Object.entries(source ?? {})) {
    if (amount > 0) {
      target[resourceId] = (target[resourceId] ?? 0) + amount;
    }
  }
  return target;
}

function buildBattleAdvice(state, registries, currentStage, army) {
  if (!currentStage) {
    return [];
  }

  const advice = [];
  const armyEstimate = Math.round(((army?.attackPower ?? 0) + (army?.defensePower ?? 0) + (army?.sustainPower ?? 0)) / 3);
  const stagePowerGap = Math.max((currentStage.enemyPower ?? 0) - armyEstimate, 0);
  const enemyTags = new Set(currentStage.enemyTags ?? []);
  const preparationLevels = state.preparations?.levels ?? {};
  const activeBeastCount = (state.beasts?.activeIds ?? []).length;
  const expeditionCount = [
    state.disciples?.expeditionTeam?.leaderId ?? null,
    ...(state.disciples?.expeditionTeam?.supportIds ?? []),
  ].filter(Boolean).length;
  const preparationMap = new Map(listBattlePreparationDefinitions().map((item) => [item.id, item]));

  if (stagePowerGap > 30 || enemyTags.has('defense') || enemyTags.has('melee')) {
    const level = preparationLevels['smithy-armament'] ?? 0;
    advice.push({
      id: 'smithy-armament',
      title: level <= 0 ? '先补玄甲兵备' : '继续补玄甲兵备',
      summary: '当前关卡偏前线压制，先把防御和兵阵战力顶上去，推图容错会明显更稳。',
      actionLabel: '前往产业页炼制',
      targetTab: 'economy',
      prepName: preparationMap.get('smithy-armament')?.name ?? '玄甲兵备',
    });
  }

  if (enemyTags.has('control') || enemyTags.has('magic') || stagePowerGap > 0) {
    const level = preparationLevels['alchemy-tonic'] ?? 0;
    advice.push({
      id: 'alchemy-tonic',
      title: level <= 0 ? '优先炼制养气丹录' : '补强养气丹录',
      summary: '目标关更吃续航和稳定推进，丹录能缓解被控和持久战压力，也会顺带提高丹药产出。',
      actionLabel: '补续航',
      targetTab: 'economy',
      prepName: preparationMap.get('alchemy-tonic')?.name ?? '养气丹录',
    });
  }

  if (currentStage.cleared || enemyTags.has('ranged') || enemyTags.has('support')) {
    const level = preparationLevels['talisman-array'] ?? 0;
    advice.push({
      id: 'talisman-array',
      title: level <= 0 ? '用符阵滚战利' : '继续升镇煞符阵',
      summary: '这类关卡适合滚资源收益，符阵会同时提高输出和战利，适合用来刷联动材料。',
      actionLabel: '冲收益',
      targetTab: 'economy',
      prepName: preparationMap.get('talisman-array')?.name ?? '镇煞符阵',
    });
  }

  if (expeditionCount < 2) {
    advice.push({
      id: 'expedition-team',
      title: '补满出征弟子',
      summary: '当前出征人数偏少，战斗联动奖励会打折。把主将和两名副将配齐，掉落线会更完整。',
      actionLabel: '前往弟子堂',
      targetTab: 'disciples',
      prepName: '出征阵容',
    });
  }

  if (activeBeastCount <= 0) {
    advice.push({
      id: 'beast-support',
      title: '带上一只灵兽',
      summary: '灵兽未参战会少一截联动成长收益，至少激活一只可让刷图掉落更有长期价值。',
      actionLabel: '前往灵兽页',
      targetTab: 'beasts',
      prepName: '灵兽支援',
    });
  }

  return advice.slice(0, 3);
}

function scoreFormationForStage(formation, stage) {
  const enemyTags = new Set(stage?.enemyTags ?? []);
  let score = 0;

  score += (formation.modifiers?.attack ?? 0) * 100;
  score += (formation.modifiers?.defense ?? 0) * 100;
  score += (formation.modifiers?.sustain ?? 0) * 100;

  if (enemyTags.has('melee') || enemyTags.has('defense')) {
    score += (formation.modifiers?.defense ?? 0) * 120;
    score += (formation.modifiers?.sustain ?? 0) * 70;
  }
  if (enemyTags.has('ranged') || enemyTags.has('support')) {
    score += (formation.modifiers?.attack ?? 0) * 110;
  }
  if (enemyTags.has('control') || enemyTags.has('magic') || enemyTags.has('fire')) {
    score += (formation.modifiers?.sustain ?? 0) * 120;
    score += (formation.modifiers?.defense ?? 0) * 40;
  }

  return score;
}

function buildTacticalRecommendation(state, registries, currentStage, units = []) {
  if (!currentStage) {
    return { formation: null, squad: [], shortage: { missingResources: {}, suggestedRewardFocus: [] } };
  }

  const formations = registries.systems.get('formations') ?? [];
  const rankedFormations = formations
    .map((formation) => ({
      ...formation,
      recommendationScore: scoreFormationForStage(formation, currentStage),
    }))
    .sort((left, right) => right.recommendationScore - left.recommendationScore);

  const bestFormation = rankedFormations[0] ?? null;
  const enemyTags = new Set(currentStage.enemyTags ?? []);
  const squad = [...units]
    .map((unit) => {
      const count = state.war.trainedUnits?.[unit.id] ?? 0;
      const tagScore = (unit.tags ?? []).reduce((sum, tag) => sum + (enemyTags.has(tag) ? -0.2 : 0), 0);
      let preferredRow = getDefaultRow(unit);
      if (unit.role === 'frontline' || unit.tags?.includes('defense')) preferredRow = 1;
      else if (unit.tags?.includes('support') || unit.tags?.includes('sustain')) preferredRow = 6;
      else if (unit.tags?.includes('ranged') || unit.tags?.includes('flying')) preferredRow = 5;
      else if (unit.tags?.includes('burst') || unit.tags?.includes('pierce')) preferredRow = 3;
      return {
        unitId: unit.id,
        unitName: unit.name,
        count,
        targetCount: Math.max(count, unit.counterProfile?.counterHits?.length > 0 ? 12 : 8),
        score: (unit.counterProfile?.score ?? 0) + tagScore + Math.min(count / 8, 2),
        counters: unit.counterProfile?.counterHits ?? [],
        weakHits: unit.counterProfile?.weakHits ?? [],
        role: unit.role,
        preferredRow,
      };
    })
    .filter((unit) => unit.count > 0 || unit.counters.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  return {
    formation: bestFormation,
    squad,
    shortage: {
      missingResources: {},
      suggestedRewardFocus: [],
    },
  };
}

function grantResources(state, resourceMap = {}) {
  for (const [resourceId, amount] of Object.entries(resourceMap)) {
    state.resources[resourceId] = (state.resources[resourceId] ?? 0) + amount;
  }
}

function getAffordableTrainAmount(state, unit, targetAmount) {
  const safeTarget = Math.max(0, Math.floor(targetAmount));
  let amount = 0;
  while (amount < safeTarget && canAfford(state, unit.trainingCost, amount + 1)) {
    amount += 1;
  }
  return amount;
}

function buildMissingCost(costMap = {}, affordedCount = 0, targetCount = 0) {
  const missingCount = Math.max(targetCount - affordedCount, 0);
  if (missingCount <= 0) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(costMap ?? {}).map(([resourceId, amount]) => [resourceId, amount * missingCount]),
  );
}

function buildLinkedBattleRewards(state, stage, expeditionBondSnapshot = null, options = {}) {
  const rewards = {};
  const enemyTags = new Set(stage?.enemyTags ?? []);
  const memberStations = new Set((expeditionBondSnapshot?.members ?? []).map((member) => member.station).filter(Boolean));
  const activeBeastCount = (state.beasts?.activeIds ?? []).length;
  const alchemyLevel = Math.max(state.buildings?.alchemy?.level ?? 0, 0);
  const smithyLevel = Math.max(state.buildings?.smithy?.level ?? 0, 0);
  const talismanLevel = Math.max(state.buildings?.talismanWorkshop?.level ?? 0, 0);
  const encounterFactor = stage?.encounterType === 'boss' ? 2 : (stage?.encounterType === 'elite' ? 1.5 : 1);
  const firstClearFactor = options.alreadyCleared ? 1 : 1.25;

  if (memberStations.has('alchemy') || alchemyLevel > 0) {
    rewards.herb = Math.max(18, Math.round((22 + alchemyLevel * 12) * firstClearFactor));
    rewards.pills = Math.max(4, Math.round((6 + alchemyLevel * 3) * encounterFactor));
  }
  if (memberStations.has('smithy') || smithyLevel > 0) {
    rewards.iron = Math.max(12, Math.round((16 + smithyLevel * 10) * encounterFactor));
  }
  if (talismanLevel > 0 || enemyTags.has('magic') || enemyTags.has('control')) {
    rewards.talisman = Math.max(4, Math.round((4 + talismanLevel * 2) * encounterFactor));
  }
  if ((expeditionBondSnapshot?.members?.length ?? 0) >= 2) {
    rewards.discipleShard = Math.max(
      6,
      Math.round(((expeditionBondSnapshot?.totalResonance ?? 0) * 0.8 + 8) * encounterFactor),
    );
  }
  if (activeBeastCount > 0) {
    rewards.beastShard = Math.max(1, Math.round(activeBeastCount * 0.6 * encounterFactor));
    rewards.spiritCrystal = (rewards.spiritCrystal ?? 0) + Math.max(4, Math.round(activeBeastCount * 5 * encounterFactor));
  }
  if (stage?.encounterType === 'elite') {
    rewards.seekImmortalToken = 1;
  }
  if (stage?.encounterType === 'boss') {
    rewards.seekImmortalToken = Math.max(rewards.seekImmortalToken ?? 0, 1);
    rewards.tianmingSeal = 1;
  }

  return Object.fromEntries(Object.entries(rewards).filter(([, amount]) => amount > 0));
}

function scaleResourceMap(resourceMap = {}, multiplier = 1) {
  const scaled = {};
  for (const [resourceId, amount] of Object.entries(resourceMap ?? {})) {
    const nextValue = Math.max(0, Math.round(amount * multiplier));
    if (nextValue > 0) {
      scaled[resourceId] = nextValue;
    }
  }
  return scaled;
}

function entriesToResourceMap(entries = [], amountMultiplier = 1) {
  return (entries ?? []).reduce((result, entry) => {
    if (!entry?.resourceId || !entry?.amount) {
      return result;
    }
    const nextAmount = Math.max(0, Math.round(entry.amount * amountMultiplier));
    if (nextAmount > 0) {
      result[entry.resourceId] = (result[entry.resourceId] ?? 0) + nextAmount;
    }
    return result;
  }, {});
}

function getDefaultRewardProfile(stage) {
  const encounterType = stage.encounterType ?? 'normal';
  if (encounterType === 'boss') {
    return {
      tier: 'boss',
      rewardMultiplier: 1.3,
      lootAmountMultiplier: 1.6,
      lootChanceMultiplier: 1.2,
      firstClearBonus: {},
      guaranteedDrops: [],
      bonusLootTable: [],
    };
  }

  if (encounterType === 'elite') {
    return {
      tier: 'elite',
      rewardMultiplier: 1.15,
      lootAmountMultiplier: 1.25,
      lootChanceMultiplier: 1.1,
      firstClearBonus: {},
      guaranteedDrops: [],
      bonusLootTable: [],
    };
  }

  return {
    tier: 'normal',
    rewardMultiplier: 1,
    lootAmountMultiplier: 1,
    lootChanceMultiplier: 1,
    firstClearBonus: {},
    guaranteedDrops: [],
    bonusLootTable: [],
  };
}

function getRewardProfile(stage) {
  const defaults = getDefaultRewardProfile(stage);
  const rewardProfile = stage.rewardProfile ?? {};
  return {
    ...defaults,
    ...rewardProfile,
    firstClearBonus: {
      ...defaults.firstClearBonus,
      ...(rewardProfile.firstClearBonus ?? {}),
    },
    guaranteedDrops: [...defaults.guaranteedDrops, ...(rewardProfile.guaranteedDrops ?? [])],
    bonusLootTable: [...defaults.bonusLootTable, ...(rewardProfile.bonusLootTable ?? [])],
  };
}

function rollLootEntries(entries = [], options = {}) {
  const amountMultiplier = options.amountMultiplier ?? 1;
  const chanceMultiplier = options.chanceMultiplier ?? 1;
  const source = options.source ?? 'loot';
  const loot = {};
  const lootRolls = [];

  for (const entry of entries ?? []) {
    if (!entry?.resourceId || !entry?.amount) {
      continue;
    }

    const chance = clamp01((entry.chance ?? 0) * chanceMultiplier);
    const hit = Math.random() <= chance;
    if (!hit) {
      continue;
    }

    const amount = Math.max(1, Math.round(entry.amount * amountMultiplier));
    loot[entry.resourceId] = (loot[entry.resourceId] ?? 0) + amount;
    lootRolls.push({
      resourceId: entry.resourceId,
      amount,
      chance: round2(chance),
      source,
    });
  }

  return { loot, lootRolls };
}

function buildRewardPreview(stage, cleared = false, warehouseEffects = null, linkedReward = {}) {
  const rewardProfile = getRewardProfile(stage);
  const rewardMultiplier = 1 + Math.max(warehouseEffects?.warRewardMultiplier ?? 0, 0);
  const lootAmountMultiplier = rewardProfile.lootAmountMultiplier * (1 + Math.max(warehouseEffects?.warLootAmountMultiplier ?? 0, 0));
  return {
    tier: rewardProfile.tier,
    rewardMultiplier: rewardProfile.rewardMultiplier * rewardMultiplier,
    lootAmountMultiplier,
    lootChanceMultiplier: rewardProfile.lootChanceMultiplier,
    warehouseRewardMultiplier: rewardMultiplier,
    warehouseLootAmountMultiplier: 1 + Math.max(warehouseEffects?.warLootAmountMultiplier ?? 0, 0),
    baseReward: scaleResourceMap(stage.reward ?? {}, rewardProfile.rewardMultiplier * rewardMultiplier),
    guaranteedLoot: entriesToResourceMap(rewardProfile.guaranteedDrops, lootAmountMultiplier),
    firstClearBonus: cleared ? {} : scaleResourceMap(rewardProfile.firstClearBonus ?? {}, rewardMultiplier),
    linkedReward: { ...(linkedReward ?? {}) },
    bonusLootTable: rewardProfile.bonusLootTable,
  };
}

function resolveStageRewards(stage, lootBonus = 1, alreadyCleared = false, warehouseEffects = null, linkedReward = {}) {
  const rewardProfile = getRewardProfile(stage);
  const rewardMultiplier = 1 + Math.max(warehouseEffects?.warRewardMultiplier ?? 0, 0);
  const lootAmountMultiplier = rewardProfile.lootAmountMultiplier * (1 + Math.max(warehouseEffects?.warLootAmountMultiplier ?? 0, 0));
  const baseReward = scaleResourceMap(stage.reward ?? {}, lootBonus * rewardProfile.rewardMultiplier * rewardMultiplier);
  const guaranteedLoot = entriesToResourceMap(rewardProfile.guaranteedDrops, lootAmountMultiplier);
  const firstClearBonus = alreadyCleared ? {} : scaleResourceMap(rewardProfile.firstClearBonus ?? {}, rewardMultiplier);
  const randomStageLoot = rollLootEntries(stage.lootTable ?? [], {
    amountMultiplier: lootAmountMultiplier,
    chanceMultiplier: rewardProfile.lootChanceMultiplier,
    source: 'stage-loot',
  });
  const bonusLoot = rollLootEntries(rewardProfile.bonusLootTable ?? [], {
    amountMultiplier: lootAmountMultiplier,
    chanceMultiplier: rewardProfile.lootChanceMultiplier,
    source: 'bonus-loot',
  });

  const totalReward = {};
  addResourceMap(totalReward, baseReward);
  addResourceMap(totalReward, guaranteedLoot);
  addResourceMap(totalReward, firstClearBonus);
  addResourceMap(totalReward, randomStageLoot.loot);
  addResourceMap(totalReward, bonusLoot.loot);
  addResourceMap(totalReward, linkedReward);

  return {
    totalReward,
    breakdown: {
      tier: rewardProfile.tier,
      baseReward,
      guaranteedLoot,
      firstClearBonus,
      randomLoot: randomStageLoot.loot,
      bonusLoot: bonusLoot.loot,
      linkedReward: { ...(linkedReward ?? {}) },
      lootRolls: [...randomStageLoot.lootRolls, ...bonusLoot.lootRolls],
      warehouseRewardMultiplier: rewardMultiplier,
      warehouseLootAmountMultiplier: 1 + Math.max(warehouseEffects?.warLootAmountMultiplier ?? 0, 0),
    },
  };
}

function getEnemySkill(enemyTags = []) {
  if (enemyTags.includes('fire')) return { name: '\u711a\u5929\u706b\u96e8', type: 'firestorm', ratio: 0.16, cooldown: 2 };
  if (enemyTags.includes('control')) return { name: '\u60d1\u5fc3\u5492', type: 'confuse', ratio: 0.1, cooldown: 2 };
  if (enemyTags.includes('support')) return { name: '\u56de\u6625\u672f', type: 'heal', ratio: 0.1, cooldown: 2 };
  if (enemyTags.includes('pierce')) return { name: '\u7834\u9635\u7a7f\u4e91', type: 'pierce', ratio: 0.18, cooldown: 2 };
  if (enemyTags.includes('undead')) return { name: '\u5c38\u9b42\u8fd8\u9633', type: 'reanimate', ratio: 0.08, cooldown: 3 };
  if (enemyTags.includes('defense')) return { name: '\u7384\u7532\u62a4\u9635', type: 'guard', ratio: 0.1, cooldown: 2 };
  if (enemyTags.includes('ranged')) return { name: '\u7bad\u96e8\u9f50\u5c04', type: 'volley', ratio: 0.14, cooldown: 2 };
  return { name: '\u6218\u610f\u9f13\u821e', type: 'morale', ratio: 0.08, cooldown: 2 };
}

function getTargetingProfile(rowProfile) {
  const tags = rowProfile.tags ?? [];
  if (tags.includes('ranged') || tags.includes('flying')) return 'backline';
  if (tags.includes('pierce')) return 'middle';
  if (tags.includes('control') || tags.includes('magic') || tags.includes('support')) return 'support';
  return 'frontline';
}

function sortRowsByPriority(rowProfiles, priority) {
  const alive = rowProfiles.filter((item) => item.hp > 0);
  switch (priority) {
    case 'backline':
      return [...alive].sort((a, b) => b.row - a.row);
    case 'middle':
      return [...alive].sort((a, b) => Math.abs(a.row - 4) - Math.abs(b.row - 4));
    case 'support':
      return [...alive].sort((a, b) => b.row - a.row);
    default:
      return [...alive].sort((a, b) => a.row - b.row);
  }
}

function chooseTargetRow(attackerRowProfile, defender) {
  const priority = getTargetingProfile(attackerRowProfile);
  return sortRowsByPriority(defender.rowProfiles, priority)[0] ?? defender.rowProfiles.find((row) => row.hp > 0) ?? null;
}

function syncTeamHp(team) {
  team.hp = team.rowProfiles.reduce((sum, rowProfile) => sum + Math.max(rowProfile.hp, 0), 0);
}

function applyDamageToRow(team, targetRow, damage) {
  let remaining = Math.max(damage, 0);
  if (team.statuses.shield > 0) {
    const absorbed = Math.min(team.statuses.shield, remaining);
    team.statuses.shield -= absorbed;
    remaining -= absorbed;
  }

  if (remaining <= 0) {
    syncTeamHp(team);
    return 0;
  }

  const startIndex = Math.max(team.rowProfiles.findIndex((rowProfile) => rowProfile.row === targetRow.row), 0);
  const order = [
    ...team.rowProfiles.slice(startIndex),
    ...team.rowProfiles.slice(0, startIndex),
  ];

  let totalDealt = 0;
  for (const rowProfile of order) {
    if (rowProfile.hp <= 0) continue;
    const dealt = Math.min(rowProfile.hp, remaining);
    rowProfile.hp -= dealt;
    remaining -= dealt;
    totalDealt += dealt;
    if (remaining <= 0) break;
  }

  syncTeamHp(team);
  return totalDealt;
}

function healTeam(team, amount) {
  let remaining = Math.max(amount, 0);
  const order = [...team.rowProfiles].sort((a, b) => (a.hp / Math.max(a.maxHp, 1)) - (b.hp / Math.max(b.maxHp, 1)));
  for (const rowProfile of order) {
    if (remaining <= 0) break;
    const missing = rowProfile.maxHp - rowProfile.hp;
    if (missing <= 0) continue;
    const restored = Math.min(missing, remaining);
    rowProfile.hp += restored;
    remaining -= restored;
  }
  syncTeamHp(team);
}

function buildRowSummary(state, registries) {
  ensureFormationRows(state, registries);
  const summary = ROW_ORDER.map((row) => ({ row, units: [], totalCount: 0 }));
  for (const unit of getAvailableUnits(state, registries)) {
    const count = state.war.trainedUnits[unit.id] ?? 0;
    if (count <= 0) continue;
    const row = getUnitRow(state, registries, unit);
    const bucket = summary.find((item) => item.row === row);
    bucket.units.push({ id: unit.id, name: unit.name, count });
    bucket.totalCount += count;
  }
  return summary;
}

function calculateArmyPower(state, registries, stage = null) {
  const availableUnits = getAvailableUnits(state, registries);
  const formation = getFormation(registries, state.war.formationId) ?? { modifiers: { attack: 0, defense: 0, sustain: 0 } };
  const { all } = collectUnlockedEffects(state, registries);
  const synergyRoster = availableUnits.map((unit) => ({
    id: unit.id,
    tags: unit.tags ?? [],
    row: getUnitRow(state, registries, unit),
    count: state.war.trainedUnits[unit.id] ?? 0,
  }));
  const synergies = resolveFormationSynergies(synergyRoster);

  const unitPowerBonus = 1 + sumEffects(all, 'unitPowerMultiplier');
  const battleAttackBonus = sumEffects(all, 'battleAttack') + (formation.modifiers.attack ?? 0) + (synergies.modifiers.attack ?? 0);
  const battleDefenseBonus = sumEffects(all, 'battleDefense') + (formation.modifiers.defense ?? 0) + (synergies.modifiers.defense ?? 0);
  const battleSustainBonus = sumEffects(all, 'battleSustain') + (formation.modifiers.sustain ?? 0) + (synergies.modifiers.sustain ?? 0);

  let basePower = 0;
  let totalUnits = 0;
  let strategyBonus = 0;
  const composition = {};

  for (const unit of availableUnits) {
    const count = state.war.trainedUnits[unit.id] ?? 0;
    if (count <= 0) continue;

    const row = getUnitRow(state, registries, unit);
    const rowModifier = getRowModifier(row);
    totalUnits += count;
    composition[unit.id] = count;
    const unitBase = count * ((unit.power * 1.2) + (unit.hp * 0.4));
    const modifier = getTerrainModifier(stage, unit) + getCounterModifier(unit, stage?.enemyTags ?? []);
    basePower += unitBase * (1 + modifier + rowModifier.attack * 0.6 + rowModifier.defense * 0.3);
    strategyBonus += (modifier + rowModifier.attack * 0.5 + rowModifier.defense * 0.2) * count;
  }

  const supportCount = availableUnits
    .filter((unit) => unit.tags.includes('support'))
    .reduce((sum, unit) => sum + (state.war.trainedUnits[unit.id] ?? 0), 0);
  const supportRatio = totalUnits > 0 ? Math.min(supportCount / totalUnits, 0.25) : 0;

  return {
    totalUnits,
    formation,
    synergies,
    basePower,
    supportRatio,
    strategyScore: strategyBonus,
    composition,
    attackPower: basePower * (1 + battleAttackBonus + supportRatio * 0.2),
    defensePower: basePower * (1 + battleDefenseBonus + supportRatio * 0.08),
    sustainPower: basePower * (1 + battleSustainBonus + supportRatio * 0.12),
  };
}

function getUnitSpeed(unit, side = 'ally') {
  let speed = 100;
  if (unit.tags?.includes('flying')) speed += 18;
  if (unit.tags?.includes('burst')) speed += 14;
  if (unit.tags?.includes('ranged')) speed += 10;
  if (unit.tags?.includes('support')) speed += 6;
  if (unit.tags?.includes('control')) speed += 8;
  if (unit.tags?.includes('defense')) speed -= 10;
  if (unit.tags?.includes('summon')) speed += 12;
  if (unit.role === 'frontline') speed -= 6;
  if (unit.role === 'backline') speed += 6;
  if ((unit.row ?? 4) <= 2) speed -= 4;
  if ((unit.row ?? 4) >= 5) speed += 5;
  if (side === 'ally') speed += 2;
  return Math.max(55, speed);
}

function buildPlayerTeam(state, registries, stage) {
  const { all } = collectUnlockedEffects(state, registries);
  const unitPowerBonus = 1 + sumEffects(all, 'unitPowerMultiplier');
  const formation = getFormation(registries, state.war.formationId) ?? { modifiers: { attack: 0, defense: 0, sustain: 0 } };
  const synergyRoster = getAvailableUnits(state, registries).map((unit) => ({
    id: unit.id,
    tags: unit.tags ?? [],
    row: getUnitRow(state, registries, unit),
    count: state.war.trainedUnits[unit.id] ?? 0,
  }));
  const synergies = resolveFormationSynergies(synergyRoster);
  const battlePacing = resolveBattlePacing(stage);
  const units = getAvailableUnits(state, registries)
    .map((unit) => {
      const count = state.war.trainedUnits[unit.id] ?? 0;
      const row = getUnitRow(state, registries, unit);
      const rowModifier = getRowModifier(row);
      const terrainModifier = getTerrainModifier(stage, unit) + getCounterModifier(unit, stage.enemyTags ?? []);
      const attackPower = count * unit.power * unitPowerBonus * (1 + terrainModifier + rowModifier.attack) * (1 + (formation.modifiers.attack ?? 0) + (synergies.modifiers.attack ?? 0));
      const defensePower = count * unit.hp * (unit.tags.includes('defense') ? 1.2 : 1) * (1 + rowModifier.defense) * (1 + (formation.modifiers.defense ?? 0) + (synergies.modifiers.defense ?? 0));
      const sustainPower = count * (unit.tags.includes('support') || unit.tags.includes('sustain') ? 1.4 : 0.7) * (1 + rowModifier.sustain) * (1 + (formation.modifiers.sustain ?? 0) + (synergies.modifiers.sustain ?? 0));
      const maxHp = count * unit.hp * battlePacing.playerHpMultiplier;
      return {
        ...unit,
        count,
        row,
        attackPower,
        defensePower,
        sustainPower,
        maxHp,
        speed: getUnitSpeed({ ...unit, row }, 'ally'),
        source: 'base',
      };
    })
    .filter((unit) => unit.count > 0);

  const rowProfiles = ROW_ORDER.map((row) => {
    const rowUnits = units.filter((unit) => unit.row === row);
    const tags = [...new Set(rowUnits.flatMap((unit) => unit.tags))];
    const attackPower = rowUnits.reduce((sum, unit) => sum + unit.attackPower, 0);
    const defensePower = rowUnits.reduce((sum, unit) => sum + unit.defensePower, 0);
    const sustainPower = rowUnits.reduce((sum, unit) => sum + unit.sustainPower, 0);
    const maxHp = rowUnits.reduce((sum, unit) => sum + unit.maxHp, 0);
    return {
      row,
      name: `\u7b2c ${row} \u6392`,
      tags,
      units: rowUnits,
      attackPower,
      defensePower,
      sustainPower,
      maxHp,
      hp: maxHp,
      avgUnitHp: rowUnits.length ? maxHp / Math.max(rowUnits.reduce((sum, unit) => sum + unit.count, 0), 1) : 1,
    };
  });

  const totalUnits = units.reduce((sum, unit) => sum + unit.count, 0);
  const maxHp = rowProfiles.reduce((sum, rowProfile) => sum + rowProfile.maxHp, 0);

  return {
    side: 'ally',
    name: '\u6211\u65b9',
    units,
    totalUnits,
    maxHp,
    hp: maxHp,
    rowProfiles,
    formation,
    synergies,
    battlePacing,
    statuses: {
      shield: 0,
      poison: 0,
      fire: 0,
      morale: 0,
      attackBuff: 0,
      defenseBuff: 0,
      sustainBuff: 0,
      attackDebuff: 0,
      armorBreak: 0,
      skillSeal: 0,
      confused: 0,
      tenacity: 0,
    },
    cooldowns: {},
  };
}


function getEnemyStatPack(basePower, tags = [], scale = 1) {
  return {
    attackPower: basePower * scale * (1.4 + (tags.includes('ranged') ? 0.2 : 0) + (tags.includes('magic') ? 0.15 : 0) + (tags.includes('burst') ? 0.18 : 0)),
    defensePower: basePower * scale * (1.1 + (tags.includes('defense') ? 0.35 : 0) + (tags.includes('wood') ? 0.12 : 0)),
    sustainPower: basePower * scale * (0.4 + (tags.includes('support') ? 0.25 : 0) + (tags.includes('undead') ? 0.18 : 0)),
  };
}

function createEnemyUnit({ id, name, row, count, tags = [], power, maxHp, skill, attackPower, defensePower, sustainPower, source = 'base', mechanicId = null, lifecycle = null, killChain = null, reaction = null, aura = null }) {
  return {
    id,
    name,
    row,
    count,
    tags,
    power,
    hp: maxHp / Math.max(count, 1),
    maxHp,
    skill: skill ?? getEnemySkill(tags),
    speed: getUnitSpeed({ tags, row, source, role: tags.includes('defense') ? 'frontline' : tags.includes('ranged') ? 'backline' : 'midline' }, 'enemy'),
    attackPower,
    defensePower,
    sustainPower,
    source,
    mechanicId,
    lifecycle,
    killChain,
    reaction,
    aura,
  };
}

function recalculateEnemyRowProfile(rowProfile) {
  const activeUnits = rowProfile.units ?? [];
  const nextMaxHp = activeUnits.reduce((sum, unit) => sum + (unit.maxHp ?? ((unit.hp ?? 1) * Math.max(unit.count ?? 1, 1))), 0);
  rowProfile.tags = [...new Set(activeUnits.flatMap((unit) => unit.tags ?? []))];
  rowProfile.attackPower = activeUnits.reduce((sum, unit) => sum + (unit.attackPower ?? ((unit.count ?? 0) * (unit.power ?? 0))), 0);
  rowProfile.defensePower = activeUnits.reduce((sum, unit) => sum + (unit.defensePower ?? ((unit.count ?? 0) * (unit.hp ?? 0))), 0);
  rowProfile.sustainPower = activeUnits.reduce((sum, unit) => sum + (unit.sustainPower ?? 0), 0);
  rowProfile.maxHp = nextMaxHp;
  rowProfile.hp = Math.min(rowProfile.hp ?? nextMaxHp, nextMaxHp);
  const totalCount = activeUnits.reduce((sum, unit) => sum + Math.max(unit.count ?? 0, 0), 0);
  rowProfile.avgUnitHp = totalCount > 0 ? nextMaxHp / totalCount : 1;
  return rowProfile;
}

function refreshEnemyTeam(team) {
  for (const rowProfile of team.rowProfiles) {
    recalculateEnemyRowProfile(rowProfile);
  }
  team.units = team.rowProfiles.flatMap((rowProfile) => rowProfile.units ?? []);
  team.totalUnits = team.units.reduce((sum, unit) => sum + Math.max(unit.count ?? 0, 0), 0);
  team.maxHp = team.rowProfiles.reduce((sum, rowProfile) => sum + Math.max(rowProfile.maxHp ?? 0, 0), 0);
  syncTeamHp(team);
  return team;
}

function buildEnemyTeam(stage) {
  const battlePacing = resolveBattlePacing(stage);
  const totalUnits = Math.max(Math.round(stage.enemyPower / 6), 18);
  const maxHp = stage.enemyPower * battlePacing.enemyHpMultiplier;
  const totalRatio = (stage.enemyFormation ?? []).reduce((sum, rowProfile) => sum + rowProfile.countRatio, 0) || 1;
  const rowProfiles = ROW_ORDER.map((row) => {
    const template = (stage.enemyFormation ?? []).find((item) => item.row === row);
    if (!template) {
      return { row, name: `\u7b2c ${row} \u6392`, tags: [], units: [], attackPower: 0, defensePower: 0, sustainPower: 0, maxHp: 0, hp: 0, avgUnitHp: 1 };
    }

    const ratio = template.countRatio / totalRatio;
    const count = Math.max(1, Math.round(totalUnits * ratio));
    const rowMaxHp = maxHp * ratio;
    const tags = template.tags ?? [];
    const statPack = getEnemyStatPack(stage.enemyPower, tags, ratio);
    const baseUnit = createEnemyUnit({
      id: `${stage.id}-enemy-${row}`,
      name: template.name,
      row,
      count,
      tags,
      power: stage.enemyPower / 10,
      maxHp: rowMaxHp,
      skill: getEnemySkill(tags),
      attackPower: statPack.attackPower,
      defensePower: statPack.defensePower,
      sustainPower: statPack.sustainPower,
      lifecycle: template.lifecycle ?? null,
      killChain: template.killChain ?? null,
      reaction: template.reaction ?? null,
      aura: template.aura ?? null,
    });

    return recalculateEnemyRowProfile({
      row,
      name: template.name,
      tags,
      units: [baseUnit],
      attackPower: statPack.attackPower,
      defensePower: statPack.defensePower,
      sustainPower: statPack.sustainPower,
      maxHp: rowMaxHp,
      hp: rowMaxHp,
      avgUnitHp: rowMaxHp / Math.max(count, 1),
    });
  });

  return refreshEnemyTeam({
    side: 'enemy',
    name: '\u654c\u519b',
    units: rowProfiles.flatMap((rowProfile) => rowProfile.units),
    totalUnits,
    maxHp,
    baseTotalUnits: totalUnits,
    baseMaxHp: maxHp,
    baseEnemyPower: stage.enemyPower,
    hp: maxHp,
    rowProfiles,
    formation: null,
    encounterType: stage.encounterType ?? 'normal',
    battlePacing,
    mechanics: stage.mechanics ?? [],
    mechanicState: {},
    statuses: {
      shield: 0,
      poison: 0,
      fire: 0,
      morale: 0,
      attackBuff: 0,
      defenseBuff: 0,
      sustainBuff: 0,
      attackDebuff: 0,
      armorBreak: 0,
      skillSeal: 0,
      confused: 0,
      tenacity: 0,
    },
    cooldowns: {},
  });
}

function summonEnemyUnit(enemyTeam, mechanic) {
  const targetRow = enemyTeam.rowProfiles.find((item) => item.row === mechanic.targetRow);
  if (!targetRow) {
    return null;
  }

  const summon = mechanic.summon ?? {};
  const tags = summon.tags ?? ['summon', 'magic'];
  const count = summon.count ?? Math.max(1, Math.round(enemyTeam.baseTotalUnits * Math.max(summon.countScale ?? mechanic.value ?? 0.1, 0.08)));
  const hpScale = Math.max(summon.hpScale ?? ((mechanic.value ?? 0.1) * 1.15), 0.08);
  const powerScale = Math.max(summon.powerScale ?? ((mechanic.value ?? 0.1) * 1.05), 0.08);
  const maxHp = enemyTeam.baseMaxHp * hpScale;
  const statPack = getEnemyStatPack(enemyTeam.baseEnemyPower, tags, powerScale);
  const summonUnit = createEnemyUnit({
    id: `${mechanic.id}-summon-${targetRow.row}`,
    name: summon.name ?? `\u6218\u5080-${targetRow.row}`,
    row: targetRow.row,
    count,
    tags,
    power: Math.max(8, enemyTeam.baseEnemyPower * powerScale * 0.12),
    maxHp,
    skill: summon.skill ?? getEnemySkill(tags),
    attackPower: statPack.attackPower,
    defensePower: statPack.defensePower,
    sustainPower: statPack.sustainPower,
    source: 'summon',
    mechanicId: mechanic.id,
    lifecycle: summon.lifecycle ?? null,
    killChain: summon.killChain ?? null,
    reaction: summon.reaction ?? null,
    aura: summon.aura ?? null,
  });

  targetRow.units.push(summonUnit);
  targetRow.hp += summonUnit.maxHp;
  recalculateEnemyRowProfile(targetRow);
  refreshEnemyTeam(enemyTeam);
  return summonUnit;
}

function addRoundLog(roundLogs, text) {
  roundLogs.push(text);
}

function getTeamAliveRatio(team) {
  return clamp01(team.hp / Math.max(team.maxHp, 1));
}

function getPreferredTargetRowForSkill(attackerUnit, defender) {
  const attackerRowProfile = { row: attackerUnit.row ?? getDefaultRow(attackerUnit), tags: attackerUnit.tags ?? [] };
  return chooseTargetRow(attackerRowProfile, defender) ?? defender.rowProfiles.find((item) => item.hp > 0) ?? null;
}

function getSkillPotency(team, unit, enemy) {
  const totalUnits = Math.max(team.totalUnits, 1);
  const weight = Math.min(unit.count / totalUnits, 0.35);
  const sealPenalty = 1 - Math.min(team.statuses.skillSeal, 0.45);
  return unit.skill.ratio * (0.7 + weight * 1.5) * sealPenalty;
}

function getHitChance(unit, targetRow) {
  let value = 0.9;
  if (unit.tags?.includes('ranged')) value += 0.04;
  if (unit.tags?.includes('flying')) value += 0.05;
  if (unit.tags?.includes('control')) value += 0.03;
  if (unit.tags?.includes('summon')) value -= 0.02;
  if ((unit.row ?? 4) >= 5) value += 0.02;
  if (targetRow?.tags?.includes('flying')) value -= 0.04;
  if ((targetRow?.row ?? 4) >= 5) value -= 0.03;
  return clamp01(value);
}

function getCritProfile(unit) {
  let chance = 0.08;
  let multiplier = 1.55;
  if (unit.tags?.includes('burst')) {
    chance += 0.12;
    multiplier += 0.2;
  }
  if (unit.tags?.includes('ranged')) chance += 0.04;
  if (unit.tags?.includes('pierce')) chance += 0.03;
  if (unit.tags?.includes('summon')) chance += 0.05;
  if (unit.tags?.includes('flying')) multiplier += 0.08;
  return { chance: clamp01(chance), multiplier };
}

function getBlockProfile(targetRow, defenderTeam) {
  let chance = 0.06;
  let mitigation = 0.36;
  if (targetRow?.tags?.includes('defense')) {
    chance += 0.16;
    mitigation += 0.16;
  }
  if (targetRow?.tags?.includes('wood')) {
    chance += 0.06;
    mitigation += 0.08;
  }
  if ((targetRow?.row ?? 4) <= 2) {
    chance += 0.08;
    mitigation += 0.06;
  }
  chance -= Math.min(defenderTeam.statuses.armorBreak * 0.18, 0.12);
  mitigation -= Math.min(defenderTeam.statuses.armorBreak * 0.2, 0.16);
  return {
    chance: clamp01(chance),
    mitigation: clamp01(Math.max(mitigation, 0.12)),
  };
}

function getBlockBreak(unit) {
  let value = 0;
  if (unit.tags?.includes('pierce')) value += 0.12;
  if (unit.tags?.includes('fire')) value += 0.04;
  if (unit.tags?.includes('burst')) value += 0.03;
  return value;
}

function getStatusHitChance(unit, statusType, targetRow) {
  let chance = 0.72;
  if (unit.tags?.includes('magic')) chance += 0.05;
  if (unit.tags?.includes('control')) chance += 0.07;
  if ((unit.row ?? 4) >= 5) chance += 0.02;
  switch (statusType) {
    case 'poison':
      if (unit.tags?.includes('dot')) chance += 0.16;
      if (unit.tags?.includes('magic')) chance += 0.04;
      break;
    case 'fire':
      if (unit.tags?.includes('fire')) chance += 0.18;
      if (unit.tags?.includes('magic')) chance += 0.03;
      break;
    case 'confuse':
      if (unit.tags?.includes('control')) chance += 0.18;
      if (unit.tags?.includes('support')) chance += 0.02;
      break;
    case 'skillSeal':
      if (unit.tags?.includes('magic')) chance += 0.14;
      if (unit.tags?.includes('control')) chance += 0.08;
      break;
    case 'armorBreak':
      if (unit.tags?.includes('pierce')) chance += 0.16;
      if (unit.tags?.includes('burst')) chance += 0.04;
      break;
    default:
      break;
  }
  if (targetRow?.tags?.includes('support')) chance -= 0.02;
  return clamp01(chance);
}

function getStatusResistance(statusType, targetRow, defenderTeam) {
  let resistance = 0.08 + Math.min(defenderTeam.statuses.defenseBuff * 0.08, 0.12) + Math.min(defenderTeam.statuses.tenacity * 0.24, 0.18);
  if (targetRow?.tags?.includes('support')) resistance += 0.03;
  switch (statusType) {
    case 'poison':
      if (targetRow?.tags?.includes('wood')) resistance += 0.08;
      if (targetRow?.tags?.includes('undead')) resistance += 0.12;
      if ((targetRow?.row ?? 4) <= 2) resistance += 0.03;
      break;
    case 'fire':
      if (targetRow?.tags?.includes('fire')) resistance += 0.2;
      if (targetRow?.tags?.includes('wood')) resistance -= 0.12;
      if (targetRow?.tags?.includes('flying')) resistance += 0.03;
      break;
    case 'confuse':
      if (targetRow?.tags?.includes('control')) resistance += 0.16;
      if ((targetRow?.row ?? 4) >= 5) resistance += 0.04;
      break;
    case 'skillSeal':
      if (targetRow?.tags?.includes('magic')) resistance += 0.12;
      if ((targetRow?.row ?? 4) >= 5) resistance += 0.04;
      break;
    case 'armorBreak':
      if (targetRow?.tags?.includes('defense')) resistance += 0.18;
      if (targetRow?.tags?.includes('wood')) resistance += 0.06;
      if ((targetRow?.row ?? 4) <= 2) resistance += 0.05;
      break;
    default:
      break;
  }
  return clamp01(Math.max(resistance, 0));
}

function applyStatusValue(defenderTeam, statusType, value) {
  switch (statusType) {
    case 'poison':
    case 'fire':
    case 'skillSeal':
    case 'armorBreak':
      defenderTeam.statuses[statusType] += value;
      return round2(value);
    case 'confuse': {
      const appliedValue = Math.max(1, Math.round(value));
      defenderTeam.statuses.confused += appliedValue;
      return appliedValue;
    }
    default:
      return round2(value);
  }
}

function getNegativeStatusConfig() {
  return [
    { type: 'skillSeal', mode: 'ratio' },
    { type: 'confused', mode: 'count' },
    { type: 'fire', mode: 'ratio' },
    { type: 'poison', mode: 'ratio' },
    { type: 'armorBreak', mode: 'ratio' },
    { type: 'attackDebuff', mode: 'ratio' },
  ];
}

function getPositiveStatusConfig() {
  return [
    { type: 'shield', mode: 'ratio' },
    { type: 'attackBuff', mode: 'ratio' },
    { type: 'defenseBuff', mode: 'ratio' },
    { type: 'sustainBuff', mode: 'ratio' },
    { type: 'morale', mode: 'ratio' },
    { type: 'tenacity', mode: 'ratio' },
  ];
}

function reduceStatusValue(team, type, mode, ratio = 0.5, flat = 0) {
  const current = team.statuses[type] ?? 0;
  if (current <= 0) {
    return null;
  }

  const removed = mode === 'count'
    ? Math.min(current, Math.max(1, Math.round(flat || 1)))
    : Math.min(current, Math.max(flat, current * ratio));
  const next = Math.max(0, current - removed);
  team.statuses[type] = type === 'confused' ? Math.round(next) : round2(next);
  return {
    type,
    before: round2(current),
    after: round2(team.statuses[type]),
    removed: round2(removed),
  };
}

function cleanseTeamStatuses(team, options = {}) {
  const maxTypes = options.maxTypes ?? 1;
  const ratio = options.ratio ?? 0.45;
  const flat = options.flat ?? 0;
  const results = [];
  for (const config of getNegativeStatusConfig()) {
    if (results.length >= maxTypes) break;
    const result = reduceStatusValue(team, config.type, config.mode, ratio, flat);
    if (result && result.removed > 0) {
      results.push(result);
    }
  }
  return results;
}

function dispelTeamBuffs(team, options = {}) {
  const maxTypes = options.maxTypes ?? 1;
  const ratio = options.ratio ?? 0.5;
  const flat = options.flat ?? 0;
  const results = [];
  for (const config of getPositiveStatusConfig()) {
    if (results.length >= maxTypes) break;
    const result = reduceStatusValue(team, config.type, config.mode, ratio, flat);
    if (result && result.removed > 0) {
      results.push(result);
    }
  }
  return results;
}

function gainTenacity(team, amount) {
  const nextValue = round2((team.statuses.tenacity ?? 0) + amount);
  team.statuses.tenacity = nextValue;
  return nextValue;
}

function resolveStatusApplication({ attackerTeam, defenderTeam, unit, targetRow, statusType, baseValue, roundLogs, actionLabel, onApply }) {
  if (!targetRow) {
    return { type: statusType, applied: false, resisted: true, chance: 0, resistance: 1, value: 0, targetRow: null };
  }

  const chance = getStatusHitChance(unit, statusType, targetRow);
  const resistance = getStatusResistance(statusType, targetRow, defenderTeam);
  const effectiveChance = clamp01(chance - resistance);
  const applied = Math.random() <= effectiveChance;
  if (!applied) {
    addRoundLog(roundLogs, `${attackerTeam.name}${unit.name}${actionLabel}，但第 ${targetRow.row} 排成功抵抗。`);
    return {
      type: statusType,
      applied: false,
      resisted: true,
      chance: round2(effectiveChance),
      baseChance: round2(chance),
      resistance: round2(resistance),
      value: 0,
      targetRow: targetRow.row,
    };
  }

  const appliedValue = applyStatusValue(defenderTeam, statusType, baseValue);
  if (typeof onApply === 'function') {
    onApply(appliedValue);
  }
  addRoundLog(roundLogs, `${attackerTeam.name}${unit.name}${actionLabel}，对第 ${targetRow.row} 排施加${getStatusLabel(statusType)}。`);
  return {
    type: statusType,
    applied: true,
    resisted: false,
    chance: round2(effectiveChance),
    baseChance: round2(chance),
    resistance: round2(resistance),
    value: appliedValue,
    targetRow: targetRow.row,
  };
}

function formatOutcomeLabel(outcome) {
  if (!outcome) return '\u672a\u77e5';
  if (outcome.result === 'miss') return '\u95ea\u907f';
  if (outcome.crit && outcome.blocked) return '\u66b4\u51fb\u88ab\u6321';
  if (outcome.crit) return '\u66b4\u51fb';
  if (outcome.blocked) return '\u683c\u6321';
  if (outcome.result === 'hit') return '\u547d\u4e2d';
  if (outcome.result === 'no-target') return '\u65e0\u76ee\u6807';
  if (outcome.result === 'skipped') return '\u5f85\u547d';
  if (outcome.result === 'utility') return '\u6218\u672f\u751f\u6548';
  if (outcome.result === 'heal') return '\u6062\u590d\u751f\u6548';
  if (outcome.result === 'buff') return '\u589e\u76ca\u751f\u6548';
  if (outcome.result === 'status-applied') return '\u72b6\u6001\u547d\u4e2d';
  if (outcome.result === 'status-resisted') return '\u72b6\u6001\u62b5\u6297';
  return outcome.result ?? '\u547d\u4e2d';
}

function resolveDamageAction({ attackerTeam, defenderTeam, unit, targetRow, baseDamage, roundLogs, actionLabel, reactionContext = null }) {
  if (!targetRow) {
    return { result: 'no-target', hit: false, crit: false, blocked: false, damage: 0, casualties: 0, targetRow: null };
  }

  const guardResult = tryTriggerGuardReaction({
    attackerTeam,
    defenderTeam,
    attackingUnit: unit,
    targetRow,
    round: reactionContext?.round,
    roundLogs,
    roundReactionEvents: reactionContext?.roundReactionEvents ?? [],
    allowGuard: reactionContext?.allowGuard !== false,
  });
  const resolvedTargetRow = guardResult.targetRow ?? targetRow;
  const reactionEvents = [...(guardResult.reactionEvents ?? [])];

  const hitChance = getHitChance(unit, resolvedTargetRow);
  if (Math.random() > hitChance) {
    addRoundLog(roundLogs, `${attackerTeam.name}${unit.name}${actionLabel}，但被第 ${resolvedTargetRow.row} 排闪避。`);
    return {
      result: 'miss',
      hit: false,
      crit: false,
      blocked: false,
      damage: 0,
      casualties: 0,
      targetRow: resolvedTargetRow.row,
      hitChance: round2(hitChance),
      reactionEvents,
      outcomeLabel: formatOutcomeLabel({ result: 'miss' }),
    };
  }

  const critProfile = getCritProfile(unit);
  const crit = Math.random() <= critProfile.chance;
  const blockProfile = getBlockProfile(resolvedTargetRow, defenderTeam);
  const blockChance = clamp01(blockProfile.chance - getBlockBreak(unit));
  const blocked = Math.random() <= blockChance;
  const critMultiplier = crit ? critProfile.multiplier : 1;
  const blockMultiplier = blocked ? (1 - blockProfile.mitigation) : 1;
  const battlePacing = attackerTeam.battlePacing ?? defenderTeam.battlePacing ?? BATTLE_PACING;
  const damage = Math.max(1, baseDamage * battlePacing.globalDamageMultiplier * (guardResult.damageMultiplier ?? 1) * critMultiplier * blockMultiplier);
  const dealt = applyDamageToRow(defenderTeam, resolvedTargetRow, damage);
  const casualties = Math.floor(dealt / Math.max(resolvedTargetRow.avgUnitHp, 1));
  const result = crit ? (blocked ? 'crit-block' : 'crit') : blocked ? 'block' : 'hit';
  addRoundLog(roundLogs, `${attackerTeam.name}${unit.name}${actionLabel}\u547d\u4e2d\u7b2c ${resolvedTargetRow.row} \u6392\uff0c\u9020\u6210 ${Math.round(dealt)} \u4f24\u5bb3\uff0c\u7ed3\u679c ${formatOutcomeLabel({ result, crit, blocked })}\uff0c\u51fb\u7834 ${casualties} \u4eba\u3002`);
  return {
    result,
    hit: true,
    crit,
    blocked,
    damage: Math.round(dealt),
    casualties,
    targetRow: resolvedTargetRow.row,
    hitChance: round2(hitChance),
    critChance: round2(critProfile.chance),
    blockChance: round2(blockChance),
    guarded: resolvedTargetRow.row !== targetRow.row || reactionEvents.some((event) => event.type === 'guard'),
    reactionEvents,
    outcomeLabel: formatOutcomeLabel({ result, crit, blocked }),
  };
}

function applySkill(team, enemy, unit, round, roundLogs, roundReactionEvents = [], options = {}) {
  if (!unit.skill) return null;

  const nextAvailableRound = team.cooldowns[unit.id] ?? 1;
  if (round < nextAvailableRound) return null;

  const targetRow = options.targetRow ?? getPreferredTargetRowForSkill(unit, enemy);
  const potency = getSkillPotency(team, unit, enemy);
  const streakMultiplier = getKillStreakDamageMultiplier(team, unit);
  let outcome = { result: 'utility' };
  switch (unit.skill.type) {
    case 'guard': {
      const amount = team.maxHp * potency * 0.18;
      team.statuses.shield += amount;
      addRoundLog(roundLogs, `${team.name}${unit.name}施展${unit.skill.name}，为全军加持 ${Math.round(amount)} 护盾。`);
      outcome = { result: 'utility', shield: Math.round(amount), outcomeLabel: formatOutcomeLabel({ result: 'utility' }) };
      break;
    }
    case 'volley': {
      const damage = (unit.count * unit.power * 2.2) * potency * streakMultiplier;
      outcome = resolveDamageAction({ attackerTeam: team, defenderTeam: enemy, unit, targetRow, baseDamage: damage, roundLogs, actionLabel: `\u65bd\u5c55${unit.skill.name}`, reactionContext: { round, roundReactionEvents } });
      break;
    }
    case 'execute': {
      const hpRatio = getTeamAliveRatio(enemy);
      const damage = (unit.count * unit.power * 2.4) * potency * (hpRatio < 0.6 ? 1.5 : 1) * streakMultiplier;
      outcome = resolveDamageAction({ attackerTeam: team, defenderTeam: enemy, unit, targetRow, baseDamage: damage, roundLogs, actionLabel: `\u65bd\u5c55${unit.skill.name}`, reactionContext: { round, roundReactionEvents } });
      break;
    }
    case 'barrier': {
      team.statuses.defenseBuff += potency * 0.7;
      team.statuses.shield += team.maxHp * potency * 0.08;
      const tenacity = gainTenacity(team, potency * 0.22);
      addRoundLog(roundLogs, `${team.name}${unit.name}施展${unit.skill.name}，提升守势并张开护盾。`);
      outcome = { result: 'utility', shield: Math.round(team.maxHp * potency * 0.08), tenacity, outcomeLabel: formatOutcomeLabel({ result: 'utility' }) };
      break;
    }
    case 'morale': {
      team.statuses.attackBuff += potency * 0.75;
      team.statuses.morale += potency * 0.4;
      addRoundLog(roundLogs, `${team.name}${unit.name}施展${unit.skill.name}，全军士气高涨。`);
      outcome = { result: 'utility', morale: round2(potency * 0.4), outcomeLabel: formatOutcomeLabel({ result: 'utility' }) };
      break;
    }
    case 'poison': {
      const statusResult = resolveStatusApplication({ attackerTeam: team, defenderTeam: enemy, unit, targetRow, statusType: 'poison', baseValue: potency * 0.85, roundLogs, actionLabel: `\u65bd\u5c55${unit.skill.name}` });
      outcome = { result: statusResult.applied ? 'status-applied' : 'status-resisted', statusResults: [statusResult], outcomeLabel: formatOutcomeLabel({ result: statusResult.applied ? 'status-applied' : 'status-resisted' }) };
      break;
    }
    case 'confuse': {
      const statusResult = resolveStatusApplication({
        attackerTeam: team,
        defenderTeam: enemy,
        unit,
        targetRow,
        statusType: 'confuse',
        baseValue: 1,
        roundLogs,
        actionLabel: `\u65bd\u5c55${unit.skill.name}`,
        onApply: () => {
          enemy.statuses.attackDebuff += potency * 0.55;
        },
      });
      outcome = { result: statusResult.applied ? 'status-applied' : 'status-resisted', attackDebuff: statusResult.applied ? round2(potency * 0.55) : 0, statusResults: [statusResult], outcomeLabel: formatOutcomeLabel({ result: statusResult.applied ? 'status-applied' : 'status-resisted' }) };
      break;
    }
    case 'berserk': {
      const missingRatio = 1 - getTeamAliveRatio(team);
      team.statuses.attackBuff += potency * (0.5 + missingRatio);
      addRoundLog(roundLogs, `${team.name}${unit.name}施展${unit.skill.name}，自身进入狂战状态。`);
      outcome = { result: 'buff', attackBuff: round2(potency * (0.5 + missingRatio)), outcomeLabel: formatOutcomeLabel({ result: 'buff' }) };
      break;
    }
    case 'reanimate': {
      const amount = team.maxHp * potency * 0.12;
      healTeam(team, amount);
      const cleanseResults = cleanseTeamStatuses(team, { maxTypes: 1, ratio: 0.6, flat: 1 });
      addRoundLog(roundLogs, `${team.name}${unit.name}施展${unit.skill.name}，恢复 ${Math.round(amount)} 兵力${cleanseResults.length ? '，并清除了负面状态。' : '。'}`);
      outcome = { result: 'heal', heal: Math.round(amount), cleanseResults, outcomeLabel: formatOutcomeLabel({ result: 'heal' }) };
      break;
    }
    case 'dive': {
      const damage = (unit.count * unit.power * 2.6) * potency * streakMultiplier;
      outcome = resolveDamageAction({ attackerTeam: team, defenderTeam: enemy, unit, targetRow, baseDamage: damage, roundLogs, actionLabel: `\u65bd\u5c55${unit.skill.name}`, reactionContext: { round, roundReactionEvents } });
      break;
    }
    case 'firestorm': {
      const damageOutcome = resolveDamageAction({ attackerTeam: team, defenderTeam: enemy, unit, targetRow, baseDamage: (unit.count * unit.power * 2.1) * potency * streakMultiplier, roundLogs, actionLabel: `\u65bd\u5c55${unit.skill.name}`, reactionContext: { round, roundReactionEvents } });
      const statusResults = [];
      if (damageOutcome.hit) {
        statusResults.push(resolveStatusApplication({ attackerTeam: team, defenderTeam: enemy, unit, targetRow, statusType: 'fire', baseValue: potency * 0.75, roundLogs, actionLabel: `\u65bd\u5c55${unit.skill.name}` }));
      }
      outcome = { ...damageOutcome, statusResults };
      break;
    }
    case 'barkskin': {
      team.statuses.defenseBuff += potency * 0.8;
      team.statuses.sustainBuff += potency * 0.35;
      const tenacity = gainTenacity(team, potency * 0.35);
      const cleanseResults = cleanseTeamStatuses(team, { maxTypes: 1, ratio: 0.45, flat: 1 });
      addRoundLog(roundLogs, `${team.name}${unit.name}施展${unit.skill.name}，强化守势与续航${cleanseResults.length ? '，并清除了负面状态。' : '。'}`);
      outcome = { result: 'buff', defenseBuff: round2(potency * 0.8), tenacity, cleanseResults, outcomeLabel: formatOutcomeLabel({ result: 'buff' }) };
      break;
    }
    case 'heal': {
      const amount = team.maxHp * potency * 0.14;
      healTeam(team, amount);
      team.statuses.sustainBuff += potency * 0.3;
      const cleanseResults = cleanseTeamStatuses(team, { maxTypes: 2, ratio: 0.58, flat: 1 });
      const tenacity = gainTenacity(team, potency * 0.18);
      addRoundLog(roundLogs, `${team.name}${unit.name}施展${unit.skill.name}，恢复 ${Math.round(amount)} 兵力${cleanseResults.length ? '，并清除了负面状态。' : '。'}`);
      outcome = { result: 'heal', heal: Math.round(amount), tenacity, cleanseResults, outcomeLabel: formatOutcomeLabel({ result: 'heal' }) };
      break;
    }
    case 'pierce': {
      const damageOutcome = resolveDamageAction({ attackerTeam: team, defenderTeam: enemy, unit, targetRow, baseDamage: (unit.count * unit.power * 2.25) * potency * streakMultiplier, roundLogs, actionLabel: `\u65bd\u5c55${unit.skill.name}`, reactionContext: { round, roundReactionEvents } });
      const statusResults = [];
      if (damageOutcome.hit) {
        statusResults.push(resolveStatusApplication({ attackerTeam: team, defenderTeam: enemy, unit, targetRow, statusType: 'armorBreak', baseValue: potency * 0.8, roundLogs, actionLabel: `\u65bd\u5c55${unit.skill.name}` }));
      }
      outcome = { ...damageOutcome, statusResults };
      break;
    }
    case 'seal': {
      const statusResult = resolveStatusApplication({ attackerTeam: team, defenderTeam: enemy, unit, targetRow, statusType: 'skillSeal', baseValue: potency * 0.65, roundLogs, actionLabel: `\u65bd\u5c55${unit.skill.name}` });
      const dispelResults = statusResult.applied ? dispelTeamBuffs(enemy, { maxTypes: 2, ratio: 0.55, flat: enemy.maxHp * potency * 0.015 }) : [];
      if (dispelResults.length) {
        addRoundLog(roundLogs, `${team.name}${unit.name}驱散了敌方增益：${formatStatusList(dispelResults.map((item) => item.type))}`);
      }
      outcome = { result: statusResult.applied ? 'status-applied' : 'status-resisted', statusResults: [statusResult], dispelResults, outcomeLabel: formatOutcomeLabel({ result: statusResult.applied ? 'status-applied' : 'status-resisted' }) };
      break;
    }
    default:
      outcome = { result: 'utility', outcomeLabel: formatOutcomeLabel({ result: 'utility' }) };
      break;
  }

  team.cooldowns[unit.id] = round + Math.max(unit.skill.cooldown ?? 2, 1);
  return { actionType: 'skill', outcome };
}


function applyDotEffects(team, roundLogs) {
  let totalDamage = 0;
  const target = team.rowProfiles.find((item) => item.hp > 0) ?? team.rowProfiles[0];
  if (target && team.statuses.poison > 0) {
    totalDamage += applyDamageToRow(team, target, team.maxHp * Math.min(team.statuses.poison, 0.2) * 0.04);
  }
  if (target && team.statuses.fire > 0) {
    totalDamage += applyDamageToRow(team, target, team.maxHp * Math.min(team.statuses.fire, 0.2) * 0.05);
  }
  if (totalDamage > 0) {
    addRoundLog(roundLogs, `${team.name}受到持续伤害 ${Math.round(totalDamage)}。`);
  }
}

function decayStatuses(team) {
  team.statuses.poison *= 0.72;
  team.statuses.fire *= 0.68;
  team.statuses.attackBuff *= 0.82;
  team.statuses.defenseBuff *= 0.82;
  team.statuses.sustainBuff *= 0.82;
  team.statuses.attackDebuff *= 0.72;
  team.statuses.armorBreak *= 0.72;
  team.statuses.skillSeal *= 0.72;
  team.statuses.morale *= 0.8;
  team.statuses.tenacity *= 0.76;
  if (team.statuses.confused > 0) team.statuses.confused -= 1;
  team.statuses.shield *= 0.55;
}

function getRowAttackValue(rowProfile, team) {
  const hpRatio = rowProfile.maxHp > 0 ? 0.35 + (rowProfile.hp / rowProfile.maxHp) * 0.65 : 0;
  const confusePenalty = team.statuses.confused > 0 ? 0.18 : 0;
  return rowProfile.attackPower
    * hpRatio
    * (1 + team.statuses.attackBuff + team.statuses.morale - team.statuses.attackDebuff - confusePenalty)
    * randomFactor();
}

function getRowDefenseValue(rowProfile, team) {
  const hpRatio = rowProfile.maxHp > 0 ? 0.45 + (rowProfile.hp / rowProfile.maxHp) * 0.55 : 0;
  return rowProfile.defensePower * hpRatio * (1 + team.statuses.defenseBuff - team.statuses.armorBreak * 0.6);
}

function getRowSustainValue(rowProfile, team) {
  return rowProfile.sustainPower * (1 + team.statuses.sustainBuff);
}

function getBattleReadyUnits(team) {
  return [...(team.units ?? [])]
    .filter((unit) => {
      if ((unit.count ?? 0) <= 0) {
        return false;
      }
      const rowProfile = team.rowProfiles.find((row) => row.row === unit.row);
      return Boolean(rowProfile && rowProfile.hp > 0);
    });
}

function ensureLifecycleState(team) {
  team.lifecycleState ??= {};
  for (const unit of team.units ?? []) {
    team.lifecycleState[unit.id] ??= {
      lastHpRatio: 1,
      nearDeathTriggered: false,
      defeated: false,
      reviveCount: 0,
      deathCount: 0,
    };
  }
  return team.lifecycleState;
}

function getUnitCurrentHp(team, unit) {
  const rowProfile = team.rowProfiles.find((row) => row.row === unit.row);
  if (!rowProfile || rowProfile.maxHp <= 0 || (unit.maxHp ?? 0) <= 0) {
    return 0;
  }
  return Math.max(0, unit.maxHp * (rowProfile.hp / rowProfile.maxHp));
}

function getLifecycleProfile(unit) {
  const defaults = {
    nearDeath: null,
    onDeath: null,
    revive: null,
  };
  if (unit.skill?.type === 'reanimate' || unit.tags?.includes('undead')) {
    defaults.revive = { ratio: 0.24, maxTimes: 1 };
  }
  if (unit.tags?.includes('defense') || unit.tags?.includes('wood')) {
    defaults.onDeath = { shieldTeamRatio: 0.03 };
  }
  if (unit.tags?.includes('support') || unit.skill?.type === 'heal') {
    defaults.nearDeath = { threshold: 0.35, tenacity: 0.08, cleanse: 1 };
  }
  return {
    ...defaults,
    ...(unit.lifecycle ?? {}),
    nearDeath: unit.lifecycle?.nearDeath ?? defaults.nearDeath,
    onDeath: unit.lifecycle?.onDeath ?? defaults.onDeath,
    revive: unit.lifecycle?.revive ?? defaults.revive,
  };
}

function triggerNearDeathEffects(team, enemyTeam, unit, profile, round, roundLogs) {
  const nearDeath = profile.nearDeath ?? {};
  const cleanseResults = nearDeath.cleanse ? cleanseTeamStatuses(team, { maxTypes: nearDeath.cleanse, ratio: nearDeath.cleanseRatio ?? 0.5, flat: 1 }) : [];
  const dispelResults = nearDeath.dispelEnemyBuffs ? dispelTeamBuffs(enemyTeam, { maxTypes: nearDeath.dispelEnemyBuffs, ratio: 0.45 }) : [];
  const tenacity = nearDeath.tenacity ? gainTenacity(team, nearDeath.tenacity) : 0;
  const shield = nearDeath.shieldTeamRatio ? Math.round((team.maxHp * nearDeath.shieldTeamRatio)) : 0;
  if (shield > 0) {
    team.statuses.shield += shield;
  }
  addRoundLog(roundLogs, `${team.name}${unit.name}触发濒危应变${cleanseResults.length ? '，净化自身。' : ''}${dispelResults.length ? '，并压制敌方增益。' : ''}${tenacity ? '，同时获得韧性。' : ''}`);
  return {
    type: 'near-death',
    unitId: unit.id,
    name: unit.name,
    side: team.side,
    row: unit.row,
    round,
    payload: { cleanseResults, dispelResults, tenacity: tenacity || undefined, shield: shield || undefined },
  };
}

function triggerDeathEffects(team, enemyTeam, unit, profile, round, roundLogs) {
  const onDeath = profile.onDeath ?? {};
  const cleanseResults = onDeath.cleanse ? cleanseTeamStatuses(team, { maxTypes: onDeath.cleanse, ratio: 0.55, flat: 1 }) : [];
  const dispelResults = onDeath.dispelEnemyBuffs ? dispelTeamBuffs(enemyTeam, { maxTypes: onDeath.dispelEnemyBuffs, ratio: 0.55 }) : [];
  const tenacity = onDeath.tenacity ? gainTenacity(team, onDeath.tenacity) : 0;
  const shield = onDeath.shieldTeamRatio ? Math.round(team.maxHp * onDeath.shieldTeamRatio) : 0;
  if (shield > 0) {
    team.statuses.shield += shield;
  }
  addRoundLog(roundLogs, `${team.name}${unit.name}战死后留下余势${dispelResults.length ? '，驱散敌方增益。' : ''}${shield ? '，并为友军留下一层护盾。' : ''}`);
  return {
    type: 'death',
    unitId: unit.id,
    name: unit.name,
    side: team.side,
    row: unit.row,
    round,
    payload: { cleanseResults, dispelResults, tenacity: tenacity || undefined, shield: shield || undefined },
  };
}

function reviveUnit(team, unit, profile, round, roundLogs) {
  const revive = profile.revive ?? null;
  if (!revive) {
    return null;
  }
  const rowProfile = team.rowProfiles.find((row) => row.row === unit.row);
  if (!rowProfile) {
    return null;
  }
  const restoredHp = Math.round((unit.maxHp ?? 0) * (revive.ratio ?? 0.24));
  rowProfile.hp = Math.min(rowProfile.maxHp, rowProfile.hp + restoredHp);
  syncTeamHp(team);
  addRoundLog(roundLogs, `${team.name}${unit.name}重新归阵，恢复 ${restoredHp} 兵力。`);
  return {
    type: 'revive',
    unitId: unit.id,
    name: unit.name,
    side: team.side,
    row: unit.row,
    round,
    payload: { restoredHp, reviveRatio: revive.ratio ?? 0.24 },
  };
}

function processLifecycleTransitions(team, enemyTeam, round, roundLogs, lifecycleEvents) {
  const stateMap = ensureLifecycleState(team);
  const emittedEvents = [];
  for (const unit of team.units ?? []) {
    const state = stateMap[unit.id];
    const profile = getLifecycleProfile(unit);
    const currentHp = getUnitCurrentHp(team, unit);
    const maxHp = Math.max(unit.maxHp ?? 1, 1);
    const hpRatio = currentHp / maxHp;

    if (!state.nearDeathTriggered && profile.nearDeath && currentHp > 0 && hpRatio <= (profile.nearDeath.threshold ?? 0.35)) {
      const event = triggerNearDeathEffects(team, enemyTeam, unit, profile, round, roundLogs);
      lifecycleEvents.push(event);
      emittedEvents.push(event);
      state.nearDeathTriggered = true;
    }

    if (!state.defeated && currentHp <= 0) {
      state.defeated = true;
      state.deathCount += 1;
      const deathEvent = triggerDeathEffects(team, enemyTeam, unit, profile, round, roundLogs);
      lifecycleEvents.push(deathEvent);
      emittedEvents.push(deathEvent);
      if (profile.revive && state.reviveCount < (profile.revive.maxTimes ?? 1)) {
        const reviveEvent = reviveUnit(team, unit, profile, round, roundLogs);
        if (reviveEvent) {
          lifecycleEvents.push(reviveEvent);
          emittedEvents.push(reviveEvent);
          state.reviveCount += 1;
          state.defeated = false;
          state.nearDeathTriggered = true;
        }
      }
    }

    state.lastHpRatio = round2(hpRatio);
  }
  return emittedEvents;
}

function ensureCombatStats(team, round = null) {
  team.combatStats ??= { round: null, units: {} };
  for (const unit of team.units ?? []) {
    team.combatStats.units[unit.id] ??= {
      kills: 0,
      streak: 0,
      followUpsThisRound: 0,
      lastKillRound: 0,
    };
  }
  if (round !== null && team.combatStats.round !== round) {
    for (const stats of Object.values(team.combatStats.units)) {
      stats.followUpsThisRound = 0;
    }
    team.combatStats.round = round;
  }
  return team.combatStats.units;
}

function getUnitCombatStats(team, unit) {
  return ensureCombatStats(team)[unit.id] ?? null;
}

function getKillChainProfile(unit) {
  const defaults = {
    streakBonusPerKill: 0,
    maxStacks: 0,
    reward: null,
    followUp: null,
  };
  const profile = unit.killChain ?? {};
  const reward = profile.reward ? { ...profile.reward } : defaults.reward;
  const followUp = profile.followUp ? {
    chance: 1,
    damageRatio: 0.7,
    maxTriggersPerRound: 1,
    target: 'preferred',
    ...profile.followUp,
  } : defaults.followUp;
  return {
    ...defaults,
    ...profile,
    reward,
    followUp,
  };
}

function getKillStreakDamageMultiplier(team, unit) {
  const combatStats = getUnitCombatStats(team, unit);
  const profile = getKillChainProfile(unit);
  if (!combatStats || !profile.streakBonusPerKill || !profile.maxStacks) {
    return 1;
  }
  return 1 + Math.min(combatStats.streak, profile.maxStacks) * profile.streakBonusPerKill;
}

function applyKillReward(team, unit, profile, roundLogs) {
  if (!profile.reward) {
    return null;
  }
  const reward = {};
  if (profile.reward.morale) {
    team.statuses.morale += profile.reward.morale;
    reward.morale = round2(profile.reward.morale);
  }
  if (profile.reward.tenacity) {
    const tenacity = gainTenacity(team, profile.reward.tenacity);
    if (tenacity) {
      reward.tenacity = tenacity;
    }
  }
  if (profile.reward.shieldTeamRatio) {
    const shield = Math.round(team.maxHp * profile.reward.shieldTeamRatio);
    if (shield > 0) {
      team.statuses.shield += shield;
      reward.shield = shield;
    }
  }
  if (Object.keys(reward).length) {
    addRoundLog(roundLogs, `${team.name}${unit.name}完成击破后鼓舞全军${reward.morale ? '，士气提升。' : ''}${reward.tenacity ? '，韧性提升。' : ''}${reward.shield ? '，并获得护盾。' : ''}`);
    return reward;
  }
  return null;
}

function recordKillEvents({ actingTeam, targetTeam, unit, round, roundLogs, actionType, lifecycleEvents, roundKillEvents }) {
  const profile = getKillChainProfile(unit);
  const combatStats = getUnitCombatStats(actingTeam, unit);
  if (!combatStats) {
    return [];
  }
  const killEvents = [];
  for (const event of lifecycleEvents ?? []) {
    if (event.type !== 'death') {
      continue;
    }
    if (!targetTeam.lifecycleState?.[event.unitId]?.defeated) {
      continue;
    }
    combatStats.kills += 1;
    combatStats.streak += 1;
    combatStats.lastKillRound = round;
    const reward = applyKillReward(actingTeam, unit, profile, roundLogs);
    const killEvent = {
      killerUnitId: unit.id,
      killerName: unit.name,
      killerSide: actingTeam.side,
      victimUnitId: event.unitId,
      victimName: event.name,
      side: targetTeam.side,
      row: event.row,
      round,
      sourceAction: actionType,
      streakCount: combatStats.streak,
      reward: reward ?? undefined,
      followUpEligible: Boolean(profile.followUp),
    };
    roundKillEvents.push(killEvent);
    killEvents.push(killEvent);
  }
  return killEvents;
}

function resolveLifecycleSweep(playerTeam, enemyTeam, round, roundLogs, lifecycleEvents) {
  return {
    allyEvents: processLifecycleTransitions(playerTeam, enemyTeam, round, roundLogs, lifecycleEvents),
    enemyEvents: processLifecycleTransitions(enemyTeam, playerTeam, round, roundLogs, lifecycleEvents),
  };
}

function getFollowUpTargetRow(unit, enemyTeam, triggerEvent, profile) {
  const targetMode = profile.followUp?.target ?? 'preferred';
  if (targetMode === 'same-row' && triggerEvent?.row) {
    const rowTarget = enemyTeam.rowProfiles.find((row) => row.row === triggerEvent.row && row.hp > 0);
    if (rowTarget) {
      return rowTarget;
    }
  }
  if (targetMode === 'lowest-hp') {
    const lowestHpRow = [...enemyTeam.rowProfiles]
      .filter((row) => row.hp > 0)
      .sort((left, right) => (left.hp / Math.max(left.maxHp, 1)) - (right.hp / Math.max(right.maxHp, 1)))[0];
    if (lowestHpRow) {
      return lowestHpRow;
    }
  }
  return getPreferredTargetRowForSkill(unit, enemyTeam);
}

function tryTriggerFollowUp({ playerTeam, enemyTeam, actingTeam, targetTeam, unit, turn, round, roundLogs, roundReactionEvents, roundLifecycleEvents, roundKillEvents, killEvents }) {
  if (!killEvents?.length) {
    return null;
  }
  const profile = getKillChainProfile(unit);
  const followUp = profile.followUp;
  const combatStats = getUnitCombatStats(actingTeam, unit);
  if (!followUp || !combatStats) {
    return null;
  }
  if (combatStats.followUpsThisRound >= (followUp.maxTriggersPerRound ?? 1)) {
    return null;
  }
  if (!getLivingRowProfile(actingTeam, unit.row) || (unit.count ?? 0) <= 0) {
    return null;
  }
  if (targetTeam.hp <= 0) {
    return null;
  }
  if (Math.random() > (followUp.chance ?? 1)) {
    return null;
  }
  const targetRow = getFollowUpTargetRow(unit, targetTeam, killEvents[0], profile);
  if (!targetRow) {
    return null;
  }

  combatStats.followUpsThisRound += 1;
  addRoundLog(roundLogs, `${actingTeam.name}${unit.name}乘势追击。`);
  const actionRecord = performUnitAttack(actingTeam, targetTeam, unit, roundLogs, {
    actionType: 'follow-up',
    damageMultiplier: followUp.damageRatio ?? 0.7,
    targetRow,
    actionLabel: '\u8ffd\u51fb',
    round,
    roundReactionEvents,
    allowGuard: false,
  });
  const lifecycleDelta = resolveLifecycleSweep(playerTeam, enemyTeam, round, roundLogs, roundLifecycleEvents);
  const defeatedEvents = actingTeam.side === 'ally' ? lifecycleDelta.enemyEvents : lifecycleDelta.allyEvents;
  const followUpKills = recordKillEvents({
    actingTeam,
    targetTeam,
    unit,
    round,
    roundLogs,
    actionType: 'follow-up',
    lifecycleEvents: defeatedEvents,
    roundKillEvents,
  });
  return {
    unitId: unit.id,
    name: unit.name,
    side: turn.side,
    row: unit.row,
    source: unit.source ?? 'base',
    initiative: turn.initiative - 0.01,
    actionType: 'follow-up',
    outcome: {
      ...(actionRecord?.outcome ?? { result: 'unknown' }),
      killEvents: followUpKills,
      followUpTriggered: false,
      streakCount: getUnitCombatStats(actingTeam, unit)?.streak ?? 0,
      followUpSourceUnitId: unit.id,
    },
  };
}

function ensureReactionState(team, round = null) {
  team.reactionState ??= { round: null, units: {} };
  for (const unit of team.units ?? []) {
    team.reactionState.units[unit.id] ??= {
      guardTriggersThisRound: 0,
      counterTriggersThisRound: 0,
    };
  }
  if (round !== null && team.reactionState.round !== round) {
    for (const state of Object.values(team.reactionState.units)) {
      state.guardTriggersThisRound = 0;
      state.counterTriggersThisRound = 0;
    }
    team.reactionState.round = round;
  }
  return team.reactionState.units;
}

function getUnitReactionState(team, unit) {
  return ensureReactionState(team)[unit.id] ?? null;
}

function getReactionProfile(unit) {
  const defaults = {
    guard: null,
    counter: null,
  };
  const profile = unit.reaction ?? {};
  const guard = profile.guard ? {
    chance: 1,
    damageReduction: 0.25,
    maxTriggersPerRound: 1,
    protectRows: [unit.row],
    ...profile.guard,
  } : null;
  const counter = profile.counter ? {
    chance: 1,
    damageRatio: 0.65,
    maxTriggersPerRound: 1,
    ...profile.counter,
  } : null;
  return {
    ...defaults,
    ...profile,
    guard,
    counter,
  };
}

function getLivingRowProfile(team, row) {
  return team.rowProfiles.find((rowProfile) => rowProfile.row === row && rowProfile.hp > 0) ?? null;
}

function getGuardCandidates(defenderTeam, targetRow) {
  return [...(defenderTeam.units ?? [])]
    .filter((unit) => {
      const profile = getReactionProfile(unit);
      const state = getUnitReactionState(defenderTeam, unit);
      const rowProfile = getLivingRowProfile(defenderTeam, unit.row);
      return Boolean(
        profile.guard
        && state
        && rowProfile
        && (unit.count ?? 0) > 0
        && state.guardTriggersThisRound < (profile.guard.maxTriggersPerRound ?? 1)
        && (profile.guard.protectRows ?? [unit.row]).includes(targetRow.row)
      );
    })
    .sort((left, right) => (right.defensePower ?? 0) - (left.defensePower ?? 0) || Math.abs((left.row ?? 0) - targetRow.row) - Math.abs((right.row ?? 0) - targetRow.row));
}

function tryTriggerGuardReaction({ attackerTeam, defenderTeam, attackingUnit, targetRow, round, roundLogs, roundReactionEvents, allowGuard = true }) {
  if (!allowGuard) {
    return { targetRow, damageMultiplier: 1, reactionEvents: [] };
  }
  const guardian = getGuardCandidates(defenderTeam, targetRow)[0];
  if (!guardian) {
    return { targetRow, damageMultiplier: 1, reactionEvents: [] };
  }

  const profile = getReactionProfile(guardian).guard;
  const state = getUnitReactionState(defenderTeam, guardian);
  if (!profile || !state || Math.random() > (profile.chance ?? 1)) {
    return { targetRow, damageMultiplier: 1, reactionEvents: [] };
  }

  state.guardTriggersThisRound += 1;
  const guardRow = getLivingRowProfile(defenderTeam, guardian.row) ?? targetRow;
  const event = {
    type: 'guard',
    unitId: guardian.id,
    name: guardian.name,
    side: defenderTeam.side,
    row: guardian.row,
    round,
    payload: {
      protectedRow: targetRow.row,
      redirectedRow: guardRow.row,
      damageReduction: round2(profile.damageReduction ?? 0.25),
      attackerUnitId: attackingUnit.id,
    },
  };
  roundReactionEvents.push(event);
  addRoundLog(roundLogs, `${defenderTeam.name}${guardian.name}发动护卫，将攻击从第 ${targetRow.row} 排转移至第 ${guardRow.row} 排。`);
  return {
    targetRow: guardRow,
    damageMultiplier: Math.max(0.15, 1 - (profile.damageReduction ?? 0.25)),
    reactionEvents: [event],
  };
}

function getCounterCandidates(defenderTeam, targetRowNumber) {
  return [...(defenderTeam.units ?? [])]
    .filter((unit) => {
      const profile = getReactionProfile(unit);
      const state = getUnitReactionState(defenderTeam, unit);
      const rowProfile = getLivingRowProfile(defenderTeam, unit.row);
      return Boolean(
        profile.counter
        && state
        && rowProfile
        && unit.row === targetRowNumber
        && (unit.count ?? 0) > 0
        && state.counterTriggersThisRound < (profile.counter.maxTriggersPerRound ?? 1)
      );
    })
    .sort((left, right) => (right.attackPower ?? 0) - (left.attackPower ?? 0));
}

function tryTriggerCounterReaction({ playerTeam, enemyTeam, actingTeam, targetTeam, actingUnit, turn, round, roundLogs, roundReactionEvents, roundLifecycleEvents, roundKillEvents, actionOutcome }) {
  if (!actionOutcome?.hit || !actionOutcome?.targetRow || targetTeam.hp <= 0) {
    return null;
  }
  const counterUnit = getCounterCandidates(targetTeam, actionOutcome.targetRow)[0];
  if (!counterUnit) {
    return null;
  }

  const profile = getReactionProfile(counterUnit).counter;
  const state = getUnitReactionState(targetTeam, counterUnit);
  if (!profile || !state || Math.random() > (profile.chance ?? 1)) {
    return null;
  }

  state.counterTriggersThisRound += 1;
  const event = {
    type: 'counter',
    unitId: counterUnit.id,
    name: counterUnit.name,
    side: targetTeam.side,
    row: counterUnit.row,
    round,
    payload: {
      targetUnitId: actingUnit.id,
      targetUnitName: actingUnit.name,
      damageRatio: round2(profile.damageRatio ?? 0.65),
    },
  };
  roundReactionEvents.push(event);
  addRoundLog(roundLogs, `${targetTeam.name}${counterUnit.name}抓住破绽，对${actingUnit.name}发动反击。`);

  const preferredRow = getLivingRowProfile(actingTeam, actingUnit.row) ?? getPreferredTargetRowForSkill(counterUnit, actingTeam);
  const counterAction = performUnitAttack(targetTeam, actingTeam, counterUnit, roundLogs, {
    actionType: 'counter',
    targetRow: preferredRow,
    damageMultiplier: profile.damageRatio ?? 0.65,
    actionLabel: '\u53cd\u51fb',
    round,
    roundReactionEvents,
    allowGuard: false,
    allowCounter: false,
  });
  const lifecycleDelta = resolveLifecycleSweep(playerTeam, enemyTeam, round, roundLogs, roundLifecycleEvents);
  const defeatedEvents = targetTeam.side === 'ally' ? lifecycleDelta.enemyEvents : lifecycleDelta.allyEvents;
  const killEvents = recordKillEvents({
    actingTeam: targetTeam,
    targetTeam: actingTeam,
    unit: counterUnit,
    round,
    roundLogs,
    actionType: 'counter',
    lifecycleEvents: defeatedEvents,
    roundKillEvents,
  });
  return {
    unitId: counterUnit.id,
    name: counterUnit.name,
    side: targetTeam.side,
    row: counterUnit.row,
    source: counterUnit.source ?? 'base',
    initiative: turn.initiative - 0.02,
    actionType: 'counter',
    outcome: {
      ...(counterAction?.outcome ?? { result: 'unknown' }),
      killEvents,
      reactionEvents: [event, ...((counterAction?.outcome?.reactionEvents) ?? [])],
      followUpTriggered: false,
      streakCount: getUnitCombatStats(targetTeam, counterUnit)?.streak ?? 0,
    },
  };
}

function ensureAuraState(team, round = null) {
  team.auraState ??= { round: null, units: {} };
  for (const unit of team.units ?? []) {
    team.auraState.units[unit.id] ??= {
      lastTriggeredRound: 0,
    };
  }
  if (round !== null) {
    team.auraState.round = round;
  }
  return team.auraState.units;
}

function getUnitAuraState(team, unit) {
  return ensureAuraState(team)[unit.id] ?? null;
}

function getAuraProfile(unit) {
  const defaults = { roundStart: null };
  const profile = unit.aura ?? {};
  const roundStart = profile.roundStart ? {
    target: 'team',
    chance: 1,
    ...profile.roundStart,
  } : null;
  return {
    ...defaults,
    ...profile,
    roundStart,
  };
}

function applyAuraEffectMap(team, auraConfig) {
  const applied = {};
  const statusKeys = ['morale', 'attackBuff', 'defenseBuff', 'sustainBuff', 'attackDebuff', 'armorBreak', 'skillSeal', 'poison', 'fire'];
  for (const statusKey of statusKeys) {
    if (!auraConfig[statusKey]) {
      continue;
    }
    team.statuses[statusKey] += auraConfig[statusKey];
    applied[statusKey] = round2(auraConfig[statusKey]);
  }
  if (auraConfig.tenacity) {
    const tenacity = gainTenacity(team, auraConfig.tenacity);
    if (tenacity) {
      applied.tenacity = tenacity;
    }
  }
  if (auraConfig.shieldTeamRatio) {
    const shield = Math.round(team.maxHp * auraConfig.shieldTeamRatio);
    if (shield > 0) {
      team.statuses.shield += shield;
      applied.shield = shield;
    }
  }
  return applied;
}

function applyRoundAuras(sourceTeam, targetTeam, round, roundLogs, auraEvents) {
  const auraState = ensureAuraState(sourceTeam, round);
  for (const unit of sourceTeam.units ?? []) {
    const rowProfile = getLivingRowProfile(sourceTeam, unit.row);
    if (!rowProfile || (unit.count ?? 0) <= 0) {
      continue;
    }
    const unitState = auraState[unit.id];
    const profile = getAuraProfile(unit);
    const roundStart = profile.roundStart;
    if (!unitState || !roundStart || unitState.lastTriggeredRound === round) {
      continue;
    }
    if (Math.random() > (roundStart.chance ?? 1)) {
      continue;
    }

    const appliedTarget = roundStart.target === 'enemy' ? targetTeam : sourceTeam;
    const applied = applyAuraEffectMap(appliedTarget, roundStart);
    if (!Object.keys(applied).length) {
      unitState.lastTriggeredRound = round;
      continue;
    }

    unitState.lastTriggeredRound = round;
    const event = {
      type: 'aura',
      unitId: unit.id,
      name: unit.name,
      side: sourceTeam.side,
      row: unit.row,
      round,
      payload: {
        targetSide: appliedTarget.side,
        target: roundStart.target ?? 'team',
        ...applied,
      },
    };
    auraEvents.push(event);
    addRoundLog(roundLogs, `${sourceTeam.name}${unit.name}的光环生效：${formatStatusList(Object.keys(applied))}`);
  }
}

function getUnitInitiative(team, unit, round, battleRoundLimit = MAX_BATTLE_ROUNDS) {
  const rowProfile = team.rowProfiles.find((row) => row.row === unit.row);
  const rowAliveRatio = rowProfile?.maxHp > 0 ? rowProfile.hp / rowProfile.maxHp : 0;
  const moraleBonus = team.statuses.morale * 0.35;
  const confusePenalty = team.statuses.confused > 0 ? 0.18 : 0;
  const sealPenalty = team.statuses.skillSeal * 0.08;
  const baseSpeed = unit.speed ?? getUnitSpeed(unit, team.side);
  return round2(baseSpeed * (0.7 + rowAliveRatio * 0.3) * (1 + moraleBonus - confusePenalty - sealPenalty) + (unit.count ?? 0) * 0.12 + (battleRoundLimit - round) * 0.5 + Math.random() * 6);
}

function buildInitiativeTimeline(playerTeam, enemyTeam, round, battleRoundLimit = MAX_BATTLE_ROUNDS) {
  return [
    ...getBattleReadyUnits(playerTeam).map((unit) => ({ side: 'ally', unit, initiative: getUnitInitiative(playerTeam, unit, round, battleRoundLimit) })),
    ...getBattleReadyUnits(enemyTeam).map((unit) => ({ side: 'enemy', unit, initiative: getUnitInitiative(enemyTeam, unit, round, battleRoundLimit) })),
  ].sort((left, right) => right.initiative - left.initiative || (left.side === 'ally' ? -1 : 1));
}

function performUnitAttack(team, enemy, unit, roundLogs, options = {}) {
  const rowProfile = team.rowProfiles.find((row) => row.row === unit.row);
  if (!rowProfile || rowProfile.hp <= 0 || rowProfile.attackPower <= 0) {
    return { actionType: options.actionType ?? 'basic', outcome: { result: 'skipped' } };
  }

  const targetRow = options.targetRow ?? getPreferredTargetRowForSkill(unit, enemy);
  if (!targetRow) {
    return { actionType: options.actionType ?? 'basic', outcome: { result: 'no-target' } };
  }

  const share = rowProfile.attackPower > 0 ? Math.max(0.08, Math.min(unit.attackPower / rowProfile.attackPower, 0.72)) : 0.12;
  const attackValue = getRowAttackValue(rowProfile, team) * share;
  const defenseValue = getRowDefenseValue(targetRow, enemy);
  const sustainValue = getRowSustainValue(rowProfile, team) * share;
  const focusModifier = unit.tags?.includes('burst') ? 1.08 : unit.tags?.includes('defense') ? 0.94 : 1;
  const streakMultiplier = getKillStreakDamageMultiplier(team, unit);
  const rawDamage = Math.max(8, (attackValue - defenseValue * 0.18 + sustainValue * 0.03) * focusModifier * streakMultiplier * (options.damageMultiplier ?? 1));
  const outcome = resolveDamageAction({
    attackerTeam: team,
    defenderTeam: enemy,
    unit,
    targetRow,
    baseDamage: rawDamage,
    roundLogs,
    actionLabel: options.actionLabel ?? '\u53d1\u8d77\u653b\u51fb',
    reactionContext: {
      round: options.round,
      roundReactionEvents: options.roundReactionEvents ?? [],
      allowGuard: options.allowGuard !== false,
    },
  });
  return { actionType: options.actionType ?? 'basic', outcome };
}

function createBattlePreview(kind, summary, details = [], extra = {}) {
  return {
    kind,
    summary,
    details: details.filter(Boolean),
    ...extra,
  };
}

function estimateDamagePreview(unit, targetRow, defenderTeam, baseDamage) {
  const hitChance = getHitChance(unit, targetRow);
  const critProfile = getCritProfile(unit);
  const blockProfile = getBlockProfile(targetRow, defenderTeam);
  const effectiveBlockMitigation = clamp01(blockProfile.mitigation * (1 - clamp01(getBlockBreak(unit))));
  const expectedDamage = baseDamage
    * hitChance
    * (1 + critProfile.chance * (critProfile.multiplier - 1))
    * (1 - blockProfile.chance * effectiveBlockMitigation);

  return {
    estimatedDamage: Math.max(0, Math.round(expectedDamage)),
    rawDamage: Math.max(0, Math.round(baseDamage)),
    hitChance: round2(hitChance),
    critChance: round2(critProfile.chance),
    critMultiplier: round2(critProfile.multiplier),
    blockChance: round2(blockProfile.chance),
    effectiveBlockMitigation: round2(effectiveBlockMitigation),
  };
}

function estimateStatusApplyChance(unit, statusType, targetRow, defenderTeam) {
  return round2(clamp01(getStatusHitChance(unit, statusType, targetRow) * (1 - getStatusResistance(statusType, targetRow, defenderTeam))));
}

function buildDamagePreview(unit, targetRow, defenderTeam, baseDamage, label, detailLines = []) {
  const preview = estimateDamagePreview(unit, targetRow, defenderTeam, baseDamage);
  return createBattlePreview('damage', `${label} \u9884\u4f30\u4f24\u5bb3 ${preview.estimatedDamage}`, [
    `\u547d\u4e2d ${Math.round(preview.hitChance * 100)}%`,
    `\u66b4\u51fb ${Math.round(preview.critChance * 100)}% \u00b7 \u500d\u7387 ${preview.critMultiplier}x`,
    `\u683c\u6321 ${Math.round(preview.blockChance * 100)}% \u00b7 \u6709\u6548\u51cf\u4f24 ${Math.round(preview.effectiveBlockMitigation * 100)}%`,
    `\u539f\u59cb\u4f24\u5bb3 ${preview.rawDamage}`,
    ...detailLines,
  ], preview);
}

function buildAttackPreview(team, enemy, unit, targetRow) {
  const rowProfile = team.rowProfiles.find((row) => row.row === unit.row);
  if (!rowProfile || rowProfile.hp <= 0 || rowProfile.attackPower <= 0 || !targetRow) {
    return createBattlePreview('unavailable', '\u65e0\u6cd5\u8fdb\u653b', ['\u5f53\u524d\u6392\u6ca1\u6709\u53ef\u7528\u5175\u529b\u6216\u76ee\u6807\u5df2\u6e05\u7a7a\u3002']);
  }

  const share = rowProfile.attackPower > 0 ? Math.max(0.08, Math.min(unit.attackPower / rowProfile.attackPower, 0.72)) : 0.12;
  const attackValue = getRowAttackValue(rowProfile, team) * share;
  const defenseValue = getRowDefenseValue(targetRow, enemy);
  const sustainValue = getRowSustainValue(rowProfile, team) * share;
  const focusModifier = unit.tags?.includes('burst') ? 1.08 : unit.tags?.includes('defense') ? 0.94 : 1;
  const streakMultiplier = getKillStreakDamageMultiplier(team, unit);
  const rawDamage = Math.max(8, (attackValue - defenseValue * 0.18 + sustainValue * 0.03) * focusModifier * streakMultiplier);
  return buildDamagePreview(unit, targetRow, enemy, rawDamage, '\u666e\u653b');
}

function buildSkillPreview(team, enemy, unit, targetRow, round, nextAvailableRound) {
  if (!unit.skill) {
    return null;
  }

  if (round < nextAvailableRound) {
    return createBattlePreview('unavailable', `\u7b2c ${nextAvailableRound} \u56de\u5408\u53ef\u7528`, ['\u6280\u80fd\u51b7\u5374\u4e2d\u3002']);
  }

  const potency = getSkillPotency(team, unit, enemy);
  const streakMultiplier = getKillStreakDamageMultiplier(team, unit);
  switch (unit.skill.type) {
    case 'guard': {
      const amount = Math.round(team.maxHp * potency * 0.18);
      return createBattlePreview('support', `\u62a4\u76fe +${amount}`, [
        `\u4e3a\u6211\u65b9\u63d0\u4f9b\u62a4\u76fe\uff0c\u5148\u62b5\u6321\u4f24\u5bb3\u3002`,
        `\u4f20\u529f\u7cfb\u6570 ${round2(potency * 0.7)}`,
      ], { shield: amount });
    }
    case 'volley': {
      const damage = (unit.count * unit.power * 2.2) * potency * streakMultiplier;
      return buildDamagePreview(unit, targetRow, enemy, damage, unit.skill.name);
    }
    case 'execute': {
      const hpRatio = getTeamAliveRatio(enemy);
      const damage = (unit.count * unit.power * 2.4) * potency * (hpRatio < 0.6 ? 1.5 : 1) * streakMultiplier;
      return buildDamagePreview(unit, targetRow, enemy, damage, unit.skill.name, [
        hpRatio < 0.6 ? '\u654c\u65b9\u6b8b\u8840\uff1a\u6597\u5fd7\u9ad8\u6da8\uff0c\u4f24\u5bb3\u63d0\u5347\u3002' : '\u654c\u65b9\u8840\u91cf\u4ecd\u9ad8\uff1a\u4f24\u5bb3\u6b63\u5e38\u3002',
      ]);
    }
    case 'barrier': {
      const shield = Math.round(team.maxHp * potency * 0.08);
      const tenacity = round2(potency * 0.22);
      return createBattlePreview('support', `\u62a4\u76fe ${shield} \u00b7 \u97e7\u6027 +${tenacity}`, [
        `\u62a4\u76fe\u7cfb\u6570 ${round2(potency * 0.7)}`,
        `\u97e7\u6027\u63d0\u5347\u53ef\u964d\u4f4e\u88ab\u63a7\u5236\u7684\u6982\u7387\u3002`,
      ], { shield, tenacity });
    }
    case 'morale': {
      return createBattlePreview('support', `\u58eb\u6c14 +${round2(potency * 0.4)}`, [
        `\u58eb\u6c14\u7cfb\u6570 ${round2(potency * 0.75)}`,
        `\u58eb\u6c14\u4f1a\u63d0\u5347\u6574\u4f53\u6218\u6597\u72b6\u6001\u3002`,
      ]);
    }
    case 'poison': {
      const chance = estimateStatusApplyChance(unit, 'poison', targetRow, enemy);
      return createBattlePreview('status', `\u547d\u4e2d\u6982\u7387 ${Math.round(chance * 100)}%`, [
        `\u7cfb\u6570 ${round2(potency * 0.85)}`,
        `\u65bd\u52a0\u72b6\u6001\uff1a${getStatusLabel('poison')}`,
      ], { applyChance: chance, statusType: 'poison' });
    }
    case 'confuse': {
      const chance = estimateStatusApplyChance(unit, 'confuse', targetRow, enemy);
      return createBattlePreview('status', `\u547d\u4e2d\u6982\u7387 ${Math.round(chance * 100)}%`, [
        `\u7cfb\u6570 ${round2(potency * 0.55)}`,
        `\u65bd\u52a0\u72b6\u6001\uff1a${getStatusLabel('confuse')}`,
      ], { applyChance: chance, statusType: 'confuse' });
    }
    case 'berserk': {
      const missingRatio = 1 - getTeamAliveRatio(team);
      const attackBuff = round2(potency * (0.5 + missingRatio));
      return createBattlePreview('support', `\u653b\u52bf +${attackBuff}`, [
        `\u6211\u65b9\u6b8b\u8840\u8d8a\u591a\uff0c\u653b\u52bf\u589e\u76ca\u8d8a\u9ad8\u3002`,
      ], { attackBuff });
    }
    case 'reanimate': {
      const heal = Math.round(team.maxHp * potency * 0.12);
      return createBattlePreview('heal', `\u6cbb\u7597 ${heal}`, [
        `\u6301\u7eed 1 \u56de\u5408`,
      ], { heal });
    }
    case 'dive': {
      const damage = (unit.count * unit.power * 2.6) * potency * streakMultiplier;
      return buildDamagePreview(unit, targetRow, enemy, damage, unit.skill.name);
    }
    case 'firestorm': {
      const damage = (unit.count * unit.power * 2.1) * potency * streakMultiplier;
      const chance = estimateStatusApplyChance(unit, 'fire', targetRow, enemy);
      return buildDamagePreview(unit, targetRow, enemy, damage, unit.skill.name, [
        `\u9644\u5e26\u707c\u70e7 ${Math.round(chance * 100)}%`,
        `\u7cfb\u6570 ${round2(potency * 0.75)}`,
      ]);
    }
    case 'barkskin': {
      return createBattlePreview('support', `\u5b88\u52bf +${round2(potency * 0.8)} \u00b7 \u7eed\u822a +${round2(potency * 0.35)}`, [
        `\u7eed\u822a\u7cfb\u6570 ${round2(potency * 0.35)}`,
        `\u6301\u7eed 1 \u56de\u5408`,
      ]);
    }
    case 'heal': {
      const heal = Math.round(team.maxHp * potency * 0.14);
      return createBattlePreview('heal', `\u6cbb\u7597 ${heal}`, [
        `\u7cfb\u6570 ${round2(potency * 0.3)}`,
        `\u6301\u7eed 2 \u56de\u5408`,
      ], { heal });
    }
    case 'pierce': {
      const damage = (unit.count * unit.power * 2.25) * potency * streakMultiplier;
      const chance = estimateStatusApplyChance(unit, 'armorBreak', targetRow, enemy);
      return buildDamagePreview(unit, targetRow, enemy, damage, unit.skill.name, [
        `\u9644\u5e26\u7834\u7532 ${Math.round(chance * 100)}%`,
        `\u7cfb\u6570 ${round2(potency * 0.8)}`,
      ]);
    }
    case 'seal': {
      const chance = estimateStatusApplyChance(unit, 'skillSeal', targetRow, enemy);
      return createBattlePreview('status', `\u5c01\u6280\u6982\u7387 ${Math.round(chance * 100)}%`, [
        `\u7cfb\u6570 ${round2(potency * 0.65)}`,
        `\u6301\u7eed 2 \u56de\u5408`,
      ], { applyChance: chance, statusType: 'skillSeal' });
    }
    default:
      return createBattlePreview('utility', '\u7279\u6b8a\u6548\u679c', ['\u8be5\u6280\u80fd\u6ca1\u6709\u9884\u89c8\u4fe1\u606f\u3002']);
  }
}

function buildTargetActionPreviews(team, enemy, unit, targetRow, round, nextAvailableRound) {
  return {
    attack: buildAttackPreview(team, enemy, unit, targetRow),
    skill: buildSkillPreview(team, enemy, unit, targetRow, round, nextAvailableRound),
  };
}

function simulateBattle(playerTeam, enemyTeam) {
  const rounds = [];
  const battleRoundLimit = getBattleRoundLimit(playerTeam, enemyTeam);

  for (let round = 1; round <= battleRoundLimit; round += 1) {
    const roundLogs = [];
    const roundMechanics = [];
    const roundAuraEvents = [];
    const roundLifecycleEvents = [];
    const roundReactionEvents = [];
    const roundKillEvents = [];
    const initiativeOrder = [];
    ensureCombatStats(playerTeam, round);
    ensureCombatStats(enemyTeam, round);
    ensureReactionState(playerTeam, round);
    ensureReactionState(enemyTeam, round);
    ensureAuraState(playerTeam, round);
    ensureAuraState(enemyTeam, round);
    addRoundLog(roundLogs, `\u7b2c ${round} \u56de\u5408`);

    processEncounterMechanics(enemyTeam, playerTeam, round, roundLogs, roundMechanics);
    applyDotEffects(playerTeam, roundLogs);
    applyDotEffects(enemyTeam, roundLogs);
    resolveLifecycleSweep(playerTeam, enemyTeam, round, roundLogs, roundLifecycleEvents);
    applyRoundAuras(playerTeam, enemyTeam, round, roundLogs, roundAuraEvents);
    applyRoundAuras(enemyTeam, playerTeam, round, roundLogs, roundAuraEvents);
    if (playerTeam.hp <= 0 || enemyTeam.hp <= 0) {
      rounds.push({ round, logs: roundLogs, allyHp: Math.round(playerTeam.hp), enemyHp: Math.round(enemyTeam.hp), mechanicEvents: roundMechanics, auraEvents: roundAuraEvents, lifecycleEvents: roundLifecycleEvents, reactionEvents: roundReactionEvents, killEvents: roundKillEvents, initiativeOrder });
      break;
    }

    const timeline = buildInitiativeTimeline(playerTeam, enemyTeam, round, battleRoundLimit);
    for (const turn of timeline) {
      if (playerTeam.hp <= 0 || enemyTeam.hp <= 0) {
        break;
      }

      const actingTeam = turn.side === 'ally' ? playerTeam : enemyTeam;
      const targetTeam = turn.side === 'ally' ? enemyTeam : playerTeam;
      const rowProfile = actingTeam.rowProfiles.find((row) => row.row === turn.unit.row);
      if (!rowProfile || rowProfile.hp <= 0 || (turn.unit.count ?? 0) <= 0) {
        initiativeOrder.push({ unitId: turn.unit.id, name: turn.unit.name, side: turn.side, row: turn.unit.row, source: turn.unit.source ?? 'base', initiative: turn.initiative, actionType: 'skipped', outcome: { result: 'skipped', outcomeLabel: formatOutcomeLabel({ result: 'skipped' }) } });
        continue;
      }

      const skillAction = applySkill(actingTeam, targetTeam, turn.unit, round, roundLogs, roundReactionEvents);
      const actionRecord = skillAction ?? performUnitAttack(actingTeam, targetTeam, turn.unit, roundLogs, { round, roundReactionEvents });
      const lifecycleDelta = resolveLifecycleSweep(playerTeam, enemyTeam, round, roundLogs, roundLifecycleEvents);
      const defeatedEvents = turn.side === 'ally' ? lifecycleDelta.enemyEvents : lifecycleDelta.allyEvents;
      const killEvents = recordKillEvents({
        actingTeam,
        targetTeam,
        unit: turn.unit,
        round,
        roundLogs,
        actionType: actionRecord?.actionType ?? 'basic',
        lifecycleEvents: defeatedEvents,
        roundKillEvents,
      });
      const actionOutcome = {
        ...(actionRecord?.outcome ?? { result: 'unknown', outcomeLabel: formatOutcomeLabel({ result: 'unknown' }) }),
        reactionEvents: actionRecord?.outcome?.reactionEvents ?? [],
        killEvents,
        followUpTriggered: false,
        counterTriggered: false,
        streakCount: getUnitCombatStats(actingTeam, turn.unit)?.streak ?? 0,
        outcomeLabel: actionRecord?.outcome?.outcomeLabel ?? formatOutcomeLabel(actionRecord?.outcome ?? { result: 'unknown' }),
      };

      const actionEntry = {
        unitId: turn.unit.id,
        name: turn.unit.name,
        side: turn.side,
        row: turn.unit.row,
        source: turn.unit.source ?? 'base',
        initiative: turn.initiative,
        actionType: actionRecord?.actionType ?? 'basic',
        outcome: actionOutcome,
      };
      initiativeOrder.push(actionEntry);

      const counterEntry = tryTriggerCounterReaction({
        playerTeam,
        enemyTeam,
        actingTeam,
        targetTeam,
        actingUnit: turn.unit,
        turn,
        round,
        roundLogs,
        roundReactionEvents,
        roundLifecycleEvents,
        roundKillEvents,
        actionOutcome,
      });
      if (counterEntry) {
        actionEntry.outcome.counterTriggered = true;
        initiativeOrder.push(counterEntry);
      }

      const followUpEntry = tryTriggerFollowUp({
        playerTeam,
        enemyTeam,
        actingTeam,
        targetTeam,
        unit: turn.unit,
        turn,
        round,
        roundLogs,
        roundReactionEvents,
        roundLifecycleEvents,
        roundKillEvents,
        killEvents,
      });
      if (followUpEntry) {
        actionEntry.outcome.followUpTriggered = true;
        initiativeOrder.push(followUpEntry);
      }
    }

    rounds.push({
      round,
      logs: roundLogs,
      allyHp: Math.round(playerTeam.hp),
      enemyHp: Math.round(enemyTeam.hp),
      mechanicEvents: roundMechanics,
      auraEvents: roundAuraEvents,
      lifecycleEvents: roundLifecycleEvents,
      reactionEvents: roundReactionEvents,
      killEvents: roundKillEvents,
      initiativeOrder,
    });

    if (playerTeam.hp <= 0 || enemyTeam.hp <= 0) break;

    decayStatuses(playerTeam);
    decayStatuses(enemyTeam);
  }

  return rounds;
}



function createRoundRecord(roundState, playerTeam, enemyTeam) {
  return {
    round: roundState.round,
    logs: [...roundState.logs],
    allyHp: Math.round(playerTeam.hp),
    enemyHp: Math.round(enemyTeam.hp),
    mechanicEvents: [...roundState.mechanicEvents],
    auraEvents: [...roundState.auraEvents],
    lifecycleEvents: [...roundState.lifecycleEvents],
    reactionEvents: [...roundState.reactionEvents],
    killEvents: [...roundState.killEvents],
    initiativeOrder: [...roundState.initiativeOrder],
  };
}

function finalizeOpenRound(battle) {
  if (!battle.currentRound) {
    return;
  }

  battle.rounds.push(createRoundRecord(battle.currentRound, battle.playerTeam, battle.enemyTeam));
  battle.currentRound = null;
  battle.pendingAction = null;
  battle.round += 1;
}

function createCurrentBattle(stage, playerTeam, enemyTeam, options = {}) {
  const battlePacing = resolveBattlePacing(stage);
  const autoPreferences = options.autoPreferences ?? {};
  playerTeam.battlePacing = battlePacing;
  enemyTeam.battlePacing = battlePacing;
  return {
    stageId: stage.id,
    stageName: stage.name,
    stageWorld: stage.world,
    encounterType: stage.encounterType ?? 'normal',
    terrain: stage.terrain,
    enemyPower: stage.enemyPower,
    battlePacing,
    battleRoundLimit: getBattleRoundLimit(playerTeam, enemyTeam),
    playerTeam,
    enemyTeam,
    rounds: [],
    currentRound: null,
    pendingAction: null,
    round: 1,
    startedAt: Date.now(),
    battleMode: 'manual',
    autoMode: false,
    autoStrategy: autoPreferences.strategyId ?? 'skill-first',
    autoSpeed: autoPreferences.speedId ?? 'normal',
    retreated: false,
  };
}

function initializeCurrentRound(battle) {
  const roundState = {
    round: battle.round,
    logs: [],
    mechanicEvents: [],
    auraEvents: [],
    lifecycleEvents: [],
    reactionEvents: [],
    killEvents: [],
    initiativeOrder: [],
    timeline: [],
    turnIndex: 0,
  };

  ensureCombatStats(battle.playerTeam, battle.round);
  ensureCombatStats(battle.enemyTeam, battle.round);
  ensureReactionState(battle.playerTeam, battle.round);
  ensureReactionState(battle.enemyTeam, battle.round);
  ensureAuraState(battle.playerTeam, battle.round);
  ensureAuraState(battle.enemyTeam, battle.round);
  addRoundLog(roundState.logs, `\u7b2c ${battle.round} \u56de\u5408`);

  processEncounterMechanics(battle.enemyTeam, battle.playerTeam, battle.round, roundState.logs, roundState.mechanicEvents);
  applyDotEffects(battle.playerTeam, roundState.logs);
  applyDotEffects(battle.enemyTeam, roundState.logs);
  resolveLifecycleSweep(battle.playerTeam, battle.enemyTeam, battle.round, roundState.logs, roundState.lifecycleEvents);
  applyRoundAuras(battle.playerTeam, battle.enemyTeam, battle.round, roundState.logs, roundState.auraEvents);
  applyRoundAuras(battle.enemyTeam, battle.playerTeam, battle.round, roundState.logs, roundState.auraEvents);
  roundState.timeline = buildInitiativeTimeline(battle.playerTeam, battle.enemyTeam, battle.round, battle.battleRoundLimit);
  battle.currentRound = roundState;
}

function buildPendingBattleAction(battle, turn) {
  const currentRound = battle.currentRound;
  const nextAvailableRound = battle.playerTeam.cooldowns?.[turn.unit.id] ?? 1;
  const skillReady = !!turn.unit.skill && currentRound.round >= nextAvailableRound;
  const recommendedTarget = getPreferredTargetRowForSkill(turn.unit, battle.enemyTeam);
  const availableTargets = (battle.enemyTeam?.rowProfiles ?? [])
    .filter((rowProfile) => rowProfile.hp > 0)
    .map((rowProfile) => ({
      row: rowProfile.row,
      name: rowProfile.name,
      hp: Math.round(rowProfile.hp),
      maxHp: Math.round(rowProfile.maxHp),
      tags: [...(rowProfile.tags ?? [])],
      aliveUnits: rowProfile.units?.reduce((sum, unit) => sum + Math.max(unit.count ?? 0, 0), 0) ?? 0,
      previews: buildTargetActionPreviews(battle.playerTeam, battle.enemyTeam, turn.unit, rowProfile, currentRound.round, nextAvailableRound),
    }));
  return {
    unitId: turn.unit.id,
    name: turn.unit.name,
    row: turn.unit.row,
    initiative: turn.initiative,
    actionType: turn.unit.skill ? 'skill-or-attack' : 'attack-only',
    preferredTargetRow: recommendedTarget?.row ?? availableTargets[0]?.row ?? null,
    availableTargets,
    skill: turn.unit.skill ? {
      name: turn.unit.skill.name,
      type: turn.unit.skill.type,
      ready: skillReady,
      availableFromRound: nextAvailableRound,
      cooldown: turn.unit.skill.cooldown ?? 0,
    } : null,
  };
}

function resolveBattleCommand(command) {
  if (typeof command === 'string') {
    return { type: command, targetRow: null };
  }

  return {
    type: command?.type ?? command?.command ?? 'attack',
    targetRow: Number.isFinite(Number(command?.targetRow)) ? Number(command.targetRow) : null,
  };
}

function getCommandTargetRow(targetTeam, targetRow) {
  if (!Number.isFinite(targetRow)) {
    return null;
  }

  return targetTeam.rowProfiles.find((rowProfile) => rowProfile.row === targetRow && rowProfile.hp > 0) ?? null;
}

function executeBattleTurnAction(battle, turn, mode = 'auto', options = {}) {
  const currentRound = battle.currentRound;
  const actingTeam = turn.side === 'ally' ? battle.playerTeam : battle.enemyTeam;
  const targetTeam = turn.side === 'ally' ? battle.enemyTeam : battle.playerTeam;
  const manualTargetRow = getCommandTargetRow(targetTeam, options.targetRow);
  const rowProfile = actingTeam.rowProfiles.find((row) => row.row === turn.unit.row);

  if (!rowProfile || rowProfile.hp <= 0 || (turn.unit.count ?? 0) <= 0) {
    currentRound.initiativeOrder.push({
      unitId: turn.unit.id,
      name: turn.unit.name,
      side: turn.side,
      row: turn.unit.row,
      source: turn.unit.source ?? 'base',
      initiative: turn.initiative,
      actionType: 'skipped',
      outcome: { result: 'skipped', outcomeLabel: formatOutcomeLabel({ result: 'skipped' }) },
    });
    currentRound.turnIndex += 1;
    return { executed: true, skipped: true };
  }

  let actionRecord = null;
  if (mode === 'skill') {
    actionRecord = applySkill(actingTeam, targetTeam, turn.unit, currentRound.round, currentRound.logs, currentRound.reactionEvents, {
      targetRow: manualTargetRow,
    });
    if (!actionRecord) {
      return { executed: false, reason: 'skill-unavailable' };
    }
  } else if (mode === 'basic') {
    actionRecord = performUnitAttack(actingTeam, targetTeam, turn.unit, currentRound.logs, {
      round: currentRound.round,
      roundReactionEvents: currentRound.reactionEvents,
      targetRow: manualTargetRow,
    });
  } else {
    const skillAction = applySkill(actingTeam, targetTeam, turn.unit, currentRound.round, currentRound.logs, currentRound.reactionEvents, {
      targetRow: manualTargetRow,
    });
    actionRecord = skillAction ?? performUnitAttack(actingTeam, targetTeam, turn.unit, currentRound.logs, {
      round: currentRound.round,
      roundReactionEvents: currentRound.reactionEvents,
      targetRow: manualTargetRow,
    });
  }

  const lifecycleDelta = resolveLifecycleSweep(battle.playerTeam, battle.enemyTeam, currentRound.round, currentRound.logs, currentRound.lifecycleEvents);
  const defeatedEvents = turn.side === 'ally' ? lifecycleDelta.enemyEvents : lifecycleDelta.allyEvents;
  const killEvents = recordKillEvents({
    actingTeam,
    targetTeam,
    unit: turn.unit,
    round: currentRound.round,
    roundLogs: currentRound.logs,
    actionType: actionRecord?.actionType ?? 'basic',
    lifecycleEvents: defeatedEvents,
    roundKillEvents: currentRound.killEvents,
  });
  const actionOutcome = {
    ...(actionRecord?.outcome ?? { result: 'unknown', outcomeLabel: formatOutcomeLabel({ result: 'unknown' }) }),
    reactionEvents: actionRecord?.outcome?.reactionEvents ?? [],
    killEvents,
    followUpTriggered: false,
    counterTriggered: false,
    streakCount: getUnitCombatStats(actingTeam, turn.unit)?.streak ?? 0,
    outcomeLabel: actionRecord?.outcome?.outcomeLabel ?? formatOutcomeLabel(actionRecord?.outcome ?? { result: 'unknown' }),
  };

  const actionEntry = {
    unitId: turn.unit.id,
    name: turn.unit.name,
    side: turn.side,
    row: turn.unit.row,
    targetRow: manualTargetRow?.row ?? actionRecord?.outcome?.targetRow?.row ?? null,
    source: turn.unit.source ?? 'base',
    initiative: turn.initiative,
    actionType: actionRecord?.actionType ?? 'basic',
    outcome: actionOutcome,
  };
  currentRound.initiativeOrder.push(actionEntry);

  const counterEntry = tryTriggerCounterReaction({
    playerTeam: battle.playerTeam,
    enemyTeam: battle.enemyTeam,
    actingTeam,
    targetTeam,
    actingUnit: turn.unit,
    turn,
    round: currentRound.round,
    roundLogs: currentRound.logs,
    roundReactionEvents: currentRound.reactionEvents,
    roundLifecycleEvents: currentRound.lifecycleEvents,
    roundKillEvents: currentRound.killEvents,
    actionOutcome,
  });
  if (counterEntry) {
    actionEntry.outcome.counterTriggered = true;
    currentRound.initiativeOrder.push(counterEntry);
  }

  const followUpEntry = tryTriggerFollowUp({
    playerTeam: battle.playerTeam,
    enemyTeam: battle.enemyTeam,
    actingTeam,
    targetTeam,
    unit: turn.unit,
    turn,
    round: currentRound.round,
    roundLogs: currentRound.logs,
    roundReactionEvents: currentRound.reactionEvents,
    roundLifecycleEvents: currentRound.lifecycleEvents,
    roundKillEvents: currentRound.killEvents,
    killEvents,
  });
  if (followUpEntry) {
    actionEntry.outcome.followUpTriggered = true;
    currentRound.initiativeOrder.push(followUpEntry);
  }

  currentRound.turnIndex += 1;
  return { executed: true, actionEntry };
}

function isBattleResolved(battle) {
  return battle.retreated || battle.playerTeam.hp <= 0 || battle.enemyTeam.hp <= 0 || battle.round > battle.battleRoundLimit;
}

function progressCurrentBattle(battle) {
  while (!isBattleResolved(battle)) {
    if (!battle.currentRound) {
      initializeCurrentRound(battle);
      if (battle.playerTeam.hp <= 0 || battle.enemyTeam.hp <= 0) {
        finalizeOpenRound(battle);
        break;
      }
    }

    const currentRound = battle.currentRound;
    if (!currentRound) {
      continue;
    }

    if (currentRound.turnIndex >= currentRound.timeline.length) {
      finalizeOpenRound(battle);
      continue;
    }

    const turn = currentRound.timeline[currentRound.turnIndex];
    if (turn.side === 'ally') {
      battle.pendingAction = buildPendingBattleAction(battle, turn);
      return 'awaiting-action';
    }

    executeBattleTurnAction(battle, turn, 'auto');
  }

  battle.pendingAction = null;
  return 'resolved';
}

function collectBattleRounds(battle) {
  const rounds = [...(battle.rounds ?? [])];
  if (battle.currentRound) {
    rounds.push(createRoundRecord(battle.currentRound, battle.playerTeam, battle.enemyTeam));
  }
  return rounds;
}

function sanitizeBattleLogLine(line) {
  if (!line) return line;
  const text = String(line);
  const roundMatch = text.match(/^\?\s*(\d+)\s*\?\?$/);
  if (roundMatch) {
    return `\u7b2c ${roundMatch[1]} \u56de\u5408`;
  }

  const resultMap = {
    hit: '\u547d\u4e2d',
    miss: '\u95ea\u907f',
    block: '\u683c\u6321',
    crit: '\u66b4\u51fb',
    'crit-block': '\u66b4\u51fb\u88ab\u6321',
  };

  return text.replace(/(\u7ed3\u679c|结果)\s+(hit|miss|block|crit|crit-block)\b/g, (full, prefix, key) => `${prefix} ${resultMap[key] ?? key}`);
}

function buildLiveBattleSnapshot(battle) {
  if (!battle?.currentRound?.timeline?.length) {
    return battle;
  }

  const turnIndex = battle.currentRound.turnIndex ?? 0;
  const turn = battle.currentRound.timeline[turnIndex] ?? null;
  if (!turn || turn.side !== 'ally') {
    return {
      ...battle,
      currentRound: battle.currentRound
        ? { ...battle.currentRound, logs: (battle.currentRound.logs ?? []).map(sanitizeBattleLogLine) }
        : battle.currentRound,
      pendingAction: null,
    };
  }

  return {
    ...battle,
    currentRound: battle.currentRound
      ? { ...battle.currentRound, logs: (battle.currentRound.logs ?? []).map(sanitizeBattleLogLine) }
      : battle.currentRound,
    pendingAction: buildPendingBattleAction(battle, turn),
  };
}

function resolveBattleReport(draft, registries, stage, playerTeam, enemyTeam, rounds, options = {}) {
  const retreated = !!options.retreated;
  const allyLostRatio = clamp01(1 - (playerTeam.hp / Math.max(playerTeam.maxHp, 1)));
  const enemyLostRatio = clamp01(1 - (enemyTeam.hp / Math.max(enemyTeam.maxHp, 1)));
  const victory = !retreated && (enemyTeam.hp <= 0 || enemyLostRatio > allyLostRatio);
  const casualtyRatio = retreated
    ? Math.min(0.35, Math.max(0.08, allyLostRatio * 0.45 + 0.08))
    : victory
      ? allyLostRatio * 0.85
      : Math.min(0.62, allyLostRatio + 0.1);

  applyUnitCasualties(draft, registries, casualtyRatio);

      const rewardProfile = getRewardProfile(stage);
      const warehouseEffects = getWarehouseEffects(draft);
      const rewardBreakdown = {
        tier: rewardProfile.tier,
        baseReward: {},
    guaranteedLoot: {},
    firstClearBonus: {},
    randomLoot: {},
    bonusLoot: {},
    lootRolls: [],
  };
  const reward = {};
  const { all, expeditionBondSnapshot } = collectUnlockedEffects(draft, registries);
  const expeditionBondEffects = expeditionBondSnapshot?.activeBonds?.flatMap((bond) => bond.effects ?? []) ?? [];

      if (victory) {
        const lootBonus = 1 + sumEffects(all, 'battleLoot');
        const alreadyCleared = draft.war.clearedStages.includes(stage.id);
        const linkedReward = buildLinkedBattleRewards(draft, stage, expeditionBondSnapshot, { alreadyCleared });
        const resolvedRewards = resolveStageRewards(stage, lootBonus, alreadyCleared, warehouseEffects, linkedReward);
        addResourceMap(reward, resolvedRewards.totalReward);
        Object.assign(rewardBreakdown, resolvedRewards.breakdown);
        grantResources(draft, reward);

    if (!alreadyCleared) {
      draft.war.clearedStages.push(stage.id);
    }

    draft.war.currentStageId = getNextStageId(registries, stage.id);
  }

  const report = {
    id: `battle-${Date.now()}`,
    stageId: stage.id,
    stageName: stage.name,
    victory,
    retreated,
    battleMode: options.battleMode ?? 'auto',
    combinedPower: Math.round(playerTeam.rowProfiles.reduce((sum, row) => sum + row.attackPower + row.defensePower * 0.2, 0)),
    enemyPower: Math.round(enemyTeam.rowProfiles.reduce((sum, row) => sum + row.attackPower + row.defensePower * 0.2, 0)),
    casualtyRatio,
    reward,
    rewardBreakdown,
    rewardTier: rewardBreakdown.tier,
    strategyScore: round2(playerTeam.rowProfiles.reduce((sum, row) => sum + row.attackPower * 0.001, 0) - enemyTeam.rowProfiles.reduce((sum, row) => sum + row.attackPower * 0.0008, 0)),
    enemyTags: stage.enemyTags ?? [],
    encounterType: stage.encounterType ?? 'normal',
    mechanics: stage.mechanics ?? [],
    enemyFormation: getEnemyPreview(stage),
    battlePacing: resolveBattlePacing(stage),
    expeditionSupport: {
      memberNames: expeditionBondSnapshot?.members?.map((member) => member.name) ?? [],
      bondNames: expeditionBondSnapshot?.activeBonds?.map((bond) => bond.name) ?? [],
      bondCount: expeditionBondSnapshot?.activeBonds?.length ?? 0,
      uniqueFactionCount: expeditionBondSnapshot?.uniqueFactionCount ?? 0,
      totalResonance: expeditionBondSnapshot?.totalResonance ?? 0,
      bondEffects: expeditionBondEffects,
    },
    rounds,
    triggeredMechanicIds: [...new Set(rounds.flatMap((round) => (round.mechanicEvents ?? []).map((event) => event.id)))],
    createdAt: Date.now(),
  };

  draft.war.currentBattle = null;
  draft.war.battleReports.unshift(report);
  draft.war.battleReports = draft.war.battleReports.slice(0, 20);
  appendLog(
    draft,
    'war',
    retreated
      ? `\u64a4\u9000\uff1a${stage.name}`
      : `${victory ? '\u80dc\u5229' : '\u5931\u8d25'}\uff1a${stage.name}`
  );
  return report;
}

function applyUnitCasualties(state, registries, casualtyRatio) {
  for (const unit of getAvailableUnits(state, registries)) {
    const current = state.war.trainedUnits[unit.id] ?? 0;
    if (current <= 0) continue;
    const lost = Math.min(current, Math.floor(current * casualtyRatio));
    state.war.trainedUnits[unit.id] = current - lost;
  }
}

function getEnemyPreview(stage) {
  return ROW_ORDER.map((row) => stage.enemyFormation?.find((item) => item.row === row) ?? { row, name: '\u7a7a\u4f4d', tags: [], countRatio: 0 });
}


function getTeamMechanicState(team) {
  team.mechanicState ??= {};
  return team.mechanicState;
}

function processEncounterMechanics(enemyTeam, playerTeam, round, roundLogs, roundMechanics) {
  const mechanics = enemyTeam.mechanics ?? [];
  const state = getTeamMechanicState(enemyTeam);

  for (const mechanic of mechanics) {
    if (state[mechanic.id]) {
      continue;
    }

    if (mechanic.type === 'opening-shield' && round === 1) {
      enemyTeam.statuses.shield += enemyTeam.maxHp * mechanic.value;
      state[mechanic.id] = true;
      addRoundLog(roundLogs, `[mechanic:${mechanic.id}] ${mechanic.text}`);
      roundMechanics.push({ id: mechanic.id, type: mechanic.type, text: mechanic.text, round });
      continue;
    }

    if (mechanic.type === 'round-enrage' && round >= (mechanic.triggerRound ?? 99)) {
      enemyTeam.statuses.attackBuff += mechanic.value;
      enemyTeam.statuses.morale += mechanic.value * 0.5;
      state[mechanic.id] = true;
      addRoundLog(roundLogs, `[mechanic:${mechanic.id}] ${mechanic.text}`);
      roundMechanics.push({ id: mechanic.id, type: mechanic.type, text: mechanic.text, round });
      continue;
    }

    if (mechanic.type === 'round-firestorm' && round >= (mechanic.triggerRound ?? 99)) {
      playerTeam.statuses.fire += mechanic.value * 2;
      state[mechanic.id] = true;
      addRoundLog(roundLogs, `[mechanic:${mechanic.id}] ${mechanic.text}`);
      roundMechanics.push({ id: mechanic.id, type: mechanic.type, text: mechanic.text, round });
      continue;
    }

    if (mechanic.type === 'hp-enrage' && getTeamAliveRatio(enemyTeam) <= (mechanic.threshold ?? 0)) {
      enemyTeam.statuses.attackBuff += mechanic.value;
      enemyTeam.statuses.defenseBuff += mechanic.value * 0.4;
      state[mechanic.id] = true;
      addRoundLog(roundLogs, `[mechanic:${mechanic.id}] ${mechanic.text}`);
      roundMechanics.push({ id: mechanic.id, type: mechanic.type, text: mechanic.text, round });
      continue;
    }

    if (mechanic.type === 'summon-row' && round >= (mechanic.triggerRound ?? 99)) {
      const summonUnit = summonEnemyUnit(enemyTeam, mechanic);
      if (summonUnit) {
        state[mechanic.id] = true;
        addRoundLog(roundLogs, `[mechanic:${mechanic.id}] ${mechanic.text} (${summonUnit.name} x${summonUnit.count})`);
        roundMechanics.push({
          id: mechanic.id,
          type: mechanic.type,
          text: mechanic.text,
          round,
          payload: {
            row: summonUnit.row,
            unitId: summonUnit.id,
            name: summonUnit.name,
            count: summonUnit.count,
            tags: summonUnit.tags,
            source: summonUnit.source,
          },
        });
      }
    }
  }
}

export function createWarSystem() {
  return {
    id: 'war-system',
    setup({ store, bus, registries }) {
      bus.on('action:war/trainUnit', ({ unitId, amount }) => {
        trainUnit({ store, registries }, unitId, amount);
      });

      bus.on('action:war/setFormation', ({ formationId }) => {
        setFormation({ store, registries }, formationId);
      });

      bus.on('action:war/setUnitRow', ({ unitId, row }) => {
        setUnitRow({ store, registries }, unitId, row);
      });

      bus.on('action:war/autoArrange', () => {
        autoArrangeFormation({ store, registries });
      });

      bus.on('action:war/challengeStage', ({ stageId }) => {
        challengeStage({ store, registries }, stageId);
      });

      bus.on('action:war/startBattle', ({ stageId }) => {
        startBattle({ store, registries }, stageId);
      });

      bus.on('action:war/commandBattle', ({ command }) => {
        commandBattle({ store, registries }, command);
      });

      bus.on('action:war/setBattleAutoMode', ({ enabled }) => {
        setBattleAutoMode({ store }, enabled);
      });

      bus.on('action:war/setBattleAutoStrategy', ({ strategyId }) => {
        setBattleAutoStrategy({ store }, strategyId);
      });

      bus.on('action:war/setBattleAutoSpeed', ({ speedId }) => {
        setBattleAutoSpeed({ store }, speedId);
      });

      bus.on('action:war/setCurrentStage', ({ stageId }) => {
        setCurrentStage({ store, registries }, stageId);
      });

      bus.on('action:war/applyRecommendedTactic', () => {
        applyRecommendedTactic({ store, registries });
      });
    },
  };
}

export function trainUnit({ store, registries }, unitId, amount = 1) {
  let success = false;

  store.update((draft) => {
    const unit = registries.units.get(unitId);
    const safeAmount = Math.max(1, amount);
    if (!unit || !canUseUnit(draft, unit) || !canAfford(draft, unit.trainingCost, safeAmount)) {
      return;
    }

    payCost(draft, unit.trainingCost, safeAmount);
    draft.war.trainedUnits[unitId] = (draft.war.trainedUnits[unitId] ?? 0) + safeAmount;
    appendLog(draft, 'war', `训练 ${unit.name} ×${safeAmount}`);
    success = true;
  }, { type: 'war/train-unit', unitId, amount });

  return success;
}

export function setFormation({ store, registries }, formationId) {
  let success = false;

  store.update((draft) => {
    const formation = getFormation(registries, formationId);
    if (!formation) {
      return;
    }

    draft.war.formationId = formationId;
    appendLog(draft, 'war', `切换战阵：${formation.name}`);
    success = true;
  }, { type: 'war/set-formation', formationId });

  return success;
}

export function setUnitRow({ store, registries }, unitId, row) {
  let success = false;

  store.update((draft) => {
    const unit = registries.units.get(unitId);
    const safeRow = Math.min(Math.max(Number(row), 1), 6);
    if (!unit || !canUseUnit(draft, unit)) {
      return;
    }

    ensureFormationRows(draft, registries);
    draft.war.formationRows[unitId] = safeRow;
    appendLog(draft, 'war', `${unit.name} 调整至第 ${safeRow} 排`);
    success = true;
  }, { type: 'war/set-unit-row', unitId, row });

  return success;
}

export function autoArrangeFormation({ store, registries }) {
  let success = false;

  store.update((draft) => {
    const availableUnits = getAvailableUnits(draft, registries);
    if (availableUnits.length === 0) {
      appendLog(draft, 'war', '当前没有可布阵兵种，请先参悟兵道初识。');
      return;
    }

    ensureFormationRows(draft, registries);
    for (const unit of availableUnits) {
      draft.war.formationRows[unit.id] = getDefaultRow(unit);
    }
    appendLog(draft, 'war', '已按默认站位完成自动布阵。');
    success = true;
  }, { type: 'war/auto-arrange' });

  return success;
}

export function setCurrentStage({ store, registries }, stageId) {
  let success = false;

  store.update((draft) => {
    const stage = registries.stages.get(stageId);
    if (!stage) {
      return;
    }

    draft.war.currentStageId = stageId;
    appendLog(draft, 'war', `已切换当前关卡：${stage.name}`);
    success = true;
  }, { type: 'war/set-current-stage', stageId });

  return success;
}

export function applyRecommendedTactic({ store, registries }) {
  let success = false;

  store.update((draft) => {
    ensureFormationRows(draft, registries);
    const snapshot = getWarSnapshot(draft, registries);
    const recommendation = snapshot.tacticalRecommendation;
    if (!recommendation?.formation) {
      return;
    }

    const missingResources = {};
    draft.war.formationId = recommendation.formation.id;
    for (const item of recommendation.squad ?? []) {
      const unit = registries.units.get(item.unitId);
      if (!unit || !canUseUnit(draft, unit)) {
        continue;
      }
      const currentCount = draft.war.trainedUnits?.[item.unitId] ?? 0;
      const missingCount = Math.max((item.targetCount ?? currentCount) - currentCount, 0);
      const recruitAmount = Math.min(getAffordableTrainAmount(draft, unit, missingCount), 12);
      if (recruitAmount > 0) {
        payCost(draft, unit.trainingCost, recruitAmount);
        draft.war.trainedUnits[item.unitId] = currentCount + recruitAmount;
      }
      const shortageCost = buildMissingCost(unit.trainingCost, recruitAmount, missingCount);
      addResourceMap(missingResources, shortageCost);
      if ((draft.war.trainedUnits?.[item.unitId] ?? 0) <= 0) {
        continue;
      }
      draft.war.formationRows[item.unitId] = item.preferredRow ?? getDefaultRow(unit);
    }
    const suggestedRewardFocus = Object.keys(missingResources)
      .sort((left, right) => (missingResources[right] ?? 0) - (missingResources[left] ?? 0))
      .slice(0, 3);
    draft.war.lastRecommendedPrep = {
      formationId: recommendation.formation.id,
      missingResources,
      suggestedRewardFocus,
      updatedAt: Date.now(),
    };
    appendLog(draft, 'war', `已套用推荐战备：${recommendation.formation.name}`);
    success = true;
  }, { type: 'war/apply-recommended-tactic' });

  return success;
}

export function challengeStage({ store, registries }, stageId) {
  let report = null;

  store.update((draft) => {
    const stage = registries.stages.get(stageId);
    if (!stage || !isStageUnlocked(draft, stage)) {
      appendLog(draft, 'war', '\u5173\u5361\u672a\u89e3\u9501\uff0c\u65e0\u6cd5\u6311\u6218\u3002');
      return;
    }

    const playerTeam = buildPlayerTeam(draft, registries, stage);
    if (playerTeam.totalUnits <= 0) {
      appendLog(draft, 'war', '\u65e0\u53ef\u7528\u5175\u79cd\uff0c\u8bf7\u5148\u62db\u52df\u5175\u79cd\u3002');
      return;
    }

    const enemyTeam = buildEnemyTeam(stage);
    const rounds = simulateBattle(playerTeam, enemyTeam);
    report = resolveBattleReport(draft, registries, stage, playerTeam, enemyTeam, rounds, { battleMode: 'auto' });
  }, { type: 'war/challenge-stage', stageId });

  return report;
}


export function startBattle({ store, registries }, stageId) {
  let started = false;
  let report = null;

  store.update((draft) => {
    if (draft.war.currentBattle) {
      appendLog(draft, 'war', '\u5df2\u6709\u8fdb\u884c\u4e2d\u7684\u6218\u6597\uff0c\u8bf7\u5148\u64a4\u9000\u6216\u7b49\u5f85\u7ed3\u675f\u3002');
      return;
    }

    const stage = registries.stages.get(stageId);
    if (!stage || !isStageUnlocked(draft, stage)) {
      appendLog(draft, 'war', '\u5173\u5361\u672a\u89e3\u9501\uff0c\u65e0\u6cd5\u53d1\u8d77\u6218\u6597\u3002');
      return;
    }

    const playerTeam = buildPlayerTeam(draft, registries, stage);
    if (playerTeam.totalUnits <= 0) {
      appendLog(draft, 'war', '\u65e0\u53ef\u7528\u5175\u79cd\uff0c\u8bf7\u5148\u62db\u52df\u5175\u79cd\u3002');
      return;
    }

    const enemyTeam = buildEnemyTeam(stage);
    draft.war.currentBattle = createCurrentBattle(stage, playerTeam, enemyTeam, {
      autoPreferences: draft.war.autoPreferences,
    });
    appendLog(draft, 'war', `\u5f00\u59cb\u6218\u6597\uff1a${stage.name}`);
    const progressState = progressCurrentBattle(draft.war.currentBattle);
    if (progressState === 'resolved') {
      report = resolveBattleReport(draft, registries, stage, playerTeam, enemyTeam, collectBattleRounds(draft.war.currentBattle), { battleMode: 'manual' });
    }
    started = true;
  }, { type: 'war/start-battle', stageId });

  return { started, report };
}

export function setBattleAutoMode({ store }, enabled) {
  let success = false;

  store.update((draft) => {
    if (!draft.war.currentBattle) {
      appendLog(draft, 'war', '\u5f53\u524d\u6ca1\u6709\u8fdb\u884c\u4e2d\u7684\u6218\u6597\u3002');
      return;
    }

    draft.war.currentBattle.autoMode = !!enabled;
    appendLog(draft, 'war', enabled ? '\u5df2\u5f00\u542f\u81ea\u52a8\u6218\u6597\u3002' : '\u5df2\u5173\u95ed\u81ea\u52a8\u6218\u6597\u3002');
    success = true;
  }, { type: 'war/set-battle-auto-mode', enabled: !!enabled });

  return success;
}

export function setBattleAutoStrategy({ store }, strategyId) {
  const allowedStrategies = ['skill-first', 'save-skill', 'focus-backline', 'focus-lowest-hp'];
  const normalizedStrategy = allowedStrategies.includes(strategyId) ? strategyId : 'skill-first';
  let success = false;

  store.update((draft) => {
    draft.war.autoPreferences ??= { strategyId: 'skill-first', speedId: 'normal' };
    draft.war.autoPreferences.strategyId = normalizedStrategy;

    if (draft.war.currentBattle) {
      draft.war.currentBattle.autoStrategy = normalizedStrategy;
      appendLog(draft, 'war', `\u5df2\u5207\u6362\u81ea\u52a8\u6218\u6597\u7b56\u7565\uff1a${normalizedStrategy}`);
    } else {
      appendLog(draft, 'war', `\u5df2\u4fdd\u5b58\u9ed8\u8ba4\u81ea\u52a8\u6218\u6597\u7b56\u7565\uff1a${normalizedStrategy}`);
    }
    success = true;
  }, { type: 'war/set-battle-auto-strategy', strategyId: normalizedStrategy });

  return success;
}

export function setBattleAutoSpeed({ store }, speedId) {
  const allowedSpeeds = ['slow', 'normal', 'fast'];
  const normalizedSpeed = allowedSpeeds.includes(speedId) ? speedId : 'normal';
  let success = false;

  store.update((draft) => {
    draft.war.autoPreferences ??= { strategyId: 'skill-first', speedId: 'normal' };
    draft.war.autoPreferences.speedId = normalizedSpeed;

    if (draft.war.currentBattle) {
      draft.war.currentBattle.autoSpeed = normalizedSpeed;
      appendLog(draft, 'war', `\u5df2\u5207\u6362\u81ea\u52a8\u6218\u6597\u901f\u5ea6\uff1a${normalizedSpeed}`);
    } else {
      appendLog(draft, 'war', `\u5df2\u4fdd\u5b58\u9ed8\u8ba4\u81ea\u52a8\u6218\u6597\u901f\u5ea6\uff1a${normalizedSpeed}`);
    }
    success = true;
  }, { type: 'war/set-battle-auto-speed', speedId: normalizedSpeed });

  return success;
}

export function commandBattle({ store, registries }, command) {
  let result = { executed: false, report: null };

  store.update((draft) => {
    const battle = draft.war.currentBattle;
    if (!battle) {
      appendLog(draft, 'war', '\u5f53\u524d\u6ca1\u6709\u8fdb\u884c\u4e2d\u7684\u6218\u6597\u3002');
      return;
    }

    const stage = registries.stages.get(battle.stageId);
    if (!stage) {
      draft.war.currentBattle = null;
      appendLog(draft, 'war', '\u5173\u5361\u6570\u636e\u7f3a\u5931\uff0c\u6218\u6597\u5df2\u7ed3\u675f\u3002');
      return;
    }

    const normalizedCommand = resolveBattleCommand(command);
    if (normalizedCommand.type === 'retreat') {
      battle.retreated = true;
      result.executed = true;
      result.report = resolveBattleReport(draft, registries, stage, battle.playerTeam, battle.enemyTeam, collectBattleRounds(battle), {
        battleMode: 'manual',
        retreated: true,
      });
      return;
    }

    const turn = battle.currentRound?.timeline?.[battle.currentRound?.turnIndex ?? -1] ?? null;
    if (!turn || turn.side !== 'ally') {
      appendLog(draft, 'war', '\u5f53\u524d\u4e0d\u662f\u6211\u65b9\u51fa\u624b\u3002');
      return;
    }

    const mode = normalizedCommand.type === 'skill' ? 'skill' : 'basic';
    const execution = executeBattleTurnAction(battle, turn, mode, { targetRow: normalizedCommand.targetRow });
    if (!execution.executed) {
      appendLog(draft, 'war', normalizedCommand.type === 'skill' ? '\u6280\u80fd\u65e0\u6cd5\u4f7f\u7528\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002' : '\u666e\u653b\u6267\u884c\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002');
      return;
    }

    result.executed = true;
    const progressState = progressCurrentBattle(battle);
    if (progressState === 'resolved') {
      result.report = resolveBattleReport(draft, registries, stage, battle.playerTeam, battle.enemyTeam, collectBattleRounds(battle), { battleMode: 'manual' });
    }
  }, { type: 'war/command-battle', command });

  return result;
}

export function getWarSnapshot(state, registries) {
  const formation = getFormation(registries, state.war.formationId);
  const warehouseEffects = getWarehouseEffects(state);
  const { expeditionBondSnapshot } = collectUnlockedEffects(state, registries);
  ensureFormationRows(state, registries);

  const stageSnapshots = registries.stages.list().map((stage) => {
    const cleared = state.war.clearedStages.includes(stage.id);
    const linkedReward = buildLinkedBattleRewards(state, stage, expeditionBondSnapshot, { alreadyCleared: cleared });
    return {
      ...stage,
      unlocked: isStageUnlocked(state, stage),
      lockReasons: getStageLockReasons(state, registries, stage),
      cleared,
      current: state.war.currentStageId === stage.id,
      enemyPreview: getEnemyPreview(stage),
      encounterType: stage.encounterType ?? 'normal',
      mechanics: stage.mechanics ?? [],
      rewardProfile: getRewardProfile(stage),
      rewardPreview: buildRewardPreview(stage, cleared, warehouseEffects, linkedReward),
    };
  });

  const currentStage = stageSnapshots.find((stage) => stage.current) ?? stageSnapshots[0] ?? null;
  const army = calculateArmyPower(state, registries, currentStage);
  const activeBattle = state.war.currentBattle ? buildLiveBattleSnapshot(state.war.currentBattle) : null;
  const stageEnemyTags = currentStage?.enemyTags ?? [];
  const units = getAvailableUnits(state, registries).map((unit) => {
    const counterProfile = getCounterScore(unit, stageEnemyTags);
    return {
      ...unit,
      count: state.war.trainedUnits[unit.id] ?? 0,
      row: getUnitRow(state, registries, unit),
      counterProfile,
      counterModifier: getCounterModifier(unit, stageEnemyTags),
    };
  });
  const counterAdvice = [...units]
    .filter((unit) => unit.count > 0 || unit.counterProfile.counterHits.length > 0)
    .sort((left, right) => (right.counterProfile.score - left.counterProfile.score) || ((right.count ?? 0) - (left.count ?? 0)))
    .slice(0, 3)
    .map((unit) => ({
      unitId: unit.id,
      unitName: unit.name,
      score: unit.counterProfile.score,
      counterHits: unit.counterProfile.counterHits,
      weakHits: unit.counterProfile.weakHits,
      count: unit.count,
    }));
  const tacticalRecommendation = buildTacticalRecommendation(state, registries, currentStage, units);

  return {
    units,
    stages: stageSnapshots,
    formation,
    rowSummary: buildRowSummary(state, registries),
    enemyPreview: currentStage ? getEnemyPreview(currentStage) : [],
    currentStage,
    army,
    autoPreferences: {
      strategyId: state.war.autoPreferences?.strategyId ?? 'skill-first',
      speedId: state.war.autoPreferences?.speedId ?? 'normal',
    },
    counterAdvice,
    tacticalRecommendation,
    lastRecommendedPrep: state.war.lastRecommendedPrep ?? null,
    battleAdvice: buildBattleAdvice(state, registries, currentStage, army),
    activeBattle,
    reports: state.war.battleReports,
  };
}

