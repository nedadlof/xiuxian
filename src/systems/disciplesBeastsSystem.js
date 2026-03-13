import { appendLog } from './shared/logs.js';
import { canTrainDisciple, getDiscipleEffectMultiplier, getDiscipleTrainingCost } from '../data/discipleTraining.js';
import {
  canAdvanceDiscipleResonance,
  getDiscipleResonanceBonus,
  getDiscipleResonanceCost,
  getDiscipleResonanceTitle,
} from '../data/discipleAdvancement.js';
import { getBeastBondSnapshot } from '../data/beastBonds.js';
import { getBeastExpeditionDefinition, listBeastExpeditionDefinitions } from '../data/beastExpeditions.js';
import { getBeastExpeditionEventTriggerProgress, pickBeastExpeditionEventDefinition } from '../data/beastExpeditionEvents.js';
import { getExpeditionBondSnapshot } from '../data/expeditionBonds.js';
import {
  filterCandidatesByGuarantee,
  getActiveRecruitBanner,
  getDuplicateShardReward,
  getFactionMeta,
  getRecruitPityThresholds,
  getRecruitModeCost,
  getRecruitModeLabel,
  getRecruitTokenDefinition,
  listRecruitTokenDefinitions,
  pickDiscipleFromPool,
} from '../data/discipleRecruitment.js';

const SWITCH_COOLDOWN_MS = 4 * 60 * 60 * 1000;

function ensureCharacterState(state) {
  state.disciples.unlocked ??= [];
  state.disciples.owned ??= [];
  state.disciples.stationed ??= {};
  state.disciples.cooldowns ??= {};
  state.disciples.elders ??= [];
  state.disciples.modes ??= {};
  state.disciples.levels ??= {};
  state.disciples.resonance ??= {};
  state.disciples.recruit ??= {
    focusId: null,
    lastResult: null,
    lastBatch: [],
    history: [],
    selectedFactionId: null,
    pity: {
      advancedEpic: 0,
      advancedLegendary: 0,
    },
  };
  state.disciples.recruit.lastBatch ??= [];
  state.disciples.recruit.history ??= [];
  state.disciples.recruit.pity ??= { advancedEpic: 0, advancedLegendary: 0 };
  state.disciples.expeditionTeam ??= { leaderId: null, supportIds: [] };
  state.beasts.unlocked ??= [];
  state.beasts.activeIds ??= [];
  state.beasts.awakeningLevels ??= {};
  state.beasts.bondLevels ??= {};
  state.beasts.expedition ??= {
    active: null,
    history: [],
  };
  state.beasts.expedition.active ??= null;
  state.beasts.expedition.history ??= [];
  if (state.beasts.expedition.active) {
    state.beasts.expedition.active.eventState ??= {
      triggerProgress: getBeastExpeditionEventTriggerProgress(),
      resolvedEvents: [],
      pendingEvent: null,
    };
    state.beasts.expedition.active.eventState.resolvedEvents ??= [];
    state.beasts.expedition.active.eventState.pendingEvent ??= null;
  }

  for (const discipleId of state.disciples.owned ?? []) {
    if (!state.disciples.levels[discipleId]) {
      state.disciples.levels[discipleId] = 1;
    }
  }
}

function isOwnedDisciple(state, discipleId) {
  return state.disciples.owned.includes(discipleId);
}

function isUnlockedDisciple(state, discipleId) {
  return state.disciples.unlocked.includes(discipleId) || isOwnedDisciple(state, discipleId);
}

function hasCooldown(state, discipleId) {
  return (state.disciples.cooldowns?.[discipleId] ?? 0) > Date.now();
}

function setCooldown(state, discipleId) {
  state.disciples.cooldowns[discipleId] = Date.now() + SWITCH_COOLDOWN_MS;
}

function removeFromStations(state, discipleId) {
  for (const [buildingId, currentDiscipleId] of Object.entries(state.disciples.stationed)) {
    if (currentDiscipleId === discipleId) {
      delete state.disciples.stationed[buildingId];
    }
  }
}

function removeFromExpedition(state, discipleId) {
  if (state.disciples.expeditionTeam.leaderId === discipleId) {
    state.disciples.expeditionTeam.leaderId = null;
  }

  state.disciples.expeditionTeam.supportIds = state.disciples.expeditionTeam.supportIds.filter((id) => id !== discipleId);
}

function normalizeExpeditionTeamSelection(leaderId, supportIds = []) {
  const uniqueSupportIds = [];
  for (const discipleId of supportIds) {
    if (!discipleId || discipleId === leaderId || uniqueSupportIds.includes(discipleId)) {
      continue;
    }
    uniqueSupportIds.push(discipleId);
    if (uniqueSupportIds.length >= 2) {
      break;
    }
  }

  return {
    leaderId: leaderId ?? null,
    supportIds: uniqueSupportIds,
  };
}

function isAdvancedFamilyMode(mode) {
  return mode === 'advanced' || mode === 'faction';
}

function getRecruitBatchCount(count) {
  return count >= 10 ? 10 : 1;
}

function getUnlockedRecruitCandidates(state, registries, { includeOwned = true, factionId = null } = {}) {
  return registries.disciples.list().filter((disciple) => {
    if (!isUnlockedDisciple(state, disciple.id)) {
      return false;
    }
    if (!includeOwned && isOwnedDisciple(state, disciple.id)) {
      return false;
    }
    if (factionId && disciple.faction !== factionId) {
      return false;
    }
    return true;
  });
}

function buildRecruitRecord(discipleId, mode, extras = {}) {
  return {
    discipleId,
    mode,
    createdAt: Date.now(),
    ...extras,
  };
}

function registerRecruitBatch(state, results) {
  state.disciples.recruit.lastBatch = results.slice(0, 10);
  state.disciples.recruit.lastResult = results[0] ?? null;
  state.disciples.recruit.history.unshift(...results);
  state.disciples.recruit.history = state.disciples.recruit.history.slice(0, 20);
}

function grantDiscipleOwnership(state, discipleId) {
  if (!state.disciples.owned.includes(discipleId)) {
    state.disciples.owned.push(discipleId);
  }
  state.disciples.levels[discipleId] ??= 1;
  state.disciples.modes[discipleId] ??= 'idle';
}

function getAdvancedGuaranteeTier(state, candidates) {
  const pity = state.disciples.recruit?.pity ?? {};
  const thresholds = getRecruitPityThresholds();
  if ((pity.advancedLegendary ?? 0) >= thresholds.advancedLegendary - 1) {
    return filterCandidatesByGuarantee(candidates, 'legendary').some((disciple) => disciple.rarity === 'legendary')
      ? 'legendary'
      : null;
  }
  if ((pity.advancedEpic ?? 0) >= thresholds.advancedEpic - 1) {
    return 'epic+';
  }
  return null;
}

