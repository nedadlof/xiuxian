import { renderActiveBattlePanelView } from './warBattleView.js';
import {
  getAutoBattleStrategyOptions,
  getAutoBattleStrategyMeta,
  getAutoBattleSpeedOptions,
  getAutoBattleSpeedMeta,
  createBattlePreviewFormatter,
  createBattleTargetTooltipLines,
  getAutoBattleIntent,
  getLiveBattleHpPercent,
  getSelectedBattleTargetRow,
} from './warBattleUi.js';
import { sanitizeUiText } from './textSanitizer.js';

function renderActiveBattlePanel(activeBattle, uiState = {}, deps = {}) {
  const {
    tooltipAttr,
    formatNumber,
    getTagLabel,
    getEncounterTypeLabel,
    renderWarActionCards,
    getTransientUiFeedback,
  } = deps;

  const SKILL_TYPE_LABELS = {
    guard: '\u62a4\u76fe',
    volley: '\u9f50\u5c04',
    execute: '\u65a9\u6740',
    barrier: '\u62a4\u4f53',
    morale: '\u58eb\u6c14',
    poison: '\u4e2d\u6bd2',
    confuse: '\u6df7\u4e71',
    berserk: '\u72c2\u6012',
    reanimate: '\u56de\u6625',
    dive: '\u4fef\u51b2',
    firestorm: '\u706b\u98ce\u66b4',
    barkskin: '\u6811\u76ae',
    heal: '\u6cbb\u7597',
    pierce: '\u7834\u7532',
    seal: '\u5c01\u6280',
  };
  const getSkillTypeLabel = (type) => SKILL_TYPE_LABELS[type] ?? (type ?? '\u672a\u77e5');

  const previewFormatter = createBattlePreviewFormatter();
  const { formatBattlePreviewLines, getBattlePreviewSummary } = previewFormatter;

  const currentRound = activeBattle.currentRound;
  const pendingAction = activeBattle.pendingAction;
  const playerHpPercent = getLiveBattleHpPercent(activeBattle.playerTeam);
  const enemyHpPercent = getLiveBattleHpPercent(activeBattle.enemyTeam);
  const recentLogs = (currentRound?.logs ?? []).slice(-6).map((line) => sanitizeUiText(line));
  const queuedTurns = currentRound?.timeline?.slice(currentRound.turnIndex, currentRound.turnIndex + 6) ?? [];
  const selectedTargetRow = getSelectedBattleTargetRow(uiState, activeBattle);
  const selectedTarget = pendingAction?.availableTargets?.find((target) => target.row === selectedTargetRow) ?? null;
  const selectedAttackPreview = selectedTarget?.previews?.attack ?? null;
  const selectedSkillPreview = selectedTarget?.previews?.skill ?? null;
  const autoIntent = getAutoBattleIntent(uiState, activeBattle);
  const autoTargetRow = autoIntent?.targetRow ?? null;
  const battleControlFeedback = getTransientUiFeedback?.(uiState, 'warBattleControlFeedback', 3200) ?? null;

  const getBattleTargetTooltipLines = createBattleTargetTooltipLines({ formatNumber, getTagLabel, previewFormatter });
  const skillTooltip = pendingAction?.skill
    ? [
        `\u6280\u80fd\uff1a${pendingAction.skill.name}`,
          `\u7c7b\u578b\uff1a${getSkillTypeLabel(pendingAction.skill.type)}`,
        pendingAction.skill.ready ? '\u72b6\u6001\uff1a\u53ef\u4f7f\u7528' : `\u72b6\u6001\uff1a\u7b2c ${pendingAction.skill.availableFromRound} \u56de\u5408\u53ef\u7528`,
        `\u51b7\u5374\uff1a${pendingAction.skill.cooldown} \u56de\u5408`,
        ...formatBattlePreviewLines('\u6280\u80fd\u9884\u4f30', selectedSkillPreview),
      ]
    : ['\u5f53\u524d\u65e0\u6280\u80fd\u53ef\u7528'];

  return renderActiveBattlePanelView({
    activeBattle,
    currentRound,
    pendingAction,
    playerHpPercent,
    enemyHpPercent,
    recentLogs,
    queuedTurns,
    selectedTargetRow,
    selectedTarget,
    selectedAttackPreview,
    selectedSkillPreview,
    autoIntent,
    autoTargetRow,
    battleControlFeedback,
    skillTooltip,
    tooltipAttr,
    formatNumber,
    getEncounterTypeLabel,
    formatBattlePreviewLines,
    getBattlePreviewSummary,
    getAutoBattleStrategyMeta,
    getAutoBattleSpeedMeta,
    getAutoBattleStrategyOptions,
    getAutoBattleSpeedOptions,
    getBattleTargetTooltipLines,
    renderWarActionCards,
  });
}

export { renderActiveBattlePanel };
