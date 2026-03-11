import { getDiscipleEffectMultiplier } from '../../data/discipleTraining.js';
import { getExpeditionBondEffects, getExpeditionBondSnapshot } from '../../data/expeditionBonds.js';

export function collectUnlockedEffects(state, registries) {
  const techEffects = state.scripture.unlockedNodes.flatMap((id) => registries.techNodes.get(id)?.effects ?? []);

  const discipleEffects = [];
  for (const [buildingId, discipleId] of Object.entries(state.disciples.stationed)) {
    const disciple = registries.disciples.get(discipleId);
    if (!disciple || disciple.station !== buildingId) {
      continue;
    }

    const level = state.disciples.levels?.[discipleId] ?? 1;
    const resonanceLevel = state.disciples.resonance?.[discipleId] ?? 0;
    const multiplier = getDiscipleEffectMultiplier(level, resonanceLevel, disciple.rarity);
    discipleEffects.push(...(disciple.modifiers?.stationed ?? []).map((effect) => ({
      ...effect,
      value: typeof effect.value === 'number' ? effect.value * multiplier : effect.value,
    })));
  }

  const expeditionEffects = [];
  const expeditionIds = [
    state.disciples.expeditionTeam.leaderId,
    ...state.disciples.expeditionTeam.supportIds,
  ].filter(Boolean);
  for (const discipleId of expeditionIds) {
    const disciple = registries.disciples.get(discipleId);
    if (disciple) {
      const level = state.disciples.levels?.[discipleId] ?? 1;
      const resonanceLevel = state.disciples.resonance?.[discipleId] ?? 0;
      const multiplier = getDiscipleEffectMultiplier(level, resonanceLevel, disciple.rarity);
      expeditionEffects.push(...(disciple.modifiers?.expedition ?? []).map((effect) => ({
        ...effect,
        value: typeof effect.value === 'number' ? effect.value * multiplier : effect.value,
      })));
    }
  }
  const expeditionMembers = expeditionIds
    .map((discipleId) => {
      const disciple = registries.disciples.get(discipleId);
      if (!disciple) {
        return null;
      }
      return {
        ...disciple,
        resonanceLevel: state.disciples.resonance?.[discipleId] ?? 0,
        elder: (state.disciples.elders ?? []).includes(discipleId),
      };
    })
    .filter(Boolean);
  const expeditionBondSnapshot = getExpeditionBondSnapshot(expeditionMembers);
  const teamBondEffects = getExpeditionBondEffects(expeditionMembers);

  const beastEffects = state.beasts.activeIds.flatMap((id) => registries.beasts.get(id)?.modifiers ?? []);

  return {
    techEffects,
    discipleEffects,
    expeditionEffects,
    teamBondEffects,
    expeditionBondSnapshot,
    beastEffects,
    all: [...techEffects, ...discipleEffects, ...expeditionEffects, ...teamBondEffects, ...beastEffects],
  };
}

export function sumEffects(effects, type, predicate = null) {
  return effects
    .filter((effect) => effect.type === type)
    .filter((effect) => (predicate ? predicate(effect) : true))
    .reduce((total, effect) => total + (effect.value ?? 0), 0);
}

export function listEffectTargets(effects, type) {
  return effects.filter((effect) => effect.type === type);
}
