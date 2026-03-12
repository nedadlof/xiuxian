import {
  applyCommissionEventOutcome,
  calculateCommissionAffairsCreditReward,
  calculateCommissionCaseFileClueGain,
  calculateCommissionReputationReward,
  evaluateCommissionTeam,
  getCommissionAffairsShopAvailability,
  getCommissionAffairsShopDefinition,
  getCommissionAffairsUpgradeEffects,
  getCommissionCaseFileAvailability,
  getCommissionCaseFileDefinition,
  getCommissionCaseFileProgress,
  getCommissionDefinition,
  getCommissionEventDefinition,
  getCommissionEventTriggerProgress,
  getCommissionMilestoneDefinition,
  getCommissionMilestoneProgress,
  getCommissionRecoveryCooldownSeconds,
  getCommissionRerollCooldownSeconds,
  getCommissionRerollCost,
  getCommissionSupplyAvailability,
  getCommissionSupplyDefinition,
  getCommissionSpecialRespawnSeconds,
  getCommissionStandingBoardSize,
  getCommissionStandingByReputation,
  getCommissionStandingProgress,
  getCommissionStandingRerollCost,
  getCommissionStandingSpecialOfferLimit,
  getCommissionThemeDefinition,
  getCommissionThemeRotationSeconds,
  getSpecialCommissionDefinition,
  isCommissionCoolingDown,
  listCommissionAffairsShopDefinitions,
  listCommissionCaseFileDefinitions,
  listCommissionDefinitions,
  listCommissionSupplyDefinitions,
  pickCommissionEventDefinition,
  rollCommissionBoard,
  rollCommissionTheme,
  rollSpecialCommissionDefinition,
} from '../data/commissions.js';
import { getExpeditionBondSnapshot } from '../data/expeditionBonds.js';
import { appendLog } from './shared/logs.js';

const COMMISSION_AUTO_PRIORITY_DEFINITIONS = Object.freeze([
  {
    id: 'case-first',
    name: '悬案优先',
    description: '优先追查已解锁的卷宗悬案，其次处理限时诏令，最后回到常驻委托。',
    sourceWeights: {
      case: 260000,
      special: 140000,
      board: 0,
    },
    speedWeight: 220,
  },
  {
    id: 'special-first',
    name: '诏令优先',
    description: '优先吃掉限时诏令窗口，再顺手处理卷宗和常驻委托。',
    sourceWeights: {
      case: 120000,
      special: 260000,
      board: 0,
    },
    speedWeight: 200,
  },
  {
    id: 'fast-cycle',
    name: '速刷循环',
    description: '优先选择收益密度更高、周转更快的委托，适合持续挂机滚动。',
    sourceWeights: {
      case: 90000,
      special: 120000,
      board: 160000,
    },
    speedWeight: 900,
  },
]);

function ensureCommissionState(state) {
  state.commissions ??= {
    active: null,
    completed: [],
    history: [],
    boardIds: [],
    cooldowns: {},
    rerollCooldownUntil: 0,
    specialOffers: [],
    nextSpecialSpawnAt: 0,
  };
  state.commissions.completed ??= [];
  state.commissions.history ??= [];
  state.commissions.boardIds ??= [];
  state.commissions.cooldowns ??= {};
  state.commissions.rerollCooldownUntil ??= 0;
  state.commissions.specialOffers ??= [];
  state.commissions.nextSpecialSpawnAt ??= 0;
  state.commissions.aftereffect ??= null;
  state.commissions.currentThemeId ??= null;
  state.commissions.currentThemeExpiresAt ??= 0;
  state.commissions.reputation ??= 0;
  state.commissions.claimedCount ??= 0;
  state.commissions.specialClaimedCount ??= 0;
  state.commissions.claimedMilestoneIds ??= [];
  state.commissions.preparationBoost ??= null;
  state.commissions.affairsCredit ??= 0;
  state.commissions.purchasedShopItemIds ??= [];
  state.commissions.caseFileProgress ??= {};
  state.commissions.caseFileOffers ??= [];
  state.commissions.resolvedCaseFileIds ??= [];
  state.commissions.autoDispatch ??= {
    enabled: false,
    priorityMode: 'case-first',
    autoResolveEvents: true,
    autoClaim: true,
  };
  state.commissions.autoDispatch.enabled ??= false;
  state.commissions.autoDispatch.priorityMode ??= 'case-first';
  state.commissions.autoDispatch.autoResolveEvents ??= true;
  state.commissions.autoDispatch.autoClaim ??= true;
}

function canAffordCost(state, cost = {}) {
  return Object.entries(cost ?? {}).every(([resourceId, amount]) => (state.resources?.[resourceId] ?? 0) >= (amount ?? 0));
}

function payCost(state, cost = {}) {
  for (const [resourceId, amount] of Object.entries(cost ?? {})) {
    state.resources[resourceId] = Math.max((state.resources?.[resourceId] ?? 0) - (amount ?? 0), 0);
  }
}

function getCurrentCommissionTheme(state) {
  return getCommissionThemeDefinition(state.commissions?.currentThemeId ?? null);
}

function getCommissionStanding(state) {
  return getCommissionStandingByReputation(state.commissions?.reputation ?? 0);
}

function getCommissionAffairsEffects(state) {
  return getCommissionAffairsUpgradeEffects(state.commissions?.purchasedShopItemIds ?? []);
}

function getCommissionSourceDefinition(sourceType = 'board', definitionId = null) {
  if (!definitionId) {
    return null;
  }

  if (sourceType === 'special') {
    return getSpecialCommissionDefinition(definitionId);
  }
  if (sourceType === 'case') {
    return getCommissionCaseFileDefinition(definitionId);
  }
  return getCommissionDefinition(definitionId);
}

function getCommissionSourceLabel(sourceType = 'board') {
  if (sourceType === 'special') {
    return '限时诏令';
  }
  if (sourceType === 'case') {
    return '卷宗悬案';
  }
  return '委托';
}

function listCommissionAutoPriorityDefinitions() {
  return COMMISSION_AUTO_PRIORITY_DEFINITIONS.map((definition) => ({
    ...definition,
    sourceWeights: {
      ...(definition.sourceWeights ?? {}),
    },
  }));
}

function getCommissionAutoPriorityDefinition(priorityMode = 'case-first') {
  return listCommissionAutoPriorityDefinitions().find((definition) => definition.id === priorityMode)
    ?? listCommissionAutoPriorityDefinitions()[0];
}

function getCommissionAutoDispatchState(state) {
  ensureCommissionState(state);
  const currentMode = getCommissionAutoPriorityDefinition(state.commissions.autoDispatch?.priorityMode);

  return {
    enabled: Boolean(state.commissions.autoDispatch?.enabled),
    autoResolveEvents: Boolean(state.commissions.autoDispatch?.autoResolveEvents),
    autoClaim: Boolean(state.commissions.autoDispatch?.autoClaim),
    priorityMode: currentMode?.id ?? 'case-first',
    currentMode,
    modes: listCommissionAutoPriorityDefinitions(),
  };
}

function getCommissionStandingSnapshot(state) {
  return {
    ...getCommissionStandingProgress(state.commissions?.reputation ?? 0),
    claimedCount: state.commissions?.claimedCount ?? 0,
    specialClaimedCount: state.commissions?.specialClaimedCount ?? 0,
    affairsCredit: state.commissions?.affairsCredit ?? 0,
  };
}

function getCommissionMilestoneSnapshot(state) {
  return getCommissionMilestoneProgress({
    reputation: state.commissions?.reputation ?? 0,
    claimedCount: state.commissions?.claimedCount ?? 0,
    specialClaimedCount: state.commissions?.specialClaimedCount ?? 0,
  }, state.commissions?.claimedMilestoneIds ?? []);
}

function getCommissionBoardSizeForState(state) {
  return getCommissionStandingBoardSize(state.commissions?.reputation ?? 0)
    + Math.max(getCommissionAffairsEffects(state).boardSizeBonus ?? 0, 0);
}

