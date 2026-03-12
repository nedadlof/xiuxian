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

function formatOfflineDuration(seconds = 0) {
  const safeSeconds = Math.max(Math.floor(seconds), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分钟`;
  }
  if (minutes > 0) {
    return `${minutes} 分钟 ${remainSeconds} 秒`;
  }
  return `${remainSeconds} 秒`;
}

function renderOfflineSummary(sessionSummary, formatCostSummary) {
  if (!sessionSummary) {
    return '';
  }

  const commissionSummary = sessionSummary.commissions;
  const claimableReward = formatCostSummary(commissionSummary?.claimableReward ?? {});
  const completedNames = commissionSummary?.newCompletedNames?.join(' · ') || '暂无';

  return `
    <section class="panel">
      <div class="panel-title"><h3>离线进度</h3><span class="tag">${formatOfflineDuration(sessionSummary.offlineSeconds)}</span></div>
      <div class="grid">
        <div class="card">
          <div class="card-title"><strong>离线结算</strong><span class="tag">${sessionSummary.offlineSeconds} 秒</span></div>
          <div class="muted">本次离线已完成结算，可以直接继续当前宗门经营。</div>
        </div>
        <div class="card">
          <div class="card-title"><strong>委托进展</strong><span class="tag">${commissionSummary?.newCompletedCount ?? 0} 项完成</span></div>
          ${commissionSummary ? `
            <div class="muted">新完成委托：${completedNames}</div>
            <div class="muted">待领取奖励：${claimableReward}</div>
            <div class="muted">当前待结算：${commissionSummary.pendingCompletedCount ?? 0} 项</div>
            ${commissionSummary.activeName
              ? `<div class="muted">仍在执行：${commissionSummary.activeName}，剩余 ${Math.ceil(commissionSummary.activeRemainingSeconds ?? 0)} 秒</div>`
              : '<div class="muted">当前没有继续执行中的宗门委托。</div>'}
            <div class="inline-actions">
              <button class="secondary" data-action="switch-tab" data-tab="missions">前往委托页结算</button>
            </div>
          ` : `
            <div class="muted">离线期间没有新增的宗门委托结果。</div>
          `}
        </div>
      </div>
    </section>
  `;
}

export function overviewPanel(state, registries, deps = {}) {
  const economy = getEconomyOverviewSnapshot(state, registries);
  const sessionSummary = deps.getSessionSummary?.() ?? null;

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
      ${renderOfflineSummary(sessionSummary, deps.formatCostSummary)}
    </div>
  `;
}
