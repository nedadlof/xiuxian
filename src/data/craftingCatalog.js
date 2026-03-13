const WEAPON_FAMILIES = Object.freeze([
  {
    id: 'sword',
    name: '长剑',
    profile: '细脊直锋',
    baseCost: { lingStone: 120, iron: 72, wood: 24 },
    effects: [
      { type: 'battleAttack', value: 0.055 },
      { type: 'unitPowerMultiplier', value: 0.03 },
    ],
    tags: ['burst', 'command'],
  },
  {
    id: 'saber',
    name: '战刀',
    profile: '宽背斩锋',
    baseCost: { lingStone: 126, iron: 78, wood: 18 },
    effects: [
      { type: 'battleAttack', value: 0.06 },
      { type: 'battleLoot', value: 0.025 },
    ],
    tags: ['burst', 'melee'],
  },
  {
    id: 'spear',
    name: '长枪',
    profile: '长柄锐锋',
    baseCost: { lingStone: 118, iron: 68, wood: 32 },
    effects: [
      { type: 'unitPowerMultiplier', value: 0.04 },
      { type: 'battleAttack', value: 0.042 },
    ],
    tags: ['command', 'pierce'],
  },
  {
    id: 'bow',
    name: '猎弓',
    profile: '反曲弓臂',
    baseCost: { lingStone: 112, wood: 78, iron: 28 },
    effects: [
      { type: 'battleAttack', value: 0.05 },
      { type: 'battleLoot', value: 0.036 },
    ],
    tags: ['ranged', 'hunt'],
  },
  {
    id: 'halberd',
    name: '方天戟',
    profile: '月刃长戟',
    baseCost: { lingStone: 134, iron: 86, wood: 30 },
    effects: [
      { type: 'battleAttack', value: 0.05 },
      { type: 'battleDefense', value: 0.035 },
    ],
    tags: ['pierce', 'defense'],
  },
  {
    id: 'hammer',
    name: '重锤',
    profile: '双棱锤首',
    baseCost: { lingStone: 128, iron: 92, wood: 26 },
    effects: [
      { type: 'battleDefense', value: 0.055 },
      { type: 'unitPowerMultiplier', value: 0.028 },
    ],
    tags: ['defense', 'command'],
  },
  {
    id: 'axe',
    name: '战斧',
    profile: '斜月斧刃',
    baseCost: { lingStone: 124, iron: 88, wood: 24 },
    effects: [
      { type: 'battleAttack', value: 0.054 },
      { type: 'battleDefense', value: 0.028 },
    ],
    tags: ['melee', 'defense'],
  },
  {
    id: 'dagger',
    name: '短匕',
    profile: '折光暗锋',
    baseCost: { lingStone: 98, iron: 54, wood: 14, pills: 8 },
    effects: [
      { type: 'battleLoot', value: 0.05 },
      { type: 'battleAttack', value: 0.038 },
    ],
    tags: ['burst', 'hunt'],
  },
  {
    id: 'fan',
    name: '灵扇',
    profile: '折骨流纹',
    baseCost: { lingStone: 108, wood: 46, herb: 40, pills: 10 },
    effects: [
      { type: 'battleSustain', value: 0.045 },
      { type: 'battleAttack', value: 0.03 },
    ],
    tags: ['support', 'alchemy'],
  },
  {
    id: 'staff',
    name: '法杖',
    profile: '中空杖芯',
    baseCost: { lingStone: 116, wood: 42, herb: 38, spiritCrystal: 10 },
    effects: [
      { type: 'battleSustain', value: 0.048 },
      { type: 'battleDefense', value: 0.032 },
    ],
    tags: ['support', 'mystic'],
  },
  {
    id: 'crossbow',
    name: '连弩',
    profile: '复槽弩臂',
    baseCost: { lingStone: 132, wood: 66, iron: 56 },
    effects: [
      { type: 'battleAttack', value: 0.053 },
      { type: 'unitPowerMultiplier', value: 0.032 },
    ],
    tags: ['ranged', 'pierce'],
  },
  {
    id: 'whip',
    name: '玄鞭',
    profile: '多节锁鞭',
    baseCost: { lingStone: 120, iron: 48, wood: 36, talisman: 8 },
    effects: [
      { type: 'battleLoot', value: 0.038 },
      { type: 'battleSustain', value: 0.036 },
    ],
    tags: ['control', 'hunt'],
  },
]);

