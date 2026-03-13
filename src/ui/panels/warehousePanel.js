import { getWarehouseSnapshot } from '../../systems/warehouseSystem.js';

function formatPercent(value = 0, digits = 0) {
  return `${(Math.max(Number(value) || 0, 0) * 100).toFixed(digits)}%`;
}

function renderPressureSection(warehouse, deps = {}) {
  const {
    formatNumber,
    getResourceLabel,
  } = deps;

  return `
    <div class="log-list">
      ${warehouse.pressureEntries.slice(0, 4).map((entry) => {
        const percent = Math.min(Math.round((entry.ratio ?? 0) * 100), 100);
        return `
          <div class="log-item">
            <div style="flex:1;">
              <strong>${getResourceLabel(entry.resourceId)}</strong>
              <div class="muted">库存 ${formatNumber(entry.current)}/${formatNumber(entry.cap)}</div>
              <div class="war-progress-track"><span class="war-progress-fill ally" style="width:${percent}%"></span></div>
            </div>
            <span class="tag">${percent}%</span>
          </div>
        `;
      }).join('') || '<div class="card">当前没有可监控的仓储压力。</div>'}
    </div>
  `;
}

function renderStrategySection(warehouse, deps = {}) {
  const {
    tooltipAttr,
  } = deps;

  return `
    <div class="log-list">
      ${warehouse.strategies.map((strategy) => `
        <div class="log-item" ${tooltipAttr([
          strategy.description,
          ...strategy.effectSummary,
          strategy.unlocked ? '状态：已解锁' : `解锁条件：总仓阶达到 ${strategy.requiredLevel}`,
        ])}>
          <div>
            <strong>${strategy.name}</strong>
            <div class="muted">${strategy.unlocked ? strategy.description : `总仓阶 ${warehouse.totalLevel}/${strategy.requiredLevel}`}</div>
          </div>
          <button
            class="${strategy.active ? 'secondary' : ''}"
            ${strategy.unlocked && !strategy.active ? '' : 'disabled'}
            data-action="set-warehouse-strategy"
            data-id="${strategy.id}"
          >${strategy.active ? '当前仓策' : '切换仓策'}</button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSealSection(warehouse, deps = {}) {
  const {
    tooltipAttr,
    formatCostSummary,
    formatNumber,
    getResourceLabel,
  } = deps;

  return `
    <div class="log-list">
      ${warehouse.seals.map((seal) => `
        <div class="card" ${tooltipAttr([
          seal.description,
          ...seal.effectSummary,
          `封存成本：${formatCostSummary(seal.cost)}`,
        ])}>
          <div class="card-title">
            <strong>${seal.name}</strong>
            <span class="tag">仓阶 ${seal.level}/${seal.maxLevel}</span>
          </div>
          <div class="muted">已封存 ${seal.sealCount} 次 · ${seal.nextThreshold == null ? '已达满阶' : `下阶还需 ${seal.sealsToNext} 次`}</div>
          <div class="war-progress-track"><span class="war-progress-fill ally" style="width:${seal.progressPercent}%"></span></div>
          <div class="muted">封存材料：${formatCostSummary(seal.cost)}</div>
          <div class="muted">
            ${seal.resourceEntries.map((entry) => `${getResourceLabel(entry.resourceId)} ${formatNumber(entry.current)}/${formatNumber(entry.amount)}`).join(' · ')}
          </div>
          <div class="inline-actions">
            <button ${seal.affordable ? '' : 'disabled'} data-action="warehouse-seal" data-id="${seal.id}">封存入库</button>
            <span class="tag">压力 ${Math.round((seal.pressureScore ?? 0) * 100)}%</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderBonusSection(warehouse) {
  return `
    <div class="mini-grid">
      <div class="card">
        <div class="muted">仓容增幅</div>
        <strong>${formatPercent(warehouse.bonuses.storageMultiplier)}</strong>
      </div>
      <div class="card">
        <div class="muted">产业增幅</div>
        <strong>${formatPercent(warehouse.bonuses.economyGlobalOutputMultiplier)}</strong>
      </div>
      <div class="card">
        <div class="muted">委托加成</div>
        <strong>${formatPercent(warehouse.bonuses.commissionRewardMultiplier)}</strong>
      </div>
      <div class="card">
        <div class="muted">战利加成</div>
        <strong>${formatPercent(warehouse.bonuses.warRewardMultiplier)}</strong>
      </div>
    </div>
  `;
}

export function warehousePanel(state, registries, deps = {}) {
  const {
    tooltipAttr,
    formatCostSummary,
    formatNumber,
    formatTime,
    getResourceLabel,
  } = deps;
  const warehouse = getWarehouseSnapshot(state, registries);
  const autoSealLabel = warehouse.autoSealEnabled
    ? ((warehouse.nextAutoSealAt ?? 0) > Date.now() ? `下次尝试 ${formatTime(warehouse.nextAutoSealAt)}` : '下次 Tick 即尝试')
    : '未开启';

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>宗门仓库</h3><span class="tag">总仓阶 ${warehouse.totalLevel}</span></div>
        ${renderBonusSection(warehouse)}
        <div class="mini-grid">
          <div class="card">
            <div class="muted">当前仓策</div>
            <strong>${warehouse.activeStrategy?.name ?? '均衡盘库'}</strong>
          </div>
          <div class="card">
            <div class="muted">自动封存</div>
            <strong>${warehouse.autoSealEnabled ? '已开启' : '未开启'}</strong>
          </div>
          <div class="card">
            <div class="muted">自动节奏</div>
            <strong>${autoSealLabel}</strong>
          </div>
          <div class="card">
            <div class="muted">宗务额外收益</div>
            <strong>声望 +${warehouse.bonuses.commissionReputationFlatBonus} · 事务点 +${warehouse.bonuses.commissionAffairsFlatBonus}</strong>
          </div>
        </div>
        <div class="inline-actions">
          <button data-action="toggle-warehouse-auto-seal">${warehouse.autoSealEnabled ? '关闭自动封存' : '开启自动封存'}</button>
        </div>
        <div class="panel-title" style="margin-top:16px;"><h3>库存压力</h3><span class="tag">优先看接近满仓的资源</span></div>
        ${renderPressureSection(warehouse, { formatNumber, getResourceLabel })}
      </section>

      <section class="panel">
        <div class="panel-title"><h3>仓储法策</h3><span class="tag">${warehouse.activeStrategy?.name ?? '均衡盘库'}</span></div>
        ${renderStrategySection(warehouse, { tooltipAttr })}
      </section>

      <section class="panel">
        <div class="panel-title"><h3>封存库位</h3><span class="tag">把闲置资源转成长线收益</span></div>
        ${renderSealSection(warehouse, {
          tooltipAttr,
          formatCostSummary,
          formatNumber,
          getResourceLabel,
        })}
      </section>
    </div>
  `;
}
