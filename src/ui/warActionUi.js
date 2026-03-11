function createWarActionUi({ tooltipAttr, formatNumber }) {
  function getWarActionTypeLabel(actionType) {
    return ({
      basic: '\u666e\u653b',
      skill: '\u672f\u6cd5',
      'follow-up': '\u8ffd\u51fb',
      counter: '\u53cd\u51fb',
      skipped: '\u5f85\u547d',
    })[actionType] ?? actionType ?? '\u884c\u52a8';
  }

  function getWarOutcomeLabel(outcome) {
    if (outcome?.outcomeLabel) return outcome.outcomeLabel;
    const result = outcome?.result ?? 'unknown';
    return ({
      skipped: '\u672a\u884c\u52a8',
      'no-target': '\u65e0\u76ee\u6807',
      miss: '\u843d\u7a7a',
      hit: '\u547d\u4e2d',
      crit: '\u66b4\u51fb',
      block: '\u88ab\u683c\u6321',
      'crit-block': '\u66b4\u51fb\u88ab\u6321',
      utility: '\u6218\u672f\u652f\u63f4',
      buff: '\u589e\u76ca\u751f\u6548',
      heal: '\u6062\u590d\u751f\u6548',
      'status-applied': '\u72b6\u6001\u547d\u4e2d',
      'status-resisted': '\u72b6\u6001\u62b5\u6297',
      unknown: '\u751f\u6548',
    })[result] ?? result;
  }

  function buildWarActionTags(action) {
    const outcome = action?.outcome ?? {};
    const tags = [`\u7ed3\u679c ${getWarOutcomeLabel(outcome)}`];

    if (outcome.targetRow) tags.push(`\u76ee\u6807 ${outcome.targetRow} \u6392`);
    if (outcome.damage) tags.push(`\u4f24\u5bb3 ${formatNumber(outcome.damage)}`);
    if (outcome.casualties) tags.push(`\u51fb\u7834 ${outcome.casualties}`);
    if (outcome.heal) tags.push(`\u6062\u590d ${formatNumber(outcome.heal)}`);
    if (outcome.shield) tags.push(`\u62a4\u76fe ${formatNumber(outcome.shield)}`);
    if (outcome.tenacity) tags.push(`\u97e7\u6027 ${outcome.tenacity}`);
    if (outcome.morale) tags.push(`\u58eb\u6c14 ${outcome.morale}`);
    if (outcome.attackBuff) tags.push(`\u653b\u52bf +${outcome.attackBuff}`);
    if (outcome.defenseBuff) tags.push(`\u5b88\u52bf +${outcome.defenseBuff}`);
    if (outcome.attackDebuff) tags.push(`\u538b\u5236 ${outcome.attackDebuff}`);
    if (outcome.followUpTriggered) tags.push('\u89e6\u53d1\u8ffd\u51fb');
    if (outcome.counterTriggered) tags.push('\u89e6\u53d1\u53cd\u51fb');

    return tags;
  }

  function buildWarActionTooltip(action) {
    const outcome = action?.outcome ?? {};
    return [
      `\u9635\u8425\uff1a${action?.side === 'ally' ? '\u6211\u65b9' : '\u654c\u65b9'}`,
      `\u884c\u52a8\uff1a${getWarActionTypeLabel(action?.actionType)}`,
      `\u5148\u624b\uff1a${Math.round(action?.initiative ?? 0)}`,
      outcome.hitChance != null ? `\u547d\u4e2d\uff1a${Math.round(outcome.hitChance * 100)}%` : null,
      outcome.critChance != null ? `\u66b4\u51fb\uff1a${Math.round(outcome.critChance * 100)}%` : null,
      outcome.blockChance != null ? `\u683c\u6321\uff1a${Math.round(outcome.blockChance * 100)}%` : null,
      ...(buildWarActionTags(action)),
    ].filter(Boolean);
  }

  function renderWarActionCards(actions = []) {
    if (!actions.length) {
      return `<div class="card"><div class="muted">\u672c\u56de\u5408\u6682\u65e0\u51fa\u624b\u8bb0\u5f55\u3002</div></div>`;
    }

    return actions.map((action) => `
      <div class="card" ${tooltipAttr(buildWarActionTooltip(action))}>
        <div class="card-title"><strong>${action.name}</strong><span class="tag">${action.side === 'ally' ? '\u6211\u65b9' : '\u654c\u65b9'} \u00b7 ${getWarActionTypeLabel(action.actionType)}</span></div>
        <div class="muted">\u7b2c ${action.row} \u6392 \u00b7 \u5148\u624b ${Math.round(action.initiative ?? 0)}</div>
        <div class="detail-list">${buildWarActionTags(action).map((tag) => `<span>${tag}</span>`).join('')}</div>
      </div>
    `).join('');
  }

  return {
    getWarActionTypeLabel,
    buildWarActionTags,
    buildWarActionTooltip,
    renderWarActionCards,
  };
}

export { createWarActionUi };
