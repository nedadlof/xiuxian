import { renderEntityThumb } from '../entityVisuals.js?v=20260313-ui-refresh-2';

function getLogVisual(log = {}) {
  const category = `${log.category ?? 'system'}`.toLowerCase();
  if (category.includes('war') || category.includes('battle')) {
    return { kind: 'unit', subtitle: '战报', tone: category };
  }
  if (category.includes('beast')) {
    return { kind: 'beast', subtitle: '灵兽', tone: category };
  }
  if (category.includes('mission')) {
    return { kind: 'disciple', subtitle: '委托', tone: category };
  }
  if (category.includes('economy') || category.includes('craft')) {
    return { kind: 'resource', subtitle: '产业', tone: category };
  }
  return { kind: 'generic', subtitle: '宗门', tone: category };
}

export function logsPanel(state, registries, deps = {}) {
  const { formatTime } = deps;
  const sanitizeUiText = deps.sanitizeUiText ?? ((value) => value);

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>宗门日志</h3><span class="tag">最近 ${state.logs.length} 条</span></div>
        <div class="card">
          <div class="entity-row">
            ${renderEntityThumb({
              kind: 'generic',
              title: '宗门日志',
              subtitle: '近况卷录',
              badge: '志',
              tone: 'sect-logs',
            })}
            <div class="entity-copy">
              <div class="card-title"><strong>近况卷录</strong><span class="tag">自动归档</span></div>
              <div class="muted">这里会持续记录宗门经营、战斗推进、委托结算和工坊变化，方便回溯挂机期间发生的关键事件。</div>
            </div>
          </div>
        </div>
        <div class="log-list">
          ${state.logs.map((log) => {
            const visual = getLogVisual(log);
            return `
              <div class="log-item">
                ${renderEntityThumb({
                  kind: visual.kind,
                  title: log.category ?? 'system',
                  subtitle: visual.subtitle,
                  badge: log.category ?? '记',
                  tone: visual.tone,
                  className: 'entity-thumb-small',
                })}
                <div>
                  <strong>${log.category ?? 'system'}</strong>
                  <div class="muted">${sanitizeUiText(log.message)}</div>
                </div>
                <span class="tag">${log.createdAt ? formatTime(log.createdAt) : '刚刚'}</span>
              </div>
            `;
          }).join('') || '<div class="card">暂无日志</div>'}
        </div>
      </section>
    </div>
  `;
}