const WEAPON_TRADITIONS = Object.freeze([
  {
    id: 'greenvine',
    prefix: '青藤',
    rarity: 'common',
    smithyLevel: 1,
    reputation: 0,
    costMultiplier: 0.92,
    extraCost: { herb: 18 },
    effects: [
      { type: 'resourceMultiplier', resourceId: 'herb', value: 0.05 },
      { type: 'battleSustain', value: 0.02 },
    ],
    tags: ['support', 'alchemy'],
    craftNote: '以草木灵息温养兵胎，更适合长线续战。',
  },
  {
    id: 'xuanzhu',
    prefix: '玄铸',
    rarity: 'common',
    smithyLevel: 1,
    reputation: 6,
    costMultiplier: 1,
    extraCost: { iron: 20 },
    effects: [
      { type: 'battleDefense', value: 0.025 },
      { type: 'unitPowerMultiplier', value: 0.02 },
    ],
    tags: ['defense', 'command'],
    craftNote: '铸胚厚重，适合构筑宗门常备兵阵。',
  },
  {
    id: 'chijin',
    prefix: '赤烬',
    rarity: 'rare',
    smithyLevel: 2,
    reputation: 18,
    requiredStageId: 'stage-cultivation-2',
    costMultiplier: 1.08,
    extraCost: { pills: 12, spiritCrystal: 8 },
    effects: [
      { type: 'battleAttack', value: 0.028 },
      { type: 'resourceMultiplier', resourceId: 'pills', value: 0.04 },
    ],
    tags: ['burst', 'alchemy'],
    craftNote: '火脉锻火淬纹，兼顾爆发与丹火回流。',
  },
  {
    id: 'xinghui',
    prefix: '星辉',
    rarity: 'rare',
    smithyLevel: 2,
    reputation: 30,
    requiredStageId: 'stage-cultivation-3',
    costMultiplier: 1.1,
    extraCost: { talisman: 8, spiritCrystal: 10 },
    effects: [
      { type: 'battleLoot', value: 0.03 },
      { type: 'unitPowerMultiplier', value: 0.024 },
    ],
    tags: ['hunt', 'ranged'],
    craftNote: '借星砂刻线，偏向追猎和战利回收。',
  },
  {
    id: 'xuanshuang',
    prefix: '玄霜',
    rarity: 'rare',
    smithyLevel: 2,
    reputation: 48,
    requiredStageId: 'stage-ancient-1',
    costMultiplier: 1.12,
    extraCost: { herb: 28, spiritCrystal: 12 },
    effects: [
      { type: 'battleDefense', value: 0.03 },
      { type: 'battleSustain', value: 0.024 },
    ],
    tags: ['support', 'defense'],
    craftNote: '寒意封锋，适合拉长战线并稳住前排。',
  },
  {
    id: 'tinglv',
    prefix: '霆律',
    rarity: 'epic',
    smithyLevel: 3,
    reputation: 66,
    requiredNodeId: 'shenbing-bailian',
    requiredStageId: 'stage-ancient-2',
    costMultiplier: 1.2,
    extraCost: { spiritCrystal: 16, talisman: 12 },
    effects: [
      { type: 'battleAttack', value: 0.032 },
      { type: 'battleLoot', value: 0.03 },
    ],
    tags: ['burst', 'hunt'],
    craftNote: '器纹带雷，锻成后最适合压节奏滚战利。',
  },
  {
    id: 'yougu',
    prefix: '幽骨',
    rarity: 'epic',
    smithyLevel: 3,
    reputation: 84,
    requiredNodeId: 'shenbing-bailian',
    requiredStageId: 'stage-ancient-3',
    costMultiplier: 1.24,
    extraCost: { pills: 16, talisman: 14, affairsCredit: 16 },
    effects: [
      { type: 'battleDefense', value: 0.03 },
      { type: 'unitPowerMultiplier', value: 0.03 },
    ],
    tags: ['mystic', 'defense'],
    craftNote: '借古战残材重锻，偏向稳阵与厚势。',
  },
  {
    id: 'tiangong',
    prefix: '天工',
    rarity: 'legendary',
    smithyLevel: 4,
    reputation: 110,
    requiredNodeId: 'tian-gong-fuling',
    requiredStageId: 'stage-celestial-1',
    costMultiplier: 1.34,
    extraCost: { spiritCrystal: 24, talisman: 18, affairsCredit: 26 },
    effects: [
      { type: 'battleAttack', value: 0.036 },
      { type: 'unitPowerMultiplier', value: 0.035 },
      { type: 'resourceMultiplier', resourceId: 'iron', value: 0.05 },
    ],
    tags: ['command', 'mystic'],
    craftNote: '天工残殿流出的制器思路，追求全局兵势提升。',
  },
  {
    id: 'longyin',
    prefix: '龙吟',
    rarity: 'legendary',
    smithyLevel: 4,
    reputation: 140,
    requiredNodeId: 'danxin-dao',
    requiredStageId: 'stage-celestial-2',
    costMultiplier: 1.4,
    extraCost: { spiritCrystal: 28, pills: 20, affairsCredit: 32 },
    effects: [
      { type: 'battleAttack', value: 0.04 },
      { type: 'battleDefense', value: 0.032 },
      { type: 'resourceMultiplier', resourceId: 'talisman', value: 0.05 },
    ],
    tags: ['burst', 'command'],
    craftNote: '以高阶丹火复锻，追求一器镇场的统御压制。',
  },
]);