function updateAdvancedPity(state, disciple) {
  const pity = state.disciples.recruit.pity ??= { advancedEpic: 0, advancedLegendary: 0 };
  if (disciple?.rarity === 'legendary') {
    pity.advancedEpic = 0;
    pity.advancedLegendary = 0;
    return;
  }
  if (disciple?.rarity === 'epic') {
    pity.advancedEpic = 0;
    pity.advancedLegendary = (pity.advancedLegendary ?? 0) + 1;
    return;
  }

  pity.advancedEpic = (pity.advancedEpic ?? 0) + 1;
  pity.advancedLegendary = (pity.advancedLegendary ?? 0) + 1;
}

function resolveRecruitBatch(state, registries, {
  mode,
  count = 1,
  factionId = null,
} = {}) {
  const safeCount = getRecruitBatchCount(count);
  const candidates = getUnlockedRecruitCandidates(state, registries, {
    includeOwned: true,
    factionId: mode === 'faction' ? factionId : null,
  });
  if (!candidates.length) {
    return [];
  }

  const banner = mode === 'advanced' ? getActiveRecruitBanner() : null;
  const results = [];

  for (let index = 0; index < safeCount; index += 1) {
    const guaranteeTier = isAdvancedFamilyMode(mode) ? getAdvancedGuaranteeTier(state, candidates) : null;
    const disciple = pickDiscipleFromPool(candidates, {
      mode,
      banner,
      guaranteeTier,
    });
    if (!disciple) {
      break;
    }

    const duplicate = isOwnedDisciple(state, disciple.id);
    const shardReward = duplicate ? getDuplicateShardReward(disciple.rarity) : 0;

    if (duplicate) {
      state.resources.discipleShard = (state.resources.discipleShard ?? 0) + shardReward;
    } else {
      grantDiscipleOwnership(state, disciple.id);
    }

    if (isAdvancedFamilyMode(mode)) {
      updateAdvancedPity(state, disciple);
    }

    results.push(buildRecruitRecord(disciple.id, mode, {
      duplicate,
      shardReward,
      rarity: disciple.rarity,
      factionId: disciple.faction ?? null,
      bannerId: banner?.id ?? null,
      guaranteeTier,
    }));
  }

  return results;
}

export function createDisciplesBeastsSystem() {
  return {
    id: 'disciples-beasts-system',
    setup({ store, bus, registries }) {
      bus.on('action:disciples/recruit', ({ discipleId }) => {
        recruitDisciple({ store, bus, registries }, { discipleId, mode: 'targeted' });
      });

      bus.on('action:disciples/recruitPool', ({ mode, count, factionId }) => {
        recruitFromPool({ store, bus, registries }, { mode, count, factionId });
      });

      bus.on('action:disciples/setRecruitFocus', ({ discipleId }) => {
        setRecruitFocus({ store, bus, registries }, discipleId);
      });

      bus.on('action:disciples/setRecruitFaction', ({ factionId }) => {
        setRecruitFaction({ store, bus, registries }, factionId);
      });

      bus.on('action:disciples/buyRecruitToken', ({ resourceId }) => {
        buyRecruitToken({ store, bus, registries }, resourceId);
      });

      bus.on('action:disciples/station', ({ discipleId, buildingId }) => {
        stationDisciple({ store, bus, registries }, discipleId, buildingId);
      });

      bus.on('action:disciples/assignExpedition', ({ leaderId, supportIds }) => {
        assignExpeditionTeam({ store, bus, registries }, leaderId, supportIds);
      });

      bus.on('action:disciples/promoteElder', ({ discipleId }) => {
        promoteDiscipleToElder({ store, bus, registries }, discipleId);
      });

      bus.on('action:disciples/train', ({ discipleId, amount }) => {
        trainDisciple({ store, bus, registries }, discipleId, amount);
      });

      bus.on('action:disciples/advanceResonance', ({ discipleId }) => {
        advanceDiscipleResonance({ store, bus, registries }, discipleId);
      });

      bus.on('action:beasts/toggleActive', ({ beastId }) => {
        toggleBeastActive({ store, bus, registries }, beastId);
      });

      bus.on('action:beasts/awaken', ({ beastId }) => {
        awakenBeast({ store, bus, registries }, beastId);
      });

      bus.on('action:beasts/temper', ({ beastId }) => {
        temperBeast({ store, bus, registries }, beastId);
      });

      bus.on('action:beasts/applyRecommendedLineup', () => {
        applyRecommendedBeastLineup({ store, bus, registries });
      });

      bus.on('action:beasts/startExpedition', ({ routeId }) => {
        startBeastExpedition({ store, bus, registries }, routeId);
      });

      bus.on('action:beasts/claimExpedition', () => {
        claimBeastExpedition({ store, bus, registries });
      });

      bus.on('action:beasts/resolveExpeditionEvent', ({ optionId }) => {
        resolveBeastExpeditionEvent({ store, bus, registries }, optionId);
      });
    },
    tick({ store }, deltaSeconds, source) {
      store.update((draft) => {
        ensureCharacterState(draft);
        tickBeastExpeditionEvents(draft, source);
      }, { type: 'disciples-beasts/tick' });
    },
  };
}

export function recruitDisciple({ store, registries }, { discipleId, mode = 'targeted' } = {}) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const disciple = registries.disciples.get(discipleId);
    if (!disciple || !isUnlockedDisciple(draft, discipleId) || isOwnedDisciple(draft, discipleId)) {
      return;
    }

    const recruitCost = getRecruitModeCost(mode);
    if (!canAfford(draft, recruitCost)) {
      return;
    }

    payCost(draft, recruitCost);
    grantDiscipleOwnership(draft, discipleId);
    registerRecruitBatch(draft, [buildRecruitRecord(discipleId, mode, {
      duplicate: false,
      shardReward: 0,
      rarity: disciple.rarity,
      factionId: disciple.faction ?? null,
    })]);
    if (draft.disciples.recruit.focusId === discipleId) {
      draft.disciples.recruit.focusId = null;
    }
    appendLog(draft, 'disciples', `${getRecruitModeLabel(mode)}招得 ${disciple.name}`);
    success = true;
  }, { type: 'disciples/recruit', discipleId, mode });

  return success;
}

