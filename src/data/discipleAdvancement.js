export const DISCIPLE_RESONANCE_MAX_LEVEL = 5;

const RESONANCE_BASE_COSTS = Object.freeze({
  common: { discipleShard: 40, dao: 800, spiritCrystal: 10 },
  rare: { discipleShard: 65, dao: 1200, spiritCrystal: 14 },
  epic: { discipleShard: 100, dao: 1800, spiritCrystal: 18 },
  legendary: { discipleShard: 160, dao: 2600, spiritCrystal: 24 },
});

const RESONANCE_TITLES = Object.freeze([
  '凡躯',
  '灵骨',
  '真命',
  '道胎',
  '归一',
  '仙魄',
]);

const RESONANCE_BONUS_PER_LEVEL = Object.freeze({
  common: 0.1,
  rare: 0.12,
  epic: 0.15,
  legendary: 0.18,
});

const RESONANCE_COST_GROWTH = 1.55;
const LEVEL_BONUS_PER_LEVEL = 0.12;

function getSafeResonanceLevel(level) {
  return Math.max(0, Math.min(Number(level) || 0, DISCIPLE_RESONANCE_MAX_LEVEL));
}

function getResonanceRarity(rarity) {
  return RESONANCE_BASE_COSTS[rarity] ? rarity : 'common';
}

export function getDiscipleResonanceBonus(rarity, resonanceLevel = 0) {
  const safeRarity = getResonanceRarity(rarity);
  const safeLevel = getSafeResonanceLevel(resonanceLevel);
  return safeLevel * (RESONANCE_BONUS_PER_LEVEL[safeRarity] ?? RESONANCE_BONUS_PER_LEVEL.common);
}

export function getDiscipleEffectMultiplier(level, resonanceLevel = 0, rarity = 'common') {
  const safeLevel = Math.max(1, Number(level) || 1);
  return 1 + (safeLevel - 1) * LEVEL_BONUS_PER_LEVEL + getDiscipleResonanceBonus(rarity, resonanceLevel);
}

export function getDiscipleResonanceCost(rarity, currentLevel = 0) {
  const safeRarity = getResonanceRarity(rarity);
  const safeLevel = getSafeResonanceLevel(currentLevel);
  const factor = RESONANCE_COST_GROWTH ** safeLevel;
  const cost = {};

  for (const [resourceId, amount] of Object.entries(RESONANCE_BASE_COSTS[safeRarity] ?? {})) {
    cost[resourceId] = Math.round(amount * factor);
  }

  return cost;
}

export function canAdvanceDiscipleResonance(level) {
  return getSafeResonanceLevel(level) < DISCIPLE_RESONANCE_MAX_LEVEL;
}

export function getDiscipleResonanceTitle(level) {
  return RESONANCE_TITLES[getSafeResonanceLevel(level)] ?? RESONANCE_TITLES[0];
}
