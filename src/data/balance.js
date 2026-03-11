export const BUILDING_OUTPUT_GROWTH = 1.2;
export const BUILDING_COST_GROWTH = 1.85;
export const OFFLINE_REWARD_LIMIT_SECONDS = 60 * 60 * 8;
export const SCRIPTURE_BASE_RATE = 5;
export const DEFAULT_FORMATION = 'balanced-array';

export function getLevelMultiplier(level) {
  return BUILDING_OUTPUT_GROWTH ** Math.max(level - 1, 0);
}

export function getUpgradeCost(baseCost, level) {
  return Math.round(baseCost * (BUILDING_COST_GROWTH ** Math.max(level - 1, 0)));
}

export function getWorkerEfficiency(workers) {
  let total = 0;

  for (let index = 1; index <= workers; index += 1) {
    if (index <= 10) {
      total += 1;
      continue;
    }

    total += 1 / (1 + 0.03 * (index - 10));
  }

  return total;
}

export function getScriptureRatePerHour(workers) {
  return SCRIPTURE_BASE_RATE * (workers ** 2);
}

export function getDormitoryMaintenancePerHour(index) {
  return 50 * (2 ** Math.max(index - 1, 0));
}

export function getDormitoryCapacity(level) {
  return level * 5 + 20;
}

export function clampResource(value, storageCap) {
  return Math.max(0, Math.min(value, storageCap));
}