export function recruitFromPool({ store, registries }, { mode = 'standard', count = 1, factionId = null } = {}) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const safeCount = getRecruitBatchCount(count);
    const fallbackFactionId = [...new Set(
      getUnlockedRecruitCandidates(draft, registries, { includeOwned: true })
        .map((disciple) => disciple.faction)
        .filter(Boolean),
    )][0] ?? null;
    const resolvedFactionId = mode === 'faction'
      ? (factionId ?? draft.disciples.recruit.selectedFactionId ?? fallbackFactionId)
      : null;
    const candidates = getUnlockedRecruitCandidates(draft, registries, {
      includeOwned: true,
      factionId: resolvedFactionId,
    });
    if (!candidates.length) {
      return;
    }

    const recruitCost = getRecruitModeCost(mode, safeCount);
    if (!canAfford(draft, recruitCost)) {
      return;
    }

    const results = resolveRecruitBatch(draft, registries, {
      mode,
      count: safeCount,
      factionId: resolvedFactionId,
    });
    if (!results.length) {
      return;
    }

    payCost(draft, recruitCost);
    registerRecruitBatch(draft, results);
    if (mode === 'faction') {
      draft.disciples.recruit.selectedFactionId = resolvedFactionId;
    }
    const recruitedNames = results.map((entry) => {
      const disciple = registries.disciples.get(entry.discipleId);
      return disciple ? `${disciple.name}${entry.duplicate ? `（转化 ${entry.shardReward} 碎片）` : ''}` : entry.discipleId;
    }).join('、');
    appendLog(draft, 'disciples', `${getRecruitModeLabel(mode)}${safeCount === 10 ? '十连' : '单抽'}：${recruitedNames}`);
    success = true;
  }, { type: 'disciples/recruit-pool', mode, count, factionId });

  return success;
}

export function setRecruitFocus({ store, registries }, discipleId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    if (!discipleId) {
      draft.disciples.recruit.focusId = null;
      success = true;
      return;
    }

    const disciple = registries.disciples.get(discipleId);
    if (!disciple || !isUnlockedDisciple(draft, discipleId) || isOwnedDisciple(draft, discipleId)) {
      return;
    }

    draft.disciples.recruit.focusId = discipleId;
    appendLog(draft, 'disciples', `已设定 ${disciple.name} 为定向招募目标`);
    success = true;
  }, { type: 'disciples/set-recruit-focus', discipleId });

  return success;
}

export function setRecruitFaction({ store, registries }, factionId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    if (!factionId) {
      draft.disciples.recruit.selectedFactionId = null;
      success = true;
      return;
    }

    const candidates = getUnlockedRecruitCandidates(draft, registries, {
      includeOwned: true,
      factionId,
    });
    if (!candidates.length) {
      return;
    }

    draft.disciples.recruit.selectedFactionId = factionId;
    appendLog(draft, 'disciples', `已切换阵营定向池：${getFactionMeta(factionId)?.label ?? factionId}`);
    success = true;
  }, { type: 'disciples/set-recruit-faction', factionId });

  return success;
}

export function buyRecruitToken({ store }, resourceId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const token = getRecruitTokenDefinition(resourceId);
    if (!token || !canAfford(draft, token.purchaseCost)) {
      return;
    }

    payCost(draft, token.purchaseCost);
    draft.resources[resourceId] = (draft.resources[resourceId] ?? 0) + 1;
    appendLog(draft, 'disciples', `购入 ${token.name} x1`);
    success = true;
  }, { type: 'disciples/buy-recruit-token', resourceId });

  return success;
}

export function stationDisciple({ store, registries }, discipleId, buildingId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const disciple = registries.disciples.get(discipleId);
    if (!disciple || !isOwnedDisciple(draft, discipleId) || disciple.station !== buildingId || hasCooldown(draft, discipleId)) {
      return;
    }

    removeFromExpedition(draft, discipleId);
    draft.disciples.stationed[buildingId] = discipleId;
    draft.disciples.modes[discipleId] = 'stationed';
    setCooldown(draft, discipleId);
    appendLog(draft, 'disciples', `${disciple.name} 驻守 ${buildingId}`);
    success = true;
  }, { type: 'disciples/station', discipleId, buildingId });

  return success;
}

export function assignExpeditionTeam({ store, registries }, leaderId, supportIds = []) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const normalizedTeam = normalizeExpeditionTeamSelection(leaderId, supportIds);
    const allIds = [normalizedTeam.leaderId, ...normalizedTeam.supportIds].filter(Boolean);
    if (allIds.some((discipleId) => !isOwnedDisciple(draft, discipleId) || hasCooldown(draft, discipleId))) {
      return;
    }

    for (const discipleId of allIds) {
      removeFromStations(draft, discipleId);
      removeFromExpedition(draft, discipleId);
      draft.disciples.modes[discipleId] = 'expedition';
      setCooldown(draft, discipleId);
    }

    draft.disciples.expeditionTeam.leaderId = normalizedTeam.leaderId;
    draft.disciples.expeditionTeam.supportIds = normalizedTeam.supportIds;
    appendLog(draft, 'disciples', '更新出征阵容');
    success = true;
  }, { type: 'disciples/assign-expedition', leaderId, supportIds });

  return success;
}

export function promoteDiscipleToElder({ store, registries }, discipleId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    if (!draft.scripture.flags?.elderModeUnlocked || !isOwnedDisciple(draft, discipleId)) {
      return;
    }

    const disciple = registries.disciples.get(discipleId);
    if (!disciple || draft.disciples.elders.includes(discipleId)) {
      return;
    }

    draft.disciples.elders.push(discipleId);
    appendLog(draft, 'disciples', `${disciple.name} 晋升为长老`);
    success = true;
  }, { type: 'disciples/promote-elder', discipleId });

  return success;
}

export function toggleBeastActive({ store, registries }, beastId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const beast = registries.beasts.get(beastId);
    if (!beast || !draft.beasts.unlocked.includes(beastId)) {
      return;
    }

    if (draft.beasts.activeIds.includes(beastId)) {
      draft.beasts.activeIds = draft.beasts.activeIds.filter((id) => id !== beastId);
      appendLog(draft, 'beasts', `收回 ${beast.name} 的出战位`);
      success = true;
      return;
    }

    if (draft.beasts.activeIds.length >= 3) {
      return;
    }

    draft.beasts.activeIds.push(beastId);
    appendLog(draft, 'beasts', `${beast.name} 已加入激活阵列`);
    success = true;
  }, { type: 'beasts/toggle-active', beastId });

  return success;
}

function getBeastAwakeningCost(level = 0) {
  return {
    beastShard: 2 + level * 2,
    spiritCrystal: 18 + level * 12,
  };
}

function canAwakenBeast(level = 0) {
  return level < 5;
}

function getBeastBondCost(beast, level = 0) {
  const base = beast?.contractCosts ?? { pills: 8, spiritCrystal: 6 };
  const multiplier = 1 + level * 0.35;
  return Object.fromEntries(
    Object.entries(base).map(([resourceId, amount]) => [resourceId, Math.max(1, Math.round(amount * multiplier))]),
  );
}

function canTemperBeast(level = 0) {
  return level < 10;
}

function addResourceMap(state, resourceMap) {
  for (const [resourceId, amount] of Object.entries(resourceMap ?? {})) {
    state.resources[resourceId] = (state.resources?.[resourceId] ?? 0) + amount;
  }
}

