export function renderAppShell(params) {
  const { activeTab, tabContent, tabs } = params;

  const tabButtons = (tabs ?? []).map(([key, label]) => (
    `<button class="${activeTab === key ? 'active' : 'secondary'}" data-action="switch-tab" data-tab="${key}">${label}</button>`
  )).join('');

  return `
    <div class="panel">
      <div class="panel-title"><h3>\u5b97\u95e8\u9762\u677f</h3><span class="tag">\u6302\u673a\u4fee\u4ed9</span></div>
      <div class="inline-actions">
        ${tabButtons}
        <button data-action="save-game">\u5b58\u6863</button>
        <button class="ghost" data-action="reset-game">\u91cd\u7f6e</button>
      </div>
    </div>
    ${tabContent}
    <div class="tooltip hidden" data-role="tooltip"></div>
  `;
}

