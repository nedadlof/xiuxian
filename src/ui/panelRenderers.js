import { overviewPanel } from './panels/overviewPanel.js?v=20260313-ui-refresh';
import { economyPanel } from './panels/economyPanel.js?v=20260313-ui-refresh';
import { warehousePanel } from './panels/warehousePanel.js?v=20260313-ui-refresh';
import { scripturePanel } from './panels/scripturePanel.js';
import { logsPanel } from './panels/logsPanel.js?v=20260310-9';
import { beastsPanel } from './panels/beastsPanel.js?v=20260313-ui-refresh';
import { disciplesPanel } from './panels/disciplesPanel.js?v=20260313-ui-refresh';
import { barracksPanel } from './panels/barracksPanel.js?v=20260313-ui-refresh';
import { warPanel } from './panels/warPanel.js?v=20260313-ui-refresh';
import { missionsPanel } from './panels/missionsPanel.js';
import { sanitizeUiText } from './textSanitizer.js';
import { APP_TABS } from './tabConfig.js';

function createPanelRenderers({ uiState = {}, helpers = {} } = {}) {
  const {
    tooltipAttr,
    formatNumber,
    formatTime,
    formatCostSummary,
    formatResourceRate,
    formatResourceAmount,
    getResourceLabel,
    getEncounterTypeLabel,
    getTagLabel,
    getRarityLabel,
    getRarityRank,
    getRarityTagClass,
    getTransientUiFeedback,
    resourceDisplayOrder,
    getSessionSummary,
  } = helpers;

  return {
    overview: (state, registries, nextUiState) => overviewPanel(state, registries, {
      tooltipAttr,
      formatNumber,
      formatCostSummary,
      getResourceLabel,
      getSessionSummary,
      resourceDisplayOrder,
      uiState: nextUiState ?? uiState,
    }),
    economy: (state, registries, nextUiState) => economyPanel(state, registries, {
      tooltipAttr,
      formatNumber,
      formatCostSummary,
      formatResourceRate,
      formatResourceAmount,
      getResourceLabel,
      uiState: nextUiState ?? uiState,
    }),
    warehouse: (state, registries, nextUiState) => warehousePanel(state, registries, {
      tooltipAttr,
      formatNumber,
      formatTime,
      formatCostSummary,
      getResourceLabel,
      uiState: nextUiState ?? uiState,
    }),
    scripture: (state, registries, nextUiState) => scripturePanel(state, registries, {
      tooltipAttr,
      formatNumber,
      formatCostSummary,
      uiState: nextUiState ?? uiState,
    }),
    barracks: (state, registries, nextUiState) => barracksPanel(state, registries, {
      tooltipAttr,
      formatNumber,
      formatCostSummary,
      getTagLabel,
      uiState: nextUiState ?? uiState,
    }),
    war: (state, registries, nextUiState) => warPanel(state, registries, {
      tooltipAttr,
      formatNumber,
      formatCostSummary,
      getResourceLabel,
      getEncounterTypeLabel,
      getTagLabel,
      getTransientUiFeedback,
      uiState: nextUiState ?? uiState,
    }),
    disciples: (state, registries, nextUiState) => disciplesPanel(state, registries, {
      tooltipAttr,
      formatTime,
      formatNumber,
      formatCostSummary,
      getRarityLabel,
      getRarityRank,
      getRarityTagClass,
      uiState: nextUiState ?? uiState,
    }),
    beasts: (state, registries, nextUiState) => beastsPanel(state, registries, {
      tooltipAttr,
      getResourceLabel,
      formatCostSummary,
      uiState: nextUiState ?? uiState,
    }),
    missions: (state, registries, nextUiState) => missionsPanel(state, registries, {
      tooltipAttr,
      formatNumber,
      formatTime,
      formatCostSummary,
      uiState: nextUiState ?? uiState,
    }),
    logs: (state, registries, nextUiState) => logsPanel(state, registries, {
      formatTime,
      sanitizeUiText,
      uiState: nextUiState ?? uiState,
    }),
  };
}

export { APP_TABS, createPanelRenderers };
