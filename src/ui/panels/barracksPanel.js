import { getWarSnapshot } from '../../systems/warSystem.js?v=20260312-warehouse';
import { renderCounterAdviceCard, renderTacticalPlanCard, renderWarRecruitmentSection, renderWarSynergyCard } from '../warRecruitView.js';

export function barracksPanel(state, registries, deps = {}) {
  const {
    tooltipAttr,
    formatNumber,
    formatCostSummary,
    getTagLabel,
  } = deps;

  const war = getWarSnapshot(state, registries);
  if (!war) return '';

  const battleLocked = !!war.activeBattle;
  const formations = registries.systems.get('formations') ?? [];

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>\u5175\u8425</h3><span class="tag">${battleLocked ? '\u6218\u6597\u4e2d' : '\u6574\u5907\u4e2d'}</span></div>
        <div class="mini-grid">
          <div class="card"><div class="muted">\u5f53\u524d\u9635\u6cd5</div><strong>${war.formation?.name ?? '\u672a\u9009\u62e9'}</strong></div>
          <div class="card"><div class="muted">\u603b\u5175\u529b</div><strong>${war.army.totalUnits}</strong></div>
          <div class="card"><div class="muted">\u653b\u52bf\u8bc4\u4f30</div><strong>${formatNumber(war.army.attackPower)}</strong></div>
          <div class="card"><div class="muted">\u5b88\u52bf\u8bc4\u4f30</div><strong>${formatNumber(war.army.defensePower)}</strong></div>
        </div>
        ${renderWarSynergyCard(war.army.synergies, tooltipAttr)}
        ${renderCounterAdviceCard(war.counterAdvice, tooltipAttr)}
        ${renderTacticalPlanCard(war.tacticalRecommendation, tooltipAttr)}
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
        <div class="inline-actions">
          <button class="secondary" data-action="auto-arrange" ${battleLocked ? 'disabled' : ''}>\u81ea\u52a8\u5e03\u9635</button>
          ${formations.map((formation) => `<button class="${war.formation?.id === formation.id ? 'secondary' : 'ghost'}" data-action="set-formation" data-id="${formation.id}" ${battleLocked ? 'disabled' : ''} ${tooltipAttr([formation.description ?? ''])}>${formation.name}</button>`).join('')}
        </div>
        <div class="card">
          <div class="muted">\u62db\u52df\u3001\u8c03\u6574\u7ad9\u4f4d\u4ee5\u53ca\u5207\u6362\u9635\u6cd5\u90fd\u5728\u5175\u8425\u8fdb\u884c\u3002\u6218\u4e89\u9875\u4ec5\u7528\u4e8e\u9009\u62e9\u5173\u5361\u4e0e\u6307\u6325\u6218\u6597\u3002</div>
        </div>
        ${renderWarRecruitmentSection({
          units: war.units,
          battleLocked,
          tooltipAttr,
          formatCostSummary,
          getTagLabel,
        })}
      </section>
    </div>
  `;
}
