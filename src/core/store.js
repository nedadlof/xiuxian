function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function uniqueList(values, limit = Infinity) {
  return [...new Set(Array.isArray(values) ? values : [])].slice(0, limit);
}

export function createStore(initialState) {
  let state = cloneValue(initialState);
  const subscribers = new Set();

  function getState() {
    return state;
  }

  function setState(nextState, meta = {}) {
    state = nextState;
    for (const listener of subscribers) {
      listener(state, meta);
    }
    return state;
  }

  function update(updater, meta = {}) {
    const draft = cloneValue(state);
    const result = updater(draft) ?? draft;
    return setState(result, meta);
  }

  function patch(partialState, meta = {}) {
    return setState({ ...state, ...partialState }, meta);
  }

  function subscribe(listener) {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  }

  function reset(nextState, meta = { reason: 'reset' }) {
    state = cloneValue(nextState);
    for (const listener of subscribers) {
      listener(state, meta);
    }
    return state;
  }

  return {
    getState,
    setState,
    update,
    patch,
    subscribe,
    reset,
  };
}

export function createBaseState() {
  return {
    meta: {
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastSavedAt: 0,
      lastTickAt: Date.now(),
      activeTab: 'overview',
    },
    modifiers: {
      economy: {},
      scripture: {},
      war: {},
      disciples: {},
      beasts: {},
    },
    resources: {
      lingStone: 800,
      wood: 320,
      herb: 240,
      iron: 0,
      pills: 0,
      talisman: 0,
      spiritCrystal: 0,
      dao: 9999999,
      beastShard: 0,
      discipleShard: 0,
      seekImmortalToken: 0,
      tianmingSeal: 0,
    },
    storage: {
      lingStone: 4000,
      wood: 2000,
      herb: 2000,
      iron: 1200,
      pills: 900,
      talisman: 900,
      spiritCrystal: 1200,
      dao: 9999999,
      beastShard: 9999999,
      discipleShard: 9999999,
      seekImmortalToken: 999,
      tianmingSeal: 999,
    },
    buildings: {},
    housing: {
      dormitories: [
        {
          id: 'dorm-1',
          level: 1,
          maintained: true,
        },
      ],
      maxDormitories: 1,
    },
    workforce: {
      populationCap: 25,
      totalWorkers: 12,
      assignedWorkers: {
        mine: 3,
        lumber: 2,
        herbGarden: 2,
        smithy: 0,
        alchemy: 0,
        talismanWorkshop: 0,
        scriptureHall: 1,
      },
    },
    preparations: {
      levels: {},
    },
    scripture: {
      era: '鸿蒙初开',
      unlockedNodes: [],
      cooldowns: {},
      flags: {},
      unlockedSystems: [],
    },
    war: {
      currentStageId: 'stage-mortal-1',
      trainedUnits: {},
      formationId: 'balanced-array',
      formationRows: {},
      expedition: null,
      autoPreferences: {
        strategyId: 'skill-first',
        speedId: 'normal',
      },
      currentBattle: null,
      battleReports: [],
      clearedStages: [],
    },
    disciples: {
      unlocked: [],
      owned: [],
      stationed: {},
      cooldowns: {},
      elders: [],
      modes: {},
      levels: {},
      resonance: {},
      recruit: {
        focusId: null,
        lastResult: null,
        lastBatch: [],
        history: [],
        selectedFactionId: null,
        pity: {
          advancedEpic: 0,
          advancedLegendary: 0,
        },
      },
      expeditionTeam: {
        leaderId: null,
        supportIds: [],
      },
    },
    beasts: {
      unlocked: [],
      activeIds: [],
      awakeningLevels: {},
      bondLevels: {},
      collection: {
        relicIds: [],
        routeInsight: {},
        recentDiscoveries: [],
      },
      expedition: {
        active: null,
        history: [],
      },
    },
    trade: {
      unlocked: false,
      totalExchanged: 0,
      lastRouteId: null,
    },
    warehouse: {
      seals: {},
      activeStrategyId: 'balanced-ledger',
      autoSealEnabled: false,
      nextAutoSealAt: 0,
    },
    commissions: {
      active: null,
      completed: [],
      history: [],
      boardIds: [],
      cooldowns: {},
      rerollCooldownUntil: 0,
      specialOffers: [],
      nextSpecialSpawnAt: 0,
      aftereffect: null,
      currentThemeId: null,
      currentThemeExpiresAt: 0,
      reputation: 0,
      claimedCount: 0,
      specialClaimedCount: 0,
      claimedMilestoneIds: [],
      preparationBoost: null,
      affairsCredit: 0,
      purchasedShopItemIds: [],
      caseFileProgress: {},
      caseFileOffers: [],
      resolvedCaseFileIds: [],
      autoDispatch: {
        enabled: false,
        priorityMode: 'case-first',
        autoResolveEvents: true,
        autoClaim: true,
      },
      directiveOfferIds: [],
      activeDirectiveId: null,
      activeDirectiveProgress: 0,
      directiveRewardReady: false,
      completedDirectiveCount: 0,
    },
    logs: [],
  };
}

