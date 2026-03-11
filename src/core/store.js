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
    },
    trade: {
      unlocked: false,
      totalExchanged: 0,
      lastRouteId: null,
    },
    commissions: {
      active: null,
      completed: [],
      history: [],
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
    },
    trade: {
      ...base.trade,
      ...(savedState.trade ?? {}),
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
    },
    logs: Array.isArray(savedState.logs)
      ? savedState.logs.slice(0, 80)
      : base.logs,
  };
}
