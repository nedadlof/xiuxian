export function renderWarReplaySection(params) {
  const {
    latestReport,
    selectedReport,
    battleResultFeedback,
    frame,
    rounds,
    currentRound,
    currentAction,
    replay,
    replaySpeed,
    progressPercent,
    allyHpPercent,
    enemyHpPercent,
    tooltipAttr,
    formatNumber,
    formatCostSummary,
    getWarReplaySpeedLabel,
    getWarReportOutcomeLabel,
    getWarEndingReasonLabel,
    getWarCasualtyTierLabel,
    getWarLootOutcomeLabel,
    getWarBattleModeLabel,
    getWarActionTypeLabel,
    buildWarActionTooltip,
    buildWarActionTags,
    renderWarActionCards,
    WAR_REPLAY_SPEED_OPTIONS,
  } = params;

  return `
      <section class="panel">
        <div class="panel-title"><h3>\u6218\u6597\u56de\u653e</h3><span class="tag ${battleResultFeedback ? 'tag-saved-pulse' : ''}">${battleResultFeedback?.message ?? getWarReportOutcomeLabel(selectedReport)}</span></div>
        ${selectedReport ? `
          <div class="mini-grid">
            <div class="card"><div class="muted">${selectedReport.id === latestReport?.id ? '\u6700\u8fd1\u6218\u6597' : '\u5f53\u524d\u6218\u62a5'}</div><strong>${selectedReport.stageName}</strong></div>
            <div class="card"><div class="muted">\u56de\u653e\u8fdb\u5ea6</div><strong>${frame.totalRounds ? `\u7b2c ${frame.roundIndex + 1}/${frame.totalRounds} \u56de\u5408` : '\u6682\u65e0\u56de\u5408'}</strong></div>
            <div class="card"><div class="muted">\u5f53\u524d\u8282\u594f</div><strong>${getWarReplaySpeedLabel(replaySpeed)}</strong></div>
            <div class="card"><div class="muted">\u6218\u6597\u7ed3\u679c</div><strong>${getWarReportOutcomeLabel(selectedReport)}</strong></div>
          </div>
          <div class="card ${battleResultFeedback ? 'preference-saved-card' : ''}" ${tooltipAttr([
            `\u7ed3\u5c40\u7c7b\u578b\uff1a${getWarReportOutcomeLabel(selectedReport)}`,
            `\u7ed3\u675f\u65b9\u5f0f\uff1a${getWarEndingReasonLabel(selectedReport)}`,
            `\u6218\u635f\u7387\uff1a${(selectedReport.casualtyRatio * 100).toFixed(1)}%`,
            `\u6218\u635f\u8bc4\u7ea7\uff1a${getWarCasualtyTierLabel(selectedReport.casualtyRatio)}`,
            `\u5956\u52b1\u6863\u4f4d\uff1a${getWarLootOutcomeLabel(selectedReport)}`,
            `\u4f5c\u6218\u6a21\u5f0f\uff1a${getWarBattleModeLabel(selectedReport.battleMode)}`,
            `\u8c0b\u7565\u5f97\u5206\uff1a${selectedReport.strategyScore}`,
            `\u6218\u5229\u54c1\uff1a${formatCostSummary(selectedReport.reward)}`,
            selectedReport.triggeredMechanicIds?.length ? `\u89e6\u53d1\u673a\u5236\uff1a${selectedReport.triggeredMechanicIds.join(' \u00b7 ')}` : '\u672c\u573a\u672a\u89e6\u53d1\u989d\u5916\u673a\u5236',
          ])}>
            <div class="card-title"><strong>\u56de\u653e\u603b\u89c8</strong><span class="tag ${battleResultFeedback ? 'tag-saved-pulse' : ''}">${battleResultFeedback?.message ?? `${progressPercent}%`}</span></div>
            <div class="muted">\u5df2\u64ad\u653e ${frame.finishedSteps}/${frame.totalSteps || 0} \u624b \u00b7 \u7ed3\u675f ${getWarEndingReasonLabel(selectedReport)} \u00b7 \u6218\u635f\u8bc4\u7ea7 ${getWarCasualtyTierLabel(selectedReport.casualtyRatio)}</div>
            <div class="detail-list">
              <span>\u7ed3\u5c40 ${getWarReportOutcomeLabel(selectedReport)}</span>
              <span>\u7ed3\u675f\u65b9\u5f0f ${getWarEndingReasonLabel(selectedReport)}</span>
              <span>\u6218\u635f\u8bc4\u7ea7 ${getWarCasualtyTierLabel(selectedReport.casualtyRatio)}</span>
              <span>\u5956\u52b1\u6863\u4f4d ${getWarLootOutcomeLabel(selectedReport)}</span>
              <span>\u4f5c\u6218\u6a21\u5f0f ${getWarBattleModeLabel(selectedReport.battleMode)}</span>
              <span>\u56de\u5408\u4e0a\u9650 ${selectedReport.battlePacing?.maxRounds ?? '-'} \u56de</span>
              ${selectedReport.triggeredMechanicIds?.length ? `<span>\u89e6\u53d1\u673a\u5236 ${selectedReport.triggeredMechanicIds.length} \u9879</span>` : '<span>\u989d\u5916\u673a\u5236 \u672a\u89e6\u53d1</span>'}
            </div>
            ${battleResultFeedback && selectedReport.id === latestReport?.id ? `<div class="detail-list"><span class="saved-feedback-chip">${battleResultFeedback.message}</span></div>` : ''}
            <div class="war-progress-track"><span class="war-progress-fill" style="width:${progressPercent}%"></span></div>
          </div>
          <div class="inline-actions">
            <button class="ghost" data-action="war-replay-reset">\u56de\u5230\u5f00\u573a</button>
            <button class="ghost" data-action="war-replay-prev" ${(frame.roundIndex <= 0 && frame.actionIndex <= 0) ? 'disabled' : ''}>\u4e0a\u4e00\u6b65</button>
            <button class="secondary" data-action="war-replay-toggle">${replay?.autoplay ? '\u6682\u505c\u56de\u653e' : '\u81ea\u52a8\u56de\u653e'}</button>
            <button class="ghost" data-action="war-replay-next" ${(frame.roundIndex >= Math.max(frame.totalRounds - 1, 0) && frame.actionIndex >= Math.max(frame.actionCount - 1, 0)) ? 'disabled' : ''}>\u4e0b\u4e00\u6b65</button>
            ${WAR_REPLAY_SPEED_OPTIONS.map((option) => `<button class="${replaySpeed === option.value ? 'secondary' : 'ghost'}" data-action="war-replay-speed" data-speed="${option.value}">${option.label}</button>`).join('')}
          </div>
          <div class="card">
            <div class="card-title"><strong>${currentRound ? `\u7b2c ${currentRound.round} \u56de\u5408` : '\u6682\u65e0\u56de\u5408'}</strong><span class="tag">${currentAction ? `\u7b2c ${frame.actionIndex + 1}/${frame.actionCount} \u624b` : '\u7b49\u5f85\u5c55\u5f00'}</span></div>
            ${currentRound ? `
              <div class="muted">\u6211\u65b9\u5269\u4f59 ${formatNumber(currentRound.allyHp)} \u00b7 \u654c\u65b9\u5269\u4f59 ${formatNumber(currentRound.enemyHp)} \u00b7 \u5f53\u524d\u51fa\u624b ${currentAction ? currentAction.name : '\u6682\u65e0\u8bb0\u5f55'}</div>
              <div class="war-hp-grid">
                <div>
                  <div class="muted">\u6211\u65b9\u8840\u7ebf</div>
                  <div class="war-progress-track"><span class="war-progress-fill ally" style="width:${allyHpPercent}%"></span></div>
                </div>
                <div>
                  <div class="muted">\u654c\u65b9\u8840\u7ebf</div>
                  <div class="war-progress-track"><span class="war-progress-fill enemy" style="width:${enemyHpPercent}%"></span></div>
                </div>
              </div>
              <div class="detail-list">
                <span>\u673a\u5236 ${currentRound.mechanicEvents?.length ?? 0}</span>
                <span>\u5149\u73af ${currentRound.auraEvents?.length ?? 0}</span>
                <span>\u53cd\u5e94 ${currentRound.reactionEvents?.length ?? 0}</span>
                <span>\u51fb\u7834 ${currentRound.killEvents?.length ?? 0}</span>
                <span>\u539f\u59cb\u65e5\u5fd7 ${currentRound.logs?.length ?? 0} \u6761</span>
              </div>
              ${currentAction ? `
                <div class="card" ${tooltipAttr(buildWarActionTooltip(currentAction))}>
                  <div class="card-title"><strong>\u5f53\u524d\u51fa\u624b\uff1a${currentAction.name}</strong><span class="tag">${currentAction.side === 'ally' ? '\u6211\u65b9' : '\u654c\u65b9'} \u00b7 ${getWarActionTypeLabel(currentAction.actionType)}</span></div>
                  <div class="muted">\u7b2c ${currentAction.row} \u6392 \u00b7 \u5148\u624b ${Math.round(currentAction.initiative ?? 0)}</div>
                  <div class="detail-list">${buildWarActionTags(currentAction).map((tag) => `<span>${tag}</span>`).join('')}</div>
                </div>
              ` : ''}
              <div class="war-action-grid">
                ${renderWarActionCards(frame.visibleActions)}
              </div>
            ` : '<div class="muted">\u8fd9\u573a\u6218\u6597\u6682\u65e0\u53ef\u56de\u653e\u56de\u5408\u3002</div>'}
          </div>
          <div class="log-list">
            ${(rounds ?? []).map((round, index) => `<button class="${frame.roundIndex === index ? 'secondary' : 'ghost'}" data-action="war-replay-jump" data-round="${index}" ${tooltipAttr([
              `\u7b2c ${round.round} \u56de\u5408`,
              `\u6211\u65b9\u5269\u4f59\uff1a${formatNumber(round.allyHp)}`,
              `\u654c\u65b9\u5269\u4f59\uff1a${formatNumber(round.enemyHp)}`,
              `\u51fa\u624b\u6b21\u6570\uff1a${round.initiativeOrder?.length ?? 0}`,
            ])}>\u7b2c ${round.round} \u56de\u5408</button>`).join('')}
          </div>
        ` : '<div class="card"><div class="muted">\u6682\u65e0\u6218\u6597\u7ed3\u679c\uff0c\u8bf7\u5148\u9009\u62e9\u5173\u5361\u5e76\u53d1\u8d77\u6311\u6218\u3002</div></div>'}
      </section>
  `;
}