const WEAPON_AFFIX_DEFINITIONS = Object.freeze([
  { id: 'sunder', name: '裂甲', type: 'battleAttack', min: 0.018, max: 0.04, tags: ['burst', 'melee', 'pierce'] },
  { id: 'cloudpierce', name: '穿云', type: 'battleAttack', min: 0.02, max: 0.042, tags: ['ranged', 'hunt'] },
  { id: 'warding', name: '御阵', type: 'battleDefense', min: 0.018, max: 0.04, tags: ['defense', 'command'] },
  { id: 'soulguard', name: '镇魄', type: 'battleDefense', min: 0.02, max: 0.038, tags: ['mystic', 'support'] },
  { id: 'ebbflow', name: '回潮', type: 'battleSustain', min: 0.016, max: 0.036, tags: ['support', 'alchemy'] },
  { id: 'profit', name: '逐利', type: 'battleLoot', min: 0.02, max: 0.045, tags: ['hunt', 'ranged', 'control'] },
  { id: 'banner', name: '统御', type: 'unitPowerMultiplier', min: 0.018, max: 0.04, tags: ['command'] },
  { id: 'herblore', name: '采药', type: 'resourceMultiplier', resourceId: 'herb', min: 0.04, max: 0.08, tags: ['alchemy', 'support'] },
  { id: 'timberline', name: '营木', type: 'resourceMultiplier', resourceId: 'wood', min: 0.04, max: 0.08, tags: ['command', 'defense'] },
  { id: 'forgeblood', name: '炼铁', type: 'resourceMultiplier', resourceId: 'iron', min: 0.04, max: 0.08, tags: ['defense', 'pierce'] },
  { id: 'pillguide', name: '丹引', type: 'resourceMultiplier', resourceId: 'pills', min: 0.04, max: 0.08, tags: ['alchemy', 'support'] },
  { id: 'sigilwake', name: '符悟', type: 'resourceMultiplier', resourceId: 'talisman', min: 0.04, max: 0.08, tags: ['mystic', 'control'] },
]);

