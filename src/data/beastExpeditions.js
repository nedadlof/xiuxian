const BEAST_EXPEDITION_DEFINITIONS = Object.freeze([
  {
    id: 'verdant-trail',
    name: '林渊巡猎',
    description: '沿林渊边界巡猎灵息与幼兽踪迹，偏向草木与碎片收集。',
    preferredTags: ['ranged', 'control', 'support'],
    preferredArchetypes: ['追猎型', '劫掠滚利型'],
    minUnlockedBeasts: 1,
    baseDurationMinutes: 18,
    baseRewards: {
      herb: 90,
      wood: 75,
      beastShard: 1,
    },
    bonusRewards: {
      beastShard: 1,
      pills: 6,
    },
  },
  {
    id: 'flame-rift',
    name: '炎脉寻火',
    description: '深入炎脉收集火灵髓与残阵，适合炼丹与符箓系资源补给。',
    preferredTags: ['fire', 'magic', 'burst'],
    preferredArchetypes: ['焚杀号令型', '劫掠滚利型'],
    minUnlockedBeasts: 2,
    baseDurationMinutes: 24,
    baseRewards: {
      spiritCrystal: 22,
      pills: 12,
      talisman: 8,
    },
    bonusRewards: {
      spiritCrystal: 10,
      talisman: 6,
    },
  },
  {
    id: 'ruin-vault',
    name: '荒城拾遗',
    description: '翻找废弃古城与封库遗藏，偏向灵石、命魂碎片与长期养成材料。',
    preferredTags: ['defense', 'flying', 'undead', 'support'],
    preferredArchetypes: ['守势扭转型', '吞纳型'],
    minUnlockedBeasts: 3,
    baseDurationMinutes: 30,
    baseRewards: {
      lingStone: 180,
      discipleShard: 8,
      spiritCrystal: 16,
    },
    bonusRewards: {
      beastShard: 2,
      dao: 60,
    },
  },
]);

export function listBeastExpeditionDefinitions() {
  return BEAST_EXPEDITION_DEFINITIONS.map((definition) => ({
    ...definition,
    preferredTags: [...(definition.preferredTags ?? [])],
    preferredArchetypes: [...(definition.preferredArchetypes ?? [])],
    baseRewards: { ...(definition.baseRewards ?? {}) },
    bonusRewards: { ...(definition.bonusRewards ?? {}) },
  }));
}

export function getBeastExpeditionDefinition(routeId) {
  const definition = BEAST_EXPEDITION_DEFINITIONS.find((entry) => entry.id === routeId);
  if (!definition) {
    return null;
  }

  return {
    ...definition,
    preferredTags: [...(definition.preferredTags ?? [])],
    preferredArchetypes: [...(definition.preferredArchetypes ?? [])],
    baseRewards: { ...(definition.baseRewards ?? {}) },
    bonusRewards: { ...(definition.bonusRewards ?? {}) },
  };
}