function mergeResourceMaps(...maps) {
  const merged = {};
  for (const map of maps) {
    for (const [resourceId, amount] of Object.entries(map ?? {})) {
      merged[resourceId] = (merged[resourceId] ?? 0) + amount;
    }
  }
  return merged;
}

function scaleResourceMap(resourceMap, multiplier = 1) {
  return Object.fromEntries(
    Object.entries(resourceMap ?? {}).map(([resourceId, amount]) => [
      resourceId,
      Math.max(1, Math.round(amount * multiplier)),
    ]),
  );
}

function getBeastExpeditionProgressRatio(active, now = Date.now()) {
  if (!active) {
    return 0;
  }

  const startedAt = Number(active.startedAt) || now;
  const completesAt = Math.max(Number(active.completesAt) || startedAt, startedAt + 1000);
  if (completesAt <= startedAt) {
    return 1;
  }

  return Math.max(0, Math.min((now - startedAt) / (completesAt - startedAt), 1));
}

function buildPendingBeastExpeditionEvent(active, now = Date.now()) {
  const usedEventIds = active?.eventState?.resolvedEvents?.map((entry) => entry.eventId).filter(Boolean) ?? [];
  const definition = pickBeastExpeditionEventDefinition({
    routeId: active?.routeId,
    usedEventIds,
    seed: (active?.startedAt ?? now) + usedEventIds.length,
  });
  if (!definition) {
    return null;
  }

  return {
    eventId: definition.id,
    name: definition.name,
    description: definition.description,
    triggeredAt: now,
    options: (definition.options ?? []).map((option) => ({
      ...option,
      eventId: definition.id,
      effects: {
        ...(option.effects ?? {}),
        rewardBonus: { ...(option.effects?.rewardBonus ?? {}) },
      },
    })),
  };
}

function applyBeastExpeditionEventOption(active, option, now = Date.now()) {
  const effects = {
    ...(option?.effects ?? {}),
    rewardBonus: { ...(option?.effects?.rewardBonus ?? {}) },
  };
  const rewardMultiplier = Math.max(Number(effects.rewardMultiplier) || 1, 0.2);
  const rewardMap = mergeResourceMaps(
    scaleResourceMap(active?.rewardMap ?? {}, rewardMultiplier),
    effects.rewardBonus ?? {},
  );
  const remainingSeconds = Math.max(Math.ceil(((active?.completesAt ?? now) - now) / 1000), 0);
  const durationMultiplier = Math.max(Number(effects.durationMultiplier) || 1, 0.35);
  const durationFlatSeconds = Math.round(Number(effects.durationFlatSeconds) || 0);
  const nextRemainingSeconds = Math.max(0, Math.round(remainingSeconds * durationMultiplier) + durationFlatSeconds);
  const resolvedEntry = {
    eventId: active?.eventState?.pendingEvent?.eventId ?? option?.eventId ?? null,
    eventName: active?.eventState?.pendingEvent?.name ?? null,
    optionId: option?.id ?? null,
    optionLabel: option?.label ?? null,
    resolvedAt: now,
  };

  return {
    ...active,
    rewardMap,
    completesAt: now + nextRemainingSeconds * 1000,
    eventState: {
      ...(active?.eventState ?? {}),
      pendingEvent: null,
      resolvedEvents: [...(active?.eventState?.resolvedEvents ?? []), resolvedEntry],
    },
    lastEventOutcome: {
      ...resolvedEntry,
      effects,
    },
  };
}