const PILL_FORMS = Object.freeze([
  {
    id: 'yangqi',
    name: '养气丹',
    profile: '稳息回元',
    baseCost: { herb: 72, pills: 14, lingStone: 80 },
    effects: [
      { type: 'battleSustain', value: 0.042 },
      { type: 'resourceMultiplier', resourceId: 'pills', value: 0.028 },
    ],
    tags: ['support', 'alchemy'],
  },
  {
    id: 'pofeng',
    name: '破锋丹',
    profile: '短促提锋',
    baseCost: { herb: 58, pills: 16, iron: 18, lingStone: 86 },
    effects: [
      { type: 'battleAttack', value: 0.04 },
      { type: 'unitPowerMultiplier', value: 0.024 },
    ],
    tags: ['burst', 'command'],
  },
  {
    id: 'zhengu',
    name: '镇骨丹',
    profile: '护脉固守',
    baseCost: { herb: 68, pills: 16, wood: 18, lingStone: 82 },
    effects: [
      { type: 'battleDefense', value: 0.042 },
      { type: 'battleSustain', value: 0.024 },
    ],
    tags: ['defense', 'support'],
  },
  {
    id: 'liecai',
    name: '猎财散',
    profile: '凝识追痕',
    baseCost: { herb: 66, pills: 14, talisman: 10, lingStone: 84 },
    effects: [
      { type: 'battleLoot', value: 0.04 },
      { type: 'unitPowerMultiplier', value: 0.022 },
    ],
    tags: ['hunt', 'control'],
  },
  {
    id: 'huichun',
    name: '回春露',
    profile: '久战续命',
    baseCost: { herb: 78, pills: 12, spiritCrystal: 8, lingStone: 88 },
    effects: [
      { type: 'battleSustain', value: 0.045 },
      { type: 'battleDefense', value: 0.022 },
    ],
    tags: ['support', 'alchemy'],
  },
  {
    id: 'ningshen',
    name: '凝神丸',
    profile: '稳神提速',
    baseCost: { herb: 62, pills: 15, talisman: 8, lingStone: 92 },
    effects: [
      { type: 'battleAttack', value: 0.032 },
      { type: 'battleDefense', value: 0.028 },
    ],
    tags: ['mystic', 'support'],
  },
  {
    id: 'zhumai',
    name: '铸脉丹',
    profile: '厚势固阵',
    baseCost: { herb: 64, pills: 18, iron: 16, lingStone: 96 },
    effects: [
      { type: 'unitPowerMultiplier', value: 0.032 },
      { type: 'battleDefense', value: 0.024 },
    ],
    tags: ['command', 'defense'],
  },
  {
    id: 'huasha',
    name: '化煞露',
    profile: '祛秽猎杀',
    baseCost: { herb: 76, pills: 16, talisman: 12, lingStone: 94 },
    effects: [
      { type: 'battleAttack', value: 0.034 },
      { type: 'battleLoot', value: 0.03 },
    ],
    tags: ['burst', 'hunt'],
  },
  {
    id: 'qingshen',
    name: '轻身丸',
    profile: '轻灵回转',
    baseCost: { herb: 56, pills: 14, wood: 20, lingStone: 84 },
    effects: [
      { type: 'battleLoot', value: 0.032 },
      { type: 'battleSustain', value: 0.024 },
    ],
    tags: ['hunt', 'support'],
  },
  {
    id: 'huxin',
    name: '护心丹',
    profile: '定魄稳阵',
    baseCost: { herb: 74, pills: 18, spiritCrystal: 8, lingStone: 98 },
    effects: [
      { type: 'battleDefense', value: 0.038 },
      { type: 'battleLoot', value: 0.022 },
    ],
    tags: ['defense', 'control'],
  },
  {
    id: 'tongluo',
    name: '通络散',
    profile: '调脉回气',
    baseCost: { herb: 70, pills: 18, wood: 16, lingStone: 90 },
    effects: [
      { type: 'unitPowerMultiplier', value: 0.028 },
      { type: 'battleSustain', value: 0.026 },
    ],
    tags: ['command', 'alchemy'],
  },
  {
    id: 'lianshen',
    name: '炼神丹',
    profile: '凝识提锋',
    baseCost: { herb: 72, pills: 20, talisman: 10, spiritCrystal: 8, lingStone: 104 },
    effects: [
      { type: 'battleAttack', value: 0.036 },
      { type: 'resourceMultiplier', resourceId: 'talisman', value: 0.028 },
    ],
    tags: ['mystic', 'burst'],
  },
]);

