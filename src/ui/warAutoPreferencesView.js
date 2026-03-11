export function renderWarAutoPreferencesCard(params) {
  const {
    autoPreferenceFeedback,
    defaultAutoStrategy,
    defaultAutoSpeed,
    battleLocked,
    tooltipAttr,
    getAutoBattleStrategyMeta,
    getAutoBattleSpeedMeta,
    getAutoBattleStrategyOptions,
    getAutoBattleSpeedOptions,
  } = params;

  const fallbackStrategyLabels = {
    'skill-first': '\u6280\u80fd\u4f18\u5148',
    'save-skill': '\u4fdd\u7559\u6280\u80fd',
    'focus-backline': '\u4f18\u5148\u540e\u6392',
    'focus-lowest-hp': '\u6536\u5272\u6b8b\u8840',
  };
  const fallbackSpeedLabels = {
    slow: '\u6162\u901f',
    normal: '\u6807\u51c6',
    fast: '\u6781\u901f',
  };

  const garbledPattern = /[?？�]/;
  const sanitizeLabel = (value, fallback) => {
    const text = String(value ?? '');
    if (!text || garbledPattern.test(text)) return fallback;
    return text;
  };

  const strategyMeta = getAutoBattleStrategyMeta(defaultAutoStrategy);
  const speedMeta = getAutoBattleSpeedMeta(defaultAutoSpeed);
  const strategyLabel = sanitizeLabel(strategyMeta?.label, fallbackStrategyLabels[defaultAutoStrategy] ?? defaultAutoStrategy);
  const speedLabel = sanitizeLabel(speedMeta?.label, fallbackSpeedLabels[defaultAutoSpeed] ?? defaultAutoSpeed);
  const strategyOptions = getAutoBattleStrategyOptions().map((strategy) => ({
    ...strategy,
    label: sanitizeLabel(strategy.label, fallbackStrategyLabels[strategy.id] ?? strategy.id),
    description: sanitizeLabel(strategy.description, ''),
  }));
  const speedOptions = getAutoBattleSpeedOptions().map((speed) => ({
    ...speed,
    label: sanitizeLabel(speed.label, fallbackSpeedLabels[speed.id] ?? speed.id),
    description: sanitizeLabel(speed.description, ''),
  }));

  return `
    <section class="panel">
      <div class="panel-title"><h3>\u81ea\u52a8\u6218\u6597\u8bbe\u7f6e</h3><span class="tag">${battleLocked ? '\u6218\u6597\u4e2d' : '\u9ed8\u8ba4\u8bbe\u7f6e'}</span></div>
      <div class="card ${autoPreferenceFeedback ? 'preference-saved-card' : ''}" ${tooltipAttr([
        `\u9ed8\u8ba4\u7b56\u7565\uff1a${strategyLabel}`,
        `\u9ed8\u8ba4\u901f\u5ea6\uff1a${speedLabel}`,
        battleLocked ? '\u5f53\u524d\u6218\u6597\u4e2d\u4fee\u6539\u4f1a\u5373\u65f6\u751f\u6548\u3002' : '\u4e0d\u5728\u6218\u6597\u4e2d\u4fee\u6539\u4f1a\u4fdd\u5b58\u4e3a\u9ed8\u8ba4\u8bbe\u7f6e\u3002',
      ])}>
        <div class="card-title"><strong>\u5f53\u524d\u9009\u62e9</strong><span class="tag ${autoPreferenceFeedback ? 'tag-saved-pulse' : ''}">${autoPreferenceFeedback?.message ?? (battleLocked ? '\u6218\u6597\u4e2d\u751f\u6548' : '\u5df2\u4fdd\u5b58')}</span></div>
        <div class="detail-list">
          <span>\u7b56\u7565 ${strategyLabel}</span>
          <span>\u901f\u5ea6 ${speedLabel}</span>
          <span>${battleLocked ? '\u5f53\u524d\u6218\u6597\u4f7f\u7528\u4e2d' : '\u4e0b\u573a\u6218\u6597\u9ed8\u8ba4\u4f7f\u7528'}</span>
          ${autoPreferenceFeedback ? `<span class="saved-feedback-chip">${autoPreferenceFeedback.message}</span>` : ''}
        </div>
        <div class="inline-actions">${strategyOptions.map((strategy) => `<button class="${defaultAutoStrategy === strategy.id ? 'active' : 'ghost'}" data-action="battle-auto-strategy" data-id="${strategy.id}" ${tooltipAttr([strategy.label, strategy.description])}>${strategy.label}</button>`).join('')}</div>
        <div class="inline-actions">${speedOptions.map((speed) => `<button class="${defaultAutoSpeed === speed.id ? 'active' : 'ghost'}" data-action="battle-auto-speed" data-id="${speed.id}" ${tooltipAttr([speed.label, speed.description, `\u51fa\u624b\u95f4\u9694 ${speed.delayMs}ms`])}>${speed.label}</button>`).join('')}</div>
      </div>
    </section>
  `;
}
