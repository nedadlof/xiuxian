const BEAST_EXPEDITION_EVENT_TRIGGER_PROGRESS = 0.46;

const BEAST_EXPEDITION_EVENT_DEFINITIONS = Object.freeze([
  {
    id: 'verdant-lost-cub',
    routeIds: ['verdant-trail'],
    name: '灵藤岔路',
    description: '巡游途中传来幼兽啼鸣，灵藤深处还有未被采尽的药芽与猎痕。',
    options: [
      {
        id: 'soothe-cub',
        label: '安抚幼兽',
        description: '多停留一阵，换回更多灵草与兽契碎片。',
        default: true,
        effects: {
          rewardBonus: {
            herb: 42,
            beastShard: 1,
          },
          durationMultiplier: 1.12,
        },
      },
      {
        id: 'track-poachers',
        label: '追索猎痕',
        description: '顺着痕迹追查，带回更多木材与执务线索。',
        effects: {
          rewardBonus: {
            wood: 54,
            dao: 120,
          },
          durationMultiplier: 0.9,
          affairsCredit: 2,
        },
      },
    ],
  },
  {
    id: 'verdant-hidden-cache',
    routeIds: ['verdant-trail'],
    name: '苔洞密匣',
    description: '影狼发现一处被苔藓覆盖的密匣，里面夹着旧封签和药引残页。',
    options: [
      {
        id: 'gather-dew',
        label: '收取药露',
        description: '以稳妥方式回收药露，整体收益更扎实。',
        default: true,
        effects: {
          rewardMultiplier: 1.14,
          rewardBonus: {
            pills: 4,
          },
        },
      },
      {
        id: 'mark-storehouse',
        label: '标记封库',
        description: '留下仓储标记，为宗门后勤提前探路。',
        effects: {
          rewardBonus: {
            wood: 36,
            beastShard: 1,
          },
          warehouseAutoSealAdvanceSeconds: 90,
        },
      },
    ],
  },
  {
    id: 'flame-rune-furnace',
    routeIds: ['flame-rift'],
    name: '熔穴丹雾',
    description: '炎脉裂缝里喷出夹杂丹渣与火纹的烟雾，稍有处理便可回收高价值材料。',
    options: [
      {
        id: 'collect-cinders',
        label: '收火髓',
        description: '优先回收灵晶与丹料，稳妥提升当前巡游收益。',
        default: true,
        effects: {
          rewardBonus: {
            spiritCrystal: 12,
            pills: 8,
          },
        },
      },
      {
        id: 'inscribe-runes',
        label: '临刻火纹',
        description: '现场描摹火纹阵路，带回额外符箓收益与执务情报。',
        effects: {
          rewardBonus: {
            talisman: 10,
            spiritCrystal: 6,
          },
          durationMultiplier: 1.06,
          affairsCredit: 2,
        },
      },
    ],
  },
  {
    id: 'ruin-sealed-ledger',
    routeIds: ['ruin-vault'],
    name: '封库暗纹',
    description: '荒城残库里留有一册未烧尽的账册与一道半失效封印，既可拆解也可备案。',
    options: [
      {
        id: 'catalog-ledger',
        label: '誊抄账册',
        description: '整理线索，换取更多命魂碎片与执务信用。',
        default: true,
        effects: {
          rewardBonus: {
            discipleShard: 12,
            dao: 80,
          },
          affairsCredit: 3,
        },
      },
      {
        id: 'pry-seal',
        label: '撬开封印',
        description: '直接拆开密封残库，回收灵石并加速仓库下一轮封存。',
        effects: {
          rewardBonus: {
            lingStone: 120,
            beastShard: 2,
          },
          warehouseAutoSealAdvanceSeconds: 120,
        },
      },
    ],
  },
]);

function cloneEventDefinition(definition) {
  return {
    ...definition,
    routeIds: [...(definition.routeIds ?? [])],
    options: (definition.options ?? []).map((option) => ({
      ...option,
      effects: {
        ...(option.effects ?? {}),
        rewardBonus: { ...(option.effects?.rewardBonus ?? {}) },
      },
    })),
  };
}

export function getBeastExpeditionEventTriggerProgress() {
  return BEAST_EXPEDITION_EVENT_TRIGGER_PROGRESS;
}

export function listBeastExpeditionEventDefinitions(routeId = null) {
  return BEAST_EXPEDITION_EVENT_DEFINITIONS
    .filter((definition) => !routeId || (definition.routeIds ?? []).includes(routeId))
    .map((definition) => cloneEventDefinition(definition));
}

export function pickBeastExpeditionEventDefinition({ routeId, usedEventIds = [], seed = 0 } = {}) {
  const candidates = BEAST_EXPEDITION_EVENT_DEFINITIONS.filter((definition) => (
    (definition.routeIds ?? []).includes(routeId)
      && !usedEventIds.includes(definition.id)
  ));

  if (!candidates.length) {
    return null;
  }

  const resolvedSeed = Math.abs(Math.floor(Number(seed) || 0));
  return cloneEventDefinition(candidates[resolvedSeed % candidates.length]);
}