const PILL_DOCTRINES = Object.freeze([
  {
    id: 'qinglan',
    prefix: '青岚',
    rarity: 'common',
    alchemyLevel: 1,
    reputation: 0,
    costMultiplier: 0.94,
    extraCost: { herb: 20 },
    effects: [
      { type: 'resourceMultiplier', resourceId: 'herb', value: 0.05 },
      { type: 'battleSustain', value: 0.02 },
    ],
    tags: ['support', 'alchemy'],
    craftNote: '偏向长线恢复与药材回收。',
  },
  {
    id: 'jinxia',
    prefix: '金霞',
    rarity: 'common',
    alchemyLevel: 1,
    reputation: 8,
    costMultiplier: 1,
    extraCost: { pills: 8 },
    effects: [
      { type: 'battleSustain', value: 0.022 },
      { type: 'resourceMultiplier', resourceId: 'pills', value: 0.04 },
    ],
    tags: ['alchemy', 'support'],
    craftNote: '适合沉淀丹材，把低阶药坯炼成战备成药。',
  },
  {
    id: 'chiyang',
    prefix: '赤阳',
    rarity: 'rare',
    alchemyLevel: 2,
    reputation: 18,
    requiredStageId: 'stage-cultivation-2',
    costMultiplier: 1.08,
    extraCost: { spiritCrystal: 8 },
    effects: [
      { type: 'battleAttack', value: 0.024 },
      { type: 'unitPowerMultiplier', value: 0.018 },
    ],
    tags: ['burst', 'command'],
    craftNote: '火息明烈，专门补齐冲阵爆发。',
  },
  {
    id: 'xuanshuang',
    prefix: '玄霜',
    rarity: 'rare',
    alchemyLevel: 2,
    reputation: 30,
    requiredStageId: 'stage-cultivation-3',
    costMultiplier: 1.1,
    extraCost: { herb: 24, spiritCrystal: 10 },
    effects: [
      { type: 'battleDefense', value: 0.026 },
      { type: 'battleSustain', value: 0.02 },
    ],
    tags: ['defense', 'support'],
    craftNote: '偏向稳阵续战，适合高压持久图。',
  },
  {
    id: 'xingxuan',
    prefix: '星璇',
    rarity: 'rare',
    alchemyLevel: 2,
    reputation: 48,
    requiredStageId: 'stage-ancient-1',
    costMultiplier: 1.12,
    extraCost: { talisman: 10 },
    effects: [
      { type: 'battleLoot', value: 0.028 },
      { type: 'battleAttack', value: 0.018 },
    ],
    tags: ['hunt', 'mystic'],
    craftNote: '药性带有追痕感，应对遗迹和高价值战利更合适。',
  },
  {
    id: 'leixi',
    prefix: '雷息',
    rarity: 'epic',
    alchemyLevel: 3,
    reputation: 66,
    requiredNodeId: 'danxin-dao',
    requiredStageId: 'stage-ancient-2',
    costMultiplier: 1.2,
    extraCost: { spiritCrystal: 14, talisman: 10 },
    effects: [
      { type: 'battleAttack', value: 0.028 },
      { type: 'battleLoot', value: 0.024 },
    ],
    tags: ['burst', 'hunt'],
    craftNote: '高阶丹息带雷，可同时提高破阵与战利回流。',
  },
  {
    id: 'youlian',
    prefix: '幽莲',
    rarity: 'epic',
    alchemyLevel: 3,
    reputation: 84,
    requiredNodeId: 'danxin-dao',
    requiredStageId: 'stage-ancient-3',
    costMultiplier: 1.24,
    extraCost: { spiritCrystal: 16, affairsCredit: 12 },
    effects: [
      { type: 'battleSustain', value: 0.026 },
      { type: 'battleDefense', value: 0.026 },
    ],
    tags: ['support', 'mystic'],
    craftNote: '从古战残痕中提炼出的沉稳药性，适合高压防线。',
  },
  {
    id: 'tianlu',
    prefix: '天露',
    rarity: 'legendary',
    alchemyLevel: 4,
    reputation: 110,
    requiredNodeId: 'tianhuo-zhenyan',
    requiredStageId: 'stage-celestial-1',
    costMultiplier: 1.34,
    extraCost: { spiritCrystal: 22, talisman: 16, affairsCredit: 20 },
    effects: [
      { type: 'unitPowerMultiplier', value: 0.03 },
      { type: 'resourceMultiplier', resourceId: 'talisman', value: 0.05 },
    ],
    tags: ['command', 'mystic'],
    craftNote: '仙门真火淬成的露剂，偏向统御与符阵回流。',
  },
  {
    id: 'jiuzhuan',
    prefix: '九转',
    rarity: 'legendary',
    alchemyLevel: 4,
    reputation: 140,
    requiredNodeId: 'tian-gong-fuling',
    requiredStageId: 'stage-celestial-2',
    costMultiplier: 1.4,
    extraCost: { spiritCrystal: 26, talisman: 18, affairsCredit: 28 },
    effects: [
      { type: 'battleAttack', value: 0.032 },
      { type: 'battleSustain', value: 0.03 },
      { type: 'resourceMultiplier', resourceId: 'pills', value: 0.05 },
    ],
    tags: ['burst', 'alchemy'],
    craftNote: '终局级丹道沉淀，适合全盘压榨资源和战斗转化。',
  },
]);

