import { getEconomyOverviewSnapshot, getEconomySnapshot } from '../../systems/economySystem.js';
import { getTradeSnapshot } from '../../systems/tradeSystem.js';

export function economyPanel(state, registries, deps = {}) {
  const {
    tooltipAttr,
    formatNumber,
    formatCostSummary,
    formatResourceRate,
    formatResourceAmount,
    getResourceLabel,
  } = deps;

  const overview = getEconomyOverviewSnapshot(state, registries);
  const buildings = getEconomySnapshot(state, registries);
  const trade = getTradeSnapshot(state, registries);

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>\u5de5\u4eba\u4e0e\u5bbf\u820d</h3><span class="tag">\u6269\u5f20\u6838\u5fc3</span></div>
        <div class="mini-grid">
          <div class="card"><div class="muted">\u603b\u5de5\u4eba</div><strong>${overview.workforce.totalWorkers}</strong></div>
          <div class="card"><div class="muted">\u7a7a\u95f2\u5de5\u4eba</div><strong>${overview.workforce.idleWorkers}</strong></div>
          <div class="card"><div class="muted">\u4eba\u53e3\u4e0a\u9650</div><strong>${overview.workforce.populationCap}</strong></div>
          <div class="card"><div class="muted">\u6302\u673a\u9884\u4f30</div><strong>${formatCostSummary(overview.offlineYieldByResource)}</strong></div>
        </div>
        <div class="inline-actions">
          <button data-action="recruit-workers" data-amount="1" ${tooltipAttr([`\u62db\u52df 1 \u4eba`, `\u82b1\u8d39\uff1a${formatCostSummary(overview.recruitCosts.one)}`])}>\u62db\u52df 1 \u4eba</button>
          <button data-action="recruit-workers" data-amount="5" ${tooltipAttr([`\u62db\u52df 5 \u4eba`, `\u82b1\u8d39\uff1a${formatCostSummary(overview.recruitCosts.five)}`])}>\u62db\u52df 5 \u4eba</button>
          <button ${overview.dormitoryPlan.canBuild ? '' : 'disabled'} data-action="build-dormitory" ${tooltipAttr([`\u65b0\u5efa\u5bbf\u820d`, `\u82b1\u8d39\uff1a${formatCostSummary(overview.dormitoryPlan.nextCost)}`, `\u65b0\u589e\u5bb9\u91cf\uff1a${overview.dormitoryPlan.nextCapacity}`])}>\u65b0\u5efa\u5bbf\u820d</button>
        </div>
        <div class="log-list">
          ${overview.dormitorySnapshots.map((dormitory) => `
            <div class="log-item" ${tooltipAttr([`\u5f53\u524d\u5bb9\u91cf\uff1a${dormitory.capacity}`, `\u5347\u7ea7\u540e\u5bb9\u91cf\uff1a${dormitory.nextCapacity}`, `\u5347\u7ea7\u82b1\u8d39\uff1a${formatCostSummary(dormitory.upgradeCost)}`])}>
              <div>
                <strong>${dormitory.name}</strong>
                <div class="muted">Lv.${dormitory.level} \u00b7 \u5bb9\u91cf ${dormitory.capacity}</div>
              </div>
              <button class="secondary" data-action="upgrade-dormitory" data-id="${dormitory.id}">\u5347\u7ea7</button>
            </div>
          `).join('') || '<div class="card">\u6682\u65e0\u5bbf\u820d\u6570\u636e</div>'}
        </div>
      </section>
      <section class="panel">
        <div class="panel-title"><h3>\u4ea7\u4e1a\u5efa\u7b51</h3><span class="tag">\u8d44\u6e90\u5faa\u73af</span></div>
        <div class="log-list">
          ${buildings.map((building) => `
            <div class="log-item" ${tooltipAttr([
              `\u7b49\u7ea7\uff1a${building.level}`,
              `\u5de5\u4eba\uff1a${building.workers}`,
              `\u5f53\u524d\u4ea7\u51fa\uff1a${formatResourceRate(building.resourceId, building.productionPerSecond, 'second')}`,
              `\u5347\u7ea7\u540e\u4ea7\u51fa\uff1a${formatResourceRate(building.resourceId, building.nextProductionPerSecond, 'second')}`,
              `\u5347\u7ea7\u82b1\u8d39\uff1a${formatCostSummary(building.nextCost)}`,
              building.unlocked ? '\u72b6\u6001\uff1a\u5df2\u89e3\u9501' : `\u89e3\u9501\u6761\u4ef6\uff1a${building.unlockNodeName ?? '\u672a\u77e5\u8282\u70b9'}`
            ])}>
              <div>
                <strong>${building.name}</strong>
                <div class="muted">Lv.${building.level} \u00b7 \u5de5\u4eba ${building.workers} \u00b7 \u5e93\u5b58 ${formatNumber(building.currentStored)}/${formatNumber(building.storageCap)}</div>
              </div>
              <div class="inline-actions">
                <button class="ghost" ${building.unlocked && building.level > 0 ? '' : 'disabled'} data-action="assign-worker" data-key="${building.workerKey}" data-amount="-1">-\u5de5\u4eba</button>
                <button class="ghost" ${building.unlocked && building.level > 0 ? '' : 'disabled'} data-action="assign-worker" data-key="${building.workerKey}" data-amount="1">+\u5de5\u4eba</button>
                <button ${building.unlocked ? '' : 'disabled'} data-action="upgrade-building" data-id="${building.id}">${building.level > 0 ? '\u5347\u7ea7' : '\u5efa\u9020'}</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
      <section class="panel">
        <div class="panel-title"><h3>\u4ea4\u6613\u574a</h3><span class="tag">${trade.unlocked ? '\u5df2\u5f00\u653e' : '\u672a\u5f00\u653e'}</span></div>
        <div class="log-list">
          ${trade.routes.map((route) => `
            <div class="log-item" ${tooltipAttr([`\u6295\u5165\uff1a${formatResourceAmount(route.sourceId, route.lotSize, ' ')}`, `\u4ea7\u51fa\uff1a${formatResourceAmount(route.targetId, route.output, ' ')}`, route.unlocked ? '\u72b6\u6001\uff1a\u5df2\u5f00\u653e' : '\u72b6\u6001\uff1a\u672a\u5f00\u653e'])}>
              <div>
                <strong>${route.name}</strong>
                <div class="muted">${getResourceLabel(route.sourceId)} \u2192 ${getResourceLabel(route.targetId)}</div>
              </div>
              <div class="inline-actions">
                <button ${route.unlocked ? '' : 'disabled'} class="ghost" data-action="trade-route" data-id="${route.id}" data-multiplier="1">\u5151\u6362</button>
                <button ${route.unlocked ? '' : 'disabled'} class="secondary" data-action="trade-route" data-id="${route.id}" data-multiplier="5">\u6279\u91cf\u00d75</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}