function getCommissionSpecialOfferLimitForState(state) {
  return getCommissionStandingSpecialOfferLimit(state.commissions?.reputation ?? 0)
    + Math.max(getCommissionAffairsEffects(state).specialOfferLimitBonus ?? 0, 0);
}

function getCommissionRerollCostForState(state) {
  const standingCost = getCommissionStandingRerollCost(state.commissions?.reputation ?? 0);
  const extraDiscount = Math.max(0, Math.min(getCommissionAffairsEffects(state).rerollDiscountBonus ?? 0, 0.7));
  return Object.fromEntries(
    Object.entries(standingCost).map(([resourceId, amount]) => [
      resourceId,
      Math.max(1, Math.round((amount ?? 0) * (1 - extraDiscount))),
    ]),
  );
}

function getCommissionSpecialRespawnSecondsForState(state) {
  const base = getCommissionSpecialRespawnSeconds();
  const multiplier = Math.max(getCommissionAffairsEffects(state).specialRespawnMultiplier ?? 1, 0.4);
  return Math.max(Math.round(base * multiplier), 30);
}

function ensureCommissionTheme(state, now = Date.now()) {
  ensureCommissionState(state);
  const currentTheme = getCurrentCommissionTheme(state);
  const themeStillActive = currentTheme && (state.commissions.currentThemeExpiresAt ?? 0) > now;
  if (themeStillActive) {
    return currentTheme;
  }

  const nextTheme = rollCommissionTheme({
    excludeIds: currentTheme ? [currentTheme.id] : [],
  });
  if (!nextTheme) {
    state.commissions.currentThemeId = null;
    state.commissions.currentThemeExpiresAt = now + (getCommissionThemeRotationSeconds() * 1000);
    return null;
  }

  state.commissions.currentThemeId = nextTheme.id;
  state.commissions.currentThemeExpiresAt = now + ((nextTheme.durationSeconds ?? getCommissionThemeRotationSeconds()) * 1000);
  return nextTheme;
}

function getCommissionRollPreferredTags(state, sourceType = 'board', now = Date.now()) {
  const theme = ensureCommissionTheme(state, now);
  const themeTags = sourceType === 'special'
    ? [...new Set([...(theme?.preferredTags ?? []), ...(theme?.specialPreferredTags ?? [])])]
    : [...(theme?.preferredTags ?? [])];
  const aftereffectActive = sourceType === 'special'
    ? (state.commissions.aftereffect?.remainingSpecialSpawns ?? 0) > 0
    : (state.commissions.aftereffect?.remainingBoardRefreshes ?? 0) > 0;
  const aftereffectTags = aftereffectActive ? (state.commissions.aftereffect?.preferredTags ?? []) : [];
  return [...new Set([...themeTags, ...aftereffectTags])];
}

function refreshCommissionBoard(state, { preferFresh = false, lockedIds = [], now = Date.now() } = {}) {
  ensureCommissionState(state);
  const preferredTags = getCommissionRollPreferredTags(state, 'board', now);
  state.commissions.boardIds = rollCommissionBoard({
    cooldowns: state.commissions.cooldowns,
    excludeIds: preferFresh ? state.commissions.boardIds : [],
    lockedIds,
    preferredTags,
    boardSize: getCommissionBoardSizeForState(state),
    now,
  });
  if (state.commissions.aftereffect?.remainingBoardRefreshes > 0) {
    state.commissions.aftereffect.remainingBoardRefreshes -= 1;
    if ((state.commissions.aftereffect.remainingBoardRefreshes ?? 0) <= 0
      && (state.commissions.aftereffect.remainingSpecialSpawns ?? 0) <= 0) {
      state.commissions.aftereffect = null;
    }
  }
  return state.commissions.boardIds;
}

function sanitizeBoard(state, now = Date.now()) {
  ensureCommissionState(state);
  const desiredSize = getCommissionBoardSizeForState(state);
  const currentIds = [...new Set((state.commissions.boardIds ?? []).filter(Boolean))].slice(0, desiredSize);

  if (currentIds.length !== desiredSize) {
    state.commissions.boardIds = currentIds;
    refreshCommissionBoard(state, {
      preferFresh: currentIds.length > 0,
      lockedIds: state.commissions.active?.definitionId ? [state.commissions.active.definitionId] : [],
      now,
    });
    return;
  }

  state.commissions.boardIds = currentIds;
}

function refreshCommissionCaseFileOffers(state, now = Date.now()) {
  ensureCommissionState(state);
  const standing = getCommissionStanding(state);
  const existingOffers = state.commissions.caseFileOffers ?? [];
  const activeCaseId = state.commissions.active?.sourceType === 'case'
    ? state.commissions.active.definitionId
    : null;
  const completedCaseIds = new Set(
    (state.commissions.completed ?? [])
      .filter((entry) => entry.sourceType === 'case')
      .map((entry) => entry.definitionId),
  );
  const offeredIds = existingOffers.map((offer) => offer.caseFileId);

  state.commissions.caseFileOffers = getCommissionCaseFileProgress(state.commissions.caseFileProgress ?? {}, {
    standing,
    resolvedIds: state.commissions.resolvedCaseFileIds ?? [],
    offeredIds,
  })
    .filter((entry) => entry.ready && !entry.resolved)
    .filter((entry) => entry.id !== activeCaseId && !completedCaseIds.has(entry.id))
    .map((entry) => {
      const existing = existingOffers.find((offer) => offer.caseFileId === entry.id);
      return existing ?? {
        instanceId: `case-${entry.id}-${now}`,
        caseFileId: entry.id,
        unlockedAt: now,
      };
    });

  return state.commissions.caseFileOffers;
}

function buildExpeditionTeamSnapshot(state, registries) {
  const orderedIds = [
    state.disciples?.expeditionTeam?.leaderId ?? null,
    ...(state.disciples?.expeditionTeam?.supportIds ?? []),
  ].filter(Boolean);
  const seen = new Set();
  const members = orderedIds
    .filter((discipleId) => {
      if (seen.has(discipleId)) {
        return false;
      }
      seen.add(discipleId);
      return true;
    })
    .map((discipleId) => {
      const disciple = registries.disciples.get(discipleId);
      if (!disciple) {
        return null;
      }
      return {
        id: disciple.id,
        name: disciple.name,
        rarity: disciple.rarity,
        faction: disciple.faction ?? null,
        station: disciple.station ?? null,
        expeditionEffectTypes: [...new Set((disciple.modifiers?.expedition ?? []).map((effect) => effect.type).filter(Boolean))],
        level: state.disciples?.levels?.[discipleId] ?? 1,
        resonanceLevel: state.disciples?.resonance?.[discipleId] ?? 0,
        elder: (state.disciples?.elders ?? []).includes(discipleId),
      };
    })
    .filter(Boolean);

  return {
    members,
    bonds: getExpeditionBondSnapshot(members),
  };
}

function buildCommissionRecord(definition, teamSnapshot, evaluation, {
  now = Date.now(),
  sourceType = 'board',
  sourceInstanceId = null,
  remainingSeconds = definition.durationSeconds,
} = {}) {
  return {
    id: `commission-${definition.id}-${now}`,
    definitionId: definition.id,
    sourceType,
    sourceInstanceId,
    name: definition.name,
    description: definition.description,
    eventLabel: definition.eventLabel ?? null,
    eventType: definition.eventType ?? null,
    durationSeconds: definition.durationSeconds,
    remainingSeconds,
    startedAt: now,
    completedAt: null,
    claimedAt: null,
    interruptedAt: null,
    resultType: 'active',
    eventState: {
      triggerProgress: getCommissionEventTriggerProgress(),
      resolvedEvents: [],
      pendingEvent: null,
    },
    teamSnapshot,
    evaluation,
    themeId: evaluation?.themeId ?? null,
    themeName: evaluation?.themeName ?? null,
  };
}

