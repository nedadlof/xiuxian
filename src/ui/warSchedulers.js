import {
  clearWarReplayTimer,
  getLatestWarReport,
  getWarReplayFrame,
  getWarResolutionFeedbackMessage,
  stepWarReplay,
  syncWarReplayState,
} from './warReportUi.js';
import { getAutoBattleSpeedMeta, pickAutoBattleCommand } from './warBattleUi.js';

function clearWarAutoTimer(uiState) {
  if (uiState?.warAutoTimerId != null && typeof window !== 'undefined') {
    window.clearTimeout(uiState.warAutoTimerId);
  }
  uiState.warAutoTimerId = null;
}

function scheduleWarReplay(root, app, uiState, deps = {}) {
  const { renderGame } = deps;
  clearWarReplayTimer(uiState);
  if (typeof window === 'undefined') return;

  const state = app.store.getState();
  if ((state.meta.activeTab ?? 'overview') !== 'war') return;

  const report = getLatestWarReport(state);
  const replay = syncWarReplayState(uiState, report);
  if (!report || !replay?.autoplay) return;

  const frame = getWarReplayFrame(report, replay);
  if (!frame.totalRounds || (frame.roundIndex >= frame.totalRounds - 1 && frame.actionIndex >= frame.actionCount - 1)) {
    replay.autoplay = false;
    return;
  }

  uiState.warReplayTimerId = window.setTimeout(() => {
    uiState.warReplay = stepWarReplay(replay, report, 1);
    renderGame?.(root, app, uiState);
  }, replay.speedMs);
}

function scheduleWarAutoBattle(root, app, uiState, deps = {}) {
  const { renderGame, syncReplayAfterWarAction } = deps;
  clearWarAutoTimer(uiState);
  if (typeof window === 'undefined') return;

  const state = app.store.getState();
  if ((state.meta.activeTab ?? 'overview') !== 'war') return;

  const activeBattle = state.war?.currentBattle;
  if (!activeBattle?.autoMode || !activeBattle?.pendingAction) return;

  const command = pickAutoBattleCommand(uiState, activeBattle);
  if (!command) return;

  const autoSpeed = getAutoBattleSpeedMeta(activeBattle.autoSpeed);
  uiState.warAutoTimerId = window.setTimeout(() => {
    uiState.warBattleTargetRow = command.targetRow;
    app.bus.emit('action:war/commandBattle', { command });
    syncReplayAfterWarAction?.(uiState, app);
    renderGame?.(root, app, uiState);
  }, autoSpeed.delayMs);
}

function syncReplayAfterWarAction(uiState, app, deps = {}) {
  const { setTransientUiFeedback } = deps;
  const state = app.store.getState();
  const latestReport = getLatestWarReport(state);

  if (state.war?.currentBattle) {
    uiState.warBattleResultFeedback = null;
  }
  if (!state.war?.currentBattle) {
    uiState.warBattleTargetRow = null;
  }
  if (!state.war?.currentBattle && latestReport && uiState.warLastResolvedReportId !== latestReport.id) {
    uiState.warLastResolvedReportId = latestReport.id;
    uiState.warSelectedReportId = latestReport.id;
    setTransientUiFeedback?.(uiState, 'warBattleResultFeedback', getWarResolutionFeedbackMessage(latestReport));
  }
  if (!state.war?.currentBattle && latestReport && uiState.warReplay?.reportId !== latestReport.id) {
    clearWarReplayTimer(uiState);
    uiState.warReplay = {
      reportId: latestReport.id,
      roundIndex: 0,
      actionIndex: 0,
      autoplay: true,
      speedMs: uiState.warReplay?.speedMs ?? 1400,
    };
  }
}

export {
  scheduleWarReplay,
  scheduleWarAutoBattle,
  syncReplayAfterWarAction,
  clearWarAutoTimer,
};

