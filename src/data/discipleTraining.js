import { getDiscipleEffectMultiplier } from './discipleAdvancement.js';

export const DISCIPLE_MAX_LEVEL = 20;
export const DISCIPLE_TRAINING_COST_GROWTH = 1.42;

const BASE_TRAINING_COST = {
  dao: 96,
  spiritCrystal: 14,
  lingStone: 128,
};

const TRAINING_LEVEL_FACTORS = Object.freeze([
  0.68,
  0.82,
  0.96,
  1.12,
  1.32,
  1.56,
  1.84,
  2.18,
  2.6,
  3.12,
  3.78,
  4.58,
  5.56,
  6.76,
  8.22,
  10.02,
  12.24,
  14.98,
  18.36,
  22.54,
]);

export function getDiscipleTrainingCost(currentLevel) {
  const safeLevel = Math.max(1, Number(currentLevel) || 1);
  const factor = TRAINING_LEVEL_FACTORS[safeLevel - 1]
    ?? (TRAINING_LEVEL_FACTORS[TRAINING_LEVEL_FACTORS.length - 1]
      * (DISCIPLE_TRAINING_COST_GROWTH ** Math.max(safeLevel - TRAINING_LEVEL_FACTORS.length, 0)));
  const cost = {};
  for (const [resourceId, amount] of Object.entries(BASE_TRAINING_COST)) {
    cost[resourceId] = Math.round(amount * factor);
  }
  return cost;
}

export function canTrainDisciple(level) {
  return (Number(level) || 1) < DISCIPLE_MAX_LEVEL;
}

export { getDiscipleEffectMultiplier };