function updateCommissionProgress(commission, deltaSeconds) {
  return {
    ...commission,
    remainingSeconds: Math.max((commission.remainingSeconds ?? commission.durationSeconds ?? 0) - deltaSeconds, 0),
  };
}

function getCommissionProgressRatio(commission = {}) {
  const total = Math.max(commission.durationSeconds ?? 1, 1);
  const remaining = Math.max(commission.remainingSeconds ?? total, 0);
  return Math.max(0, Math.min((total - remaining) / total, 1));
}

function hasActiveCommission(state) {
  return Boolean(state.commissions?.active);
}

function addRewardToState(state, reward = {}) {
  for (const [resourceId, amount] of Object.entries(reward ?? {})) {
    state.resources[resourceId] = (state.resources[resourceId] ?? 0) + amount;
  }
}

function setCommissionCooldown(state, definitionId, resultType = 'complete', now = Date.now()) {
  const cooldownSeconds = getCommissionRecoveryCooldownSeconds(resultType);
  state.commissions.cooldowns[definitionId] = now + (cooldownSeconds * 1000);
}

function buildHistoryEntry(record, extra = {}) {
  return {
    ...record,
    ...extra,
  };
}

function getCommissionReputationReward(definition, evaluation, state, sourceType = 'board') {
  return calculateCommissionReputationReward(definition, evaluation, {
    sourceType,
    standing: getCommissionStanding(state),
    reputation: state.commissions?.reputation ?? 0,
  });
}

function getCommissionAffairsCreditReward(definition, evaluation, state, sourceType = 'board') {
  return calculateCommissionAffairsCreditReward(definition, evaluation, {
    sourceType,
    affairsCreditBonus: getCommissionAffairsEffects(state).affairsCreditBonus ?? 0,
  });
}

function awardCommissionCaseFileProgress(state, completed, definition, now = Date.now()) {
  const sourceDefinition = definition ?? getCommissionSourceDefinition(completed?.sourceType, completed?.definitionId) ?? completed;
  if (!sourceDefinition) {
    refreshCommissionCaseFileOffers(state, now);
    return;
  }

  const readyNow = [];
  const waitingStanding = [];
  const progressMap = state.commissions.caseFileProgress ?? {};

  for (const caseDefinition of listCommissionCaseFileDefinitions()) {
    const availability = getCommissionCaseFileAvailability(
      caseDefinition,
      getCommissionStanding(state),
      progressMap[caseDefinition.id] ?? 0,
      state.commissions.resolvedCaseFileIds ?? [],
      (state.commissions.caseFileOffers ?? []).map((offer) => offer.caseFileId),
    );
    if (availability.resolved) {
      continue;
    }

    const clueGain = calculateCommissionCaseFileClueGain(caseDefinition, sourceDefinition, {
      sourceType: completed?.sourceType ?? 'board',
      evaluation: completed?.evaluation ?? {},
    });
    if (clueGain <= 0) {
      continue;
    }

    const nextProgress = Math.min(availability.progress + clueGain, availability.requiredProgress);
    if (nextProgress <= availability.progress) {
      continue;
    }

    state.commissions.caseFileProgress[caseDefinition.id] = nextProgress;
    if (availability.progress < availability.requiredProgress && nextProgress >= availability.requiredProgress) {
      if (availability.unlocked) {
        readyNow.push(caseDefinition.name);
      } else if (availability.requiredStanding?.name) {
        waitingStanding.push(`${caseDefinition.name}（待晋升 ${availability.requiredStanding.name}）`);
      }
    }
  }

  refreshCommissionCaseFileOffers(state, now);
  readyNow.forEach((name) => appendLog(state, 'missions', `卷宗线索汇齐：${name}`));
  waitingStanding.forEach((name) => appendLog(state, 'missions', `卷宗线索已齐备：${name}`));
}

function buildPreparationBoostState(definition = {}) {
  const effect = definition.effect ?? {};
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    durationMultiplier: Number(effect.nextDurationMultiplier) || 1,
    scoreBonus: Number(effect.nextScoreBonus) || 0,
    rewardBonus: { ...(effect.nextRewardBonus ?? {}) },
  };
}

function applyPreparationBoostToEvaluation(definition = {}, evaluation = {}, boost = null) {
  if (!boost) {
    return evaluation;
  }

  return applyCommissionEventOutcome(definition, evaluation, {
    effect: {
      scoreBonus: Number(boost.scoreBonus) || 0,
      rewardBonus: { ...(boost.rewardBonus ?? {}) },
    },
  });
}

function trimHistory(state) {
  state.commissions.completed = state.commissions.completed.slice(0, 3);
  state.commissions.history = state.commissions.history.slice(0, 8);
}

function accumulateRewardMaps(items = [], selector = (item) => item) {
  const merged = {};

  for (const item of items) {
    for (const [resourceId, amount] of Object.entries(selector(item) ?? {})) {
      merged[resourceId] = (merged[resourceId] ?? 0) + amount;
    }
  }

  return Object.fromEntries(Object.entries(merged).filter(([, amount]) => amount > 0));
}

function buildPendingCommissionEvent(active, definition, now = Date.now()) {
  const resolvedEventIds = active.eventState?.resolvedEvents?.map((entry) => entry.eventId) ?? [];
  const eventDefinition = pickCommissionEventDefinition({
    definition,
    sourceType: active.sourceType ?? 'board',
    usedEventIds: resolvedEventIds,
  });
  if (!eventDefinition) {
    return null;
  }

  return {
    id: `event-${eventDefinition.id}-${now}`,
    eventId: eventDefinition.id,
    name: eventDefinition.name,
    description: eventDefinition.description,
    options: eventDefinition.options.map((option, index) => ({
      ...option,
      default: index === 0,
    })),
    triggeredAt: now,
  };
}

function applyCommissionEventOption(active, definition, option = {}, now = Date.now()) {
  const multiplier = Number(option.effect?.remainingSecondsMultiplier) || 1;
  const nextRemainingSeconds = Math.max(Math.round((active.remainingSeconds ?? 0) * multiplier), 1);
  const nextEvaluation = applyCommissionEventOutcome(definition, active.evaluation, option);
  const resolvedEntry = {
    eventId: active.eventState?.pendingEvent?.eventId ?? option.eventId ?? null,
    eventName: active.eventState?.pendingEvent?.name ?? null,
    optionId: option.id,
    optionLabel: option.label,
    resolvedAt: now,
  };

  return {
    ...active,
    remainingSeconds: nextRemainingSeconds,
    evaluation: nextEvaluation,
    eventState: {
      ...(active.eventState ?? {}),
      pendingEvent: null,
      resolvedEvents: [...(active.eventState?.resolvedEvents ?? []), resolvedEntry],
    },
  };
}

function buildAftereffectState(option = {}, eventName = '') {
  const aftereffect = option.effect?.aftereffect;
  if (!aftereffect) {
    return null;
  }

  return {
    ...aftereffect,
    sourceEventName: eventName,
    preferredTags: [...(aftereffect.preferredTags ?? [])],
    remainingBoardRefreshes: Math.max(aftereffect.remainingBoardRefreshes ?? 0, 0),
    remainingSpecialSpawns: Math.max(aftereffect.remainingSpecialSpawns ?? 0, 0),
  };
}

function maybeTriggerCommissionEvent(active, definition, now = Date.now()) {
  if (!active || active.eventState?.pendingEvent) {
    return active;
  }
  if ((active.eventState?.resolvedEvents?.length ?? 0) > 0) {
    return active;
  }
  if (getCommissionProgressRatio(active) < (active.eventState?.triggerProgress ?? getCommissionEventTriggerProgress())) {
    return active;
  }

  const pendingEvent = buildPendingCommissionEvent(active, definition, now);
  if (!pendingEvent) {
    return active;
  }

  return {
    ...active,
    eventState: {
      ...(active.eventState ?? {}),
      pendingEvent,
    },
  };
}

function removeSpecialOffer(state, instanceId) {
  state.commissions.specialOffers = (state.commissions.specialOffers ?? []).filter((offer) => offer.instanceId !== instanceId);
}