function maybeTriggerBeastExpeditionEvent(active, now = Date.now()) {
  if (!active || active.eventState?.pendingEvent) {
    return active;
  }
  if ((active.eventState?.resolvedEvents?.length ?? 0) > 0) {
    return active;
  }
  if (getBeastExpeditionProgressRatio(active, now) < (active.eventState?.triggerProgress ?? getBeastExpeditionEventTriggerProgress())) {
    return active;
  }

  const pendingEvent = buildPendingBeastExpeditionEvent(active, now);
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

function resolveBeastExpeditionEventInState(state, optionId, { now = Date.now(), origin = 'manual' } = {}) {
  const active = state.beasts.expedition?.active;
  const pendingEvent = active?.eventState?.pendingEvent;
  if (!active || !pendingEvent) {
    return false;
  }

  const pickedOption = pendingEvent.options?.find((option) => option.id === optionId);
  if (!pickedOption) {
    return false;
  }

  state.beasts.expedition.active = applyBeastExpeditionEventOption(active, pickedOption, now);
  state.commissions ??= {};
  state.commissions.affairsCredit ??= 0;
  const affairsCredit = Math.max(Number(pickedOption.effects?.affairsCredit) || 0, 0);
  if (affairsCredit > 0) {
    state.commissions.affairsCredit = (state.commissions?.affairsCredit ?? 0) + affairsCredit;
  }

  const warehouseAdvanceSeconds = Math.max(Number(pickedOption.effects?.warehouseAutoSealAdvanceSeconds) || 0, 0);
  if (warehouseAdvanceSeconds > 0 && state.warehouse?.autoSealEnabled) {
    state.warehouse.nextAutoSealAt = Math.max(
      Math.min((state.warehouse?.nextAutoSealAt ?? now) - warehouseAdvanceSeconds * 1000, now),
      0,
    );
  }

  appendLog(
    state,
    'beasts',
    `${origin === 'auto' ? '巡游奇遇代行抉择' : '巡游奇遇抉择'}：${pendingEvent.name} · ${pickedOption.label}`,
  );
  return true;
}

function tickBeastExpeditionEvents(state, source = 'runtime', now = Date.now()) {
  const active = state.beasts.expedition?.active;
  if (!active) {
    return false;
  }

  if (active.eventState?.pendingEvent) {
    if (source !== 'runtime') {
      const defaultOption = active.eventState.pendingEvent.options?.find((option) => option.default)
        ?? active.eventState.pendingEvent.options?.[0];
      if (defaultOption) {
        return resolveBeastExpeditionEventInState(state, defaultOption.id, { now, origin: 'auto' });
      }
    }
    return false;
  }

  const withEvent = maybeTriggerBeastExpeditionEvent(active, now);
  if (withEvent !== active) {
    state.beasts.expedition.active = withEvent;
    appendLog(state, 'beasts', `巡游途中奇遇：${withEvent.eventState?.pendingEvent?.name ?? '未知异象'}`);
    if (source !== 'runtime') {
      const defaultOption = withEvent.eventState?.pendingEvent?.options?.find((option) => option.default)
        ?? withEvent.eventState?.pendingEvent?.options?.[0];
      if (defaultOption) {
        resolveBeastExpeditionEventInState(state, defaultOption.id, { now, origin: 'auto' });
      }
    }
    return true;
  }

  return false;
}

function getBeastExpeditionQualityLabel(score = 0) {
  if (score >= 70) {
    return '大丰收';
  }
  if (score >= 48) {
    return '顺利';
  }
  return '初探';
}

function evaluateBeastExpeditionCandidate(beast, definition) {
  const preferredTags = new Set(definition?.preferredTags ?? []);
  const preferredArchetypes = new Set(definition?.preferredArchetypes ?? []);
  const tagMatches = (beast?.favoredTags ?? []).reduce((sum, tag) => sum + (preferredTags.has(tag) ? 1 : 0), 0);
  const archetypeMatched = preferredArchetypes.has(beast?.archetype ?? '');
  const awakeningLevel = beast?.awakeningLevel ?? 0;
  const bondLevel = beast?.bondLevel ?? 0;
  const fitScore = beast?.fitScore ?? 0;
  const score = tagMatches * 18 + (archetypeMatched ? 10 : 0) + awakeningLevel * 8 + bondLevel * 6 + fitScore * 4;
  const rewardMultiplier = 1 + tagMatches * 0.16 + (archetypeMatched ? 0.08 : 0) + awakeningLevel * 0.06 + bondLevel * 0.04;
  const durationMultiplier = Math.max(0.55, 1 - tagMatches * 0.08 - (archetypeMatched ? 0.05 : 0) - awakeningLevel * 0.02 - bondLevel * 0.01);
  const durationSeconds = Math.max(5 * 60, Math.round((definition?.baseDurationMinutes ?? 20) * 60 * durationMultiplier));
  const bonusUnlocked = tagMatches >= 2 || score >= 48;

  return {
    beast,
    tagMatches,
    archetypeMatched,
    score,
    qualityLabel: getBeastExpeditionQualityLabel(score),
    durationSeconds,
    rewardMap: mergeResourceMaps(
      scaleResourceMap(definition?.baseRewards ?? {}, rewardMultiplier),
      bonusUnlocked ? { ...(definition?.bonusRewards ?? {}) } : {},
    ),
    bonusUnlocked,
  };
}

function pickRecommendedBeastExpedition(beasts = [], definition = null) {
  return beasts
    .map((beast) => evaluateBeastExpeditionCandidate(beast, definition))
    .sort((left, right) => (
      (right.score - left.score)
      || (right.tagMatches - left.tagMatches)
      || ((right.beast?.bondLevel ?? 0) - (left.beast?.bondLevel ?? 0))
      || ((right.beast?.awakeningLevel ?? 0) - (left.beast?.awakeningLevel ?? 0))
      || (left.beast?.id ?? '').localeCompare(right.beast?.id ?? '')
    ))[0] ?? null;
}

function getBeastExpeditionSnapshot(state, registries, beasts = getBeastSnapshot(state, registries)) {
  const unlockedBeasts = beasts.filter((beast) => beast.unlocked);
  const activeRecord = state.beasts?.expedition?.active
    ? {
      ...state.beasts.expedition.active,
      rewardMap: { ...(state.beasts.expedition.active.rewardMap ?? {}) },
      eventState: {
        triggerProgress: state.beasts.expedition.active.eventState?.triggerProgress ?? getBeastExpeditionEventTriggerProgress(),
        pendingEvent: state.beasts.expedition.active.eventState?.pendingEvent
          ? {
            ...state.beasts.expedition.active.eventState.pendingEvent,
            options: (state.beasts.expedition.active.eventState.pendingEvent.options ?? []).map((option) => ({
              ...option,
              effects: {
                ...(option.effects ?? {}),
                rewardBonus: { ...(option.effects?.rewardBonus ?? {}) },
              },
            })),
          }
          : null,
        resolvedEvents: (state.beasts.expedition.active.eventState?.resolvedEvents ?? []).map((entry) => ({ ...entry })),
      },
    }
    : null;
  const now = Date.now();
  const active = activeRecord
    ? {
      ...activeRecord,
      completed: (activeRecord.completesAt ?? 0) <= now,
      remainingSeconds: Math.max(0, Math.ceil(((activeRecord.completesAt ?? 0) - now) / 1000)),
    }
    : null;
  const history = Array.isArray(state.beasts?.expedition?.history)
    ? state.beasts.expedition.history.slice(0, 6).map((entry) => ({
      ...entry,
      rewardMap: { ...(entry.rewardMap ?? {}) },
      eventState: {
        triggerProgress: entry.eventState?.triggerProgress ?? getBeastExpeditionEventTriggerProgress(),
        pendingEvent: entry.eventState?.pendingEvent
          ? {
            ...entry.eventState.pendingEvent,
            options: (entry.eventState.pendingEvent.options ?? []).map((option) => ({
              ...option,
              effects: {
                ...(option.effects ?? {}),
                rewardBonus: { ...(option.effects?.rewardBonus ?? {}) },
              },
            })),
          }
          : null,
        resolvedEvents: (entry.eventState?.resolvedEvents ?? []).map((resolvedEntry) => ({ ...resolvedEntry })),
      },
    }))
    : [];
  const routes = listBeastExpeditionDefinitions().map((definition) => {
    const unlocked = unlockedBeasts.length >= (definition.minUnlockedBeasts ?? 1);
    const recommendation = unlocked ? pickRecommendedBeastExpedition(unlockedBeasts, definition) : null;

    return {
      ...definition,
      unlocked,
      recommendedBeast: recommendation?.beast ?? null,
      recommendationScore: recommendation?.score ?? 0,
      tagMatches: recommendation?.tagMatches ?? 0,
      qualityLabel: recommendation?.qualityLabel ?? '待解锁',
      durationSeconds: recommendation?.durationSeconds ?? Math.round((definition.baseDurationMinutes ?? 20) * 60),
      rewardPreview: recommendation?.rewardMap ?? { ...(definition.baseRewards ?? {}) },
      bonusUnlocked: recommendation?.bonusUnlocked ?? false,
      canStart: !active && unlocked && Boolean(recommendation?.beast),
      active: active?.routeId === definition.id,
    };
  });

  return {
    active,
    history,
    routes,
  };
}

function getBeastLineupSignature(beastIds = []) {
  return [...beastIds].sort().join(':');
}

function buildBeastLineups(beasts = [], maxSize = 3) {
  const lineups = [];
  const limit = Math.min(Math.max(1, maxSize), beasts.length);

  function visit(startIndex, current) {
    if (current.length > 0) {
      lineups.push([...current]);
    }
    if (current.length >= limit) {
      return;
    }

    for (let index = startIndex; index < beasts.length; index += 1) {
      current.push(beasts[index]);
      visit(index + 1, current);
      current.pop();
    }
  }

  visit(0, []);
  return lineups;
}

function scoreBeastEffect(effect) {
  const value = Number(effect?.value) || 0;
  switch (effect?.type) {
    case 'battleAttack':
      return value * 180;
    case 'battleDefense':
      return value * 155;
    case 'battleSustain':
      return value * 140;
    case 'battleLoot':
      return value * 150;
    case 'unitPowerMultiplier':
      return value * 175;
    case 'resourceMultiplier':
      return value * 90;
    default:
      return value * 60;
  }
}

function evaluateBeastLineup(lineup = []) {
  const activeBondSnapshot = getBeastBondSnapshot(lineup);
  const effectScore = activeBondSnapshot.activeBonds
    .flatMap((bond) => bond.effects ?? [])
    .reduce((sum, effect) => sum + scoreBeastEffect(effect), 0);
  const beastGrowthScore = lineup.reduce((sum, beast) => (
    sum
    + (beast.fitScore ?? 0) * 18
    + (beast.awakeningLevel ?? 0) * 6
    + (beast.bondLevel ?? 0) * 4
  ), 0);
  const compositionScore = lineup.length * 5
    + activeBondSnapshot.activeBonds.length * 15
    + activeBondSnapshot.uniqueArchetypeCount * 2
    + activeBondSnapshot.totalFitScore * 4;

  return {
    beastIds: lineup.map((beast) => beast.id),
    beasts: lineup.map((beast) => ({ ...beast })),
    activeBondSnapshot,
    score: beastGrowthScore + effectScore + compositionScore,
  };
}

export function awakenBeast({ store, registries }, beastId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const beast = registries.beasts.get(beastId);
    if (!beast || !draft.beasts.unlocked.includes(beastId)) {
      return;
    }

    const currentLevel = draft.beasts.awakeningLevels?.[beastId] ?? 0;
    if (!canAwakenBeast(currentLevel)) {
      return;
    }

    const cost = getBeastAwakeningCost(currentLevel);
    if (!canAfford(draft, cost)) {
      return;
    }

    payCost(draft, cost);
    draft.beasts.awakeningLevels[beastId] = currentLevel + 1;
    appendLog(draft, 'beasts', `${beast.name} 觉醒至 ${currentLevel + 1} 阶`);
    success = true;
  }, { type: 'beasts/awaken', beastId });

  return success;
}