function cloneEffects(effects = []) {
  return effects.map((effect) => ({ ...effect }));
}

function mergeCostMaps(...costMaps) {
  const result = {};
  for (const costMap of costMaps) {
    for (const [resourceId, amount] of Object.entries(costMap ?? {})) {
      result[resourceId] = (result[resourceId] ?? 0) + amount;
    }
  }
  return result;
}

function scaleCostMap(costMap = {}, multiplier = 1) {
  return Object.fromEntries(
    Object.entries(costMap).map(([resourceId, amount]) => [resourceId, Math.max(1, Math.round(amount * multiplier))]),
  );
}

function buildWeaponBlueprint(tradition, family, order) {
  return {
    id: `${tradition.id}-${family.id}`,
    order,
    name: `${tradition.prefix}${family.name}`,
    familyId: family.id,
    traditionId: tradition.id,
    rarity: tradition.rarity,
    smithyLevel: tradition.smithyLevel,
    requiredReputation: tradition.reputation,
    requiredStageId: tradition.requiredStageId ?? null,
    requiredNodeId: tradition.requiredNodeId ?? null,
    cost: mergeCostMaps(
      scaleCostMap(family.baseCost, tradition.costMultiplier),
      tradition.extraCost,
    ),
    effects: cloneEffects([...family.effects, ...tradition.effects]),
    tags: [...new Set([...(family.tags ?? []), ...(tradition.tags ?? [])])],
    affixCapacity: tradition.rarity === 'legendary' ? 4 : tradition.rarity === 'epic' ? 3 : tradition.rarity === 'rare' ? 2 : 1,
    modelProfile: `${family.profile} · ${tradition.craftNote}`,
    description: `${tradition.prefix}系${family.name}，${tradition.craftNote}`,
  };
}

