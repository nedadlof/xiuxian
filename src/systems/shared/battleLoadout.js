import { getCraftingSnapshot } from './crafting.js';

const DEFAULT_EFFECT_WEIGHTS = Object.freeze({
  battleAttack: 0.2,
  battleDefense: 0.2,
  battleSustain: 0.2,
  battleLoot: 0.1,
  unitPowerMultiplier: 0.2,
});

const DISCIPLE_LOADOUT_PROFILES = Object.freeze({
  'han-li': {
    styleLabel: '丹火养阵',
    preferredWeaponTags: ['support', 'alchemy', 'mystic'],
    preferredPillTags: ['support', 'alchemy'],
    effectWeights: {
      battleSustain: 1,
      battleDefense: 0.55,
      unitPowerMultiplier: 0.35,
      battleAttack: 0.15,
    },
    rewardFocus: { herb: 1, pills: 0.9, spiritCrystal: 0.35 },
  },
  'su-qinghe': {
    styleLabel: '青木温养',
    preferredWeaponTags: ['support', 'alchemy', 'defense'],
    preferredPillTags: ['support', 'alchemy', 'defense'],
    effectWeights: {
      battleSustain: 0.9,
      battleDefense: 0.65,
      battleLoot: 0.15,
    },
    rewardFocus: { herb: 1, wood: 0.65, pills: 0.45 },
  },
  'wu-tie': {
    styleLabel: '重锻护阵',
    preferredWeaponTags: ['defense', 'command', 'pierce'],
    preferredPillTags: ['defense', 'support', 'command'],
    effectWeights: {
      battleDefense: 1,
      unitPowerMultiplier: 0.7,
      battleSustain: 0.45,
    },
    rewardFocus: { iron: 1, weaponEssence: 0.7, spiritCrystal: 0.35 },
  },
  'yunhuang-weining': {
    styleLabel: '逐利统军',
    preferredWeaponTags: ['hunt', 'command', 'ranged'],
    preferredPillTags: ['hunt', 'command', 'burst'],
    effectWeights: {
      battleLoot: 1,
      unitPowerMultiplier: 0.8,
      battleAttack: 0.4,
    },
    rewardFocus: { dao: 1, discipleShard: 0.8, lingStone: 0.45 },
  },
  'lin-shu': {
    styleLabel: '山门固守',
    preferredWeaponTags: ['defense', 'support', 'command'],
    preferredPillTags: ['defense', 'support'],
    effectWeights: {
      battleDefense: 0.9,
      battleSustain: 0.7,
      unitPowerMultiplier: 0.35,
    },
    rewardFocus: { wood: 1, herb: 0.4, spiritCrystal: 0.25 },
  },
  'ye-cangqiong': {
    styleLabel: '飞剑斩首',
    preferredWeaponTags: ['burst', 'ranged', 'pierce', 'mystic'],
    preferredPillTags: ['burst', 'mystic', 'command'],
    effectWeights: {
      battleAttack: 1,
      unitPowerMultiplier: 0.55,
      battleLoot: 0.3,
    },
    rewardFocus: { talisman: 1, spiritCrystal: 0.55, seekImmortalToken: 0.3 },
  },
  'mu-qingyan': {
    styleLabel: '幽灯残局',
    preferredWeaponTags: ['mystic', 'support', 'control'],
    preferredPillTags: ['support', 'mystic', 'alchemy'],
    effectWeights: {
      battleSustain: 0.85,
      battleDefense: 0.5,
      battleAttack: 0.2,
      battleLoot: 0.2,
    },
    rewardFocus: { pills: 0.8, discipleShard: 0.55, spiritCrystal: 0.45 },
  },
});

function round2(value = 0) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function round4(value = 0) {
  return Math.round((Number(value) || 0) * 10000) / 10000;
}

function getRarityRank(rarity = 'common') {
  switch (rarity) {
    case 'legendary':
      return 4;
    case 'epic':
      return 3;
    case 'rare':
      return 2;
    default:
      return 1;
  }
}

function mergeEffectWeights(baseWeights = {}, nextWeights = {}) {
  return {
    ...baseWeights,
    ...nextWeights,
  };
}

