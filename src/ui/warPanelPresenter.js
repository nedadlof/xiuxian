import {
  WAR_REPORT_PAGE_SIZE,
  doesWarReportMatchFilter,
  getSelectedWarReport,
  getWarReplayFrame,
  sortWarReports,
  syncWarReplayState,
} from './warReportUi.js';

function getWarPeakHp(rounds, key) {
  return Math.max(1, ...((rounds ?? []).map((round) => round?.[key] ?? 0)));
}

function buildWarPanelViewModel(state, registries, uiState, deps = {}) {
  const { getWarSnapshot, getTransientUiFeedback } = deps;
  const war = getWarSnapshot(state, registries);

  const formations = registries.systems.get('formations') ?? [];
  const currentStage = war.currentStage;
  const latestReport = war.reports?.[0] ?? null;
  const selectedReport = getSelectedWarReport(state, uiState) ?? latestReport;

  const reportFilter = uiState.warReportFilter ?? 'all';
  const reportSort = uiState.warReportSort ?? 'newest';
  const filteredReports = (war.reports ?? []).filter((report) => doesWarReportMatchFilter(report, reportFilter));
  const sortedReports = sortWarReports(filteredReports, reportSort);
  const reportPageCount = Math.max(1, Math.ceil(sortedReports.length / WAR_REPORT_PAGE_SIZE));
  const reportPage = Math.min(Math.max(uiState.warReportPage ?? 0, 0), reportPageCount - 1);
  const pagedReports = sortedReports.slice(reportPage * WAR_REPORT_PAGE_SIZE, (reportPage + 1) * WAR_REPORT_PAGE_SIZE);
  uiState.warReportPage = reportPage;

  const replay = syncWarReplayState(uiState, selectedReport);
  const frame = getWarReplayFrame(selectedReport, replay);
  const rounds = frame.rounds;
  const currentRound = frame.currentRound;
  const currentAction = frame.currentAction;
  const replaySpeed = replay?.speedMs ?? 1400;

  const allyPeakHp = getWarPeakHp(rounds, 'allyHp');
  const enemyPeakHp = getWarPeakHp(rounds, 'enemyHp');
  const allyHpPercent = currentRound ? Math.max(6, Math.round((currentRound.allyHp / allyPeakHp) * 100)) : 0;
  const enemyHpPercent = currentRound ? Math.max(6, Math.round((currentRound.enemyHp / enemyPeakHp) * 100)) : 0;

  const stageEnemyPreview = currentStage?.enemyPreview ?? war.enemyPreview ?? [];
  const activeBattle = war.activeBattle;
  const battleLocked = !!activeBattle;
  const defaultAutoStrategy = activeBattle?.autoStrategy ?? war.autoPreferences?.strategyId ?? 'skill-first';
  const defaultAutoSpeed = activeBattle?.autoSpeed ?? war.autoPreferences?.speedId ?? 'normal';

  const autoPreferenceFeedback = getTransientUiFeedback?.(uiState, 'warAutoPreferenceFeedback', 4000) ?? null;
  const battleResultFeedback = getTransientUiFeedback?.(uiState, 'warBattleResultFeedback', 4200) ?? null;

  return {
    war,
    formations,
    currentStage,
    latestReport,
    selectedReport,
    reportFilter,
    reportSort,
    sortedReports,
    reportPageCount,
    reportPage,
    pagedReports,
    replay,
    frame,
    rounds,
    currentRound,
    currentAction,
    replaySpeed,
    allyHpPercent,
    enemyHpPercent,
    stageEnemyPreview,
    activeBattle,
    battleLocked,
    defaultAutoStrategy,
    defaultAutoSpeed,
    autoPreferenceFeedback,
    battleResultFeedback,
  };
}

export { buildWarPanelViewModel };

