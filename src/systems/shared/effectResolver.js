import { getDiscipleEffectMultiplier } from '../../data/discipleTraining.js';
import { getBeastBondEffects, getBeastBondSnapshot } from '../../data/beastBonds.js';
import { getExpeditionBondEffects, getExpeditionBondSnapshot } from '../../data/expeditionBonds.js';
import { getBeastRelicEffects, getBeastRelicSnapshot } from '../../data/beastRelics.js';
import { listBattlePreparationDefinitions } from '../../data/battlePreparations.js';
import { getCraftingEffects } from './crafting.js';

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

  const beastEffects = state.beasts.activeIds.flatMap((id) => {
    const beast = registries.beasts.get(id);
    if (!beast) {
      return [];
    }
    const awakeningLevel = state.beasts.awakeningLevels?.[id] ?? 0;
    const bondLevel = state.beasts.bondLevels?.[id] ?? 0;
    const multiplier = 1 + awakeningLevel * 0.18 + bondLevel * 0.05;
    return (beast.modifiers ?? []).map((effect) => ({
      ...effect,
      sourceId: id,
      sourceType: 'beast',
      awakeningLevel,
      bondLevel,
      value: typeof effect.value === 'number' ? effect.value * multiplier : effect.value,
    }));
  });
  const activeBeastRoster = state.beasts.activeIds
    .map((id) => {
      const beast = registries.beasts.get(id);
      if (!beast) {
        return null;
      }
      return {
        ...beast,
        awakeningLevel: state.beasts.awakeningLevels?.[id] ?? 0,
        bondLevel: state.beasts.bondLevels?.[id] ?? 0,
      };
    })
    .filter(Boolean);
  const beastBondSnapshot = getBeastBondSnapshot(activeBeastRoster);
  const beastBondEffects = getBeastBondEffects(activeBeastRoster);
  const beastRelicSnapshot = getBeastRelicSnapshot(state.beasts?.collection);
  const beastRelicEffectBundle = getBeastRelicEffects(state.beasts?.collection);
  const craftingEffectBundle = getCraftingEffects(state);

  const preparationEffects = listBattlePreparationDefinitions().flatMap((definition) => {
    const level = state.preparations?.levels?.[definition.id] ?? 0;
    if (level <= 0) {
      return [];
    }
    return (definition.effects ?? []).map((effect) => ({
      ...effect,
      sourceId: definition.id,
      sourceType: 'preparation',
      level,
      value: typeof effect.value === 'number' ? effect.value * level : effect.value,
    }));
  });

  return {
    techEffects,
    discipleEffects,
    expeditionEffects,
    teamBondEffects,
    expeditionBondSnapshot,
    beastEffects,
    beastBondSnapshot,
    beastBondEffects,
    beastRelicSnapshot,
    beastRelicEffects: beastRelicEffectBundle.relicEffects,
    beastRelicSetEffects: beastRelicEffectBundle.setEffects,
    craftingSnapshot: craftingEffectBundle.snapshot,
    forgedWeaponEffects: craftingEffectBundle.weaponEffects,
    craftedPillEffects: craftingEffectBundle.pillEffects,
    preparationEffects,
    all: [
      ...techEffects,
      ...discipleEffects,
      ...expeditionEffects,
      ...teamBondEffects,
      ...beastEffects,
      ...beastBondEffects,
      ...beastRelicEffectBundle.all,
      ...craftingEffectBundle.all,
      ...preparationEffects,
    ],
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
