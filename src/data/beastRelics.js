const BEAST_RELIC_DEFINITIONS = Object.freeze([
  {
    id: 'dewtrace-amber',
    routeId: 'verdant-trail',
    setId: 'verdant-bestiary',
    order: 1,
    name: '露痕琥珀',
    rarity: 'rare',
    discoveryThreshold: 90,
    description: '封住晨露与兽息的古琥珀，能让灵植与丹材的回收效率更稳定。',
    effects: [
      { type: 'resourceMultiplier', resourceId: 'herb', value: 0.08 },
      { type: 'battleSustain', value: 0.03 },
    ],
  },
  {
    id: 'vinehowl-whistle',
    routeId: 'verdant-trail',
    setId: 'verdant-bestiary',
    order: 2,
    name: '藤吼骨哨',
    rarity: 'rare',
    discoveryThreshold: 110,
    description: '用古兽喉骨制成的号哨，能在猎获时放大追击和回收节奏。',
    effects: [
      { type: 'battleLoot', value: 0.05 },
      { type: 'unitPowerMultiplier', value: 0.02 },
    ],
  },
  {
    id: 'scarlet-ash-compass',
    routeId: 'flame-rift',
    setId: 'ember-forge',
    order: 1,
    name: '赤烬罗盘',
    rarity: 'epic',
    discoveryThreshold: 95,
    description: '可感应火脉回流的旧罗盘，对炼丹与战阵压制都很有帮助。',
    effects: [
      { type: 'battleAttack', value: 0.06 },
      { type: 'resourceMultiplier', resourceId: 'pills', value: 0.08 },
    ],
  },
  {
    id: 'cinder-seal-plate',
    routeId: 'flame-rift',
    setId: 'ember-forge',
    order: 2,
    name: '烬纹封板',
    rarity: 'epic',
    discoveryThreshold: 120,
    description: '残留火纹禁制的封板，拆解后能稳定补出符箓和战利余烬。',
    effects: [
      { type: 'resourceMultiplier', resourceId: 'talisman', value: 0.1 },
      { type: 'battleLoot', value: 0.04 },
    ],
  },
  {
    id: 'ruin-ledger-fragment',
    routeId: 'ruin-vault',
    setId: 'vault-mnemonics',
    order: 1,
    name: '荒账残页',
    rarity: 'epic',
    discoveryThreshold: 105,
    description: '记着古城税契与封藏路径的账页，对灵石归拢与拾遗效率很有价值。',
    effects: [
      { type: 'resourceMultiplier', resourceId: 'lingStone', value: 0.12 },
      { type: 'battleLoot', value: 0.05 },
    ],
  },
  {
    id: 'buried-command-tally',
    routeId: 'ruin-vault',
    setId: 'vault-mnemonics',
    order: 2,
    name: '埋军虎符',
    rarity: 'legendary',
    discoveryThreshold: 130,
    description: '失落军府遗留的虎符残件，会直接抬升阵列稳定度与兵势调度。',
    effects: [
      { type: 'unitPowerMultiplier', value: 0.05 },
      { type: 'battleDefense', value: 0.05 },
    ],
  },
]);

const BEAST_RELIC_SET_DEFINITIONS = Object.freeze([
  {
    id: 'verdant-bestiary',
    name: '林渊兽志',
    requiredCount: 2,
    description: '完整记下林渊灵兽和猎径后，草木回收与续战能力会更加稳定。',
    effects: [
      { type: 'resourceMultiplier', resourceId: 'wood', value: 0.1 },
      { type: 'battleSustain', value: 0.05 },
    ],
  },
  {
    id: 'ember-forge',
    name: '炎脉炉契',
    requiredCount: 2,
    description: '凑齐炎脉旧器后，战阵爆发和火纹产线会同步抬升。',
    effects: [
      { type: 'battleAttack', value: 0.04 },
      { type: 'battleDefense', value: 0.04 },
    ],
  },
  {
    id: 'vault-mnemonics',
    name: '荒城秘账',
    requiredCount: 2,
    description: '掌握荒城封库的遗留账脉后，战利回流和兵势统筹会更顺畅。',
    effects: [
      { type: 'battleLoot', value: 0.05 },
      { type: 'unitPowerMultiplier', value: 0.05 },
    ],
  },
]);

function cloneEffects(effects = []) {
  return effects.map((effect) => ({ ...effect }));
}

