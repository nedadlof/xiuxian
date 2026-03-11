import { appendLog } from './shared/logs.js';
import { canTrainDisciple, getDiscipleEffectMultiplier, getDiscipleTrainingCost } from '../data/discipleTraining.js';
import {
  canAdvanceDiscipleResonance,
  getDiscipleResonanceBonus,
  getDiscipleResonanceCost,
  getDiscipleResonanceTitle,
} from '../data/discipleAdvancement.js';
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
    },
    tick({ store }) {
      store.update((draft) => {
        ensureCharacterState(draft);
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
    const allIds = [leaderId, ...supportIds].filter(Boolean);
    if (allIds.some((discipleId) => !isOwnedDisciple(draft, discipleId) || hasCooldown(draft, discipleId))) {
      return;
    }

    for (const discipleId of allIds) {
      removeFromStations(draft, discipleId);
      removeFromExpedition(draft, discipleId);
      draft.disciples.modes[discipleId] = 'expedition';
      setCooldown(draft, discipleId);
    }

    draft.disciples.expeditionTeam.leaderId = leaderId ?? null;
    draft.disciples.expeditionTeam.supportIds = supportIds.slice(0, 2);
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

  return disciples;
}

export function getBeastSnapshot(state, registries) {
  const unlocked = new Set(state.beasts.unlocked);
  const active = new Set(state.beasts.activeIds);

  return registries.beasts.list().map((beast) => ({
    ...beast,
    unlocked: unlocked.has(beast.id),
    active: active.has(beast.id),
  }));
}
