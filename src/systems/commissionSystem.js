import { getCommissionDefinition, listCommissionDefinitions, evaluateCommissionTeam } from '../data/commissions.js';
import { getExpeditionBondSnapshot } from '../data/expeditionBonds.js';
import { appendLog } from './shared/logs.js';

function ensureCommissionState(state) {
  state.commissions ??= {
    active: null,
    completed: [],
    history: [],
  };
  state.commissions.completed ??= [];
  state.commissions.history ??= [];
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

function buildCommissionRecord(definition, teamSnapshot, evaluation) {
  return {
    id: `commission-${definition.id}-${Date.now()}`,
    definitionId: definition.id,
    name: definition.name,
    description: definition.description,
    durationSeconds: definition.durationSeconds,
    remainingSeconds: definition.durationSeconds,
    startedAt: Date.now(),
    completedAt: null,
    claimedAt: null,
    teamSnapshot,
    evaluation,
  };
}

function updateCommissionProgress(commission, deltaSeconds) {
  return {
    ...commission,
    remainingSeconds: Math.max((commission.remainingSeconds ?? commission.durationSeconds ?? 0) - deltaSeconds, 0),
  };
}

function hasActiveCommission(state) {
  return Boolean(state.commissions?.active);
}

function addRewardToState(state, reward = {}) {
  for (const [resourceId, amount] of Object.entries(reward ?? {})) {
    state.resources[resourceId] = (state.resources[resourceId] ?? 0) + amount;
  }
}

export function createCommissionSystem() {
  return {
    id: 'commission-system',
    setup({ store, bus, registries }) {
      store.update((draft) => {
        ensureCommissionState(draft);
      }, { type: 'commissions/setup' });

      bus.on('action:commissions/start', ({ commissionId }) => {
        startCommission({ store, bus, registries }, commissionId);
      });

      bus.on('action:commissions/claim', ({ commissionId }) => {
        claimCommissionReward({ store, bus }, commissionId);
      });
    },
    tick({ store }, deltaSeconds) {
      store.update((draft) => {
        ensureCommissionState(draft);
        const active = draft.commissions.active;
        if (!active) {
          return;
        }

        const next = updateCommissionProgress(active, deltaSeconds);
        if (next.remainingSeconds > 0) {
          draft.commissions.active = next;
          return;
        }

        draft.commissions.active = null;
        const completed = {
          ...next,
          remainingSeconds: 0,
          completedAt: Date.now(),
        };
        draft.commissions.completed.unshift(completed);
        draft.commissions.completed = draft.commissions.completed.slice(0, 3);
        appendLog(draft, 'missions', `委托完成：${completed.name}`);
      }, { type: 'commissions/tick', deltaSeconds });
    },
  };
}

export function startCommission({ store, bus, registries }, commissionId) {
  let success = false;

  store.update((draft) => {
    ensureCommissionState(draft);
    if (hasActiveCommission(draft)) {
      return;
    }

    const definition = getCommissionDefinition(commissionId);
    if (!definition) {
      return;
    }

    const teamSnapshot = buildExpeditionTeamSnapshot(draft, registries);
    if (!teamSnapshot.members.length) {
      return;
    }

    const evaluation = evaluateCommissionTeam(teamSnapshot, definition);
    draft.commissions.active = buildCommissionRecord(definition, teamSnapshot, evaluation);
    appendLog(draft, 'missions', `已派出委托：${definition.name}`);
    success = true;
  }, { type: 'commissions/start', commissionId });

  return success;
}

export function claimCommissionReward({ store }, commissionId) {
  let success = false;

  store.update((draft) => {
    ensureCommissionState(draft);
    const targetIndex = draft.commissions.completed.findIndex((item) => item.id === commissionId);
    if (targetIndex < 0) {
      return;
    }

    const completed = draft.commissions.completed[targetIndex];
    addRewardToState(draft, completed.evaluation?.totalReward ?? {});
    draft.commissions.completed.splice(targetIndex, 1);
    draft.commissions.history.unshift({
      ...completed,
      claimedAt: Date.now(),
    });
    draft.commissions.history = draft.commissions.history.slice(0, 8);
    appendLog(draft, 'missions', `已结算委托：${completed.name}`);
    success = true;
  }, { type: 'commissions/claim', commissionId });

  return success;
}

export function getCommissionSnapshot(state, registries) {
  ensureCommissionState(state);
  const definitions = listCommissionDefinitions();
  const teamSnapshot = buildExpeditionTeamSnapshot(state, registries);

  return {
    available: definitions.map((definition) => {
      const evaluation = evaluateCommissionTeam(teamSnapshot, definition);
      return {
        ...definition,
        evaluation,
        canStart: !hasActiveCommission(state) && teamSnapshot.members.length > 0,
      };
    }),
    active: state.commissions.active,
    completed: [...(state.commissions.completed ?? [])],
    history: [...(state.commissions.history ?? [])],
    teamSnapshot,
  };
}