export function temperBeast({ store, registries }, beastId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const beast = registries.beasts.get(beastId);
    if (!beast || !draft.beasts.unlocked.includes(beastId)) {
      return;
    }

    const currentLevel = draft.beasts.bondLevels?.[beastId] ?? 0;
    if (!canTemperBeast(currentLevel)) {
      return;
    }

    const cost = getBeastBondCost(beast, currentLevel);
    if (!canAfford(draft, cost)) {
      return;
    }

    payCost(draft, cost);
    draft.beasts.bondLevels[beastId] = currentLevel + 1;
    appendLog(draft, 'beasts', `${beast.name} 兽契提升至 ${currentLevel + 1} 阶`);
    success = true;
  }, { type: 'beasts/temper', beastId });

  return success;
}

export function applyRecommendedBeastLineup({ store, registries }) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const snapshot = getBeastMenagerieSnapshot(draft, registries);
    const recommendedIds = snapshot.recommendedLineup?.beastIds
      ?.filter((id) => draft.beasts.unlocked.includes(id))
      .slice(0, 3) ?? [];

    if (!recommendedIds.length) {
      return;
    }

    const currentSignature = getBeastLineupSignature(draft.beasts.activeIds ?? []);
    const nextSignature = getBeastLineupSignature(recommendedIds);
    if (currentSignature === nextSignature) {
      return;
    }

    draft.beasts.activeIds = [...recommendedIds];
    const beastNames = recommendedIds
      .map((id) => registries.beasts.get(id)?.name ?? id)
      .join('、');
    const bondNames = snapshot.recommendedLineup?.activeBondSnapshot?.activeBonds?.map((bond) => bond.name).join('、');
    appendLog(draft, 'beasts', `已套用推荐兽阵：${beastNames}${bondNames ? `（激活 ${bondNames}）` : ''}`);
    success = true;
  }, { type: 'beasts/apply-recommended-lineup' });

  return success;
}

function canAfford(state, costMap) {
  for (const [resourceId, amount] of Object.entries(costMap ?? {})) {
    if ((state.resources?.[resourceId] ?? 0) < amount) {
      return false;
    }
  }
  return true;
}

function payCost(state, costMap) {
  for (const [resourceId, amount] of Object.entries(costMap ?? {})) {
    state.resources[resourceId] -= amount;
  }
}

export function trainDisciple({ store, registries }, discipleId, amount = 1) {
  const safeAmount = Math.max(1, Math.min(Number(amount) || 1, 20));
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const disciple = registries.disciples.get(discipleId);
    if (!disciple || !isOwnedDisciple(draft, discipleId)) {
      return;
    }

    let level = draft.disciples.levels?.[discipleId] ?? 1;
    let trained = 0;

    while (trained < safeAmount && canTrainDisciple(level)) {
      const cost = getDiscipleTrainingCost(level);
      if (!canAfford(draft, cost)) {
        break;
      }
      payCost(draft, cost);
      level += 1;
      trained += 1;
    }

    if (trained <= 0) {
      return;
    }

    draft.disciples.levels[discipleId] = level;
    appendLog(draft, 'disciples', `${disciple.name} 培养至 Lv.${level}`);
    success = true;
  }, { type: 'disciples/train', discipleId, amount: safeAmount });

  return success;
}

export function advanceDiscipleResonance({ store, registries }, discipleId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const disciple = registries.disciples.get(discipleId);
    if (!disciple || !isOwnedDisciple(draft, discipleId)) {
      return;
    }

    const currentLevel = draft.disciples.resonance?.[discipleId] ?? 0;
    if (!canAdvanceDiscipleResonance(currentLevel)) {
      return;
    }

    const cost = getDiscipleResonanceCost(disciple.rarity, currentLevel);
    if (!canAfford(draft, cost)) {
      return;
    }

    payCost(draft, cost);
    const nextLevel = currentLevel + 1;
    draft.disciples.resonance[discipleId] = nextLevel;
    appendLog(draft, 'disciples', `${disciple.name} 命魂共鸣突破至 ${getDiscipleResonanceTitle(nextLevel)}`);
    success = true;
  }, { type: 'disciples/advance-resonance', discipleId });

  return success;
}

