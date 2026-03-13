import { renderEntityThumb } from './entityVisuals.js?v=20260313-ui-refresh';

export function renderAppShell(params) {
  const {
    activeTab,
    tabContent,
    tabs,
    shellMeta = {},
  } = params;

  const tabButtons = (tabs ?? []).map(([key, label]) => (
    `<button class="${activeTab === key ? 'active' : 'secondary'}" data-action="switch-tab" data-tab="${key}">${label}</button>`
  )).join('');
  const activeTabLabel = (tabs ?? []).find(([key]) => key === activeTab)?.[1] ?? activeTab;
  const quickStats = [
    { label: '当前卷轴', value: activeTabLabel },
    ...(shellMeta.quickStats ?? []),
  ].slice(0, 4);

  return `
    <div class="page-shell">
      <header class="hero shell-banner">
        <div class="shell-main">
          <div class="entity-row">
            ${renderEntityThumb({
              kind: 'generic',
              title: '宗门',
              subtitle: '挂机修仙',
              badge: '宗',
              tone: 'sect-idle',
            })}
            <div class="entity-copy">
              <div class="shell-eyebrow">太虚宗门录</div>
              <h1 class="shell-title">宗门面板</h1>
              <div class="muted shell-summary">${shellMeta.summary ?? '以纸卷式布局收束信息密度，让养成、战斗与制造都能在同一页风格下稳定阅读。'}</div>
            </div>
          </div>
          <div class="nav shell-nav">
            ${tabButtons}
          </div>
        </div>
        <aside class="shell-aside">
          <div class="panel shell-side-card">
            <div class="panel-title">
              <h3>今日宗务</h3>
              <span class="tag">挂机修仙</span>
            </div>
            <div class="shell-stats">
              ${quickStats.map((stat) => `
                <div class="shell-stat">
                  <div class="muted">${stat.label}</div>
                  <strong>${stat.value}</strong>
                </div>
              `).join('')}
            </div>
            <div class="inline-actions shell-actions">
              <button data-action="save-game">存档</button>
              <button class="ghost" data-action="reset-game">重置</button>
            </div>
          </div>
        </aside>
      </header>
      ${tabContent}
      <div class="tooltip hidden" data-role="tooltip"></div>
    </div>
  `;
}