function spawnSpecialOffer(state, now = Date.now()) {
  ensureCommissionState(state);
  const currentOffers = state.commissions.specialOffers ?? [];
  const offerLimit = getCommissionSpecialOfferLimitForState(state);
  if (currentOffers.length >= offerLimit) {
    return null;
  }

  const definition = rollSpecialCommissionDefinition({
    excludeIds: currentOffers.map((offer) => offer.definitionId),
    preferredTags: getCommissionRollPreferredTags(state, 'special', now),
  });
  if (!definition) {
    return null;
  }

  const offer = {
    instanceId: `special-${definition.id}-${now}`,
    definitionId: definition.id,
    eventType: definition.eventType ?? 'special',
    eventLabel: definition.eventLabel ?? '限时诏令',
    spawnedAt: now,
    expiresAt: now + ((definition.expiresSeconds ?? 240) * 1000),
  };
  state.commissions.specialOffers.push(offer);
  state.commissions.specialOffers = state.commissions.specialOffers.slice(0, offerLimit);
  state.commissions.nextSpecialSpawnAt = now + (getCommissionSpecialRespawnSecondsForState(state) * 1000);
  if (state.commissions.aftereffect?.remainingSpecialSpawns > 0) {
    state.commissions.aftereffect.remainingSpecialSpawns -= 1;
    if ((state.commissions.aftereffect.remainingBoardRefreshes ?? 0) <= 0
      && (state.commissions.aftereffect.remainingSpecialSpawns ?? 0) <= 0) {
      state.commissions.aftereffect = null;
    }
  }
  return offer;
}

function updateSpecialOffers(state, now = Date.now()) {
  ensureCommissionState(state);
  const offerLimit = getCommissionSpecialOfferLimitForState(state);
  const beforeOffers = [...(state.commissions.specialOffers ?? [])];
  const expiredOffers = beforeOffers.filter((offer) => (offer.expiresAt ?? 0) <= now);

  if (expiredOffers.length) {
    state.commissions.specialOffers = beforeOffers.filter((offer) => (offer.expiresAt ?? 0) > now);
    if ((state.commissions.nextSpecialSpawnAt ?? 0) <= now) {
      state.commissions.nextSpecialSpawnAt = now + (getCommissionSpecialRespawnSecondsForState(state) * 1000);
    }
    for (const offer of expiredOffers) {
      const definition = getSpecialCommissionDefinition(offer.definitionId);
      appendLog(state, 'missions', `限时诏令消散：${definition?.name ?? offer.definitionId}`);
    }
  }

  if ((state.commissions.specialOffers?.length ?? 0) < offerLimit
    && (state.commissions.nextSpecialSpawnAt ?? 0) <= now) {
    const spawned = spawnSpecialOffer(state, now);
    if (spawned) {
      const definition = getSpecialCommissionDefinition(spawned.definitionId);
      appendLog(state, 'missions', `限时诏令出现：${definition?.name ?? spawned.definitionId}`);
    }
  }
}

function getCommissionRewardMapValue(reward = {}) {
  const weights = {
    dao: 1,
    lingStone: 3,
    spiritCrystal: 55,
    herb: 1,
    wood: 1,
    iron: 1.2,
    pills: 12,
    talisman: 16,
    discipleShard: 20,
    tianmingSeal: 260,
    seekImmortalToken: 180,
  };

  return Object.entries(reward ?? {}).reduce((sum, [resourceId, amount]) => (
    sum + ((weights[resourceId] ?? 2) * (amount ?? 0))
  ), 0);
}

function getCommissionAutoDispatchCandidateScore(candidate = {}, autoDispatch = {}) {
  const sourceWeight = autoDispatch.currentMode?.sourceWeights?.[candidate.sourceType ?? 'board'] ?? 0;
  const rewardValue = getCommissionRewardMapValue(candidate.evaluation?.totalReward ?? candidate.reward ?? {});
  const metaValue = ((candidate.reputationReward ?? 0) * 180)
    + ((candidate.affairsCreditReward ?? 0) * 220)
    + (candidate.evaluation?.totalScore ?? 0)
    + ((candidate.evaluation?.matchCount ?? 0) * 40);
  const duration = Math.max(candidate.durationSeconds ?? 1, 1);
  const speedValue = ((rewardValue + metaValue) / duration) * (autoDispatch.currentMode?.speedWeight ?? 0);
  const urgencyValue = candidate.sourceType === 'special'
    ? Math.max(300 - (candidate.expiresInSeconds ?? 300), 0) * 120
    : 0;

  return sourceWeight + rewardValue + metaValue + speedValue + urgencyValue;
}

function pickCommissionAutoDispatchTarget(snapshot = {}, autoDispatch = {}) {
  const candidates = [
    ...(snapshot.caseFiles ?? [])
      .filter((caseFile) => caseFile.canStart)
      .map((caseFile) => ({
        ...caseFile,
        dispatchId: caseFile.instanceId,
        sourceType: 'case',
      })),
    ...(snapshot.specialOffers ?? [])
      .filter((offer) => offer.canStart)
      .map((offer) => ({
        ...offer,
        dispatchId: offer.instanceId,
        sourceType: 'special',
      })),
    ...(snapshot.available ?? [])
      .filter((mission) => mission.canStart)
      .map((mission) => ({
        ...mission,
        dispatchId: mission.id,
        sourceType: 'board',
      })),
  ];

  return candidates
    .map((candidate) => ({
      ...candidate,
      autoScore: getCommissionAutoDispatchCandidateScore(candidate, autoDispatch),
    }))
    .sort((left, right) => right.autoScore - left.autoScore)[0] ?? null;
}

function resolveCommissionEventInState(state, optionId, { now = Date.now(), origin = 'manual' } = {}) {
  ensureCommissionState(state);
  ensureCommissionTheme(state);
  const active = state.commissions.active;
  const pendingEvent = active?.eventState?.pendingEvent;
  if (!active || !pendingEvent) {
    return false;
  }

  const definition = getCommissionSourceDefinition(active.sourceType, active.definitionId);
  if (!definition) {
    return false;
  }

  const pickedOption = pendingEvent.options?.find((option) => option.id === optionId);
  if (!pickedOption) {
    return false;
  }

  state.commissions.active = applyCommissionEventOption(active, definition, pickedOption, now);
  const aftereffect = buildAftereffectState(pickedOption, pendingEvent.name);
  if (aftereffect) {
    state.commissions.aftereffect = aftereffect;
    if ((aftereffect.specialSpawnAdvanceSeconds ?? 0) > 0) {
      const advanceMs = aftereffect.specialSpawnAdvanceSeconds * 1000;
      state.commissions.nextSpecialSpawnAt = Math.max(
        now,
        (state.commissions.nextSpecialSpawnAt ?? now) - advanceMs,
      );
    }
  }

  const prefix = origin === 'auto' ? '委托排程自动抉择' : '委托事件抉择';
  appendLog(state, 'missions', `${prefix}：${pendingEvent.name} · ${pickedOption.label}`);
  return true;
}