function deriveUnitLoadoutProfile(unit = {}) {
  const tags = unit.tags ?? [];
  if (tags.includes('defense') || unit.role === 'frontline') {
    return {
      styleLabel: '前排镇守',
      preferredWeaponTags: ['defense', 'command', 'melee', 'pierce'],
      preferredPillTags: ['defense', 'support', 'alchemy', 'command'],
      effectWeights: {
        battleDefense: 1,
        battleSustain: 0.65,
        unitPowerMultiplier: 0.55,
        battleAttack: 0.2,
      },
    };
  }
  if (tags.includes('support') || tags.includes('sustain') || unit.role === 'support') {
    return {
      styleLabel: '辅战后勤',
      preferredWeaponTags: ['support', 'command', 'alchemy', 'mystic'],
      preferredPillTags: ['support', 'alchemy', 'mystic', 'command'],
      effectWeights: {
        battleSustain: 1,
        battleDefense: 0.45,
        unitPowerMultiplier: 0.75,
        battleLoot: 0.2,
      },
    };
  }
  if (tags.includes('ranged') || tags.includes('pierce') || tags.includes('flying') || unit.role === 'backline') {
    return {
      styleLabel: '后排破阵',
      preferredWeaponTags: ['ranged', 'pierce', 'hunt', 'burst'],
      preferredPillTags: ['burst', 'command', 'mystic', 'hunt'],
      effectWeights: {
        battleAttack: 1,
        unitPowerMultiplier: 0.55,
        battleLoot: 0.35,
        battleSustain: 0.15,
      },
    };
  }
  if (tags.includes('magic') || tags.includes('control') || tags.includes('fire') || tags.includes('dot')) {
    return {
      styleLabel: '术法压制',
      preferredWeaponTags: ['mystic', 'control', 'burst', 'support'],
      preferredPillTags: ['mystic', 'burst', 'support', 'alchemy'],
      effectWeights: {
        battleAttack: 0.8,
        battleSustain: 0.35,
        battleDefense: 0.2,
        battleLoot: 0.25,
        unitPowerMultiplier: 0.25,
      },
    };
  }
  if (tags.includes('burst') || tags.includes('melee')) {
    return {
      styleLabel: '近战突击',
      preferredWeaponTags: ['burst', 'melee', 'pierce', 'command'],
      preferredPillTags: ['burst', 'command', 'hunt'],
      effectWeights: {
        battleAttack: 1,
        unitPowerMultiplier: 0.45,
        battleDefense: 0.18,
        battleLoot: 0.2,
      },
    };
  }
  return {
    styleLabel: '均衡战备',
    preferredWeaponTags: ['command', 'support', 'burst'],
    preferredPillTags: ['command', 'support', 'burst'],
    effectWeights: { ...DEFAULT_EFFECT_WEIGHTS },
  };
}

function deriveDiscipleLoadoutProfile(disciple = {}) {
  const override = DISCIPLE_LOADOUT_PROFILES[disciple.id];
  if (override) {
    return {
      ...override,
      preferredWeaponTags: [...(override.preferredWeaponTags ?? [])],
      preferredPillTags: [...(override.preferredPillTags ?? [])],
      effectWeights: mergeEffectWeights(DEFAULT_EFFECT_WEIGHTS, override.effectWeights),
      rewardFocus: { ...(override.rewardFocus ?? {}) },
    };
  }

  const station = disciple.station ?? '';
  if (station === 'alchemy') {
    return {
      styleLabel: '丹房支援',
      preferredWeaponTags: ['support', 'alchemy', 'mystic'],
      preferredPillTags: ['support', 'alchemy'],
      effectWeights: mergeEffectWeights(DEFAULT_EFFECT_WEIGHTS, {
        battleSustain: 0.8,
        battleDefense: 0.4,
      }),
      rewardFocus: { herb: 1, pills: 0.85, spiritCrystal: 0.25 },
    };
  }
  if (station === 'smithy') {
    return {
      styleLabel: '军备督造',
      preferredWeaponTags: ['defense', 'command', 'pierce'],
      preferredPillTags: ['defense', 'command'],
      effectWeights: mergeEffectWeights(DEFAULT_EFFECT_WEIGHTS, {
        battleDefense: 0.9,
        unitPowerMultiplier: 0.55,
      }),
      rewardFocus: { iron: 1, weaponEssence: 0.6 },
    };
  }
  return {
    styleLabel: '出征辅战',
    preferredWeaponTags: ['command', 'support', 'mystic'],
    preferredPillTags: ['support', 'mystic', 'alchemy'],
    effectWeights: { ...DEFAULT_EFFECT_WEIGHTS },
    rewardFocus: {},
  };
}