export function normalizeState(savedState = {}) {
  const base = createBaseState();

  return {
    ...base,
    ...savedState,
    meta: {
      ...base.meta,
      ...(savedState.meta ?? {}),
      version: base.meta.version,
    },
    modifiers: {
      ...base.modifiers,
      ...(savedState.modifiers ?? {}),
    },
    resources: {
      ...base.resources,
      ...(savedState.resources ?? {}),
      dao: Math.max(savedState.resources?.dao ?? 0, base.storage.dao ?? 9999999),
    },
    storage: {
      ...base.storage,
      ...(savedState.storage ?? {}),
    },
    buildings: {
      ...(savedState.buildings ?? {}),
    },
    housing: {
      ...base.housing,
      ...(savedState.housing ?? {}),
      dormitories: Array.isArray(savedState.housing?.dormitories)
        ? savedState.housing.dormitories
        : base.housing.dormitories,
    },
    workforce: {
      ...base.workforce,
      ...(savedState.workforce ?? {}),
      assignedWorkers: {
        ...base.workforce.assignedWorkers,
        ...(savedState.workforce?.assignedWorkers ?? {}),
      },
    },
    preparations: {
      ...base.preparations,
      ...(savedState.preparations ?? {}),
      levels: {
        ...base.preparations.levels,
        ...(savedState.preparations?.levels ?? {}),
      },
    },
    scripture: {
      ...base.scripture,
      ...(savedState.scripture ?? {}),
      unlockedNodes: uniqueList(savedState.scripture?.unlockedNodes),
      cooldowns: {
        ...base.scripture.cooldowns,
        ...(savedState.scripture?.cooldowns ?? {}),
      },
      flags: {
        ...base.scripture.flags,
        ...(savedState.scripture?.flags ?? {}),
      },
      unlockedSystems: uniqueList(savedState.scripture?.unlockedSystems),
    },
    war: {
      ...base.war,
      ...(savedState.war ?? {}),
      trainedUnits: {
        ...base.war.trainedUnits,
        ...(savedState.war?.trainedUnits ?? {}),
      },
      formationRows: {
        ...base.war.formationRows,
        ...(savedState.war?.formationRows ?? {}),
      },
      autoPreferences: {
        ...base.war.autoPreferences,
        ...(savedState.war?.autoPreferences ?? {}),
      },
      currentBattle: savedState.war?.currentBattle ?? base.war.currentBattle,
      battleReports: Array.isArray(savedState.war?.battleReports)
        ? savedState.war.battleReports.slice(0, 20)
        : base.war.battleReports,
      clearedStages: uniqueList(savedState.war?.clearedStages),
    },
    disciples: {
      ...base.disciples,
      ...(savedState.disciples ?? {}),
      unlocked: uniqueList([
        ...(savedState.disciples?.unlocked ?? []),
        ...(savedState.disciples?.owned ?? []),
      ]),
      owned: uniqueList(savedState.disciples?.owned),
      stationed: {
        ...base.disciples.stationed,
        ...(savedState.disciples?.stationed ?? {}),
      },
      cooldowns: {
        ...base.disciples.cooldowns,
        ...(savedState.disciples?.cooldowns ?? {}),
      },
      elders: uniqueList(savedState.disciples?.elders),
      modes: {
        ...base.disciples.modes,
        ...(savedState.disciples?.modes ?? {}),
      },
      levels: {
        ...base.disciples.levels,
        ...(savedState.disciples?.levels ?? {}),
      },
      resonance: {
        ...base.disciples.resonance,
        ...(savedState.disciples?.resonance ?? {}),
      },
      recruit: {
        ...base.disciples.recruit,
        ...(savedState.disciples?.recruit ?? {}),
        focusId: savedState.disciples?.recruit?.focusId ?? base.disciples.recruit.focusId,
        lastResult: savedState.disciples?.recruit?.lastResult ?? base.disciples.recruit.lastResult,
        lastBatch: Array.isArray(savedState.disciples?.recruit?.lastBatch)
          ? savedState.disciples.recruit.lastBatch.slice(0, 10)
          : base.disciples.recruit.lastBatch,
        history: Array.isArray(savedState.disciples?.recruit?.history)
          ? savedState.disciples.recruit.history.slice(0, 8)
          : base.disciples.recruit.history,
        selectedFactionId: savedState.disciples?.recruit?.selectedFactionId ?? base.disciples.recruit.selectedFactionId,
        pity: {
          ...base.disciples.recruit.pity,
          ...(savedState.disciples?.recruit?.pity ?? {}),
        },
      },
      expeditionTeam: {
        ...base.disciples.expeditionTeam,
        ...(savedState.disciples?.expeditionTeam ?? {}),
        supportIds: uniqueList(savedState.disciples?.expeditionTeam?.supportIds, 2),
      },
    },
    beasts: {
      ...base.beasts,
      ...(savedState.beasts ?? {}),
      unlocked: uniqueList(savedState.beasts?.unlocked),
      activeIds: uniqueList(savedState.beasts?.activeIds, 3),
      awakeningLevels: {
        ...(savedState.beasts?.awakeningLevels ?? {}),
      },
      bondLevels: {
        ...(savedState.beasts?.bondLevels ?? {}),
      },
      collection: {
        ...base.beasts.collection,
        ...(savedState.beasts?.collection ?? {}),
        relicIds: uniqueList(savedState.beasts?.collection?.relicIds),
        routeInsight: {
          ...(savedState.beasts?.collection?.routeInsight ?? {}),
        },
        recentDiscoveries: Array.isArray(savedState.beasts?.collection?.recentDiscoveries)
          ? savedState.beasts.collection.recentDiscoveries.slice(0, 8).map((entry) => ({ ...entry }))
          : base.beasts.collection.recentDiscoveries,
      },
      expedition: {
        ...base.beasts.expedition,
        ...(savedState.beasts?.expedition ?? {}),
        history: Array.isArray(savedState.beasts?.expedition?.history)
          ? savedState.beasts.expedition.history.slice(0, 8)
          : base.beasts.expedition.history,
      },
    },
    trade: {
      ...base.trade,
      ...(savedState.trade ?? {}),
    },
    warehouse: {
      ...base.warehouse,
      ...(savedState.warehouse ?? {}),
      seals: {
        ...(savedState.warehouse?.seals ?? {}),
      },
      activeStrategyId: savedState.warehouse?.activeStrategyId ?? base.warehouse.activeStrategyId,
      autoSealEnabled: Boolean(savedState.warehouse?.autoSealEnabled ?? base.warehouse.autoSealEnabled),
      nextAutoSealAt: Math.max(Number(savedState.warehouse?.nextAutoSealAt) || 0, 0),
    },
    commissions: {
      ...base.commissions,
      ...(savedState.commissions ?? {}),
      active: savedState.commissions?.active ?? base.commissions.active,
      completed: Array.isArray(savedState.commissions?.completed)
        ? savedState.commissions.completed.slice(0, 3)
        : base.commissions.completed,
      history: Array.isArray(savedState.commissions?.history)
        ? savedState.commissions.history.slice(0, 8)
        : base.commissions.history,
      boardIds: uniqueList(savedState.commissions?.boardIds, 4),
      cooldowns: {
        ...base.commissions.cooldowns,
        ...(savedState.commissions?.cooldowns ?? {}),
      },
      rerollCooldownUntil: savedState.commissions?.rerollCooldownUntil ?? base.commissions.rerollCooldownUntil,
      specialOffers: Array.isArray(savedState.commissions?.specialOffers)
        ? savedState.commissions.specialOffers.slice(0, 2)
        : base.commissions.specialOffers,
      nextSpecialSpawnAt: savedState.commissions?.nextSpecialSpawnAt ?? base.commissions.nextSpecialSpawnAt,
      aftereffect: savedState.commissions?.aftereffect ?? base.commissions.aftereffect,
      currentThemeId: savedState.commissions?.currentThemeId ?? base.commissions.currentThemeId,
      currentThemeExpiresAt: savedState.commissions?.currentThemeExpiresAt ?? base.commissions.currentThemeExpiresAt,
      reputation: Math.max(savedState.commissions?.reputation ?? base.commissions.reputation, 0),
      claimedCount: Math.max(savedState.commissions?.claimedCount ?? base.commissions.claimedCount, 0),
      specialClaimedCount: Math.max(savedState.commissions?.specialClaimedCount ?? base.commissions.specialClaimedCount, 0),
      claimedMilestoneIds: uniqueList(savedState.commissions?.claimedMilestoneIds, 16),
      preparationBoost: savedState.commissions?.preparationBoost ?? base.commissions.preparationBoost,
      affairsCredit: Math.max(savedState.commissions?.affairsCredit ?? base.commissions.affairsCredit, 0),
      purchasedShopItemIds: uniqueList(savedState.commissions?.purchasedShopItemIds, 12),
      caseFileProgress: Object.fromEntries(
        Object.entries(savedState.commissions?.caseFileProgress ?? {})
          .map(([caseFileId, progress]) => [caseFileId, Math.max(Number(progress) || 0, 0)])
          .filter(([, progress]) => progress > 0),
      ),
      caseFileOffers: Array.isArray(savedState.commissions?.caseFileOffers)
        ? savedState.commissions.caseFileOffers
          .filter((offer) => offer?.instanceId && offer?.caseFileId)
          .slice(0, 6)
          .map((offer) => ({
            instanceId: offer.instanceId,
            caseFileId: offer.caseFileId,
            unlockedAt: offer.unlockedAt ?? 0,
          }))
        : base.commissions.caseFileOffers,
      resolvedCaseFileIds: uniqueList(savedState.commissions?.resolvedCaseFileIds, 12),
      autoDispatch: {
        ...base.commissions.autoDispatch,
        ...(savedState.commissions?.autoDispatch ?? {}),
        enabled: Boolean(savedState.commissions?.autoDispatch?.enabled ?? base.commissions.autoDispatch.enabled),
        priorityMode: savedState.commissions?.autoDispatch?.priorityMode ?? base.commissions.autoDispatch.priorityMode,
        autoResolveEvents: Boolean(
          savedState.commissions?.autoDispatch?.autoResolveEvents
            ?? base.commissions.autoDispatch.autoResolveEvents,
        ),
        autoClaim: Boolean(savedState.commissions?.autoDispatch?.autoClaim ?? base.commissions.autoDispatch.autoClaim),
      },
      directiveOfferIds: uniqueList(savedState.commissions?.directiveOfferIds, 3),
      activeDirectiveId: savedState.commissions?.activeDirectiveId ?? base.commissions.activeDirectiveId,
      activeDirectiveProgress: Math.max(
        Number(savedState.commissions?.activeDirectiveProgress ?? base.commissions.activeDirectiveProgress) || 0,
        0,
      ),
      directiveRewardReady: Boolean(
        savedState.commissions?.directiveRewardReady ?? base.commissions.directiveRewardReady,
      ),
      completedDirectiveCount: Math.max(
        Number(savedState.commissions?.completedDirectiveCount ?? base.commissions.completedDirectiveCount) || 0,
        0,
      ),
    },
    logs: Array.isArray(savedState.logs)
      ? savedState.logs.slice(0, 80)
      : base.logs,
  };
}
