// Extracted from renderApp.js to keep war battle helpers modular.
function getAutoBattleStrategyOptions() {
  const raw = [
    { id: 'skill-first', label: '\u6280\u80fd\u4f18\u5148', description: '\u6709\u6280\u80fd\u5c31\u5148\u653e\u6280\u80fd\uff0c\u6ca1\u6280\u80fd\u5c31\u666e\u653b\u3002' },
    { id: 'save-skill', label: '\u4fdd\u7559\u6280\u80fd', description: '\u4f18\u5148\u666e\u653b\uff0c\u53ea\u5728\u5173\u952e\u65f6\u523b\u4f7f\u7528\u6280\u80fd\u6536\u5272\u3002' },
    { id: 'focus-backline', label: '\u4f18\u5148\u540e\u6392', description: '\u4f18\u5148\u9501\u5b9a\u6b8b\u8840\u6216\u540e\u6392\u654c\u4eba\uff0c\u5c3d\u5feb\u89e3\u51b3\u8fdc\u7a0b\u5a01\u80c1\u3002' },
    { id: 'focus-lowest-hp', label: '\u6536\u5272\u6b8b\u8840', description: '\u4f18\u5148\u653b\u51fb\u5f53\u524d\u8840\u91cf\u6700\u4f4e\u7684\u76ee\u6807\uff0c\u5c3d\u5feb\u51fb\u7834\u654c\u65b9\u884c\u52a8\u529b\u3002' },
  ];

  const fallbackLabels = {
    'skill-first': '\u6280\u80fd\u4f18\u5148',
    'save-skill': '\u4fdd\u7559\u6280\u80fd',
    'focus-backline': '\u4f18\u5148\u540e\u6392',
    'focus-lowest-hp': '\u6536\u5272\u6b8b\u8840',
  };
  const garbledPattern = /[?？�]/;
  const sanitize = (value, fallback) => {
    const text = String(value ?? '');
    if (!text || garbledPattern.test(text)) return fallback;
    return text;
  };

  return raw.map((option) => ({
    ...option,
    label: sanitize(option.label, fallbackLabels[option.id] ?? option.id),
    description: sanitize(option.description, ''),
  }));
}

function getAutoBattleStrategyMeta(strategyId) {
  const fallbackLabels = {
    'skill-first': '\u6280\u80fd\u4f18\u5148',
    'save-skill': '\u4fdd\u7559\u6280\u80fd',
    'focus-backline': '\u4f18\u5148\u540e\u6392',
    'focus-lowest-hp': '\u6536\u5272\u6b8b\u8840',
  };
  const garbledPattern = /[?？�]/;
  const sanitize = (value, fallback) => {
    const text = String(value ?? '');
    if (!text || garbledPattern.test(text)) return fallback;
    return text;
  };

  const meta = getAutoBattleStrategyOptions().find((item) => item.id === strategyId) ?? getAutoBattleStrategyOptions()[0];
  const fallback = fallbackLabels[meta.id] ?? meta.id;
  return {
    ...meta,
    label: sanitize(meta.label, fallback),
    description: sanitize(meta.description, ''),
  };
}

function getAutoBattleSpeedOptions() {
  const raw = [
    { id: 'slow', label: '\u6162\u901f', delayMs: 1100, description: '\u51fa\u624b\u95f4\u9694\u8f83\u957f\uff0c\u89c2\u611f\u66f4\u63a5\u8fd1\u56de\u5408\u6218\u3002' },
    { id: 'normal', label: '\u6807\u51c6', delayMs: 700, description: '\u9ed8\u8ba4\u8282\u594f\uff0c\u517c\u987e\u8282\u594f\u4e0e\u9605\u8bfb\u3002' },
    { id: 'fast', label: '\u6781\u901f', delayMs: 280, description: '\u51fa\u624b\u95f4\u9694\u6700\u77ed\uff0c\u5feb\u901f\u81ea\u52a8\u63a8\u8fdb\u3002' },
  ];

  const fallbackLabels = {
    slow: '\u6162\u901f',
    normal: '\u6807\u51c6',
    fast: '\u6781\u901f',
  };
  const garbledPattern = /[?？�]/;
  const sanitize = (value, fallback) => {
    const text = String(value ?? '');
    if (!text || garbledPattern.test(text)) return fallback;
    return text;
  };

  return raw.map((option) => ({
    ...option,
    label: sanitize(option.label, fallbackLabels[option.id] ?? option.id),
    description: sanitize(option.description, ''),
  }));
}

