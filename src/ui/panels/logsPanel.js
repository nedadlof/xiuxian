import { renderEntityThumb } from '../entityVisuals.js?v=20260313-ui-refresh-2';

const LOG_CATEGORY_META = Object.freeze({
  system: { title: '宗门', badge: '宗', subtitle: '宗门' },
  scripture: { title: '藏经阁', badge: '经', subtitle: '经卷' },
  missions: { title: '委托', badge: '委', subtitle: '委托' },
  disciples: { title: '弟子', badge: '徒', subtitle: '弟子' },
  beasts: { title: '灵兽', badge: '兽', subtitle: '灵兽' },
  economy: { title: '产业', badge: '坊', subtitle: '产业' },
  trade: { title: '交易坊', badge: '市', subtitle: '交易' },
  war: { title: '战争', badge: '战', subtitle: '战报' },
  smoke: { title: '演示', badge: '测', subtitle: '调试' },
});

function getLogVisual(log = {}) {
  const category = `${log.category ?? 'system'}`.toLowerCase();
  const baseMeta = LOG_CATEGORY_META[category] ?? {
    title: log.category ?? '宗门',
    badge: `${log.category ?? '记'}`.slice(0, 1),
    subtitle: '宗门',
  };
  if (category.includes('war') || category.includes('battle')) {
    return { kind: 'unit', title: '战争', badge: '战', subtitle: '战报', tone: category };
  }
  if (category.includes('beast')) {
    return { kind: 'beast', title: '灵兽', badge: '兽', subtitle: '灵兽', tone: category };
  }
  if (category.includes('mission')) {
    return { kind: 'disciple', title: '委托', badge: '委', subtitle: '委托', tone: category };
  }
  if (category.includes('economy') || category.includes('craft')) {
    return { kind: 'resource', title: '产业', badge: '坊', subtitle: '产业', tone: category };
  }
  if (category.includes('trade')) {
    return { kind: 'resource', title: '交易坊', badge: '市', subtitle: '交易', tone: category };
  }
  if (category.includes('disciples')) {
    return { kind: 'disciple', title: '弟子', badge: '徒', subtitle: '弟子', tone: category };
  }
  return { kind: 'generic', ...baseMeta, tone: category };
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
                  title: visual.title,
                  subtitle: visual.subtitle,
                  badge: visual.badge,
                  tone: visual.tone,
                  className: 'entity-thumb-small',
                })}
                <div>
                  <strong>${visual.title}</strong>
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