export function startBeastExpedition({ store, registries }, routeId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    if (draft.beasts.expedition?.active) {
      return;
    }

    const definition = getBeastExpeditionDefinition(routeId);
    if (!definition) {
      return;
    }

    const beasts = getBeastSnapshot(draft, registries).filter((beast) => beast.unlocked);
    if (beasts.length < (definition.minUnlockedBeasts ?? 1)) {
      return;
    }

    const recommendation = pickRecommendedBeastExpedition(beasts, definition);
    if (!recommendation?.beast) {
      return;
    }

    const startedAt = Date.now();
    draft.beasts.expedition.active = {
      routeId: definition.id,
      routeName: definition.name,
      beastId: recommendation.beast.id,
      beastName: recommendation.beast.name,
      qualityLabel: recommendation.qualityLabel,
      durationSeconds: recommendation.durationSeconds,
      startedAt,
      completesAt: startedAt + recommendation.durationSeconds * 1000,
      tagMatches: recommendation.tagMatches,
      rewardMap: { ...recommendation.rewardMap },
      eventState: {
        triggerProgress: getBeastExpeditionEventTriggerProgress(),
        resolvedEvents: [],
        pendingEvent: null,
      },
    };
    appendLog(
      draft,
      'beasts',
      `${recommendation.beast.name} 已启程执行 ${definition.name}，预计带回 ${recommendation.qualityLabel} 收获`,
    );
    success = true;
  }, { type: 'beasts/start-expedition', routeId });

  return success;
}

export function claimBeastExpedition({ store }) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    const active = draft.beasts.expedition?.active;
    if (!active || active.eventState?.pendingEvent || (active.completesAt ?? 0) > Date.now()) {
      return;
    }

    addResourceMap(draft, active.rewardMap);
    draft.beasts.expedition.history.unshift({
      ...active,
      rewardMap: { ...(active.rewardMap ?? {}) },
      claimedAt: Date.now(),
    });
    draft.beasts.expedition.history = draft.beasts.expedition.history.slice(0, 8);
    draft.beasts.expedition.active = null;
    appendLog(draft, 'beasts', `${active.beastName} 完成 ${active.routeName}，带回一批巡游收获`);
    success = true;
  }, { type: 'beasts/claim-expedition' });

  return success;
}

export function resolveBeastExpeditionEvent({ store }, optionId) {
  let success = false;

  store.update((draft) => {
    ensureCharacterState(draft);
    success = resolveBeastExpeditionEventInState(draft, optionId, { now: Date.now(), origin: 'manual' });
  }, { type: 'beasts/resolve-expedition-event', optionId });

  return success;
}

export function getDisciplesSnapshot(state, registries) {
  const unlocked = new Set(state.disciples.unlocked ?? []);
  const owned = new Set(state.disciples.owned);
  const elders = new Set(state.disciples.elders ?? []);
  const recruitFocusId = state.disciples.recruit?.focusId ?? null;
  const recruitPool = getUnlockedRecruitCandidates(state, registries, { includeOwned: true });
  const recruitableCandidates = getUnlockedRecruitCandidates(state, registries, { includeOwned: false });
  const activeBanner = getActiveRecruitBanner();
  const unlockedFactionIds = [...new Set(recruitPool.map((disciple) => disciple.faction).filter(Boolean))];
  const selectedFactionId = unlockedFactionIds.includes(state.disciples.recruit?.selectedFactionId)
    ? state.disciples.recruit.selectedFactionId
    : (unlockedFactionIds[0] ?? null);
  const factionOptions = unlockedFactionIds
    .map((factionId) => {
      const meta = getFactionMeta(factionId);
      const members = recruitPool.filter((disciple) => disciple.faction === factionId);
      return {
        ...(meta ?? { id: factionId, label: factionId, description: '暂无说明' }),
        memberCount: members.length,
      };
    });
  const recruitHistory = Array.isArray(state.disciples.recruit?.history)
    ? state.disciples.recruit.history
      .map((entry) => {
        const disciple = registries.disciples.get(entry.discipleId);
        if (!disciple) {
          return null;
        }
        return {
          ...entry,
          discipleName: disciple.name,
          modeLabel: getRecruitModeLabel(entry.mode),
          factionLabel: getFactionMeta(entry.factionId)?.label ?? disciple.faction ?? '无门类',
        };
      })
      .filter(Boolean)
    : [];
  const lastBatch = Array.isArray(state.disciples.recruit?.lastBatch)
    ? state.disciples.recruit.lastBatch
      .map((entry) => {
        const disciple = registries.disciples.get(entry.discipleId);
        if (!disciple) {
          return null;
        }
        return {
          ...entry,
          discipleName: disciple.name,
          modeLabel: getRecruitModeLabel(entry.mode),
          factionLabel: getFactionMeta(entry.factionId)?.label ?? disciple.faction ?? '无门类',
        };
      })
      .filter(Boolean)
    : [];
  const lastRecruit = state.disciples.recruit?.lastResult
    ? (() => {
      const disciple = registries.disciples.get(state.disciples.recruit.lastResult.discipleId);
      if (!disciple) {
        return null;
      }
      return {
        ...state.disciples.recruit.lastResult,
        discipleName: disciple.name,
        modeLabel: getRecruitModeLabel(state.disciples.recruit.lastResult.mode),
        factionLabel: getFactionMeta(state.disciples.recruit.lastResult.factionId)?.label ?? disciple.faction ?? '无门类',
      };
    })()
    : null;
  const recruitModes = {
    standard: {
      mode: 'standard',
      label: getRecruitModeLabel('standard'),
      cost: getRecruitModeCost('standard'),
      tenCost: getRecruitModeCost('standard', 10),
      affordable: recruitPool.length > 0 && canAfford(state, getRecruitModeCost('standard')),
      tenAffordable: recruitPool.length > 0 && canAfford(state, getRecruitModeCost('standard', 10)),
    },
    advanced: {
      mode: 'advanced',
      label: getRecruitModeLabel('advanced'),
      cost: getRecruitModeCost('advanced'),
      tenCost: getRecruitModeCost('advanced', 10),
      affordable: recruitPool.length > 0 && canAfford(state, getRecruitModeCost('advanced')),
      tenAffordable: recruitPool.length > 0 && canAfford(state, getRecruitModeCost('advanced', 10)),
    },
    faction: {
      mode: 'faction',
      label: getRecruitModeLabel('faction'),
      cost: getRecruitModeCost('faction'),
      tenCost: getRecruitModeCost('faction', 10),
      affordable: Boolean(selectedFactionId) && canAfford(state, getRecruitModeCost('faction')),
      tenAffordable: Boolean(selectedFactionId) && canAfford(state, getRecruitModeCost('faction', 10)),
    },
    targeted: {
      mode: 'targeted',
      label: getRecruitModeLabel('targeted'),
      cost: getRecruitModeCost('targeted'),
      affordable: recruitableCandidates.length > 0 && Boolean(recruitFocusId) && canAfford(state, getRecruitModeCost('targeted')),
    },
  };
  const recruitTokens = listRecruitTokenDefinitions().map((token) => ({
    ...token,
    owned: state.resources?.[token.resourceId] ?? 0,
    affordable: canAfford(state, token.purchaseCost),
  }));

  const disciples = registries.disciples.list().map((disciple) => {
    const level = state.disciples.levels?.[disciple.id] ?? (owned.has(disciple.id) ? 1 : 0);
    const resonanceLevel = state.disciples.resonance?.[disciple.id] ?? 0;
    const effectMultiplier = getDiscipleEffectMultiplier(level || 1, resonanceLevel, disciple.rarity);
    return {
      ...disciple,
      unlocked: unlocked.has(disciple.id) || owned.has(disciple.id),
      owned: owned.has(disciple.id),
      recruitFocused: recruitFocusId === disciple.id,
      elder: elders.has(disciple.id),
      stationedAt: Object.entries(state.disciples.stationed).find(([, id]) => id === disciple.id)?.[0] ?? null,
      mode: state.disciples.modes?.[disciple.id] ?? 'idle',
      cooldownUntil: state.disciples.cooldowns?.[disciple.id] ?? 0,
      level,
      resonanceLevel,
      resonanceTitle: getDiscipleResonanceTitle(resonanceLevel),
      resonanceBonus: getDiscipleResonanceBonus(disciple.rarity, resonanceLevel),
      effectMultiplier,
      nextEffectMultiplier: getDiscipleEffectMultiplier(level || 1, resonanceLevel + 1, disciple.rarity),
      canAdvanceResonance: owned.has(disciple.id) && canAdvanceDiscipleResonance(resonanceLevel),
      resonanceCost: getDiscipleResonanceCost(disciple.rarity, resonanceLevel),
      canRecruit: (unlocked.has(disciple.id) || owned.has(disciple.id)) && !owned.has(disciple.id),
      canTrain: owned.has(disciple.id) && canTrainDisciple(level || 1),
      trainingCost: getDiscipleTrainingCost(level || 1),
    };
  });

  disciples.recruitPool = {
    focusId: recruitFocusId,
    availableCount: recruitPool.length,
    recruitableCount: recruitableCandidates.length,
    lastRecruit,
    lastBatch,
    history: recruitHistory,
    modes: recruitModes,
    tokens: recruitTokens,
    activeBanner: activeBanner
      ? {
        ...activeBanner,
        upNames: activeBanner.upDiscipleIds.map((id) => registries.disciples.get(id)?.name ?? id),
      }
      : null,
    selectedFactionId,
    factionOptions,
    shardBalance: state.resources?.discipleShard ?? 0,
    pity: {
      current: {
        ...(state.disciples.recruit?.pity ?? { advancedEpic: 0, advancedLegendary: 0 }),
      },
      thresholds: getRecruitPityThresholds(),
    },
  };

  const expeditionMembers = [
    state.disciples.expeditionTeam?.leaderId ?? null,
    ...(state.disciples.expeditionTeam?.supportIds ?? []),
  ]
    .filter(Boolean)
    .map((discipleId) => disciples.find((disciple) => disciple.id === discipleId))
    .filter(Boolean);

  disciples.expedition = {
    leaderId: state.disciples.expeditionTeam?.leaderId ?? null,
    supportIds: [...(state.disciples.expeditionTeam?.supportIds ?? [])],
    members: expeditionMembers,
    bonds: getExpeditionBondSnapshot(expeditionMembers),
  };

  return disciples;
}