function buildPillRecipe(doctrine, form, order) {
  return {
    id: `${doctrine.id}-${form.id}`,
    order,
    name: `${doctrine.prefix}${form.name}`,
    formId: form.id,
    doctrineId: doctrine.id,
    rarity: doctrine.rarity,
    alchemyLevel: doctrine.alchemyLevel,
    requiredReputation: doctrine.reputation,
    requiredStageId: doctrine.requiredStageId ?? null,
    requiredNodeId: doctrine.requiredNodeId ?? null,
    cost: mergeCostMaps(
      scaleCostMap(form.baseCost, doctrine.costMultiplier),
      doctrine.extraCost,
    ),
    effects: cloneEffects([...form.effects, ...doctrine.effects]),
    tags: [...new Set([...(form.tags ?? []), ...(doctrine.tags ?? [])])],
    batchSize: doctrine.rarity === 'legendary' ? 3 : doctrine.rarity === 'epic' ? 3 : doctrine.rarity === 'rare' ? 2 : 2,
    profile: `${form.profile} · ${doctrine.craftNote}`,
    description: `${doctrine.prefix}系${form.name}，${doctrine.craftNote}`,
  };
}

const WEAPON_BLUEPRINTS = Object.freeze(
  WEAPON_TRADITIONS.flatMap((tradition, traditionIndex) => (
    WEAPON_FAMILIES.map((family, familyIndex) => buildWeaponBlueprint(
      tradition,
      family,
      traditionIndex * WEAPON_FAMILIES.length + familyIndex + 1,
    ))
  )),
);

const PILL_RECIPE_DEFINITIONS = Object.freeze(
  PILL_DOCTRINES.flatMap((doctrine, doctrineIndex) => (
    PILL_FORMS.map((form, formIndex) => buildPillRecipe(
      doctrine,
      form,
      doctrineIndex * PILL_FORMS.length + formIndex + 1,
    ))
  )),
);

export function listWeaponBlueprints() {
  return WEAPON_BLUEPRINTS.map((definition) => ({
    ...definition,
    cost: { ...(definition.cost ?? {}) },
    effects: cloneEffects(definition.effects),
    tags: [...(definition.tags ?? [])],
  }));
}

export function getWeaponBlueprint(id) {
  const definition = WEAPON_BLUEPRINTS.find((item) => item.id === id);
  return definition
    ? {
      ...definition,
      cost: { ...(definition.cost ?? {}) },
      effects: cloneEffects(definition.effects),
      tags: [...(definition.tags ?? [])],
    }
    : null;
}

export function listWeaponAffixDefinitions() {
  return WEAPON_AFFIX_DEFINITIONS.map((definition) => ({ ...definition, tags: [...(definition.tags ?? [])] }));
}

export function getWeaponAffixPool(blueprint = null) {
  const tags = new Set(blueprint?.tags ?? []);
  const candidates = WEAPON_AFFIX_DEFINITIONS.filter((definition) => (
    definition.tags.some((tag) => tags.has(tag))
  ));
  const pool = candidates.length ? candidates : WEAPON_AFFIX_DEFINITIONS;
  return pool.map((definition) => ({ ...definition, tags: [...(definition.tags ?? [])] }));
}

export function listPillRecipeDefinitions() {
  return PILL_RECIPE_DEFINITIONS.map((definition) => ({
    ...definition,
    cost: { ...(definition.cost ?? {}) },
    effects: cloneEffects(definition.effects),
    tags: [...(definition.tags ?? [])],
  }));
}

export function getPillRecipeDefinition(id) {
  const definition = PILL_RECIPE_DEFINITIONS.find((item) => item.id === id);
  return definition
    ? {
      ...definition,
      cost: { ...(definition.cost ?? {}) },
      effects: cloneEffects(definition.effects),
      tags: [...(definition.tags ?? [])],
    }
    : null;
}

export function getCraftingCatalogCounts() {
  return {
    weaponBlueprints: WEAPON_BLUEPRINTS.length,
    pillRecipes: PILL_RECIPE_DEFINITIONS.length,
  };
}
