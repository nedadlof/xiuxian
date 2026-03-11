import { getTransientUiFeedback, setTransientUiFeedback } from './transientFeedback.js';
import { tooltipAttr } from './tooltipAttr.js';
import { renderAppShell } from './appShellView.js';
import { APP_TABS, createPanelRenderers } from './panelRenderers.js';
import { hydrateRenderedUi } from './renderRuntime.js';
import { getTabContent } from './tabRouter.js?v=20260310-11';
import { DEFAULT_TAB } from './tabConfig.js';
import {
  RESOURCE_DISPLAY_ORDER,
  formatNumber,
  formatTime,
  getResourceLabel,
  formatResourceAmount,
  formatCostSummary,
  formatResourceRate,
  getEncounterTypeLabel,
  getTagLabel,
  getRarityLabel,
  getRarityRank,
  getRarityTagClass,
} from './uiFormatters.js';

export function renderGame(root, app, uiState = {}) {
  if (!root) return;

  const state = app.store.getState();
  const activeTab = state.meta.activeTab ?? DEFAULT_TAB;
  const panels = createPanelRenderers({
    uiState,
    helpers: {
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
      resourceDisplayOrder: RESOURCE_DISPLAY_ORDER,
    },
  });

  root.innerHTML = renderAppShell({
    activeTab,
    tabContent: getTabContent({
      activeTab,
      state,
      registries: app.registries,
      uiState,
      panels,
    }),
    tabs: APP_TABS,
  });

  hydrateRenderedUi({
    root,
    app,
    uiState,
    helpers: {
      renderGame,
      setTransientUiFeedback,
    },
  });
}