function startCommissionInState(state, registries, commissionId, { now = Date.now(), origin = 'manual' } = {}) {
  ensureCommissionState(state);
  const theme = ensureCommissionTheme(state, now);
  sanitizeBoard(state, now);
  updateSpecialOffers(state, now);
  refreshCommissionCaseFileOffers(state, now);
  if (hasActiveCommission(state)) {
    return false;
  }

  const specialOffer = (state.commissions.specialOffers ?? []).find((offer) => offer.instanceId === commissionId);
  const caseOffer = (state.commissions.caseFileOffers ?? []).find((offer) => offer.instanceId === commissionId);
  const sourceType = specialOffer ? 'special' : (caseOffer ? 'case' : 'board');
  const definition = specialOffer
    ? getSpecialCommissionDefinition(specialOffer.definitionId)
    : (caseOffer ? getCommissionCaseFileDefinition(caseOffer.caseFileId) : getCommissionDefinition(commissionId));

  if (!definition) {
    return false;
  }
  if (!specialOffer && !caseOffer && !(state.commissions.boardIds ?? []).includes(commissionId)) {
    return false;
  }
  if (!specialOffer && !caseOffer && isCommissionCoolingDown(state.commissions.cooldowns, commissionId, now)) {
    return false;
  }
  if (specialOffer && (specialOffer.expiresAt ?? 0) <= now) {
    return false;
  }
  if (caseOffer && (state.commissions.resolvedCaseFileIds ?? []).includes(caseOffer.caseFileId)) {
    refreshCommissionCaseFileOffers(state, now);
    return false;
  }

  const teamSnapshot = buildExpeditionTeamSnapshot(state, registries);
  if (!teamSnapshot.members.length) {
    return false;
  }

  const preparationBoost = state.commissions.preparationBoost;
  let evaluation = evaluateCommissionTeam(teamSnapshot, definition, {
    theme,
    sourceType,
  });
  evaluation = applyPreparationBoostToEvaluation(definition, evaluation, preparationBoost);
  const durationMultiplier = Number(preparationBoost?.durationMultiplier) || 1;
  const remainingSeconds = Math.max(Math.round((definition.durationSeconds ?? 1) * durationMultiplier), 1);
  state.commissions.active = buildCommissionRecord(definition, teamSnapshot, evaluation, {
    now,
    sourceType,
    sourceInstanceId: specialOffer?.instanceId ?? caseOffer?.instanceId ?? null,
    remainingSeconds,
  });
  state.commissions.preparationBoost = null;

  if (specialOffer) {
    removeSpecialOffer(state, specialOffer.instanceId);
    state.commissions.nextSpecialSpawnAt = now + (getCommissionSpecialRespawnSecondsForState(state) * 1000);
    appendLog(state, 'missions', `${origin === 'auto' ? '委托排程自动接取' : '已接取'}限时诏令：${definition.name}`);
  } else if (caseOffer) {
    state.commissions.caseFileOffers = (state.commissions.caseFileOffers ?? []).filter((offer) => offer.instanceId !== caseOffer.instanceId);
    appendLog(state, 'missions', `${origin === 'auto' ? '委托排程自动接取' : '已接取'}卷宗悬案：${definition.name}`);
  } else {
    appendLog(state, 'missions', `${origin === 'auto' ? '委托排程自动派遣' : '已派出'}委托：${definition.name}`);
  }

  return true;
}

function claimCommissionRewardInState(state, commissionId, { now = Date.now(), origin = 'manual' } = {}) {
  ensureCommissionState(state);
  ensureCommissionTheme(state, now);
  refreshCommissionCaseFileOffers(state, now);
  const targetIndex = state.commissions.completed.findIndex((item) => item.id === commissionId);
  if (targetIndex < 0) {
    return false;
  }

  const completed = state.commissions.completed[targetIndex];
  const definition = getCommissionSourceDefinition(completed.sourceType, completed.definitionId);
  const reputationReward = completed.reputationReward
    ?? getCommissionReputationReward(definition ?? completed, completed.evaluation ?? {}, state, completed.sourceType);
  const affairsCreditReward = completed.affairsCreditReward
    ?? getCommissionAffairsCreditReward(definition ?? completed, completed.evaluation ?? {}, state, completed.sourceType);
  addRewardToState(state, completed.evaluation?.totalReward ?? {});
  state.commissions.reputation = (state.commissions.reputation ?? 0) + reputationReward;
  state.commissions.affairsCredit = (state.commissions.affairsCredit ?? 0) + affairsCreditReward;
  state.commissions.claimedCount = (state.commissions.claimedCount ?? 0) + 1;
  if (completed.sourceType === 'special') {
    state.commissions.specialClaimedCount = (state.commissions.specialClaimedCount ?? 0) + 1;
  }
  awardCommissionCaseFileProgress(state, completed, definition, now);
  sanitizeBoard(state, now);
  updateSpecialOffers(state, now);
  state.commissions.completed.splice(targetIndex, 1);
  state.commissions.history.unshift(buildHistoryEntry(completed, {
    claimedAt: now,
    resultType: completed.resultType ?? 'completed',
    reputationReward,
    affairsCreditReward,
  }));
  trimHistory(state);
  appendLog(
    state,
    'missions',
    `${origin === 'auto' ? '委托排程自动结算' : '已结算'}${getCommissionSourceLabel(completed.sourceType)}：${completed.name}`,
  );
  return true;
}

function shouldRunCommissionAutomation(source = 'runtime') {
  return source !== 'offline';
}

function runCommissionAutomation(state, registries, source = 'runtime', now = Date.now()) {
  if (!shouldRunCommissionAutomation(source)) {
    return false;
  }

  const autoDispatch = getCommissionAutoDispatchState(state);
  if (!autoDispatch.enabled) {
    return false;
  }

  let changed = false;
  const active = state.commissions.active;

  if (active?.eventState?.pendingEvent && autoDispatch.autoResolveEvents) {
    const defaultOption = active.eventState.pendingEvent.options?.find((option) => option.default)
      ?? active.eventState.pendingEvent.options?.[0];
    if (defaultOption) {
      changed = resolveCommissionEventInState(state, defaultOption.id, { now, origin: 'auto' }) || changed;
    }
  }

  if (!hasActiveCommission(state) && autoDispatch.autoClaim && (state.commissions.completed?.length ?? 0) > 0) {
    const pending = state.commissions.completed?.[0];
    if (pending) {
      changed = claimCommissionRewardInState(state, pending.id, { now, origin: 'auto' }) || changed;
    }
  }

  if (!hasActiveCommission(state) && (state.commissions.completed?.length ?? 0) === 0) {
    const snapshot = getCommissionSnapshot(state, registries);
    const target = pickCommissionAutoDispatchTarget(snapshot, autoDispatch);
    if (target?.dispatchId) {
      changed = startCommissionInState(state, registries, target.dispatchId, { now, origin: 'auto' }) || changed;
    }
  }

  return changed;
}

