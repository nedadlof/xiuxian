function formatModifierPercent(value) {
  const percent = Math.round((value ?? 0) * 1000) / 10;
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent}%`;
}

function renderRecruitUnitCard(unit, options = {}) {
  const {
    battleLocked,
    tooltipAttr,
    formatCostSummary,
    getTagLabel,
  } = options;

  return `
    <div class="log-item" ${tooltipAttr([
      `\u5175\u79cd\uff1a${unit.name}`,
      `\u5df2\u62db\u52df\uff1a${unit.count}`,
      `\u5355\u4f53\u6218\u529b\uff1a${unit.power}`,
      `\u5355\u4f53\u8840\u91cf\uff1a${unit.hp}`,
      unit.tags?.length ? `\u7279\u6027\uff1a${unit.tags.map((tag) => getTagLabel(tag)).join(' / ')}` : '\u7279\u6027\uff1a\u65e0',
      `\u62db\u52df\u82b1\u8d39\uff1a${formatCostSummary(unit.trainingCost)}`,
    ])}>
      <div>
        <strong>${unit.name}</strong>
        <div class="muted">\u5f53\u524d ${unit.count} \u4eba \u00b7 \u7ad9\u4f4d\u7b2c ${unit.row} \u6392</div>
      </div>
      <div class="inline-actions">
        ${[1, 2, 3, 4, 5, 6].map((row) => `<button class="ghost" data-action="set-unit-row" data-id="${unit.id}" data-row="${row}" ${battleLocked ? 'disabled' : ''}>${row}\u6392</button>`).join('')}
        <button data-action="train-unit" data-id="${unit.id}" data-amount="1" ${battleLocked ? 'disabled' : ''}>\u62db 1</button>
        <button class="secondary" data-action="train-unit" data-id="${unit.id}" data-amount="5" ${battleLocked ? 'disabled' : ''}>\u62db 5</button>
        <button class="ghost" data-action="train-unit" data-id="${unit.id}" data-amount="20" ${battleLocked ? 'disabled' : ''}>\u62db 20</button>
      </div>
    </div>
  `;
}

function renderWarRecruitmentSection(params) {
  const {
    units,
    battleLocked,
    tooltipAttr,
    formatCostSummary,
    getTagLabel,
  } = params;

  if (!units?.length) {
    return '<div class="card"><div class="muted">\u5f53\u524d\u8fd8\u6ca1\u6709\u89e3\u9501\u53ef\u62db\u52df\u7684\u5175\u79cd\uff0c\u8bf7\u5148\u53c2\u609f\u76f8\u5173\u5175\u9053\u8282\u70b9\u3002</div></div>';
  }

  return `
    <div class="log-list">
      ${units.map((unit) => renderRecruitUnitCard(unit, { battleLocked, tooltipAttr, formatCostSummary, getTagLabel })).join('')}
    </div>
  `;
}

function renderWarSynergyCard(synergies, tooltipAttr) {
  const active = synergies?.active ?? [];
  const modifiers = synergies?.modifiers ?? { attack: 0, defense: 0, sustain: 0 };
  const summary = `\u653b\u52bf ${formatModifierPercent(modifiers.attack)} \u00b7 \u5b88\u52bf ${formatModifierPercent(modifiers.defense)} \u00b7 \u7eed\u822a ${formatModifierPercent(modifiers.sustain)}`;

  return `
    <div class="card" ${tooltipAttr([
      '\u9635\u578b\u52a0\u6210\uff1a\u6839\u636e\u5f53\u524d\u62db\u52df\u5175\u79cd\u81ea\u52a8\u89e6\u53d1\uff0c\u540e\u7eed\u53ef\u6269\u5c55\u66f4\u591a\u5957\u88c5\u3002',
      `\u603b\u52a0\u6210\uff1a${summary}`,
      ...(active.length
        ? active.flatMap((synergy) => [
          `${synergy.name} \u00b7 \u653b ${formatModifierPercent(synergy.modifiers?.attack ?? 0)} \u5b88 ${formatModifierPercent(synergy.modifiers?.defense ?? 0)} \u7eed ${formatModifierPercent(synergy.modifiers?.sustain ?? 0)}`,
          synergy.description ?? '',
        ])
        : ['\u5c1a\u65e0\u89e6\u53d1\u7684\u9635\u578b\u52a0\u6210\uff0c\u53ef\u901a\u8fc7\u62db\u52df\u4e0d\u540c\u7279\u6027\u7684\u5175\u79cd\u89e6\u53d1\u3002']),
    ])}>
      <div class="card-title"><strong>\u9635\u578b\u52a0\u6210</strong><span class="tag">${active.length ? `\u5df2\u89e6\u53d1 ${active.length} \u4e2a` : '\u672a\u89e6\u53d1'}</span></div>
      <div class="muted">${summary}</div>
      <div class="detail-list">
        ${active.length ? active.map((synergy) => `<span>${synergy.name}</span>`).join('') : '<span>\u672a\u89e6\u53d1\u5957\u88c5</span>'}
      </div>
    </div>
  `;
}

export { renderWarRecruitmentSection, renderWarSynergyCard };

