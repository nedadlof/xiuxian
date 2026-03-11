import { getScriptureRatePerHour } from '../data/balance.js';
import { appendLog } from './shared/logs.js';
import { collectUnlockedEffects, sumEffects } from './shared/effectResolver.js';

const ERA_ORDER = ['启蒙纪元', '阵法纪元', '万象纪元', '炼器纪元', '大道纪元'];

function ensureScriptureState(state) {
  state.scripture.flags ??= {};
  state.scripture.cooldowns ??= {};
  state.scripture.unlockedSystems ??= [];
  state.disciples.unlocked ??= [];
  state.disciples.owned ??= [];
  state.beasts.unlocked ??= [];
  state.beasts.activeIds ??= [];
}

function getNodeEraIndex(era) {
  return Math.max(ERA_ORDER.indexOf(era), 0);
}

function refreshEra(state, registries) {
  const highest = state.scripture.unlockedNodes
    .map((id) => registries.techNodes.get(id))
    .filter(Boolean)
    .reduce((bestIndex, node) => Math.max(bestIndex, getNodeEraIndex(node.era)), 0);

  state.scripture.era = ERA_ORDER[highest] ?? ERA_ORDER[0];
}

function getNodeBlockingReasons(state, node) {
  const unlockedNodes = new Set(state.scripture.unlockedNodes);
  return (node.prerequisites ?? []).filter((nodeId) => !unlockedNodes.has(nodeId));
}

function canResearchNode(state, node) {
  return getNodeBlockingReasons(state, node).length === 0;
}

function getMissingTechCosts(state, node) {
  const missingCosts = {};

  const daoNeed = Math.max((node.daoCost ?? 0) - (state.resources.dao ?? 0), 0);
  if (daoNeed > 0) {
    missingCosts.dao = daoNeed;
  }

  for (const [resourceId, amount] of Object.entries(node.resourceCosts ?? {})) {
    const missing = Math.max(amount - (state.resources[resourceId] ?? 0), 0);
    if (missing > 0) {
      missingCosts[resourceId] = missing;
    }
  }

  return missingCosts;
}

function canPayTechCost(state, node) {
  return Object.keys(getMissingTechCosts(state, node)).length === 0;
}

function payTechCost(state, node) {
  state.resources.dao -= node.daoCost ?? 0;
  for (const [resourceId, amount] of Object.entries(node.resourceCosts ?? {})) {
    state.resources[resourceId] -= amount;
  }
}

function applyNodeEffects(state, registries, node) {
  for (const effect of node.effects ?? []) {
    switch (effect.type) {
      case 'maxDormitories':
        state.housing.maxDormitories += effect.value ?? 0;
        break;
      case 'discipleUnlock':
        for (const discipleId of effect.discipleIds ?? []) {
          if (!state.disciples.unlocked.includes(discipleId)) {
            state.disciples.unlocked.push(discipleId);
          }
        }
        break;
      case 'beastUnlock':
        for (const beastId of effect.beastIds ?? []) {
          if (!state.beasts.unlocked.includes(beastId)) {
            state.beasts.unlocked.push(beastId);
          }
          if (state.beasts.activeIds.length < 3 && !state.beasts.activeIds.includes(beastId)) {
            state.beasts.activeIds.push(beastId);
          }
        }
        break;
      case 'systemUnlock':
        for (const systemId of effect.systemIds ?? []) {
          if (!state.scripture.unlockedSystems.includes(systemId)) {
            state.scripture.unlockedSystems.push(systemId);
          }
        }
        break;
      case 'elderModeUnlock':
        state.scripture.flags.elderModeUnlocked = true;
        break;
      case 'tradeUnlocked':
        state.scripture.flags.tradeUnlocked = true;
        break;
      case 'unitUnlock':
        state.scripture.flags.lastUnlockedUnits = effect.unitIds ?? [];
        break;
      case 'buildingUnlock':
        state.scripture.flags.lastUnlockedBuildings = effect.buildingIds ?? [];
        break;
      default:
        break;
    }
  }

  refreshEra(state, registries);
}

export function createScriptureSystem() {
  return {
    id: 'scripture-system',
    setup({ store, bus, registries }) {
      store.update((draft) => {
        ensureScriptureState(draft);
        refreshEra(draft, registries);
      }, { type: 'scripture/setup' });

      bus.on('action:scripture/research', ({ nodeId }) => {
        researchNode({ store, registries }, nodeId);
      });
    },
    tick({ store, registries }, deltaSeconds) {
      store.update((draft) => {
        ensureScriptureState(draft);
        const workers = draft.workforce.assignedWorkers.scriptureHall ?? 0;
        if (workers <= 0) {
          return;
        }

        const { all } = collectUnlockedEffects(draft, registries);
        const multiplier = 1 + sumEffects(all, 'scriptureRateMultiplier');
        const perHour = getScriptureRatePerHour(workers) * multiplier;
        draft.resources.dao += (perHour * deltaSeconds) / 3600;
      }, { type: 'scripture/tick', deltaSeconds });
    },
  };
}

export function researchNode({ store, registries }, nodeId) {
  let success = false;

  store.update((draft) => {
    ensureScriptureState(draft);
    if (draft.scripture.unlockedNodes.includes(nodeId)) {
      return;
    }

    const node = registries.techNodes.get(nodeId);
    if (!node || !canResearchNode(draft, node) || !canPayTechCost(draft, node)) {
      return;
    }

    payTechCost(draft, node);
    draft.scripture.unlockedNodes.push(nodeId);
    applyNodeEffects(draft, registries, node);
    appendLog(draft, 'scripture', `参悟《${node.name}》成功`);
    success = true;
  }, { type: 'scripture/research-node', nodeId });

  return success;
}

export function getScriptureSnapshot(state, registries) {
  const unlocked = new Set(state.scripture.unlockedNodes);

  return registries.techNodes.list().map((node) => {
    const blockedBy = getNodeBlockingReasons(state, node);
    const blockedByNames = blockedBy.map((nodeId) => registries.techNodes.get(nodeId)?.name ?? nodeId);
    const missingCosts = getMissingTechCosts(state, node);
    const unlockedNode = unlocked.has(node.id);
    const available = !unlockedNode && blockedBy.length === 0;
    const affordable = !unlockedNode && Object.keys(missingCosts).length === 0;
    const canUnlock = !unlockedNode && available && affordable;

    return {
      ...node,
      unlocked: unlockedNode,
      blockedBy,
      blockedByNames,
      missingCosts,
      affordable,
      available,
      canResearch: canUnlock,
    };
  });
}
