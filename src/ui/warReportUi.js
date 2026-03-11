export const WAR_REPLAY_SPEED_OPTIONS = [
  { value: 2200, label: '\u6c89\u6d78' },
  { value: 1400, label: '\u6807\u51c6' },
  { value: 850, label: '\u5feb\u8fdb' },
];

export const WAR_REPORT_PAGE_SIZE = 5;

export function getLatestWarReport(state) {
  return state.war?.battleReports?.[0] ?? null;
}

export function getSelectedWarReport(state, uiState = {}) {
  const reports = state.war?.battleReports ?? [];
  if (!reports.length) return null;
  return reports.find((report) => report.id === uiState.warSelectedReportId) ?? reports[0];
}

export function getWarReportFilterOptions() {
  return [
    { id: 'all', label: '\u5168\u90e8', description: '\u67e5\u770b\u6240\u6709\u5386\u53f2\u6218\u62a5' },
    { id: 'victory', label: '\u80dc\u5229', description: '\u53ea\u770b\u6218\u6597\u83b7\u80dc\u7684\u6218\u62a5' },
    { id: 'defeat', label: '\u5931\u5229', description: '\u53ea\u770b\u6218\u6597\u5931\u5229\u7684\u6218\u62a5' },
    { id: 'retreat', label: '\u64a4\u9000', description: '\u53ea\u770b\u4e3b\u52a8\u64a4\u51fa\u7684\u6218\u62a5' },
    { id: 'boss', label: 'Boss', description: '\u53ea\u770b\u9996\u9886\u9047\u654c\u7684\u6218\u62a5' },
  ];
}

export function doesWarReportMatchFilter(report, filterId = 'all') {
  if (!report) return false;
  switch (filterId) {
    case 'victory':
      return report.victory && !report.retreated;
    case 'defeat':
      return !report.victory && !report.retreated;
    case 'retreat':
      return !!report.retreated;
    case 'boss':
      return report.encounterType === 'boss';
    case 'all':
    default:
      return true;
  }
}

export function getWarReportSortOptions() {
  return [
    { id: 'newest', label: '\u6700\u65b0', description: '\u6309\u65f6\u95f4\u5012\u5e8f\u67e5\u770b\u6218\u62a5' },
    { id: 'oldest', label: '\u6700\u65e9', description: '\u6309\u65f6\u95f4\u6b63\u5e8f\u67e5\u770b\u6218\u62a5' },
    { id: 'casualty', label: '\u9ad8\u6218\u635f', description: '\u4f18\u5148\u67e5\u770b\u6218\u635f\u66f4\u9ad8\u7684\u6218\u62a5' },
    { id: 'reward', label: '\u9ad8\u5956\u52b1', description: '\u4f18\u5148\u67e5\u770b\u5956\u52b1\u66f4\u4e30\u539a\u7684\u6218\u62a5' },
  ];
}

