const STORAGE_RESOURCE_IDS = Object.freeze([
  'lingStone',
  'wood',
  'herb',
  'iron',
  'pills',
  'talisman',
  'spiritCrystal',
]);

const WAREHOUSE_SEAL_DEFINITIONS = Object.freeze([
  {
    id: 'spirit-cellar',
    name: '灵泉地窖',
    description: '封存灵石与灵晶，稳住宗门日常周转与库容。',
    cost: { lingStone: 360, spiritCrystal: 12 },
    trackedResourceIds: ['lingStone', 'spiritCrystal'],
    levelThresholds: [1, 3, 6, 10, 15],
    effectSummary: ['每级提升核心仓容', '适合化解灵石溢出'],
  },
  {
    id: 'herbal-rack',
    name: '百草封架',
    description: '将灵草、丹药与灵木按序封存，反哺宗门产线轮转。',
    cost: { herb: 220, pills: 12, wood: 140 },
    trackedResourceIds: ['herb', 'pills', 'wood'],
    levelThresholds: [1, 3, 6, 10, 15],
    effectSummary: ['每级提升灵木、灵草、丹药产出', '适合长线挂机丰产'],
  },
  {
    id: 'armory-bay',
    name: '兵甲库湾',
    description: '把玄铁、灵木与符箓打包入库，为战事预留后勤底气。',
    cost: { iron: 180, wood: 120, talisman: 14 },
    trackedResourceIds: ['iron', 'wood', 'talisman'],
    levelThresholds: [1, 3, 6, 10, 15],
    effectSummary: ['每级提升战斗基础奖励与掉落量', '适合中后期冲关滚收益'],
  },
  {
    id: 'archive-shelf',
    name: '卷宗秘架',
    description: '整理命魂、兽魂与道蕴，把零碎积累沉淀成宗务底牌。',
    cost: { discipleShard: 12, beastShard: 2, dao: 800 },
    trackedResourceIds: ['discipleShard', 'beastShard', 'dao'],
    levelThresholds: [1, 2, 4, 7, 10],
    effectSummary: ['每级提升委托奖励与事务收益', '越往后越能放大挂机委托循环'],
  },
]);

const WAREHOUSE_STRATEGY_DEFINITIONS = Object.freeze([
  {
    id: 'balanced-ledger',
    name: '均衡盘库',
    description: '稳住仓容与产线，适合作为默认长挂机策略。',
    unlockTotalLevel: 0,
    preferredSealIds: ['spirit-cellar', 'herbal-rack'],
    effectSummary: ['按总仓阶提升仓容', '按总仓阶提升产业产出'],
  },
  {
    id: 'growth-cycle',
    name: '丰产轮转',
    description: '将仓中余粮继续投入产线，追求资源滚雪球。',
    unlockTotalLevel: 2,
    preferredSealIds: ['herbal-rack', 'spirit-cellar'],
    effectSummary: ['更高的全局产出增幅', '保留少量仓容加成'],
  },
  {
    id: 'sect-logistics',
    name: '宗务统筹',
    description: '把仓储余裕转成委托效率，适合专注事务堂与卷宗循环。',
    unlockTotalLevel: 4,
    preferredSealIds: ['archive-shelf', 'spirit-cellar'],
    effectSummary: ['按总仓阶提升委托奖励', '额外追加声望与事务点'],
  },
  {
    id: 'frontline-supply',
    name: '战备统筹',
    description: '优先保证前线补给，把封存资源转化为战斗收益。',
    unlockTotalLevel: 6,
    preferredSealIds: ['armory-bay', 'spirit-cellar'],
    effectSummary: ['按总仓阶提升战斗奖励', '按总仓阶提升掉落量'],
  },
]);

function cloneCostMap(cost = {}) {
  return Object.fromEntries(
    Object.entries(cost ?? {}).map(([resourceId, amount]) => [resourceId, Math.max(Number(amount) || 0, 0)]),
  );
}

function createResourceBonusMap() {
  return {
    lingStone: 0,
    wood: 0,
    herb: 0,
    iron: 0,
    pills: 0,
    talisman: 0,
    spiritCrystal: 0,
  };
}

function clampCount(value) {
  return Math.max(Math.floor(Number(value) || 0), 0);
}

export function listWarehouseSealDefinitions() {
  return WAREHOUSE_SEAL_DEFINITIONS.map((definition) => ({
    ...definition,
    cost: cloneCostMap(definition.cost),
    trackedResourceIds: [...(definition.trackedResourceIds ?? [])],
    levelThresholds: [...(definition.levelThresholds ?? [])],
    effectSummary: [...(definition.effectSummary ?? [])],
  }));
}

export function getWarehouseSealDefinition(sealId) {
  const definition = WAREHOUSE_SEAL_DEFINITIONS.find((item) => item.id === sealId);
  return definition
    ? {
      ...definition,
      cost: cloneCostMap(definition.cost),
      trackedResourceIds: [...(definition.trackedResourceIds ?? [])],
      levelThresholds: [...(definition.levelThresholds ?? [])],
      effectSummary: [...(definition.effectSummary ?? [])],
    }
    : null;
}

export function listWarehouseStrategyDefinitions() {
  return WAREHOUSE_STRATEGY_DEFINITIONS.map((definition) => ({
    ...definition,
    preferredSealIds: [...(definition.preferredSealIds ?? [])],
    effectSummary: [...(definition.effectSummary ?? [])],
  }));
}

