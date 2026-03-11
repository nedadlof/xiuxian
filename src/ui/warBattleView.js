export function renderActiveBattlePanelView(params) {
  const {
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
  } = params;

  return `
    <section class="panel">
      <div class="panel-title"><h3>\u6218\u6597\u6307\u6325</h3><span class="tag">${activeBattle.autoMode ? '\u81ea\u52a8\u6267\u884c' : (pendingAction ? '\u5f85\u4e0b\u8fbe\u6307\u4ee4' : '\u7b49\u5f85\u51fa\u624b')}</span></div>
      <div class="mini-grid">
        <div class="card"><div class="muted">\u5173\u5361</div><strong>${activeBattle.stageName}</strong></div>
        <div class="card"><div class="muted">\u56de\u5408</div><strong>\u7b2c ${currentRound?.round ?? activeBattle.round} / ${activeBattle.battleRoundLimit} \u56de</strong></div>
        <div class="card"><div class="muted">\u5f53\u524d\u51fa\u624b</div><strong>${pendingAction?.name ?? '\u7b49\u5f85\u66f4\u65b0'}</strong></div>
        <div class="card"><div class="muted">\u5730\u5f62</div><strong>${activeBattle.terrain} \u00b7 ${getEncounterTypeLabel(activeBattle.encounterType)}</strong></div>
      </div>
      <div class="card">
        <div class="muted">\u6211\u65b9\u751f\u547d ${formatNumber(activeBattle.playerTeam.hp)} / ${formatNumber(activeBattle.playerTeam.maxHp)} \u00b7 \u654c\u65b9\u751f\u547d ${formatNumber(activeBattle.enemyTeam.hp)} / ${formatNumber(activeBattle.enemyTeam.maxHp)}</div>
        <div class="war-hp-grid">
          <div>
            <div class="muted">\u6211\u65b9\u8840\u7ebf</div>
            <div class="war-progress-track"><span class="war-progress-fill ally" style="width:${playerHpPercent}%"></span></div>
          </div>
          <div>
            <div class="muted">\u654c\u65b9\u8840\u7ebf</div>
            <div class="war-progress-track"><span class="war-progress-fill enemy" style="width:${enemyHpPercent}%"></span></div>
          </div>
        </div>
        <div class="detail-list">
          <span>\u5df2\u8fdb\u884c\u56de\u5408 ${activeBattle.rounds?.length ?? 0}</span>
          <span>\u6a21\u5f0f ${activeBattle.autoMode ? '\u81ea\u52a8' : '\u624b\u52a8'}</span>
          <span>\u56de\u5408\u4e0a\u9650 ${activeBattle.battleRoundLimit} \u56de</span>
        </div>
      </div>
      ${pendingAction ? `
        <div class="card ${battleControlFeedback ? 'preference-saved-card' : ''}" ${tooltipAttr([
          `\u5f53\u524d\u51fa\u624b\uff1a${pendingAction.name}`,
          `\u6240\u5728\u6392\uff1a\u7b2c ${pendingAction.row} \u6392`,
          `\u5148\u624b\uff1a${Math.round(pendingAction.initiative ?? 0)}`,
          pendingAction.skill ? `\u53ef\u7528\u6280\u80fd\uff1a${pendingAction.skill.name}` : '\u65e0\u53ef\u7528\u6280\u80fd',
        ])}>
          <div class="card-title"><strong>\u8f6e\u5230 ${pendingAction.name} \u51fa\u624b</strong><span class="tag ${battleControlFeedback ? 'tag-saved-pulse' : ''}">${battleControlFeedback?.message ?? `\u7b2c ${pendingAction.row} \u6392 \u00b7 \u5148\u624b ${Math.round(pendingAction.initiative ?? 0)}`}</span></div>
          <div class="muted">\u9009\u62e9\u76ee\u6807\u540e\u4e0b\u8fbe\u666e\u653b/\u6280\u80fd/\u64a4\u9000\uff0c\u6216\u5f00\u542f\u81ea\u52a8\u6218\u6597\u3002</div>
          <div class="detail-list">
            <span>\u63a8\u8350\u76ee\u6807 \u7b2c ${pendingAction.preferredTargetRow ?? '-'} \u6392</span>
            <span>${selectedTarget ? `\u5df2\u9009\u76ee\u6807 \u7b2c ${selectedTarget.row} \u6392` : '\u672a\u9009\u62e9\u76ee\u6807'}</span>
            <span>${selectedTarget ? `\u76ee\u6807\u8840\u91cf ${formatNumber(selectedTarget.hp)}/${formatNumber(selectedTarget.maxHp)}` : '\u76ee\u6807\u8840\u91cf -'}</span>
            <span>${selectedTarget ? getBattlePreviewSummary('\u666e\u653b', selectedAttackPreview) : '\u666e\u653b\uff1a\u65e0\u76ee\u6807'}</span>
            ${pendingAction.skill ? `<span>${getBattlePreviewSummary(pendingAction.skill.name, selectedSkillPreview)}</span>` : ''}
            <span>\u7b56\u7565 ${getAutoBattleStrategyMeta(activeBattle.autoStrategy).label}</span>
            <span>\u901f\u5ea6 ${getAutoBattleSpeedMeta(activeBattle.autoSpeed).label}</span>
            ${autoIntent ? `<span>\u81ea\u52a8\u610f\u56fe \u7b2c ${autoIntent.targetRow} \u6392 \u00b7 ${autoIntent.type === 'skill' ? '\u6280\u80fd' : '\u666e\u653b'}</span>` : ''}
            ${battleControlFeedback ? `<span class="saved-feedback-chip">${battleControlFeedback.message}</span>` : ''}
          </div>
          <div class="inline-actions">${getAutoBattleStrategyOptions().map((strategy) => `<button class="${activeBattle.autoStrategy === strategy.id ? 'active' : 'ghost'}" data-action="battle-auto-strategy" data-id="${strategy.id}" ${tooltipAttr([strategy.label, strategy.description])}>${strategy.label}</button>`).join('')}</div>
          <div class="inline-actions">${getAutoBattleSpeedOptions().map((speed) => `<button class="${activeBattle.autoSpeed === speed.id ? 'active' : 'ghost'}" data-action="battle-auto-speed" data-id="${speed.id}" ${tooltipAttr([speed.label, speed.description, `\u51fa\u624b\u95f4\u9694 ${speed.delayMs}ms`])}>${speed.label}</button>`).join('')}</div>
          <div class="inline-actions">
            ${(pendingAction.availableTargets ?? []).map((target) => `
              <button
                class="${autoTargetRow === target.row ? 'active' : (selectedTargetRow === target.row ? 'secondary' : 'ghost')}"
                data-action="select-battle-target"
                data-row="${target.row}"
                ${tooltipAttr([...(autoTargetRow === target.row ? [autoIntent?.label ?? '\u81ea\u52a8\u51fa\u624b\u9884\u544a'] : []), ...getBattleTargetTooltipLines(target)])}
              >\u7b2c ${target.row} \u6392${autoTargetRow === target.row ? ' \u00b7 \u81ea\u52a8' : ''}</button>
            `).join('') || '<span class="muted">\u6682\u65e0\u53ef\u9009\u76ee\u6807</span>'}
          </div>
          <div class="inline-actions">
            <button class="${activeBattle.autoMode ? 'active' : 'ghost'}" data-action="battle-auto-toggle" ${tooltipAttr([activeBattle.autoMode ? '\u5173\u95ed\u81ea\u52a8\u6218\u6597\uff0c\u6539\u4e3a\u624b\u52a8\u4e0b\u4ee4\u3002' : '\u5f00\u542f\u81ea\u52a8\u6218\u6597\uff0c\u7cfb\u7edf\u5c06\u81ea\u52a8\u9009\u76ee\u6807\u5e76\u51fa\u624b\u3002'])}>${activeBattle.autoMode ? '\u81ea\u52a8\u4e2d' : '\u624b\u52a8'}</button>
            <button class="secondary" data-action="battle-attack" ${tooltipAttr(formatBattlePreviewLines('\u666e\u653b\u9884\u4f30', selectedAttackPreview))}>\u666e\u653b</button>
            <button ${pendingAction.skill?.ready ? '' : 'disabled'} data-action="battle-skill" ${tooltipAttr(skillTooltip)}>${pendingAction.skill ? `\u6280\u80fd ${pendingAction.skill.name}` : '\u65e0\u6280\u80fd'}</button>
            <button class="ghost" data-action="battle-retreat">\u64a4\u9000</button>
          </div>
        </div>
      ` : '<div class="card"><div class="muted">\u5f53\u524d\u6ca1\u6709\u53ef\u6267\u884c\u7684\u51fa\u624b\u6307\u4ee4\u3002</div></div>'}
      <div class="card">
        <div class="card-title"><strong>\u884c\u52a8\u961f\u5217</strong><span class="tag">${queuedTurns.length ? `\u5269\u4f59 ${queuedTurns.length} \u624b` : '\u6682\u65e0\u961f\u5217'}</span></div>
        <div class="detail-list">${queuedTurns.length ? queuedTurns.map((turn) => `<span>${turn.side === 'ally' ? '\u6211' : '\u654c'}:${turn.unit.name}</span>`).join('') : '<span>\u7b49\u5f85\u884c\u52a8\u987a\u5e8f</span>'}</div>
        <div class="war-action-grid">
          ${renderWarActionCards(currentRound?.initiativeOrder ?? [])}
        </div>
      </div>
      <div class="log-list">
        ${recentLogs.length ? recentLogs.map((log) => `<div class="card"><div class="muted">${log}</div></div>`).join('') : '<div class="card"><div class="muted">\u6682\u65e0\u6218\u6597\u65e5\u5fd7</div></div>'}
      </div>
    </section>
  `;
}
