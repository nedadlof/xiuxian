import { renderWarSynergyCard } from './warRecruitView.js';

export function renderWarPreparationSection(params) {
  const {
    war,
    formations,
    currentStage,
    stageEnemyPreview,
    battleLocked,
    tooltipAttr,
    formatNumber,
    formatCostSummary,
    rewardLine,
    getEncounterTypeLabel,
    getTagLabel,
  } = params;

  return `
      <section class="panel">
        <div class="panel-title"><h3>\u519b\u9635\u6574\u5907</h3><span class="tag">\u5f53\u524d\u9635\u6cd5 ${war.formation?.name ?? '\u672a\u9009\u62e9'}</span></div>
        <div class="mini-grid">
          <div class="card"><div class="muted">\u603b\u5175\u529b</div><strong>${war.army.totalUnits}</strong></div>
          <div class="card"><div class="muted">\u653b\u52bf\u8bc4\u4f30</div><strong>${formatNumber(war.army.attackPower)}</strong></div>
          <div class="card"><div class="muted">\u5b88\u52bf\u8bc4\u4f30</div><strong>${formatNumber(war.army.defensePower)}</strong></div>
          <div class="card"><div class="muted">\u8c0b\u7565\u7cfb\u6570</div><strong>${war.army.strategyScore.toFixed(2)}</strong></div>
        </div>
        ${renderWarSynergyCard(war.army.synergies, tooltipAttr)}
        <div class="card">
          <div class="muted">\u5175\u79cd\u62db\u52df\u3001\u7ad9\u4f4d\u8c03\u6574\u4e0e\u9635\u6cd5\u5207\u6362\u5df2\u79fb\u81f3\u300c\u5175\u8425\u300d\u6807\u7b7e\u3002</div>
        </div>
        ${currentStage ? `
          <div class="card" ${tooltipAttr([
            `\u5f53\u524d\u76ee\u6807\uff1a${currentStage.name}`,
            `\u9047\u654c\u7c7b\u578b\uff1a${getEncounterTypeLabel(currentStage.encounterType)}`,
            `\u5730\u5f62\uff1a${currentStage.terrain}`,
            `\u654c\u519b\u6218\u529b\uff1a${formatNumber(currentStage.enemyPower)}`,
            `\u57fa\u7840\u5956\u52b1\uff1a${formatCostSummary(currentStage.rewardPreview?.baseReward ?? currentStage.reward)}`,
            currentStage.mechanics?.length ? `\u5173\u5361\u673a\u5236\uff1a${currentStage.mechanics.map((mechanic) => mechanic.text ?? mechanic.id).join(' \u00b7 ')}` : '\u5173\u5361\u673a\u5236\uff1a\u65e0',
          ])}>
            <div class="card-title"><strong>${currentStage.name}</strong><span class="tag">${getEncounterTypeLabel(currentStage.encounterType)}</span></div>
            <div class="muted">\u654c\u519b ${formatNumber(currentStage.enemyPower)} \u00b7 \u5730\u5f62 ${currentStage.terrain}</div>
            ${rewardLine('\u9884\u8ba1\u57fa\u7840\u5956\u52b1', currentStage.rewardPreview?.baseReward ?? currentStage.reward)}
            <div class="detail-list">${stageEnemyPreview.filter((row) => row.countRatio > 0).map((row) => `<span>\u7b2c${row.row}\u6392 ${row.name}${row.tags?.length ? ` \u00b7 ${row.tags.map((tag) => getTagLabel(tag)).join('/')}` : ''}</span>`).join('') || '<span>\u6682\u65e0\u654c\u9635\u4fe1\u606f</span>'}</div>
          </div>
        ` : ''}
        <div class="war-row-grid">
          ${(war.rowSummary ?? []).map((row) => `
            <div class="card" ${tooltipAttr([
              `\u7b2c ${row.row} \u6392`,
              row.units.length ? row.units.map((unit) => `${unit.name} x${unit.count}`).join(' \u00b7 ') : '\u672a\u90e8\u7f72\u5175\u79cd',
            ])}>
              <div class="card-title"><strong>\u7b2c ${row.row} \u6392</strong><span class="tag">\u5171 ${row.totalCount} \u4eba</span></div>
              <div class="muted">${row.units.length ? row.units.map((unit) => `${unit.name} x${unit.count}`).join(' \u00b7 ') : '\u6682\u65e0\u5175\u79cd'}</div>
            </div>
          `).join('')}
        </div>
      </section>
  `;
}

