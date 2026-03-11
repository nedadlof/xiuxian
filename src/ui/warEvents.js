import {
  WAR_REPORT_PAGE_SIZE,
  clearWarReplayTimer,
  doesWarReportMatchFilter,
  getSelectedWarReport,
  getWarReplayFrame,
  sortWarReports,
  stepWarReplay,
  syncWarReplayState,
} from './warReportUi.js';
import { getSelectedBattleTargetRow } from './warBattleUi.js';
import { clearWarAutoTimer } from './warSchedulers.js';

function handleWarUiAction({ action, element, root, app, uiState, state, helpers }) {
  const {
    renderGame,
    syncReplayAfterWarAction,
    setTransientUiFeedback,
  } = helpers ?? {};

  switch (action) {
    case 'train-unit':
      app.bus.emit('action:war/trainUnit', { unitId: element.dataset.id, amount: Number(element.dataset.amount) });
      return true;
    case 'set-formation':
      app.bus.emit('action:war/setFormation', { formationId: element.dataset.id });
      return true;
    case 'set-unit-row':
      app.bus.emit('action:war/setUnitRow', { unitId: element.dataset.id, row: Number(element.dataset.row) });
      return true;
    case 'auto-arrange':
      app.bus.emit('action:war/autoArrange', {});
      return true;
    case 'challenge-stage': {
      uiState.warBattleTargetRow = null;
      const stageId = element.dataset.id;
      const totalUnits = Object.values(state.war?.trainedUnits ?? {}).reduce((sum, value) => sum + Math.max(Number(value) || 0, 0), 0);
      const beforeBattle = state.war?.currentBattle ?? null;
      app.bus.emit('action:war/startBattle', { stageId });
      const nextState = app.store.getState();
      const afterBattle = nextState.war?.currentBattle ?? null;
      if (beforeBattle) {
        setTransientUiFeedback?.(uiState, 'warBattleControlFeedback', '\u5df2\u6709\u8fdb\u884c\u4e2d\u7684\u6218\u6597');
      } else if (!afterBattle) {
        setTransientUiFeedback?.(
          uiState,
          'warBattleControlFeedback',
          totalUnits > 0 ? '\u65e0\u6cd5\u53d1\u8d77\u6218\u6597\uff0c\u8bf7\u786e\u8ba4\u5173\u5361\u5df2\u89e3\u9501' : '\u65e0\u53ef\u7528\u5175\u79cd\uff0c\u8bf7\u5148\u62db\u52df\u5175\u79cd'
        );
      }
      syncReplayAfterWarAction?.(uiState, app);
      renderGame?.(root, app, uiState);
      return true;
    }
    case 'select-stage':
      app.bus.emit('action:war/setCurrentStage', { stageId: element.dataset.id });
      return true;
    case 'select-battle-target':
      uiState.warBattleTargetRow = Number(element.dataset.row);
      renderGame?.(root, app, uiState);
      return true;
    case 'battle-auto-toggle':
      app.bus.emit('action:war/setBattleAutoMode', { enabled: !state.war?.currentBattle?.autoMode });
      setTransientUiFeedback?.(
        uiState,
        'warBattleControlFeedback',
        state.war?.currentBattle?.autoMode ? '\u5df2\u5173\u95ed\u81ea\u52a8\u6218\u6597' : '\u5df2\u5f00\u542f\u81ea\u52a8\u6218\u6597'
      );
      renderGame?.(root, app, uiState);
      return true;
    case 'battle-auto-strategy':
      app.bus.emit('action:war/setBattleAutoStrategy', { strategyId: element.dataset.id });
      setTransientUiFeedback?.(
        uiState,
        'warAutoPreferenceFeedback',
        state.war?.currentBattle ? '\u5df2\u540c\u6b65\u9ed8\u8ba4\u81ea\u52a8\u6218\u6597\u8bbe\u7f6e' : '\u5df2\u4fdd\u5b58\u9ed8\u8ba4\u81ea\u52a8\u6218\u6597\u8bbe\u7f6e'
      );
      if (state.war?.currentBattle) {
        setTransientUiFeedback?.(uiState, 'warBattleControlFeedback', '\u5df2\u5207\u6362\u81ea\u52a8\u6218\u6597\u7b56\u7565');
      }
      renderGame?.(root, app, uiState);
      return true;
    case 'battle-auto-speed':
      app.bus.emit('action:war/setBattleAutoSpeed', { speedId: element.dataset.id });
      setTransientUiFeedback?.(
        uiState,
        'warAutoPreferenceFeedback',
        state.war?.currentBattle ? '\u5df2\u540c\u6b65\u9ed8\u8ba4\u81ea\u52a8\u6218\u6597\u8bbe\u7f6e' : '\u5df2\u4fdd\u5b58\u9ed8\u8ba4\u81ea\u52a8\u6218\u6597\u8bbe\u7f6e'
      );
      if (state.war?.currentBattle) {
        setTransientUiFeedback?.(uiState, 'warBattleControlFeedback', '\u5df2\u5207\u6362\u81ea\u52a8\u6218\u6597\u901f\u5ea6');
      }
      renderGame?.(root, app, uiState);
      return true;
    case 'battle-attack': {
      if (state.war?.currentBattle?.autoMode) {
        clearWarAutoTimer(uiState);
        app.bus.emit('action:war/setBattleAutoMode', { enabled: false });
      }
      const targetRow = getSelectedBattleTargetRow(uiState, state.war?.currentBattle);
      app.bus.emit('action:war/commandBattle', { command: { type: 'attack', targetRow } });
      setTransientUiFeedback?.(uiState, 'warBattleControlFeedback', '\u5df2\u4e0b\u8fbe\u666e\u901a\u8fdb\u653b');
      syncReplayAfterWarAction?.(uiState, app);
      renderGame?.(root, app, uiState);
      return true;
    }
    case 'battle-skill': {
      if (state.war?.currentBattle?.autoMode) {
        clearWarAutoTimer(uiState);
        app.bus.emit('action:war/setBattleAutoMode', { enabled: false });
      }
      const targetRow = getSelectedBattleTargetRow(uiState, state.war?.currentBattle);
      app.bus.emit('action:war/commandBattle', { command: { type: 'skill', targetRow } });
      setTransientUiFeedback?.(uiState, 'warBattleControlFeedback', '\u5df2\u4e0b\u8fbe\u6280\u80fd\u6307\u4ee4');
      syncReplayAfterWarAction?.(uiState, app);
      renderGame?.(root, app, uiState);
      return true;
    }
    case 'battle-retreat':
      if (state.war?.currentBattle?.autoMode) {
        clearWarAutoTimer(uiState);
        app.bus.emit('action:war/setBattleAutoMode', { enabled: false });
      }
      app.bus.emit('action:war/commandBattle', { command: 'retreat' });
      setTransientUiFeedback?.(uiState, 'warBattleControlFeedback', '\u5df2\u6267\u884c\u64a4\u9000');
      syncReplayAfterWarAction?.(uiState, app);
      renderGame?.(root, app, uiState);
      return true;
    case 'set-war-report-filter': {
      const filterId = element.dataset.id || 'all';
      uiState.warReportFilter = filterId;
      uiState.warReportPage = 0;
      const matchingReports = sortWarReports(
        (state.war?.battleReports ?? []).filter((report) => doesWarReportMatchFilter(report, filterId)),
        uiState.warReportSort ?? 'newest'
      );
      uiState.warSelectedReportId = matchingReports[0]?.id ?? null;
      clearWarReplayTimer(uiState);
      uiState.warReplay = null;
      renderGame?.(root, app, uiState);
      return true;
    }
    case 'set-war-report-sort': {
      const sortId = element.dataset.id || 'newest';
      uiState.warReportSort = sortId;
      uiState.warReportPage = 0;
      const matchingReports = sortWarReports(
        (state.war?.battleReports ?? []).filter((report) => doesWarReportMatchFilter(report, uiState.warReportFilter ?? 'all')),
        sortId
      );
      uiState.warSelectedReportId = matchingReports[0]?.id ?? null;
      clearWarReplayTimer(uiState);
      uiState.warReplay = null;
      renderGame?.(root, app, uiState);
      return true;
    }
    case 'war-report-page-prev':
      uiState.warReportPage = Math.max((uiState.warReportPage ?? 0) - 1, 0);
      renderGame?.(root, app, uiState);
      return true;
    case 'war-report-page-next':
      uiState.warReportPage = (uiState.warReportPage ?? 0) + 1;
      renderGame?.(root, app, uiState);
      return true;
    case 'select-war-report': {
      const reportId = element.dataset.id || null;
      uiState.warSelectedReportId = reportId;
      const orderedReports = sortWarReports(
        (state.war?.battleReports ?? []).filter((report) => doesWarReportMatchFilter(report, uiState.warReportFilter ?? 'all')),
        uiState.warReportSort ?? 'newest'
      );
      const reportIndex = orderedReports.findIndex((report) => report.id === reportId);
      if (reportIndex >= 0) {
        uiState.warReportPage = Math.floor(reportIndex / WAR_REPORT_PAGE_SIZE);
      }
      clearWarReplayTimer(uiState);
      uiState.warReplay = null;
      renderGame?.(root, app, uiState);
      return true;
    }
    case 'war-replay-prev': {
      const report = getSelectedWarReport(state, uiState);
      const replay = syncWarReplayState(uiState, report);
      if (replay) {
        uiState.warReplay = { ...stepWarReplay(replay, report, -1), autoplay: false };
        renderGame?.(root, app, uiState);
      }
      return true;
    }
    case 'war-replay-next': {
      const report = getSelectedWarReport(state, uiState);
      const replay = syncWarReplayState(uiState, report);
      if (replay) {
        uiState.warReplay = { ...stepWarReplay(replay, report, 1), autoplay: false };
        renderGame?.(root, app, uiState);
      }
      return true;
    }
    case 'war-replay-reset': {
      const report = getSelectedWarReport(state, uiState);
      const replay = syncWarReplayState(uiState, report);
      if (replay) {
        uiState.warReplay = { ...replay, roundIndex: 0, actionIndex: 0, autoplay: false };
        renderGame?.(root, app, uiState);
      }
      return true;
    }
    case 'war-replay-toggle': {
      const report = getSelectedWarReport(state, uiState);
      const replay = syncWarReplayState(uiState, report);
      if (replay) {
        const frame = getWarReplayFrame(report, replay);
        const atEnd = frame.roundIndex >= Math.max(frame.totalRounds - 1, 0) && frame.actionIndex >= Math.max(frame.actionCount - 1, 0);
        uiState.warReplay = {
          ...replay,
          roundIndex: atEnd && !replay.autoplay ? 0 : replay.roundIndex,
          actionIndex: atEnd && !replay.autoplay ? 0 : replay.actionIndex,
          autoplay: !replay.autoplay,
        };
        renderGame?.(root, app, uiState);
      }
      return true;
    }
    case 'war-replay-jump': {
      const report = getSelectedWarReport(state, uiState);
      const replay = syncWarReplayState(uiState, report);
      if (replay) {
        uiState.warReplay = { ...replay, autoplay: false, roundIndex: Number(element.dataset.round) || 0, actionIndex: 0 };
        renderGame?.(root, app, uiState);
      }
      return true;
    }
    case 'war-replay-speed': {
      const report = getSelectedWarReport(state, uiState);
      const replay = syncWarReplayState(uiState, report);
      if (replay) {
        uiState.warReplay = { ...replay, speedMs: Number(element.dataset.speed) || 1400 };
        renderGame?.(root, app, uiState);
      }
      return true;
    }
    default:
      return false;
  }
}

export { handleWarUiAction };