function buildEffectTotals(effects = []) {
  return effects.reduce((totals, effect) => {
    if (!effect?.type) {
      return totals;
    }
    totals[effect.type] = (totals[effect.type] ?? 0) + (Number(effect.value) || 0);
    return totals;
  }, {});
}

function evaluateItemMatch(candidate, profile, kind = 'weapon') {
  if (!candidate || !profile) {
    return null;
  }

  const definition = kind === 'weapon' ? candidate.blueprint : candidate.recipe;
  const tags = definition?.tags ?? [];
  const preferredTags = kind === 'weapon' ? (profile.preferredWeaponTags ?? []) : (profile.preferredPillTags ?? []);
  const tagHits = preferredTags.filter((tag) => tags.includes(tag));
  const effectTotals = buildEffectTotals(candidate.totalEffects ?? []);
  const effectScore = Object.entries(profile.effectWeights ?? {})
    .reduce((sum, [effectType, weight]) => sum + (effectTotals[effectType] ?? 0) * (Number(weight) || 0) * 90, 0);
  const qualityScore = kind === 'weapon'
    ? ((candidate.qualityRoll ?? 1) - 0.9) * 18 + (candidate.strengthenLevel ?? 0) * 1.6
    : ((candidate.potencyRoll ?? 1) - 0.9) * 16 + Math.max((candidate.servings ?? 1) - 1, 0) * 1.4;
  const score = tagHits.length * 3.4 + effectScore + qualityScore + getRarityRank(definition?.rarity) * 0.8;
  const fitRatio = Math.min(1, Math.max(score, 0) / 18);

  return {
    id: candidate.id,
    name: candidate.name,
    kind,
    score: round2(score),
    fitRatio: round4(fitRatio),
    tagHits,
    qualityLabel: kind === 'weapon' ? candidate.qualityLabel : candidate.potencyLabel,
    effectTotals,
    rarity: definition?.rarity ?? 'common',
  };
}

function pickBestMatch(candidates = [], profile, kind) {
  return [...candidates]
    .map((candidate) => evaluateItemMatch(candidate, profile, kind))
    .filter(Boolean)
    .sort((left, right) => (
      (right.score - left.score)
      || (right.fitRatio - left.fitRatio)
      || left.name.localeCompare(right.name)
    ))[0] ?? null;
}

function formatPercent(value = 0) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function buildCombatBonus(profile, weaponMatch, pillMatch) {
  const combinedFit = Math.min(1, ((weaponMatch?.fitRatio ?? 0) * 0.55) + ((pillMatch?.fitRatio ?? 0) * 0.45));
  const weaponEffects = weaponMatch?.effectTotals ?? {};
  const pillEffects = pillMatch?.effectTotals ?? {};
  const attackBonus = combinedFit * (
    ((weaponEffects.battleAttack ?? 0) * 0.38)
    + ((pillEffects.battleAttack ?? 0) * 0.32)
    + (((weaponEffects.unitPowerMultiplier ?? 0) + (pillEffects.unitPowerMultiplier ?? 0)) * 0.16)
    + (((weaponEffects.battleLoot ?? 0) + (pillEffects.battleLoot ?? 0)) * 0.06)
  ) * ((profile.effectWeights?.battleAttack ?? 0) + 0.35);
  const defenseBonus = combinedFit * (
    ((weaponEffects.battleDefense ?? 0) * 0.34)
    + ((pillEffects.battleDefense ?? 0) * 0.3)
    + (((weaponEffects.unitPowerMultiplier ?? 0) + (pillEffects.unitPowerMultiplier ?? 0)) * 0.12)
    + (((weaponEffects.battleSustain ?? 0) + (pillEffects.battleSustain ?? 0)) * 0.08)
  ) * ((profile.effectWeights?.battleDefense ?? 0) + 0.35);
  const sustainBonus = combinedFit * (
    ((weaponEffects.battleSustain ?? 0) * 0.34)
    + ((pillEffects.battleSustain ?? 0) * 0.38)
    + (((weaponEffects.battleDefense ?? 0) + (pillEffects.battleDefense ?? 0)) * 0.08)
    + (((weaponEffects.battleLoot ?? 0) + (pillEffects.battleLoot ?? 0)) * 0.04)
  ) * ((profile.effectWeights?.battleSustain ?? 0) + 0.35);

  return {
    attack: round4(Math.min(attackBonus, 0.18)),
    defense: round4(Math.min(defenseBonus, 0.18)),
    sustain: round4(Math.min(sustainBonus, 0.18)),
  };
}