export function createCommissionSystem() {
  return {
    id: 'commission-system',
    setup({ store, bus, registries }) {
      store.update((draft) => {
        ensureCommissionState(draft);
        ensureCommissionTheme(draft);
        sanitizeBoard(draft);
        updateSpecialOffers(draft);
        refreshCommissionCaseFileOffers(draft);
      }, { type: 'commissions/setup' });

      bus.on('action:commissions/start', ({ commissionId }) => {
        startCommission({ store, registries }, commissionId);
      });

      bus.on('action:commissions/claim', ({ commissionId }) => {
        claimCommissionReward({ store }, commissionId);
      });

      bus.on('action:commissions/cancel', () => {
        interruptCommission({ store });
      });

      bus.on('action:commissions/reroll', () => {
        rerollCommissionBoard({ store });
      });

      bus.on('action:commissions/resolve-event', ({ optionId }) => {
        resolveCommissionEvent({ store }, optionId);
      });

      bus.on('action:commissions/claim-milestone', ({ milestoneId }) => {
        claimCommissionMilestoneReward({ store }, milestoneId);
      });

      bus.on('action:commissions/procure', ({ supplyId }) => {
        purchaseCommissionSupply({ store }, supplyId);
      });

      bus.on('action:commissions/purchase-shop-item', ({ itemId }) => {
        purchaseCommissionAffairsShopItem({ store }, itemId);
      });

      bus.on('action:commissions/toggle-auto-dispatch', () => {
        toggleCommissionAutoDispatch({ store });
      });

      bus.on('action:commissions/cycle-auto-priority', () => {
        cycleCommissionAutoPriorityMode({ store });
      });

      bus.on('action:commissions/toggle-auto-resolve-events', () => {
        toggleCommissionAutoResolveEvents({ store });
      });
    },
    tick({ store, registries }, deltaSeconds, source = 'runtime') {
      store.update((draft) => {
        ensureCommissionState(draft);
        const now = Date.now();
        ensureCommissionTheme(draft, now);
        sanitizeBoard(draft, now);
        updateSpecialOffers(draft, now);
        refreshCommissionCaseFileOffers(draft, now);
        runCommissionAutomation(draft, registries, source, now);
        const active = draft.commissions.active;
        if (!active) {
          return;
        }

        const definition = getCommissionSourceDefinition(active.sourceType, active.definitionId);
        if (!definition) {
          draft.commissions.active = null;
          return;
        }

        if (active.eventState?.pendingEvent) {
          if (source !== 'runtime') {
            const defaultOption = active.eventState.pendingEvent.options?.find((option) => option.default)
              ?? active.eventState.pendingEvent.options?.[0];
            if (defaultOption) {
              resolveCommissionEventInState(draft, defaultOption.id, { now, origin: 'auto' });
            }
          }
          return;
        }

        const next = updateCommissionProgress(active, deltaSeconds);
        const withEvent = maybeTriggerCommissionEvent(next, definition, now);
        if (withEvent.eventState?.pendingEvent) {
          draft.commissions.active = withEvent;
          appendLog(draft, 'missions', `委托途中事件：${withEvent.eventState.pendingEvent.name}`);
          if (source !== 'runtime') {
            const defaultOption = withEvent.eventState.pendingEvent.options?.find((option) => option.default)
              ?? withEvent.eventState.pendingEvent.options?.[0];
            if (defaultOption) {
              draft.commissions.active = applyCommissionEventOption(withEvent, definition, defaultOption, now);
              appendLog(draft, 'missions', `离线代行事件抉择：${withEvent.eventState.pendingEvent.name} · ${defaultOption.label}`);
            }
          }
          return;
        }

        if (next.remainingSeconds > 0) {
          draft.commissions.active = next;
          return;
        }

        draft.commissions.active = null;
        const completed = {
          ...next,
          remainingSeconds: 0,
          completedAt: now,
          resultType: 'completed',
          reputationReward: getCommissionReputationReward(definition, next.evaluation, draft, next.sourceType),
          affairsCreditReward: getCommissionAffairsCreditReward(definition, next.evaluation, draft, next.sourceType),
        };
        draft.commissions.completed.unshift(completed);
        if (completed.sourceType === 'board') {
          setCommissionCooldown(draft, completed.definitionId, 'complete', now);
          refreshCommissionBoard(draft, {
            preferFresh: true,
            lockedIds: [completed.definitionId],
            now,
          });
        } else if (completed.sourceType === 'special'
          && (draft.commissions.specialOffers?.length ?? 0) < getCommissionSpecialOfferLimitForState(draft)) {
          draft.commissions.nextSpecialSpawnAt = Math.min(
            draft.commissions.nextSpecialSpawnAt ?? Infinity,
            now + (getCommissionSpecialRespawnSecondsForState(draft) * 1000),
          );
        } else if (completed.sourceType === 'case') {
          draft.commissions.resolvedCaseFileIds = [...new Set([
            ...(draft.commissions.resolvedCaseFileIds ?? []),
            completed.definitionId,
          ])];
          refreshCommissionCaseFileOffers(draft, now);
        }
        trimHistory(draft);
        appendLog(draft, 'missions', `${getCommissionSourceLabel(completed.sourceType, completed.evaluation)}完成：${completed.name}`);
        runCommissionAutomation(draft, registries, source, now);
      }, { type: 'commissions/tick', deltaSeconds });
    },
  };
}

export function startCommission({ store, registries }, commissionId) {
  let success = false;

  store.update((draft) => {
    success = startCommissionInState(draft, registries, commissionId, { now: Date.now(), origin: 'manual' });
  }, { type: 'commissions/start', commissionId });

  return success;
}

export function claimCommissionReward({ store }, commissionId) {
  let success = false;

  store.update((draft) => {
    success = claimCommissionRewardInState(draft, commissionId, { now: Date.now(), origin: 'manual' });
  }, { type: 'commissions/claim', commissionId });

  return success;
}

export function claimCommissionMilestoneReward({ store }, milestoneId) {
  let success = false;

  store.update((draft) => {
    ensureCommissionState(draft);
    ensureCommissionTheme(draft);
    const milestone = getCommissionMilestoneDefinition(milestoneId);
    if (!milestone) {
      return;
    }
    if ((draft.commissions.claimedMilestoneIds ?? []).includes(milestoneId)) {
      return;
    }

    const milestoneSnapshot = getCommissionMilestoneSnapshot(draft);
    const target = milestoneSnapshot.find((entry) => entry.id === milestoneId);
    if (!target?.claimable) {
      return;
    }

    addRewardToState(draft, target.reward ?? {});
    draft.commissions.claimedMilestoneIds = [...new Set([...(draft.commissions.claimedMilestoneIds ?? []), milestoneId])];
    appendLog(draft, 'missions', `已领取委派里程碑：${target.name}`);
    success = true;
  }, { type: 'commissions/claim-milestone', milestoneId });

  return success;
}

export function purchaseCommissionSupply({ store }, supplyId) {
  let success = false;

  store.update((draft) => {
    ensureCommissionState(draft);
    const definition = getCommissionSupplyDefinition(supplyId);
    if (!definition) {
      return;
    }

    const availability = getCommissionSupplyAvailability(definition, getCommissionStanding(draft));
    if (!availability.unlocked) {
      return;
    }
    if (!canAffordCost(draft, definition.cost)) {
      return;
    }

    payCost(draft, definition.cost);
    const effect = definition.effect ?? {};
    const active = draft.commissions.active;

    if (effect.type === 'expedite') {
      if (active && !active.eventState?.pendingEvent) {
        draft.commissions.active = {
          ...active,
          remainingSeconds: Math.max(Math.round((active.remainingSeconds ?? 0) * (Number(effect.activeRemainingMultiplier) || 1)), 1),
        };
      } else {
        draft.commissions.preparationBoost = buildPreparationBoostState(definition);
      }
    } else if (effect.type === 'bounty') {
      if (active) {
        const boostedEvaluation = applyCommissionEventOutcome(
          getCommissionSourceDefinition(active.sourceType, active.definitionId),
          active.evaluation,
          {
            effect: {
              scoreBonus: Number(effect.activeScoreBonus) || 0,
              rewardBonus: { ...(effect.activeRewardBonus ?? {}) },
            },
          },
        );
        draft.commissions.active = {
          ...active,
          evaluation: boostedEvaluation,
        };
      } else {
        draft.commissions.preparationBoost = buildPreparationBoostState(definition);
      }
    } else if (effect.type === 'special-intel') {
      const advanceMs = Math.max((effect.specialSpawnAdvanceSeconds ?? 0) * 1000, 0);
      draft.commissions.nextSpecialSpawnAt = Math.max(Date.now(), (draft.commissions.nextSpecialSpawnAt ?? Date.now()) - advanceMs);
      updateSpecialOffers(draft, Date.now());
    }

    appendLog(draft, 'missions', `已调拨委托补给：${definition.name}`);
    success = true;
  }, { type: 'commissions/procure', supplyId });

  return success;
}

export function purchaseCommissionAffairsShopItem({ store }, itemId) {
  let success = false;

  store.update((draft) => {
    ensureCommissionState(draft);
    const definition = getCommissionAffairsShopDefinition(itemId);
    if (!definition) {
      return;
    }

    const availability = getCommissionAffairsShopAvailability(
      definition,
      getCommissionStanding(draft),
      draft.commissions?.purchasedShopItemIds ?? [],
    );
    if (!availability.unlocked || availability.purchased) {
      return;
    }
    if ((draft.commissions?.affairsCredit ?? 0) < (definition.cost ?? 0)) {
      return;
    }

    draft.commissions.affairsCredit = Math.max((draft.commissions.affairsCredit ?? 0) - (definition.cost ?? 0), 0);
    draft.commissions.purchasedShopItemIds = [...new Set([...(draft.commissions.purchasedShopItemIds ?? []), itemId])];
    sanitizeBoard(draft, Date.now());
    updateSpecialOffers(draft, Date.now());
    appendLog(draft, 'missions', `已购置事务强化：${definition.name}`);
    success = true;
  }, { type: 'commissions/purchase-shop-item', itemId });

  return success;
}