export function getWarehouseStrategyDefinition(strategyId) {
  const definition = WAREHOUSE_STRATEGY_DEFINITIONS.find((item) => item.id === strategyId);
  return definition
    ? {
      ...definition,
      preferredSealIds: [...(definition.preferredSealIds ?? [])],
      effectSummary: [...(definition.effectSummary ?? [])],
    }
    : null;
}

export function getWarehouseSealLevel(definition = {}, sealCount = 0) {
  const thresholds = definition.levelThresholds ?? [];
  const safeCount = clampCount(sealCount);
  return thresholds.reduce((level, threshold) => (safeCount >= threshold ? level + 1 : level), 0);
}

export function getWarehouseSealProgress(definition = {}, sealCount = 0) {
  const thresholds = [...(definition.levelThresholds ?? [])];
  const safeCount = clampCount(sealCount);
  const level = getWarehouseSealLevel(definition, safeCount);
  const currentThreshold = level > 0 ? thresholds[level - 1] ?? 0 : 0;
  const nextThreshold = thresholds[level] ?? null;
  const progressToNext = nextThreshold == null
    ? 1
    : Math.max(Math.min((safeCount - currentThreshold) / Math.max(nextThreshold - currentThreshold, 1), 1), 0);

  return {
    sealCount: safeCount,
    level,
    currentThreshold,
    nextThreshold,
    sealsToNext: nextThreshold == null ? 0 : Math.max(nextThreshold - safeCount, 0),
    progressToNext,
    maxLevel: thresholds.length,
  };
}

export function getWarehouseTotalSealLevel(seals = {}) {
  return WAREHOUSE_SEAL_DEFINITIONS.reduce((total, definition) => (
    total + getWarehouseSealLevel(definition, seals?.[definition.id] ?? 0)
  ), 0);
}

export function getWarehouseStrategyAvailability(definition = {}, totalLevel = 0) {
  const requiredLevel = clampCount(definition.unlockTotalLevel);
  const currentLevel = clampCount(totalLevel);
  return {
    unlocked: currentLevel >= requiredLevel,
    requiredLevel,
    currentLevel,
  };
}

export function resolveWarehouseActiveStrategyId(activeStrategyId = null, seals = {}) {
  const totalLevel = getWarehouseTotalSealLevel(seals);
  const preferred = getWarehouseStrategyDefinition(activeStrategyId);
  if (preferred && getWarehouseStrategyAvailability(preferred, totalLevel).unlocked) {
    return preferred.id;
  }

  return WAREHOUSE_STRATEGY_DEFINITIONS.find((definition) => (
    getWarehouseStrategyAvailability(definition, totalLevel).unlocked
  ))?.id ?? WAREHOUSE_STRATEGY_DEFINITIONS[0]?.id ?? null;
}

export function getWarehouseStorageResourceIds() {
  return [...STORAGE_RESOURCE_IDS];
}

export function getWarehouseEffects(state = {}) {
  const seals = state.warehouse?.seals ?? {};
  const totalLevel = getWarehouseTotalSealLevel(seals);
  const activeStrategyId = resolveWarehouseActiveStrategyId(state.warehouse?.activeStrategyId ?? null, seals);
  const activeStrategy = getWarehouseStrategyDefinition(activeStrategyId)
    ?? getWarehouseStrategyDefinition('balanced-ledger');
  const effects = {
    totalLevel,
    activeStrategy,
    storageMultiplier: 0,
    economyGlobalOutputMultiplier: 0,
    economyOutputByResource: createResourceBonusMap(),
    commissionRewardMultiplier: 0,
    commissionReputationFlatBonus: 0,
    commissionAffairsFlatBonus: 0,
    warRewardMultiplier: 0,
    warLootAmountMultiplier: 0,
    sealLevels: {},
  };

  for (const definition of WAREHOUSE_SEAL_DEFINITIONS) {
    const level = getWarehouseSealLevel(definition, seals?.[definition.id] ?? 0);
    effects.sealLevels[definition.id] = level;

    if (definition.id === 'spirit-cellar') {
      effects.storageMultiplier += level * 0.04;
      continue;
    }
    if (definition.id === 'herbal-rack') {
      effects.economyOutputByResource.wood += level * 0.03;
      effects.economyOutputByResource.herb += level * 0.05;
      effects.economyOutputByResource.pills += level * 0.05;
      continue;
    }
    if (definition.id === 'armory-bay') {
      effects.warRewardMultiplier += level * 0.05;
      effects.warLootAmountMultiplier += level * 0.03;
      continue;
    }
    if (definition.id === 'archive-shelf') {
      effects.commissionRewardMultiplier += level * 0.04;
      effects.commissionReputationFlatBonus += Math.floor(level / 2);
      effects.commissionAffairsFlatBonus += Math.floor((level + 1) / 3);
    }
  }

  if (activeStrategy?.id === 'balanced-ledger') {
    effects.storageMultiplier += totalLevel * 0.012;
    effects.economyGlobalOutputMultiplier += totalLevel * 0.01;
  } else if (activeStrategy?.id === 'growth-cycle') {
    effects.storageMultiplier += totalLevel * 0.006;
    effects.economyGlobalOutputMultiplier += totalLevel * 0.02;
  } else if (activeStrategy?.id === 'sect-logistics') {
    effects.commissionRewardMultiplier += totalLevel * 0.025;
    effects.commissionReputationFlatBonus += Math.floor(totalLevel / 3);
    effects.commissionAffairsFlatBonus += Math.floor(totalLevel / 4);
  } else if (activeStrategy?.id === 'frontline-supply') {
    effects.warRewardMultiplier += totalLevel * 0.03;
    effects.warLootAmountMultiplier += totalLevel * 0.02;
  }

  return effects;
}
