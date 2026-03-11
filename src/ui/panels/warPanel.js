import { getWarSnapshot } from '../../systems/warSystem.js?v=20260310-11';
import {
  WAR_REPLAY_SPEED_OPTIONS,
  getWarBattleModeLabel,
  getWarCasualtyTierLabel,
  getWarEndingReasonLabel,
  getWarLootOutcomeLabel,
  getWarReplayProgressPercent,
  getWarReplaySpeedLabel,
  getWarReportFilterOptions,
  getWarReportOutcomeLabel,
  getWarReportSortOptions,
} from '../warReportUi.js';
import { renderWarReportHistorySection } from '../warReportView.js';
import { renderWarReplaySection } from '../warReplayView.js';
import { renderWarStageProgressionSection } from '../warPageView.js?v=20260310-11';
import { renderActiveBattlePanel } from '../warBattlePanel.js?v=20260310-9';
import { createWarActionUi } from '../warActionUi.js?v=20260310-9';
import { renderWarAutoPreferencesCard } from '../warAutoPreferencesView.js';
import { buildWarPanelViewModel } from '../warPanelPresenter.js';
import {
  getAutoBattleStrategyOptions,
  getAutoBattleStrategyMeta,
  getAutoBattleSpeedOptions,
  getAutoBattleSpeedMeta,
} from '../warBattleUi.js';

function rewardLine(label, reward, formatCostSummary) {
  return `<div class="muted">${label}：${formatCostSummary(reward)}</div>`;
}

export function warPanel(state, registries, deps = {}) {
  const {
    tooltipAttr,
    formatNumber,
    formatCostSummary,
    getEncounterTypeLabel,
    getTagLabel,
    getTransientUiFeedback,
    uiState = {},
  } = deps;

  const warActionUi = createWarActionUi({ tooltipAttr, formatNumber });
  const viewModel = buildWarPanelViewModel(state, registries, uiState, { getWarSnapshot, getTransientUiFeedback });
  const progressPercent = getWarReplayProgressPercent(viewModel.frame);
  const renderRewardLine = (label, reward) => rewardLine(label, reward, formatCostSummary);

  return `
    <div class="grid">
      ${renderWarStageProgressionSection({
        war: viewModel.war,
        clearedStageCount: state.war.clearedStages.length,
        battleLocked: viewModel.battleLocked,
        tooltipAttr,
        formatNumber,
        formatCostSummary,
        rewardLine: renderRewardLine,
        getEncounterTypeLabel,
      })}
      ${renderWarAutoPreferencesCard({
        autoPreferenceFeedback: viewModel.autoPreferenceFeedback,
        defaultAutoStrategy: viewModel.defaultAutoStrategy,
        defaultAutoSpeed: viewModel.defaultAutoSpeed,
        battleLocked: viewModel.battleLocked,
        tooltipAttr,
        getAutoBattleStrategyMeta,
        getAutoBattleSpeedMeta,
        getAutoBattleStrategyOptions,
        getAutoBattleSpeedOptions,
      })}
      ${viewModel.activeBattle ? renderActiveBattlePanel(viewModel.activeBattle, uiState, {
        tooltipAttr,
        formatNumber,
        getTagLabel,
        getEncounterTypeLabel,
        renderWarActionCards: warActionUi.renderWarActionCards,
        getTransientUiFeedback,
      }) : ''}
      ${renderWarReplaySection({
        latestReport: viewModel.latestReport,
        selectedReport: viewModel.selectedReport,
        battleResultFeedback: viewModel.battleResultFeedback,
        frame: viewModel.frame,
        rounds: viewModel.rounds,
        currentRound: viewModel.currentRound,
        currentAction: viewModel.currentAction,
        replay: viewModel.replay,
        replaySpeed: viewModel.replaySpeed,
        progressPercent,
        allyHpPercent: viewModel.allyHpPercent,
        enemyHpPercent: viewModel.enemyHpPercent,
        tooltipAttr,
        formatNumber,
        formatCostSummary,
        getWarReplaySpeedLabel,
        getWarReportOutcomeLabel,
        getWarEndingReasonLabel,
        getWarCasualtyTierLabel,
        getWarLootOutcomeLabel,
        getWarBattleModeLabel,
        getWarActionTypeLabel: warActionUi.getWarActionTypeLabel,
        buildWarActionTooltip: warActionUi.buildWarActionTooltip,
        buildWarActionTags: warActionUi.buildWarActionTags,
        renderWarActionCards: warActionUi.renderWarActionCards,
        WAR_REPLAY_SPEED_OPTIONS,
      })}
      ${renderWarReportHistorySection({
        war: viewModel.war,
        reportFilter: viewModel.reportFilter,
        reportSort: viewModel.reportSort,
        sortedReports: viewModel.sortedReports,
        pagedReports: viewModel.pagedReports,
        reportPage: viewModel.reportPage,
        reportPageCount: viewModel.reportPageCount,
        selectedReport: viewModel.selectedReport,
        frame: viewModel.frame,
        tooltipAttr,
        formatCostSummary,
        rewardLine: renderRewardLine,
        getEncounterTypeLabel,
        getWarReportFilterOptions,
        getWarReportSortOptions,
        getWarReportOutcomeLabel,
        getWarEndingReasonLabel,
        getWarCasualtyTierLabel,
        getWarLootOutcomeLabel,
        getWarBattleModeLabel,
      })}
    </div>
  `;
}