function buildLoadoutEntry(identity, profile, activeWeapons = [], activeBatches = []) {
  const weaponMatch = pickBestMatch(activeWeapons, profile, 'weapon');
  const pillMatch = pickBestMatch(activeBatches, profile, 'pill');
  const bonus = buildCombatBonus(profile, weaponMatch, pillMatch);
  const fitScore = round2((((weaponMatch?.fitRatio ?? 0) * 55) + ((pillMatch?.fitRatio ?? 0) * 45)) * 100);

  return {
    ...identity,
    styleLabel: profile.styleLabel,
    weaponMatch,
    pillMatch,
    fitScore,
    bonus,
    summary: [
      weaponMatch ? `专武 ${weaponMatch.name}` : '暂无专武匹配',
      pillMatch ? `专丹 ${pillMatch.name}` : '暂无专丹匹配',
      `攻 ${formatPercent(bonus.attack)} · 守 ${formatPercent(bonus.defense)} · 续 ${formatPercent(bonus.sustain)}`,
    ].join(' · '),
  };
}

function buildRewardBonusMap(entries = []) {
  const rewardBonusMap = {};
  for (const entry of entries) {
    const focusMap = entry.rewardFocus ?? {};
    const fitRatio = Math.min((entry.fitScore ?? 0) / 100, 1);
    for (const [resourceId, weight] of Object.entries(focusMap)) {
      rewardBonusMap[resourceId] = Math.min(
        0.32,
        (rewardBonusMap[resourceId] ?? 0) + fitRatio * (Number(weight) || 0) * 0.12,
      );
    }
  }
  return Object.fromEntries(Object.entries(rewardBonusMap).filter(([, value]) => value > 0));
}

function buildExpeditionEntries(state, registries, activeWeapons, activeBatches) {
  const discipleIds = [
    state.disciples?.expeditionTeam?.leaderId ?? null,
    ...(state.disciples?.expeditionTeam?.supportIds ?? []),
  ].filter(Boolean);

  return discipleIds
    .map((discipleId) => {
      const disciple = registries.disciples.get(discipleId);
      if (!disciple) {
        return null;
      }
      const profile = deriveDiscipleLoadoutProfile(disciple);
      return {
        ...buildLoadoutEntry({
          discipleId,
          name: disciple.name,
        }, profile, activeWeapons, activeBatches),
        rewardFocus: { ...(profile.rewardFocus ?? {}) },
      };
    })
    .filter(Boolean);
}

export function getBattleLoadoutSnapshot(state, registries) {
  const craftingSnapshot = getCraftingSnapshot(state);
  const activeWeapons = craftingSnapshot.arsenal?.activeWeapons ?? [];
  const activeBatches = craftingSnapshot.alchemy?.activeBatches ?? [];
  const unitEntries = registries.units.list().map((unit) => {
    const profile = deriveUnitLoadoutProfile(unit);
    return buildLoadoutEntry({
      unitId: unit.id,
      name: unit.name,
    }, profile, activeWeapons, activeBatches);
  });
  const expeditionEntries = buildExpeditionEntries(state, registries, activeWeapons, activeBatches);
  const topUnits = [...unitEntries]
    .sort((left, right) => (
      (right.fitScore - left.fitScore)
      || (right.bonus.attack - left.bonus.attack)
      || left.name.localeCompare(right.name)
    ))
    .slice(0, 3);

  return {
    activeWeaponCount: activeWeapons.length,
    activePillCount: activeBatches.length,
    byUnitId: Object.fromEntries(unitEntries.map((entry) => [entry.unitId, entry])),
    byDiscipleId: Object.fromEntries(expeditionEntries.map((entry) => [entry.discipleId, entry])),
    topUnits,
    expeditionEntries,
    rewardBonusMap: buildRewardBonusMap(expeditionEntries),
    averageExpeditionFit: expeditionEntries.length
      ? round2(expeditionEntries.reduce((sum, entry) => sum + (entry.fitScore ?? 0), 0) / expeditionEntries.length)
      : 0,
  };
}
