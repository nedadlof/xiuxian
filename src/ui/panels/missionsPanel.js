import { getCommissionSnapshot } from '../../systems/commissionSystem.js';

function renderRewardSummary(reward = {}, formatCostSummary) {
  return Object.keys(reward ?? {}).length ? formatCostSummary(reward) : '暂无';
}

function renderProgressPercent(active) {
  const total = Math.max(active?.durationSeconds ?? 1, 1);
  const remaining = Math.max(active?.remainingSeconds ?? total, 0);
  const elapsed = total - remaining;
  return Math.max(0, Math.min(Math.round((elapsed / total) * 100), 100));
}

function renderTeamNames(teamSnapshot = {}) {
  const members = teamSnapshot.members ?? [];
  return members.length ? members.map((member) => member.name).join(' · ') : '未配置出征队';
}

export function missionsPanel(state, registries, deps = {}) {
  const {
    tooltipAttr,
    formatNumber,
    formatCostSummary,
  } = deps;
  const missions = getCommissionSnapshot(state, registries);
  const active = missions.active;
  const progressPercent = renderProgressPercent(active);

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>宗门委托</h3><span class="tag">${active ? '执行中' : '待派遣'}</span></div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>当前出征队</strong><span class="tag">${missions.teamSnapshot.members.length} / 3</span></div>
            <div class="muted">成员：${renderTeamNames(missions.teamSnapshot)}</div>
            <div class="muted">羁绊：${missions.teamSnapshot.bonds?.activeBonds?.map((bond) => bond.name).join(' · ') || '未激活'}</div>
            <div class="muted">阵营 ${missions.teamSnapshot.bonds?.uniqueFactionCount ?? 0} · 总共鸣 ${missions.teamSnapshot.bonds?.totalResonance ?? 0}</div>
            <div class="inline-actions">
              <button class="ghost" data-action="switch-tab" data-tab="disciples">前往弟子页调队</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title"><strong>执行状态</strong><span class="tag">${active ? `${progressPercent}%` : '空闲'}</span></div>
            ${active ? `
              <div class="muted">${active.name}</div>
              <div class="war-progress-track"><span class="war-progress-fill ally" style="width:${progressPercent}%"></span></div>
              <div class="detail-list">
                <span>剩余 ${Math.ceil(active.remainingSeconds ?? 0)} 秒</span>
                <span>队伍评分 ${active.evaluation?.totalScore ?? 0}</span>
                <span>评级 ${active.evaluation?.tier?.label ?? '待定'}</span>
              </div>
              <div class="muted">预计收益：${renderRewardSummary(active.evaluation?.totalReward, formatCostSummary)}</div>
            ` : `
              <div class="muted">当前没有进行中的委托。配置出征队后，可以派队进行挂机委托。</div>
            `}
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-title"><h3>可接委托</h3><span class="tag">${missions.available.length} 项</span></div>
        <div class="grid">
          ${missions.available.map((mission) => `
            <div class="card" ${tooltipAttr([
              mission.description,
              `推荐评分：${mission.recommendedScore}`,
              `预计评级：${mission.evaluation?.tier?.label ?? '待定'}`,
              `基础奖励：${renderRewardSummary(mission.reward, formatCostSummary)}`,
              `额外奖励：${renderRewardSummary(mission.bonusReward, formatCostSummary)}`,
            ])}>
              <div class="card-title"><strong>${mission.name}</strong><span class="tag">${mission.durationSeconds} 秒</span></div>
              <div class="muted">${mission.description}</div>
              <div class="detail-list">
                <span>推荐评分 ${mission.recommendedScore}</span>
                <span>队伍评分 ${mission.evaluation?.totalScore ?? 0}</span>
                <span>预计 ${mission.evaluation?.tier?.label ?? '待定'}</span>
              </div>
              <div class="muted">预计收益：${renderRewardSummary(mission.evaluation?.totalReward, formatCostSummary)}</div>
              <div class="inline-actions">
                <button ${mission.canStart ? '' : 'disabled'} data-action="start-commission" data-id="${mission.id}">派遣委托</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
      <section class="panel">
        <div class="panel-title"><h3>待结算委托</h3><span class="tag">${missions.completed.length} 项</span></div>
        <div class="log-list">
          ${missions.completed.length ? missions.completed.map((mission) => `
            <div class="log-item" ${tooltipAttr([
              `完成评级：${mission.evaluation?.tier?.label ?? '待定'}`,
              `队伍成员：${mission.teamSnapshot?.members?.map((member) => member.name).join(' · ') || '未记录'}`,
              `奖励：${renderRewardSummary(mission.evaluation?.totalReward, formatCostSummary)}`,
            ])}>
              <div>
                <strong>${mission.name}</strong>
                <div class="muted">${mission.evaluation?.tier?.label ?? '待定'} · 奖励 ${renderRewardSummary(mission.evaluation?.totalReward, formatCostSummary)}</div>
              </div>
              <div class="inline-actions">
                <button class="secondary" data-action="claim-commission" data-id="${mission.id}">结算领取</button>
              </div>
            </div>
          `).join('') : '<div class="card"><div class="muted">当前没有待领取的委托。</div></div>'}
        </div>
        ${missions.history.length ? `
          <div class="card">
            <div class="card-title"><strong>委托记录</strong><span class="tag">${missions.history.length} 条</span></div>
            <div class="detail-list">
              ${missions.history.map((mission) => `<span>${mission.name} · ${mission.evaluation?.tier?.label ?? '待定'} · ${renderRewardSummary(mission.evaluation?.totalReward, formatCostSummary)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </section>
    </div>
  `;
}