export function renderWarStageProgressionSection(params) {
  const {
    war,
    clearedStageCount,
    battleLocked,
    tooltipAttr,
    formatNumber,
    formatCostSummary,
    rewardLine,
    getEncounterTypeLabel,
  } = params;

  return `
      <section class="panel">
        <div class="panel-title"><h3>\u5173\u5361\u63a8\u8fdb</h3><span class="tag">\u5df2\u901a\u5173 ${clearedStageCount} \u4e2a</span></div>
        <div class="stage-grid">
          ${war.stages.map((stage) => `
            <div class="card" ${tooltipAttr([
              `\u5173\u5361\uff1a${stage.name}`,
              `\u533a\u57df\uff1a${stage.world}`,
              `\u5730\u5f62\uff1a${stage.terrain}`,
              `\u654c\u519b\u6218\u529b\uff1a${formatNumber(stage.enemyPower)}`,
              `\u9047\u654c\u7c7b\u578b\uff1a${getEncounterTypeLabel(stage.encounterType)}`,
              `\u5956\u52b1\u9884\u89c8\uff1a${formatCostSummary(stage.rewardPreview?.baseReward ?? stage.reward)}`,
              stage.mechanics?.length ? `\u5173\u5361\u673a\u5236\uff1a${stage.mechanics.map((mechanic) => mechanic.text ?? mechanic.id).join(' \u00b7 ')}` : '\u5173\u5361\u673a\u5236\uff1a\u65e0',
              stage.unlocked ? (stage.cleared ? '\u72b6\u6001\uff1a\u5df2\u901a\u5173\uff0c\u53ef\u518d\u6b21\u6311\u6218' : '\u72b6\u6001\uff1a\u5df2\u89e3\u9501\uff0c\u53ef\u7acb\u5373\u6311\u6218') : `\u672a\u89e3\u9501\uff1a${stage.lockReasons?.join(' \u00b7 ') ?? ''}`,
            ])}>
              <div class="card-title"><strong>${stage.name}</strong><span class="tag">${stage.current ? '\u5f53\u524d\u76ee\u6807' : stage.world}</span></div>
              <div class="muted">${getEncounterTypeLabel(stage.encounterType)} \u00b7 ${formatNumber(stage.enemyPower)} \u00b7 ${stage.terrain}</div>
              ${rewardLine('\u57fa\u7840\u5956\u52b1', stage.rewardPreview?.baseReward ?? stage.reward)}
              <div class="detail-list">${(stage.enemyPreview ?? []).filter((row) => row.countRatio > 0).slice(0, 3).map((row) => `<span>\u7b2c${row.row}\u6392 ${row.name}</span>`).join('') || '<span>\u6682\u65e0\u654c\u9635\u60c5\u62a5</span>'}</div>
              <div class="inline-actions">
                <button class="${stage.current ? 'secondary' : 'ghost'}" data-action="select-stage" data-id="${stage.id}" ${battleLocked ? 'disabled' : ''}>${stage.current ? '\u5f53\u524d\u76ee\u6807' : '\u8bbe\u4e3a\u76ee\u6807'}</button>
                <button ${(stage.unlocked && !battleLocked) ? '' : 'disabled'} data-action="challenge-stage" data-id="${stage.id}">${battleLocked ? '\u6218\u6597\u4e2d' : (stage.unlocked ? (stage.cleared ? '\u8fdb\u5165\u6218\u6597' : '\u53d1\u8d77\u6218\u6597') : '\u672a\u89e3\u9501')}</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
  `;
}
