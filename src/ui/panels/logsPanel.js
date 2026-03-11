export function logsPanel(state, registries, deps = {}) {
  const { formatTime } = deps;
  const sanitizeUiText = deps.sanitizeUiText ?? ((value) => value);

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>\u5b97\u95e8\u65e5\u5fd7</h3><span class="tag">\u6700\u8fd1 ${state.logs.length} \u6761</span></div>
        <div class="log-list">
          ${state.logs.map((log) => `
            <div class="log-item">
              <div>
                <strong>${log.category ?? 'system'}</strong>
                <div class="muted">${sanitizeUiText(log.message)}</div>
              </div>
              <span class="tag">${log.createdAt ? formatTime(log.createdAt) : '\u521a\u521a'}</span>
            </div>
          `).join('') || '<div class="card">\u6682\u65e0\u65e5\u5fd7</div>'}
        </div>
      </section>
    </div>
  `;
}