export function getBeastSnapshot(state, registries) {
  const unlocked = new Set(state.beasts.unlocked);
  const active = new Set(state.beasts.activeIds);
  const currentStage = registries.stages.get(state.war?.currentStageId);
  const currentEnemyTags = new Set(currentStage?.enemyTags ?? []);

  return registries.beasts.list().map((beast) => ({
    ...beast,
    unlocked: unlocked.has(beast.id),
    active: active.has(beast.id),
    awakeningLevel: state.beasts.awakeningLevels?.[beast.id] ?? 0,
    canAwaken: unlocked.has(beast.id) && canAwakenBeast(state.beasts.awakeningLevels?.[beast.id] ?? 0),
    awakeningCost: getBeastAwakeningCost(state.beasts.awakeningLevels?.[beast.id] ?? 0),
    bondLevel: state.beasts.bondLevels?.[beast.id] ?? 0,
    canTemper: unlocked.has(beast.id) && canTemperBeast(state.beasts.bondLevels?.[beast.id] ?? 0),
    bondCost: getBeastBondCost(beast, state.beasts.bondLevels?.[beast.id] ?? 0),
    fitScore: (beast.favoredTags ?? []).reduce((sum, tag) => sum + (currentEnemyTags.has(tag) ? 1 : 0), 0),
  }));
}

export function getBeastMenagerieSnapshot(state, registries) {
  const beasts = getBeastSnapshot(state, registries);
  const unlockedBeasts = beasts.filter((beast) => beast.unlocked);
  const activeBeasts = beasts.filter((beast) => beast.active);
  const featuredBeast = [...unlockedBeasts]
    .sort((left, right) => (
      ((right.fitScore ?? 0) - (left.fitScore ?? 0))
      || ((right.bondLevel ?? 0) - (left.bondLevel ?? 0))
      || ((right.awakeningLevel ?? 0) - (left.awakeningLevel ?? 0))
      || left.id.localeCompare(right.id)
    ))[0] ?? null;

  const recommendedLineup = buildBeastLineups(unlockedBeasts)
    .map((lineup) => evaluateBeastLineup(lineup))
    .sort((left, right) => (
      (right.score - left.score)
      || ((right.activeBondSnapshot?.activeBonds?.length ?? 0) - (left.activeBondSnapshot?.activeBonds?.length ?? 0))
      || ((right.activeBondSnapshot?.totalFitScore ?? 0) - (left.activeBondSnapshot?.totalFitScore ?? 0))
      || ((right.activeBondSnapshot?.totalBond ?? 0) - (left.activeBondSnapshot?.totalBond ?? 0))
      || getBeastLineupSignature(left.beastIds).localeCompare(getBeastLineupSignature(right.beastIds))
    ))[0] ?? null;

  const activeLineup = evaluateBeastLineup(activeBeasts);
  const activeSignature = getBeastLineupSignature(activeLineup.beastIds);
  const recommendedSignature = getBeastLineupSignature(recommendedLineup?.beastIds ?? []);

  return {
    beasts,
    featuredBeast,
    activeLineup: {
      ...activeLineup,
      sameAsRecommended: Boolean(activeSignature && activeSignature === recommendedSignature),
    },
    activeBondSnapshot: activeLineup.activeBondSnapshot,
    recommendedLineup: recommendedLineup
      ? {
        ...recommendedLineup,
        sameAsActive: Boolean(activeSignature && activeSignature === recommendedSignature),
      }
      : null,
    expedition: getBeastExpeditionSnapshot(state, registries, beasts),
  };
}
