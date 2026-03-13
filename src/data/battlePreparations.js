const PREPARATION_DEFINITIONS = Object.freeze([
  {
    id: 'alchemy-tonic',
    name: '养气丹录',
    buildingId: 'alchemy',
    description: '把灵草与丹药沉淀为宗门常备药引，提升战阵续航与后勤恢复。',
    maxLevel: 10,
    baseCost: { herb: 160, pills: 18, dao: 320 },
    costGrowth: 1.32,
    effects: [
      { type: 'battleSustain', value: 0.04 },
      { type: 'resourceMultiplier', resourceId: 'pills', value: 0.03 },
    ],
  },
  {
    id: 'smithy-armament',
    name: '玄甲兵备',
    buildingId: 'smithy',
    description: '把玄铁与木材熬成常备军械，提高前线容错与弟子兵列基础战力。',
    maxLevel: 10,
    baseCost: { iron: 150, wood: 120, pills: 10 },
    costGrowth: 1.34,
    effects: [
      { type: 'battleDefense', value: 0.05 },
      { type: 'unitPowerMultiplier', value: 0.03 },
    ],
  },
  {
    id: 'talisman-array',
    name: '镇煞符阵',
    buildingId: 'talismanWorkshop',
    description: '将符箓和灵晶炼成常备战阵，使冲关输出与战利节奏更凶更稳。',
    maxLevel: 10,
    baseCost: { talisman: 20, pills: 12, spiritCrystal: 8 },
    costGrowth: 1.36,
    effects: [
      { type: 'battleAttack', value: 0.05 },
      { type: 'battleLoot', value: 0.04 },
    ],
  },
]);

function scaleCost(costMap = {}, level = 0, growth = 1.3) {
  const multiplier = growth ** Math.max(level, 0);
  return Object.fromEntries(
    Object.entries(costMap).map(([resourceId, amount]) => [resourceId, Math.max(1, Math.round(amount * multiplier))]),
  );
}

export function listBattlePreparationDefinitions() {
  return PREPARATION_DEFINITIONS.map((definition) => ({
    ...definition,
    baseCost: { ...definition.baseCost },
    effects: definition.effects.map((effect) => ({ ...effect })),
  }));
}

export function getBattlePreparationDefinition(id) {
  const definition = PREPARATION_DEFINITIONS.find((item) => item.id === id);
  return definition
    ? {
      ...definition,
      baseCost: { ...definition.baseCost },
      effects: definition.effects.map((effect) => ({ ...effect })),
    }
    : null;
}

export function getBattlePreparationCost(id, level = 0) {
  const definition = PREPARATION_DEFINITIONS.find((item) => item.id === id);
  if (!definition) {
    return {};
  }
  return scaleCost(definition.baseCost, level, definition.costGrowth);
}
