import { beastDefinitions } from './beasts.js';
import { BUILDING_COST_GROWTH, BUILDING_OUTPUT_GROWTH, DEFAULT_FORMATION, OFFLINE_REWARD_LIMIT_SECONDS } from './balance.js';
import { buildingDefinitions } from './buildings.js';
import { discipleDefinitions } from './disciples.js';
import { stageDefinitions } from './stages.js';
import { techNodeDefinitions } from './techTree.js';
import { tradeRouteDefinitions } from './trade.js';
import { formationDefinitions, unitDefinitions } from './units.js';

export function registerAllDefinitions(registries) {
  for (const definition of buildingDefinitions) {
    registries.buildings.upsert(definition.id, definition);
  }

  for (const definition of techNodeDefinitions) {
    registries.techNodes.upsert(definition.id, definition);
  }

  for (const definition of unitDefinitions) {
    registries.units.upsert(definition.id, definition);
  }

  for (const definition of discipleDefinitions) {
    registries.disciples.upsert(definition.id, definition);
  }

  for (const definition of beastDefinitions) {
    registries.beasts.upsert(definition.id, definition);
  }

  for (const definition of stageDefinitions) {
    registries.stages.upsert(definition.id, definition);
  }

  registries.systems.upsert('formations', formationDefinitions);
  registries.systems.upsert('tradeRoutes', tradeRouteDefinitions);
}

export const balanceSnapshot = {
  BUILDING_OUTPUT_GROWTH,
  BUILDING_COST_GROWTH,
  OFFLINE_REWARD_LIMIT_SECONDS,
  DEFAULT_FORMATION,
};

export { beastDefinitions, buildingDefinitions, discipleDefinitions, formationDefinitions, stageDefinitions, techNodeDefinitions, unitDefinitions };
