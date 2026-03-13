import { getTransientUiFeedback, setTransientUiFeedback } from './transientFeedback.js';
import { tooltipAttr } from './tooltipAttr.js';
import { renderAppShell } from './appShellView.js?v=20260313-ui-refresh-2';
import { APP_TABS, createPanelRenderers } from './panelRenderers.js?v=20260313-ui-refresh-2';
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
      getSessionSummary: () => app.getSessionSummary?.() ?? null,
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
    shellMeta: {
      summary: '卷轴式界面已经按养成、战斗、制造三条主线重新收束，减少了碎片卡片感，同时保留战利品与各系统的联动逻辑。',
      quickStats: [
        { label: '宗门纪元', value: state.scripture.era },
        { label: '已通关', value: `${state.war.clearedStages.length} 关` },
        { label: '活跃灵兽', value: `${state.beasts.activeIds.length}/3` },
        { label: '宗务声望', value: formatNumber(state.commissions?.reputation ?? 0) },
      ],
    },
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
