import { getEconomyOverviewSnapshot } from '../../systems/economySystem.js';

function renderResourceBar(state, deps = {}) {
  const {
    resourceDisplayOrder = [],
    tooltipAttr,
    formatNumber,
    getResourceLabel,
  } = deps;

  return `<div class="mini-grid">${resourceDisplayOrder.map((key) => `
    <div class="card" ${tooltipAttr([`资源：${getResourceLabel(key)}`, `当前数量：${formatNumber(state.resources[key] ?? 0)}`])}>
      <div class="muted">${getResourceLabel(key)}</div>
      <strong>${formatNumber(state.resources[key] ?? 0)}</strong>
    </div>
  `).join('')}</div>`;
}

export function overviewPanel(state, registries, deps = {}) {
  const economy = getEconomyOverviewSnapshot(state, registries);
  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>宗门概览</h3><span class="tag">${state.scripture.era}</span></div>
        ${renderResourceBar(state, deps)}
      </section>
      <section class="panel">
        <div class="panel-title"><h3>当前进度</h3><span class="tag">总览</span></div>
        <div class="mini-grid">
          <div class="card"><div class="muted">总工人</div><strong>${economy.workforce.totalWorkers}</strong></div>
          <div class="card"><div class="muted">空闲工人</div><strong>${economy.workforce.idleWorkers}</strong></div>
          <div class="card"><div class="muted">通关关卡</div><strong>${state.war.clearedStages.length}</strong></div>
          <div class="card"><div class="muted">已参悟节点</div><strong>${state.scripture.unlockedNodes.length}</strong></div>
        </div>
      </section>
    </div>
  `;
}