function getAutoBattleSpeedMeta(speedId) {
  const fallbackLabels = {
    slow: '\u6162\u901f',
    normal: '\u6807\u51c6',
    fast: '\u6781\u901f',
  };
  const garbledPattern = /[?？�]/;
  const sanitize = (value, fallback) => {
    const text = String(value ?? '');
    if (!text || garbledPattern.test(text)) return fallback;
    return text;
  };

  const meta = getAutoBattleSpeedOptions().find((item) => item.id === speedId) ?? getAutoBattleSpeedOptions()[1];
  const fallback = fallbackLabels[meta.id] ?? meta.id;
  return {
    ...meta,
    label: sanitize(meta.label, fallback),
    description: sanitize(meta.description, ''),
  };
}

function canAutoUseSkill(activeBattle, target) {
  const skillPreview = target?.previews?.skill ?? null;
  return !!activeBattle?.pendingAction?.skill?.ready && (!skillPreview || skillPreview.kind !== 'unavailable');
}

function pickAutoBattleTarget(activeBattle, preferredTargetRow) {
  const targets = [...(activeBattle?.pendingAction?.availableTargets ?? [])];
  if (!targets.length) {
    return null;
  }

  const strategyId = activeBattle?.autoStrategy ?? 'skill-first';
  if (strategyId === 'focus-backline') {
    return targets.sort((left, right) => right.row - left.row || left.hp - right.hp)[0] ?? null;
  }
  if (strategyId === 'focus-lowest-hp') {
    return targets.sort((left, right) => left.hp - right.hp || right.row - left.row)[0] ?? null;
  }

  return targets.find((target) => target.row === preferredTargetRow)
    ?? targets.find((target) => target.row === activeBattle?.pendingAction?.preferredTargetRow)
    ?? targets[0]
    ?? null;
}

function pickAutoBattleCommand(uiState, activeBattle) {
  const preferredTargetRow = getSelectedBattleTargetRow(uiState, activeBattle);
  const target = pickAutoBattleTarget(activeBattle, preferredTargetRow);
  if (!target) {
    return null;
  }

  const strategyId = activeBattle?.autoStrategy ?? 'skill-first';
  const canUseSkill = canAutoUseSkill(activeBattle, target);
  let type = 'attack';
  if (strategyId === 'skill-first' || strategyId === 'focus-backline' || strategyId === 'focus-lowest-hp') {
    type = canUseSkill ? 'skill' : 'attack';
  } else if (strategyId === 'save-skill') {
    const attackDamage = target.previews?.attack?.estimatedDamage ?? 0;
    const skillDamage = target.previews?.skill?.estimatedDamage ?? 0;
    const targetHpRatio = target.maxHp > 0 ? target.hp / target.maxHp : 1;
    const shouldSpendSkill = canUseSkill && (targetHpRatio <= 0.42 || skillDamage > attackDamage * 1.45 || target.previews?.skill?.kind === 'status');
    type = shouldSpendSkill ? 'skill' : 'attack';
  }

  return {
    type,
    targetRow: target.row,
  };
}

