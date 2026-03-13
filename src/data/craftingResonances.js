function cloneEffects(effects = []) {
  return effects.map((effect) => ({ ...effect }));
}

function cloneTagMap(tagMap = {}) {
  return Object.fromEntries(Object.entries(tagMap).map(([tag, count]) => [tag, Math.max(Number(count) || 0, 0)]));
}

const CRAFTING_TAG_LABELS = Object.freeze({
  burst: '爆发',
  command: '统御',
  support: '辅修',
  alchemy: '丹火',
  defense: '守御',
  hunt: '追猎',
  ranged: '远射',
  pierce: '破阵',
  mystic: '玄法',
  control: '控场',
  melee: '近战',
});

const CRAFTING_RESONANCE_DEFINITIONS = Object.freeze([
  {
    id: 'verdant-revival',
    name: '青藤回元',
    description: '以木灵兵器引动丹火回流，适合长线刷图与药材沉淀。',
    weaponTags: { support: 1, alchemy: 1 },
    pillTags: { support: 1, alchemy: 1 },
    effects: [
      { type: 'battleSustain', value: 0.08 },
      { type: 'resourceMultiplier', resourceId: 'herb', value: 0.08 },
      { type: 'resourceMultiplier', resourceId: 'pills', value: 0.05 },
    ],
  },
  {
    id: 'scarlet-onslaught',
    name: '赤阳破军',
    description: '爆发型兵器与攻伐丹息互相催化，适合短时压场。',
    weaponTags: { burst: 1, command: 1 },
    pillTags: { burst: 1, command: 1 },
    effects: [
      { type: 'battleAttack', value: 0.09 },
      { type: 'unitPowerMultiplier', value: 0.05 },
    ],
  },
  {
    id: 'frostwall-bastion',
    name: '玄霜镇垒',
    description: '重守兵势与稳脉丹房形成厚阵共鸣，适合高压关卡。',
    weaponTags: { defense: 1, support: 1 },
    pillTags: { defense: 1, support: 1 },
    effects: [
      { type: 'battleDefense', value: 0.09 },
      { type: 'battleSustain', value: 0.05 },
    ],
  },
  {
    id: 'starhunt-harvest',
    name: '星辉逐利',
    description: '追猎兵器搭配搜利丹方，可把日常战斗变成持续回收线。',
    weaponTags: { hunt: 1, ranged: 1 },
    pillTags: { hunt: 1 },
    effects: [
      { type: 'battleLoot', value: 0.1 },
      { type: 'battleAttack', value: 0.04 },
    ],
  },
  {
    id: 'thunderstrike-frenzy',
    name: '雷息霆律',
    description: '雷火一脉同时拉高斩杀与掉落，是中段滚雪球的核心组合。',
    weaponTags: { burst: 1, hunt: 1 },
    pillTags: { burst: 1, hunt: 1 },
    effects: [
      { type: 'battleAttack', value: 0.07 },
      { type: 'battleLoot', value: 0.06 },
    ],
  },
  {
    id: 'heavenly-command',
    name: '天工军律',
    description: '军律型神兵配合天露丹方，能把全局统御和符阵产线一起拉起。',
    weaponTags: { command: 1, mystic: 1 },
    pillTags: { command: 1, mystic: 1 },
    effects: [
      { type: 'unitPowerMultiplier', value: 0.08 },
      { type: 'resourceMultiplier', resourceId: 'talisman', value: 0.08 },
    ],
  },
  {
    id: 'cloudpierce-vanguard',
    name: '贯云先阵',
    description: '破阵兵器与玄攻丹方形成先手压制，适合推进主线和扫荡。',
    weaponTags: { pierce: 1, ranged: 1 },
    pillTags: { burst: 1, mystic: 1 },
    effects: [
      { type: 'battleAttack', value: 0.06 },
      { type: 'unitPowerMultiplier', value: 0.04 },
      { type: 'battleLoot', value: 0.03 },
    ],
  },
]);

export function getCraftingTagLabel(tag = '') {
  return CRAFTING_TAG_LABELS[tag] ?? tag;
}

export function listCraftingResonanceDefinitions() {
  return CRAFTING_RESONANCE_DEFINITIONS.map((definition) => ({
    ...definition,
    weaponTags: cloneTagMap(definition.weaponTags),
    pillTags: cloneTagMap(definition.pillTags),
    effects: cloneEffects(definition.effects),
  }));
}
