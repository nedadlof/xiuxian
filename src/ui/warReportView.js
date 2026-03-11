function renderBondSummary(report) {
  const names = report?.expeditionSupport?.bondNames ?? [];
  return names.length ? names.join(' · ') : '未激活';
}

function renderBondEffects(report) {
  const effects = report?.expeditionSupport?.bondEffects ?? [];
  const getLabel = (effectType) => ({
    battleAttack: '攻势',
    battleDefense: '守势',
    battleSustain: '续航',
    battleLoot: '战利',
    unitPowerMultiplier: '战力',
  }[effectType] ?? effectType);
  return effects.length
    ? effects.map((effect) => `<span>${getLabel(effect.type)} +${Math.round((effect.value ?? 0) * 100)}%</span>`).join('')
    : '<span>无额外羁绊加成</span>';
}

export function renderWarReportHistorySection(params) {
  const {
    war,
    reportFilter,
    reportSort,
    sortedReports,
    pagedReports,
    reportPage,
    reportPageCount,
    selectedReport,
    frame,
    tooltipAttr,
    formatCostSummary,
    rewardLine,
    getEncounterTypeLabel,
    getWarReportFilterOptions,
    getWarReportSortOptions,
    getWarReportOutcomeLabel,
    getWarEndingReasonLabel,
    getWarCasualtyTierLabel,
    getWarLootOutcomeLabel,
    getWarBattleModeLabel,
  } = params;

  return `
      <section class="panel">
        <div class="panel-title"><h3>历次战报</h3><span class="tag">${sortedReports.length} / ${war.reports?.length ?? 0} 条</span></div>
        <div class="inline-actions">${getWarReportFilterOptions().map((option) => `<button class="${reportFilter === option.id ? 'secondary' : 'ghost'}" data-action="set-war-report-filter" data-id="${option.id}" ${tooltipAttr([option.label, option.description])}>${option.label}</button>`).join('')}</div>
        <div class="inline-actions">${getWarReportSortOptions().map((option) => `<button class="${reportSort === option.id ? 'secondary' : 'ghost'}" data-action="set-war-report-sort" data-id="${option.id}" ${tooltipAttr([option.label, option.description])}>${option.label}</button>`).join('')}</div>
        <div class="card">
          <div class="card-title"><strong>分页浏览</strong><span class="tag">第 ${reportPage + 1}/${reportPageCount} 页</span></div>
          <div class="detail-list">
            <span>当前筛选 ${getWarReportFilterOptions().find((item) => item.id === reportFilter)?.label ?? reportFilter}</span>
            <span>当前排序 ${getWarReportSortOptions().find((item) => item.id === reportSort)?.label ?? reportSort}</span>
            <span>本页 ${pagedReports.length} 条</span>
          </div>
          <div class="inline-actions">
            <button class="ghost" data-action="war-report-page-prev" ${reportPage <= 0 ? 'disabled' : ''}>上一页</button>
            <button class="ghost" data-action="war-report-page-next" ${reportPage >= reportPageCount - 1 ? 'disabled' : ''}>下一页</button>
          </div>
        </div>
        <div class="log-list">
          ${pagedReports.map((report) => `
            <div class="log-item" ${tooltipAttr([
              `关卡：${report.stageName}`,
              `结局：${getWarReportOutcomeLabel(report)}`,
              `结束方式：${getWarEndingReasonLabel(report)}`,
              `战损评级：${getWarCasualtyTierLabel(report.casualtyRatio)}`,
              `奖励档位：${getWarLootOutcomeLabel(report)}`,
              `作战模式：${getWarBattleModeLabel(report.battleMode)}`,
              `遇敌类型：${getEncounterTypeLabel(report.encounterType)}`,
              `出征羁绊：${renderBondSummary(report)}`,
            ])}>
              <div>
                <strong>${report.stageName}</strong>
                <div class="muted">${getWarReportOutcomeLabel(report)} · ${getWarEndingReasonLabel(report)} · ${getWarBattleModeLabel(report.battleMode)}</div>
                <div class="detail-list">
                  <span>战损 ${getWarCasualtyTierLabel(report.casualtyRatio)}</span>
                  <span>奖励 ${getWarLootOutcomeLabel(report)}</span>
                  <span>遇敌 ${getEncounterTypeLabel(report.encounterType)}</span>
                  <span>羁绊 ${report.expeditionSupport?.bondCount ?? 0}</span>
                </div>
              </div>
              <div class="inline-actions">
                <button class="${selectedReport?.id === report.id ? 'secondary' : 'ghost'}" data-action="select-war-report" data-id="${report.id}">${selectedReport?.id === report.id ? '已选中' : '查看'}</button>
              </div>
            </div>
          `).join('') || '<div class="card"><div class="muted">当前筛选下暂无战报</div></div>'}
        </div>
        ${selectedReport ? `
          <div class="card" ${tooltipAttr([
            `当前查看：${selectedReport.stageName}`,
            `奖励总览：${formatCostSummary(selectedReport.reward)}`,
            selectedReport.triggeredMechanicIds?.length ? `触发机制：${selectedReport.triggeredMechanicIds.join(' · ')}` : '本场未触发额外机制',
            `出征羁绊：${renderBondSummary(selectedReport)}`,
          ])}>
            <div class="card-title"><strong>战报详览：${selectedReport.stageName}</strong><span class="tag">${getWarReportOutcomeLabel(selectedReport)}</span></div>
            <div class="muted">${getWarEndingReasonLabel(selectedReport)} · ${getWarBattleModeLabel(selectedReport.battleMode)} · 策略分 ${selectedReport.strategyScore}</div>
            <div class="detail-list">
              <span>战损率 ${(selectedReport.casualtyRatio * 100).toFixed(1)}%</span>
              <span>战损评级 ${getWarCasualtyTierLabel(selectedReport.casualtyRatio)}</span>
              <span>奖励档位 ${getWarLootOutcomeLabel(selectedReport)}</span>
              <span>回合数 ${selectedReport.rounds?.length ?? 0}</span>
              <span>触发机制 ${selectedReport.triggeredMechanicIds?.length ?? 0}</span>
              <span>羁绊 ${selectedReport.expeditionSupport?.bondCount ?? 0}</span>
            </div>
            <div class="muted">出征成员：${selectedReport.expeditionSupport?.memberNames?.join(' · ') || '未派出弟子'}</div>
            <div class="muted">激活羁绊：${renderBondSummary(selectedReport)} · 阵营 ${selectedReport.expeditionSupport?.uniqueFactionCount ?? 0} · 总共鸣 ${selectedReport.expeditionSupport?.totalResonance ?? 0}</div>
            ${rewardLine('战利品合计', selectedReport.reward)}
            ${rewardLine('基础奖励', selectedReport.rewardBreakdown?.baseReward)}
            ${rewardLine('首通奖励', selectedReport.rewardBreakdown?.firstClearBonus)}
            ${rewardLine('额外掉落', selectedReport.rewardBreakdown?.bonusLoot)}
            <div class="detail-list">${selectedReport.triggeredMechanicIds?.length ? selectedReport.triggeredMechanicIds.map((id) => `<span>${id}</span>`).join('') : '<span>暂无机制触发</span>'}</div>
            <div class="detail-list">${renderBondEffects(selectedReport)}</div>
            <div class="detail-list">${(selectedReport.rounds ?? []).map((round, index) => `<button class="${frame.roundIndex === index ? 'secondary' : 'ghost'}" data-action="war-replay-jump" data-round="${index}">第 ${round.round} 回合</button>`).join('') || '<span>暂无回合记录</span>'}</div>
          </div>
        ` : ''}
      </section>
  `;
}
