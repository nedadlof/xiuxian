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
        <div class="panel-title"><h3>\u5386\u6b21\u6218\u62a5</h3><span class="tag">${sortedReports.length} / ${war.reports?.length ?? 0} \u6761</span></div>
        <div class="inline-actions">${getWarReportFilterOptions().map((option) => `<button class="${reportFilter === option.id ? 'secondary' : 'ghost'}" data-action="set-war-report-filter" data-id="${option.id}" ${tooltipAttr([option.label, option.description])}>${option.label}</button>`).join('')}</div>
        <div class="inline-actions">${getWarReportSortOptions().map((option) => `<button class="${reportSort === option.id ? 'secondary' : 'ghost'}" data-action="set-war-report-sort" data-id="${option.id}" ${tooltipAttr([option.label, option.description])}>${option.label}</button>`).join('')}</div>
        <div class="card">
          <div class="card-title"><strong>\u5206\u9875\u6d4f\u89c8</strong><span class="tag">\u7b2c ${reportPage + 1}/${reportPageCount} \u9875</span></div>
          <div class="detail-list">
            <span>\u5f53\u524d\u7b5b\u9009 ${getWarReportFilterOptions().find((item) => item.id === reportFilter)?.label ?? reportFilter}</span>
            <span>\u5f53\u524d\u6392\u5e8f ${getWarReportSortOptions().find((item) => item.id === reportSort)?.label ?? reportSort}</span>
            <span>\u672c\u9875 ${pagedReports.length} \u6761</span>
          </div>
          <div class="inline-actions">
            <button class="ghost" data-action="war-report-page-prev" ${reportPage <= 0 ? 'disabled' : ''}>\u4e0a\u4e00\u9875</button>
            <button class="ghost" data-action="war-report-page-next" ${reportPage >= reportPageCount - 1 ? 'disabled' : ''}>\u4e0b\u4e00\u9875</button>
          </div>
        </div>
        <div class="log-list">
          ${pagedReports.map((report) => `
            <div class="log-item" ${tooltipAttr([
              `\u5173\u5361\uff1a${report.stageName}`,
              `\u7ed3\u5c40\uff1a${getWarReportOutcomeLabel(report)}`,
              `\u7ed3\u675f\u65b9\u5f0f\uff1a${getWarEndingReasonLabel(report)}`,
              `\u6218\u635f\u8bc4\u7ea7\uff1a${getWarCasualtyTierLabel(report.casualtyRatio)}`,
              `\u5956\u52b1\u6863\u4f4d\uff1a${getWarLootOutcomeLabel(report)}`,
              `\u4f5c\u6218\u6a21\u5f0f\uff1a${getWarBattleModeLabel(report.battleMode)}`,
              `\u9047\u654c\u7c7b\u578b\uff1a${getEncounterTypeLabel(report.encounterType)}`,
            ])}>
              <div>
                <strong>${report.stageName}</strong>
                <div class="muted">${getWarReportOutcomeLabel(report)} \u00b7 ${getWarEndingReasonLabel(report)} \u00b7 ${getWarBattleModeLabel(report.battleMode)}</div>
                <div class="detail-list">
                  <span>\u6218\u635f ${getWarCasualtyTierLabel(report.casualtyRatio)}</span>
                  <span>\u5956\u52b1 ${getWarLootOutcomeLabel(report)}</span>
                  <span>\u9047\u654c ${getEncounterTypeLabel(report.encounterType)}</span>
                </div>
              </div>
              <div class="inline-actions">
                <button class="${selectedReport?.id === report.id ? 'secondary' : 'ghost'}" data-action="select-war-report" data-id="${report.id}">${selectedReport?.id === report.id ? '\u5df2\u9009\u4e2d' : '\u67e5\u770b'}</button>
              </div>
            </div>
          `).join('') || '<div class="card"><div class="muted">\u5f53\u524d\u7b5b\u9009\u4e0b\u6682\u65e0\u6218\u62a5</div></div>'}
        </div>
        ${selectedReport ? `
          <div class="card" ${tooltipAttr([
            `\u5f53\u524d\u67e5\u770b\uff1a${selectedReport.stageName}`,
            `\u5956\u52b1\u603b\u89c8\uff1a${formatCostSummary(selectedReport.reward)}`,
            selectedReport.triggeredMechanicIds?.length ? `\u89e6\u53d1\u673a\u5236\uff1a${selectedReport.triggeredMechanicIds.join(' \u00b7 ')}` : '\u672c\u573a\u672a\u89e6\u53d1\u989d\u5916\u673a\u5236',
          ])}>
            <div class="card-title"><strong>\u6218\u62a5\u8be6\u89c8\uff1a${selectedReport.stageName}</strong><span class="tag">${getWarReportOutcomeLabel(selectedReport)}</span></div>
            <div class="muted">${getWarEndingReasonLabel(selectedReport)} \u00b7 ${getWarBattleModeLabel(selectedReport.battleMode)} \u00b7 \u7b56\u7565\u5206 ${selectedReport.strategyScore}</div>
            <div class="detail-list">
              <span>\u6218\u635f\u7387 ${(selectedReport.casualtyRatio * 100).toFixed(1)}%</span>
              <span>\u6218\u635f\u8bc4\u7ea7 ${getWarCasualtyTierLabel(selectedReport.casualtyRatio)}</span>
              <span>\u5956\u52b1\u6863\u4f4d ${getWarLootOutcomeLabel(selectedReport)}</span>
              <span>\u56de\u5408\u6570 ${selectedReport.rounds?.length ?? 0}</span>
              <span>\u89e6\u53d1\u673a\u5236 ${selectedReport.triggeredMechanicIds?.length ?? 0}</span>
            </div>
            ${rewardLine('\u6218\u5229\u54c1\u5408\u8ba1', selectedReport.reward)}
            ${rewardLine('\u57fa\u7840\u5956\u52b1', selectedReport.rewardBreakdown?.baseReward)}
            ${rewardLine('\u9996\u901a\u5956\u52b1', selectedReport.rewardBreakdown?.firstClearBonus)}
            ${rewardLine('\u989d\u5916\u6389\u843d', selectedReport.rewardBreakdown?.bonusLoot)}
            <div class="detail-list">${selectedReport.triggeredMechanicIds?.length ? selectedReport.triggeredMechanicIds.map((id) => `<span>${id}</span>`).join('') : '<span>\u6682\u65e0\u673a\u5236\u89e6\u53d1</span>'}</div>
            <div class="detail-list">${(selectedReport.rounds ?? []).map((round, index) => `<button class="${frame.roundIndex === index ? 'secondary' : 'ghost'}" data-action="war-replay-jump" data-round="${index}">\u7b2c ${round.round} \u56de\u5408</button>`).join('') || '<span>\u6682\u65e0\u56de\u5408\u8bb0\u5f55</span>'}</div>
          </div>
        ` : ''}
      </section>
  `;
}

