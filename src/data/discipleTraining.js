import { getDiscipleEffectMultiplier } from './discipleAdvancement.js';

export const DISCIPLE_MAX_LEVEL = 20;
export const DISCIPLE_TRAINING_COST_GROWTH = 1.55;

const BASE_TRAINING_COST = {
  dao: 120,
  spiritCrystal: 18,
  lingStone: 160,
};

export function getDiscipleTrainingCost(currentLevel) {
  const safeLevel = Math.max(1, Number(currentLevel) || 1);
  const factor = DISCIPLE_TRAINING_COST_GROWTH ** Math.max(safeLevel - 1, 0);
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