export function toggleCommissionAutoDispatch({ store }) {
  let enabled = false;

  store.update((draft) => {
    ensureCommissionState(draft);
    draft.commissions.autoDispatch.enabled = !draft.commissions.autoDispatch.enabled;
    enabled = draft.commissions.autoDispatch.enabled;
    appendLog(draft, 'missions', `委托排程已${enabled ? '开启' : '关闭'}`);
  }, { type: 'commissions/toggle-auto-dispatch' });

  return enabled;
}

export function cycleCommissionAutoPriorityMode({ store }) {
  let currentMode = null;

  store.update((draft) => {
    ensureCommissionState(draft);
    const definitions = listCommissionAutoPriorityDefinitions();
    const currentIndex = definitions.findIndex((definition) => definition.id === draft.commissions.autoDispatch.priorityMode);
    const nextDefinition = definitions[(currentIndex + 1 + definitions.length) % definitions.length] ?? definitions[0];
    if (!nextDefinition) {
      return;
    }
    draft.commissions.autoDispatch.priorityMode = nextDefinition.id;
    currentMode = nextDefinition;
    appendLog(draft, 'missions', `委托排程切换为：${nextDefinition.name}`);
  }, { type: 'commissions/cycle-auto-priority' });

  return currentMode;
}

export function toggleCommissionAutoResolveEvents({ store }) {
  let enabled = false;

  store.update((draft) => {
    ensureCommissionState(draft);
    draft.commissions.autoDispatch.autoResolveEvents = !draft.commissions.autoDispatch.autoResolveEvents;
    enabled = draft.commissions.autoDispatch.autoResolveEvents;
    appendLog(draft, 'missions', `委托排程途中事件自动抉择已${enabled ? '开启' : '关闭'}`);
  }, { type: 'commissions/toggle-auto-resolve-events' });

  return enabled;
}

export function interruptCommission({ store }) {
  let success = false;

  store.update((draft) => {
    ensureCommissionState(draft);
    ensureCommissionTheme(draft);
    const active = draft.commissions.active;
    if (!active) {
      return;
    }

    const now = Date.now();
    draft.commissions.active = null;
    if (active.sourceType === 'board') {
      setCommissionCooldown(draft, active.definitionId, 'interrupt', now);
      refreshCommissionBoard(draft, {
        preferFresh: true,
        lockedIds: [active.definitionId],
        now,
      });
    } else if (active.sourceType === 'special') {
      draft.commissions.nextSpecialSpawnAt = Math.min(
        draft.commissions.nextSpecialSpawnAt ?? Infinity,
        now + (getCommissionSpecialRespawnSecondsForState(draft) * 1000),
      );
    } else if (active.sourceType === 'case') {
      refreshCommissionCaseFileOffers(draft, now);
    }

    draft.commissions.history.unshift(buildHistoryEntry(active, {
      remainingSeconds: Math.max(active.remainingSeconds ?? 0, 0),
      interruptedAt: now,
      resultType: 'interrupted',
    }));
    trimHistory(draft);
    appendLog(draft, 'missions', `${getCommissionSourceLabel(active.sourceType, active.evaluation)}中断：${active.name}`);
    success = true;
  }, { type: 'commissions/cancel' });

  return success;
}

export function rerollCommissionBoard({ store }) {
  let success = false;

  store.update((draft) => {
    ensureCommissionState(draft);
    ensureCommissionTheme(draft);
    sanitizeBoard(draft);
    if (hasActiveCommission(draft)) {
      return;
    }

    const now = Date.now();
    if ((draft.commissions.rerollCooldownUntil ?? 0) > now) {
      return;
    }

    const rerollCost = getCommissionRerollCostForState(draft);
    if (!canAffordCost(draft, rerollCost)) {
      return;
    }

    payCost(draft, rerollCost);
    draft.commissions.rerollCooldownUntil = now + (getCommissionRerollCooldownSeconds() * 1000);
    refreshCommissionBoard(draft, { preferFresh: true, now });
    appendLog(draft, 'missions', '已刷新委托榜单');
    success = true;
  }, { type: 'commissions/reroll' });

  return success;
}

export function resolveCommissionEvent({ store }, optionId) {
  let success = false;

  store.update((draft) => {
    success = resolveCommissionEventInState(draft, optionId, { now: Date.now(), origin: 'manual' });
  }, { type: 'commissions/resolve-event', optionId });

  return success;
}

function mapOfferSnapshot(offer, teamSnapshot, state, now) {
  const definition = getSpecialCommissionDefinition(offer.definitionId);
  if (!definition) {
    return null;
  }

  const evaluation = evaluateCommissionTeam(teamSnapshot, definition, {
    theme: getCurrentCommissionTheme(state),
    sourceType: 'special',
  });
  return {
    ...definition,
    instanceId: offer.instanceId,
    eventType: offer.eventType ?? definition.eventType ?? 'special',
    eventLabel: offer.eventLabel ?? definition.eventLabel ?? '限时诏令',
    spawnedAt: offer.spawnedAt ?? 0,
    expiresAt: offer.expiresAt ?? 0,
    expiresInSeconds: Math.max(Math.ceil(((offer.expiresAt ?? 0) - now) / 1000), 0),
    evaluation,
    reputationReward: getCommissionReputationReward(definition, evaluation, state, 'special'),
    affairsCreditReward: getCommissionAffairsCreditReward(definition, evaluation, state, 'special'),
    canStart: !hasActiveCommission(state) && teamSnapshot.members.length > 0 && (offer.expiresAt ?? 0) > now,
  };
}

function mapActiveCommissionSnapshot(active, state) {
  if (!active) {
    return null;
  }

  const definition = getCommissionSourceDefinition(active.sourceType, active.definitionId);
  const reputationReward = definition
    ? getCommissionReputationReward(definition, active.evaluation ?? {}, state, active.sourceType)
    : (active.reputationReward ?? 0);
  const affairsCreditReward = definition
    ? getCommissionAffairsCreditReward(definition, active.evaluation ?? {}, state, active.sourceType)
    : (active.affairsCreditReward ?? 0);

  return {
    ...active,
    reputationReward,
    affairsCreditReward,
  };
}

function mapCommissionSupplySnapshot(state) {
  const standing = getCommissionStanding(state);
  const active = state.commissions?.active;

  return listCommissionSupplyDefinitions().map((definition) => {
    const availability = getCommissionSupplyAvailability(definition, standing);
    const effectType = definition.effect?.type ?? 'supply';
    let targetLabel = '下一次委托';
    if (effectType === 'special-intel') {
      targetLabel = '限时诏令';
    } else if (effectType === 'bounty' && active) {
      targetLabel = '当前委托';
    } else if (effectType === 'expedite' && active && !active.eventState?.pendingEvent) {
      targetLabel = '当前委托';
    }

    return {
      ...definition,
      unlocked: availability.unlocked,
      requiredStanding: availability.requiredStanding,
      affordable: canAffordCost(state, definition.cost),
      targetLabel,
    };
  });
}

function mapCommissionAffairsShopSnapshot(state) {
  const standing = getCommissionStanding(state);
  const purchasedIds = state.commissions?.purchasedShopItemIds ?? [];

  return listCommissionAffairsShopDefinitions().map((definition) => {
    const availability = getCommissionAffairsShopAvailability(definition, standing, purchasedIds);
    return {
      ...definition,
      unlocked: availability.unlocked,
      purchased: availability.purchased,
      affordable: (state.commissions?.affairsCredit ?? 0) >= (definition.cost ?? 0),
      requiredStanding: availability.requiredStanding,
    };
  });
}