function getAutoBattleIntent(uiState, activeBattle) {
  if (!activeBattle?.autoMode || !activeBattle?.pendingAction) {
    return null;
  }

  const command = pickAutoBattleCommand(uiState, activeBattle);
  if (!command) {
    return null;
  }

  return {
    ...command,
    label: command.type === 'skill'
      ? `\u81ea\u52a8\u51fa\u624b\uff1a\u65bd\u653e ${activeBattle.pendingAction.skill?.name ?? '\u6280\u80fd'}`
      : '\u81ea\u52a8\u51fa\u624b\uff1a\u666e\u901a\u8fdb\u653b',
  };
}

function getLiveBattleHpPercent(team) {
  if (!team?.maxHp) return 0;
  return Math.max(4, Math.round((team.hp / team.maxHp) * 100));
}

function getSelectedBattleTargetRow(uiState, activeBattle) {
  const availableTargets = activeBattle?.pendingAction?.availableTargets ?? [];
  const storedTargetRow = Number(uiState.warBattleTargetRow);
  if (availableTargets.some((target) => target.row === storedTargetRow)) {
    return storedTargetRow;
  }
  return activeBattle?.pendingAction?.preferredTargetRow ?? availableTargets[0]?.row ?? null;
}

function createBattlePreviewFormatter(options = {}) {
  const renderMissingLine = options.renderMissingLine ?? ((label) => `${label}\uff1a\u65e0\u9884\u4f30`);
  const renderSummaryLine = options.renderSummaryLine ?? ((label, summary) => `${label}\uff1a${summary}`);

  function formatBattlePreviewLines(label, preview) {
    if (!preview) {
      return [renderMissingLine(label)];
    }
    return [renderSummaryLine(label, preview.summary), ...(preview.details ?? [])];
  }

  function getBattlePreviewSummary(label, preview) {
    return preview ? renderSummaryLine(label, preview.summary) : renderMissingLine(label);
  }

  return {
    formatBattlePreviewLines,
    getBattlePreviewSummary,
  };
}

const defaultBattlePreviewFormatter = createBattlePreviewFormatter();

function formatBattlePreviewLines(label, preview) {
  return defaultBattlePreviewFormatter.formatBattlePreviewLines(label, preview);
}

function getBattlePreviewSummary(label, preview) {
  return defaultBattlePreviewFormatter.getBattlePreviewSummary(label, preview);
}

function createBattleTargetTooltipLines({
  formatNumber,
  getTagLabel,
  previewFormatter,
  formatBattlePreviewLines: formatBattlePreviewLinesLegacy,
}) {
  const formatBattlePreviewLines = formatBattlePreviewLinesLegacy
    ?? previewFormatter?.formatBattlePreviewLines
    ?? defaultBattlePreviewFormatter.formatBattlePreviewLines;

  return function getBattleTargetTooltipLines(target) {
    return [
      `\u7b2c ${target.row} \u6392 \u00b7 ${target.name}`,
      `\u751f\u547d\uff1a${formatNumber(target.hp)} / ${formatNumber(target.maxHp)}`,
      `\u5b58\u6d3b\u4eba\u6570\uff1a${formatNumber(target.aliveUnits)}`,
      target.tags?.length ? `\u7279\u6027\uff1a${target.tags.map((tag) => getTagLabel(tag)).join(' / ')}` : '\u7279\u6027\uff1a\u65e0',
      ...formatBattlePreviewLines('\u666e\u653b', target.previews?.attack),
      ...formatBattlePreviewLines('\u6280\u80fd', target.previews?.skill),
    ];
  };
}

export {
  getAutoBattleStrategyOptions,
  getAutoBattleStrategyMeta,
  getAutoBattleSpeedOptions,
  getAutoBattleSpeedMeta,
  canAutoUseSkill,
  pickAutoBattleTarget,
  pickAutoBattleCommand,
  getAutoBattleIntent,
  getLiveBattleHpPercent,
  getSelectedBattleTargetRow,
  createBattlePreviewFormatter,
  formatBattlePreviewLines,
  getBattlePreviewSummary,
  createBattleTargetTooltipLines,
};