function cloneRelicDefinition(definition) {
  return {
    ...definition,
    effects: cloneEffects(definition.effects),
  };
}

function normalizeCollectionState(collectionState = {}) {
  return {
    relicIds: [...new Set(Array.isArray(collectionState.relicIds) ? collectionState.relicIds : [])],
    routeInsight: { ...(collectionState.routeInsight ?? {}) },
    recentDiscoveries: Array.isArray(collectionState.recentDiscoveries)
      ? collectionState.recentDiscoveries.slice(0, 8).map((entry) => ({ ...entry }))
      : [],
  };
}

export function listBeastRelicDefinitions() {
  return BEAST_RELIC_DEFINITIONS.map((definition) => cloneRelicDefinition(definition));
}

export function listBeastRelicSetDefinitions() {
  return BEAST_RELIC_SET_DEFINITIONS.map((definition) => ({
    ...definition,
    effects: cloneEffects(definition.effects),
  }));
}

export function getNextBeastRelicForRoute(routeId, relicIds = []) {
  const owned = new Set(relicIds);
  return BEAST_RELIC_DEFINITIONS
    .filter((definition) => definition.routeId === routeId && !owned.has(definition.id))
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))[0] ?? null;
}

export function getBeastRelicSnapshot(collectionState = {}) {
  const normalized = normalizeCollectionState(collectionState);
  const owned = new Set(normalized.relicIds);
  const relics = BEAST_RELIC_DEFINITIONS.map((definition) => ({
    ...cloneRelicDefinition(definition),
    owned: owned.has(definition.id),
  }));
  const relicCountsBySet = relics.reduce((result, relic) => {
    if (relic.owned) {
      result[relic.setId] = (result[relic.setId] ?? 0) + 1;
    }
    return result;
  }, {});
  const sets = BEAST_RELIC_SET_DEFINITIONS.map((definition) => {
    const ownedCount = relicCountsBySet[definition.id] ?? 0;
    return {
      ...definition,
      effects: cloneEffects(definition.effects),
      ownedCount,
      active: ownedCount >= definition.requiredCount,
    };
  });
  const routeProgress = BEAST_RELIC_DEFINITIONS.reduce((result, definition) => {
    if (result[definition.routeId]) {
      return result;
    }
    const nextRelic = getNextBeastRelicForRoute(definition.routeId, normalized.relicIds);
    result[definition.routeId] = {
      routeId: definition.routeId,
      currentInsight: Math.max(Number(normalized.routeInsight?.[definition.routeId]) || 0, 0),
      nextRelic: nextRelic ? cloneRelicDefinition(nextRelic) : null,
      threshold: nextRelic?.discoveryThreshold ?? 0,
      completed: !nextRelic,
      ownedCount: relics.filter((relic) => relic.routeId === definition.routeId && relic.owned).length,
      totalCount: relics.filter((relic) => relic.routeId === definition.routeId).length,
    };
    return result;
  }, {});

  return {
    relics,
    sets,
    routeProgress,
    recentDiscoveries: normalized.recentDiscoveries.map((entry) => {
      const relic = BEAST_RELIC_DEFINITIONS.find((definition) => definition.id === entry.relicId);
      return {
        ...entry,
        relicName: relic?.name ?? entry.relicId,
        routeId: relic?.routeId ?? entry.routeId ?? null,
      };
    }),
    totalOwned: relics.filter((relic) => relic.owned).length,
    totalCount: relics.length,
  };
}

export function getBeastRelicEffects(collectionState = {}) {
  const snapshot = getBeastRelicSnapshot(collectionState);
  const relicEffects = snapshot.relics
    .filter((relic) => relic.owned)
    .flatMap((relic) => relic.effects.map((effect) => ({
      ...effect,
      source: 'beast-relic',
      sourceType: 'beast-relic',
      relicId: relic.id,
      relicName: relic.name,
    })));
  const setEffects = snapshot.sets
    .filter((setDefinition) => setDefinition.active)
    .flatMap((setDefinition) => setDefinition.effects.map((effect) => ({
      ...effect,
      source: 'beast-relic-set',
      sourceType: 'beast-relic-set',
      setId: setDefinition.id,
      setName: setDefinition.name,
    })));

  return {
    relicEffects,
    setEffects,
    all: [...relicEffects, ...setEffects],
  };
}