function mapCommissionCaseFileSnapshot(state, teamSnapshot) {
  const standing = getCommissionStanding(state);
  const currentTheme = getCurrentCommissionTheme(state);
  const offerMap = new Map((state.commissions?.caseFileOffers ?? []).map((offer) => [offer.caseFileId, offer]));
  const activeCaseId = state.commissions?.active?.sourceType === 'case'
    ? state.commissions.active.definitionId
    : null;
  const pendingClaimCaseIds = new Set(
    (state.commissions?.completed ?? [])
      .filter((entry) => entry.sourceType === 'case')
      .map((entry) => entry.definitionId),
  );

  return getCommissionCaseFileProgress(state.commissions?.caseFileProgress ?? {}, {
    standing,
    resolvedIds: state.commissions?.resolvedCaseFileIds ?? [],
    offeredIds: (state.commissions?.caseFileOffers ?? []).map((offer) => offer.caseFileId),
  }).map((definition) => {
    const offer = offerMap.get(definition.id);
    const evaluation = evaluateCommissionTeam(teamSnapshot, definition, {
      theme: currentTheme,
      sourceType: 'case',
    });

    return {
      ...definition,
      instanceId: offer?.instanceId ?? null,
      unlockedAt: offer?.unlockedAt ?? 0,
      active: activeCaseId === definition.id,
      pendingClaim: pendingClaimCaseIds.has(definition.id),
      evaluation,
      reputationReward: getCommissionReputationReward(definition, evaluation, state, 'case'),
      affairsCreditReward: getCommissionAffairsCreditReward(definition, evaluation, state, 'case'),
      canStart: Boolean(offer) && !hasActiveCommission(state) && teamSnapshot.members.length > 0,
    };
  });
}

export function getCommissionSnapshot(state, registries) {
  ensureCommissionState(state);
  const currentTheme = ensureCommissionTheme(state);
  sanitizeBoard(state);
  refreshCommissionCaseFileOffers(state);
  const now = Date.now();
  const standing = getCommissionStandingSnapshot(state);
  const milestones = getCommissionMilestoneSnapshot(state);
  const supplies = mapCommissionSupplySnapshot(state);
  const affairsShop = mapCommissionAffairsShopSnapshot(state);
  const rerollCost = getCommissionRerollCostForState(state);
  const autoDispatch = getCommissionAutoDispatchState(state);
  const definitions = listCommissionDefinitions();
  const definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
  const teamSnapshot = buildExpeditionTeamSnapshot(state, registries);
  const caseFiles = mapCommissionCaseFileSnapshot(state, teamSnapshot);
  const activeDefinitionId = state.commissions.active?.definitionId ?? null;
  const available = (state.commissions.boardIds ?? [])
    .map((definitionId) => definitionMap.get(definitionId))
    .filter(Boolean)
    .map((definition) => {
      const evaluation = evaluateCommissionTeam(teamSnapshot, definition, {
        theme: currentTheme,
        sourceType: 'board',
      });
      const cooldownUntil = state.commissions.cooldowns?.[definition.id] ?? 0;
      const coolingDown = isCommissionCoolingDown(state.commissions.cooldowns, definition.id, now);
      return {
        ...definition,
        evaluation,
        reputationReward: getCommissionReputationReward(definition, evaluation, state, 'board'),
        affairsCreditReward: getCommissionAffairsCreditReward(definition, evaluation, state, 'board'),
        cooldownUntil,
        cooldownRemainingSeconds: coolingDown ? Math.ceil((cooldownUntil - now) / 1000) : 0,
        coolingDown,
        canStart: !hasActiveCommission(state) && teamSnapshot.members.length > 0 && !coolingDown && activeDefinitionId !== definition.id,
      };
    });
  const specialOffers = (state.commissions.specialOffers ?? [])
    .map((offer) => mapOfferSnapshot(offer, teamSnapshot, state, now))
    .filter(Boolean);
  const aftereffectTags = new Set(state.commissions.aftereffect?.preferredTags ?? []);
  const themeTags = new Set([
    ...(currentTheme?.preferredTags ?? []),
    ...(currentTheme?.specialPreferredTags ?? []),
  ]);

  return {
    available: available.map((definition) => ({
      ...definition,
      favoredByAftereffect: (definition.tags ?? []).some((tag) => aftereffectTags.has(tag)),
      favoredByTheme: (definition.tags ?? []).some((tag) => themeTags.has(tag)),
    })),
    specialOffers: specialOffers.map((offer) => ({
      ...offer,
      favoredByAftereffect: (offer.tags ?? []).some((tag) => aftereffectTags.has(tag)),
      favoredByTheme: (offer.tags ?? []).some((tag) => themeTags.has(tag)),
    })),
    active: mapActiveCommissionSnapshot(state.commissions.active, state),
    completed: [...(state.commissions.completed ?? [])].map((entry) => ({
      ...entry,
      reputationReward: entry.reputationReward ?? mapActiveCommissionSnapshot(entry, state)?.reputationReward ?? 0,
      affairsCreditReward: entry.affairsCreditReward ?? mapActiveCommissionSnapshot(entry, state)?.affairsCreditReward ?? 0,
    })),
    history: [...(state.commissions.history ?? [])],
    teamSnapshot,
    aftereffect: state.commissions.aftereffect,
    preparationBoost: state.commissions.preparationBoost,
    standing: {
      ...standing,
      boardSize: getCommissionBoardSizeForState(state),
      specialOfferLimit: getCommissionSpecialOfferLimitForState(state),
      rerollCost,
      affairsCredit: state.commissions?.affairsCredit ?? 0,
    },
    milestones,
    supplies,
    affairsShop,
    autoDispatch,
    caseFiles,
    currentTheme: currentTheme
      ? {
        ...currentTheme,
        expiresAt: state.commissions.currentThemeExpiresAt ?? 0,
        expiresInSeconds: Math.max(Math.ceil(((state.commissions.currentThemeExpiresAt ?? 0) - now) / 1000), 0),
      }
      : null,
    reroll: {
      cost: rerollCost,
      affordable: canAffordCost(state, rerollCost),
      cooldownUntil: state.commissions.rerollCooldownUntil ?? 0,
      remainingSeconds: Math.max(Math.ceil(((state.commissions.rerollCooldownUntil ?? 0) - now) / 1000), 0),
      canReroll: !hasActiveCommission(state) && (state.commissions.rerollCooldownUntil ?? 0) <= now,
    },
    specialState: {
      nextSpawnAt: state.commissions.nextSpecialSpawnAt ?? 0,
      nextSpawnInSeconds: Math.max(Math.ceil(((state.commissions.nextSpecialSpawnAt ?? 0) - now) / 1000), 0),
    },
  };
}

export function summarizeCommissionRewards(completedList = []) {
  return accumulateRewardMaps(completedList, (entry) => entry.evaluation?.totalReward);
}

export function summarizeCommissionOfflineProgress(beforeState = {}, afterState = {}) {
  const beforeCompleted = beforeState.commissions?.completed ?? [];
  const afterCompleted = afterState.commissions?.completed ?? [];
  const beforeCompletedIds = new Set(beforeCompleted.map((entry) => entry.id));
  const newCompleted = afterCompleted.filter((entry) => !beforeCompletedIds.has(entry.id));
  const beforeActive = beforeState.commissions?.active ?? null;
  const afterActive = afterState.commissions?.active ?? null;
  const activeProgressSeconds = beforeActive && afterActive && beforeActive.id === afterActive.id
    ? Math.max((beforeActive.remainingSeconds ?? 0) - (afterActive.remainingSeconds ?? 0), 0)
    : 0;

  if (!newCompleted.length && !activeProgressSeconds) {
    return null;
  }

  return {
    newCompletedCount: newCompleted.length,
    newCompletedNames: newCompleted.map((entry) => entry.name),
    specialCompletedCount: newCompleted.filter((entry) => entry.sourceType === 'special').length,
    claimableReward: summarizeCommissionRewards(newCompleted),
    pendingCompletedCount: afterCompleted.length,
    activeProgressSeconds,
    activeRemainingSeconds: afterActive?.remainingSeconds ?? 0,
    activeName: afterActive?.name ?? null,
  };
}