export function getWarReportRewardValue(report) {
  return Object.values(report?.reward ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
}

export function sortWarReports(reports, sortId = 'newest') {
  const list = [...(reports ?? [])];
  list.sort((left, right) => {
    switch (sortId) {
      case 'oldest':
        return (left.createdAt ?? 0) - (right.createdAt ?? 0);
      case 'casualty':
        return (right.casualtyRatio ?? 0) - (left.casualtyRatio ?? 0) || (right.createdAt ?? 0) - (left.createdAt ?? 0);
      case 'reward':
        return getWarReportRewardValue(right) - getWarReportRewardValue(left) || (right.createdAt ?? 0) - (left.createdAt ?? 0);
      case 'newest':
      default:
        return (right.createdAt ?? 0) - (left.createdAt ?? 0);
    }
  });
  return list;
}

export function clearWarReplayTimer(uiState) {
  if (typeof window === 'undefined') return;
  if (uiState.warReplayTimerId) {
    window.clearTimeout(uiState.warReplayTimerId);
    uiState.warReplayTimerId = null;
  }
}

export function syncWarReplayState(uiState, report) {
  if (!report) {
    clearWarReplayTimer(uiState);
    uiState.warReplay = null;
    return null;
  }

  const totalRounds = Math.max(report.rounds?.length ?? 0, 1);
  const replay = uiState.warReplay?.reportId === report.id
    ? { ...uiState.warReplay }
    : { reportId: report.id, roundIndex: 0, actionIndex: 0, autoplay: false, speedMs: 1400 };

  replay.roundIndex = Math.min(Math.max(replay.roundIndex ?? 0, 0), totalRounds - 1);
  replay.actionIndex = Math.max(replay.actionIndex ?? 0, 0);
  replay.autoplay = !!replay.autoplay;
  replay.speedMs = replay.speedMs ?? 1400;
  uiState.warReplay = replay;
  return replay;
}

export function getWarReplayActionCount(round) {
  return Math.max(round?.initiativeOrder?.length ?? 0, 1);
}

export function getWarReplayFrame(report, replay) {
  const rounds = report?.rounds ?? [];
  const totalRounds = rounds.length;
  const roundIndex = Math.min(Math.max(replay?.roundIndex ?? 0, 0), Math.max(totalRounds - 1, 0));
  const currentRound = rounds[roundIndex] ?? null;
  const actionCount = getWarReplayActionCount(currentRound);
  const actionIndex = Math.min(Math.max(replay?.actionIndex ?? 0, 0), actionCount - 1);
  const allActions = currentRound?.initiativeOrder ?? [];
  const visibleActions = allActions.length ? allActions.slice(0, Math.min(actionIndex + 1, allActions.length)) : [];
  const currentAction = allActions[actionIndex] ?? null;
  const totalSteps = rounds.reduce((sum, round) => sum + getWarReplayActionCount(round), 0);
  const finishedSteps = rounds
    .slice(0, roundIndex)
    .reduce((sum, round) => sum + getWarReplayActionCount(round), 0) + Math.min(actionIndex + 1, actionCount);

  return {
    rounds,
    totalRounds,
    roundIndex,
    currentRound,
    actionCount,
    actionIndex,
    allActions,
    visibleActions,
    currentAction,
    totalSteps,
    finishedSteps,
  };
}

export function stepWarReplay(replay, report, delta) {
  const frame = getWarReplayFrame(report, replay);
  if (!frame.totalRounds) {
    return { ...replay, roundIndex: 0, actionIndex: 0, autoplay: false };
  }

  const nextReplay = { ...replay, roundIndex: frame.roundIndex, actionIndex: frame.actionIndex };
  if (delta > 0) {
    if (frame.actionIndex < frame.actionCount - 1) {
      nextReplay.actionIndex = frame.actionIndex + 1;
      return nextReplay;
    }

    if (frame.roundIndex < frame.totalRounds - 1) {
      nextReplay.roundIndex = frame.roundIndex + 1;
      nextReplay.actionIndex = 0;
      return nextReplay;
    }

    return { ...nextReplay, autoplay: false };
  }

  if (frame.actionIndex > 0) {
    nextReplay.actionIndex = frame.actionIndex - 1;
    return nextReplay;
  }

  if (frame.roundIndex > 0) {
    const previousRoundIndex = frame.roundIndex - 1;
    nextReplay.roundIndex = previousRoundIndex;
    nextReplay.actionIndex = getWarReplayActionCount(report?.rounds?.[previousRoundIndex]) - 1;
    return nextReplay;
  }

  return nextReplay;
}

export function getWarReplayProgressPercent(frame) {
  if (!frame?.totalSteps) return 0;
  return Math.max(0, Math.min(100, Math.round((frame.finishedSteps / frame.totalSteps) * 100)));
}

export function getWarReplaySpeedLabel(speedMs) {
  const option = WAR_REPLAY_SPEED_OPTIONS.find((item) => item.value === speedMs);
  return option?.label ?? `\u6bcf\u624b ${Math.round((speedMs ?? 1400) / 100) / 10}\u79d2`;
}

export function getWarResultLabel(victory) {
  return victory ? '\u80dc\u5229' : '\u5931\u5229';
}

export function getWarReportOutcomeLabel(report) {
  if (!report) return '\u6682\u65e0\u6218\u62a5';
  return report.retreated ? '\u64a4\u9000' : getWarResultLabel(report.victory);
}

export function getWarResolutionFeedbackMessage(report) {
  if (!report) return '';
  if (report.retreated) return '\u5df2\u64a4\u51fa\u6218\u6597';
  return report.victory ? '\u6218\u6597\u80dc\u5229' : '\u6218\u6597\u5931\u5229';
}

export function getWarBattleModeLabel(mode) {
  return mode === 'manual' ? '\u624b\u52a8\u6307\u6325' : '\u81ea\u52a8\u63a8\u6f14';
}

export function getWarRewardTierLabel(tier) {
  return ({
    normal: '\u5e38\u89c4\u6389\u843d',
    elite: '\u4e30\u539a\u6389\u843d',
    boss: '\u9996\u9886\u6389\u843d',
  })[tier] ?? tier ?? '\u5e38\u89c4\u6389\u843d';
}

export function getWarCasualtyTierLabel(casualtyRatio = 0) {
  if (casualtyRatio <= 0.05) return '\u8fd1\u4e4e\u65e0\u4f24';
  if (casualtyRatio <= 0.18) return '\u8f7b\u5fae\u6218\u635f';
  if (casualtyRatio <= 0.35) return '\u53ef\u63a7\u6218\u635f';
  if (casualtyRatio <= 0.5) return '\u4f24\u4ea1\u8f83\u91cd';
  return '\u5143\u6c14\u5927\u4f24';
}

export function getWarEndingReasonLabel(report) {
  if (!report) return '\u6682\u65e0';
  const rounds = report.rounds ?? [];
  const lastRound = rounds[rounds.length - 1] ?? null;
  const allyHp = lastRound?.allyHp ?? null;
  const enemyHp = lastRound?.enemyHp ?? null;
  const maxRounds = report.battlePacing?.maxRounds ?? 0;

  if (report.retreated) return '\u4e3b\u52a8\u64a4\u9000';
  if (enemyHp !== null && enemyHp <= 0) return '\u6b7c\u706d\u654c\u9635';
  if (allyHp !== null && allyHp <= 0) return '\u6218\u7ebf\u5d29\u6e83';
  if (maxRounds > 0 && rounds.length >= maxRounds && (allyHp ?? 1) > 0 && (enemyHp ?? 1) > 0) {
    return report.victory ? '\u93d6\u6218\u540e\u5360\u4f18' : '\u56de\u5408\u8017\u5c3d';
  }
  return report.victory ? '\u6218\u635f\u5360\u4f18' : '\u6218\u5c40\u5931\u8861';
}

export function getWarLootOutcomeLabel(report) {
  if (!report) return '\u6682\u65e0';
  if (!report.victory) {
    return report.retreated ? '\u672a\u5e26\u56de\u6218\u5229' : '\u672a\u83b7\u6218\u5229';
  }
  return getWarRewardTierLabel(report.rewardTier);
}
