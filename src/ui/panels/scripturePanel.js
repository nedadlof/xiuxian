import { getScriptureSnapshot } from '../../systems/scriptureSystem.js';
import { renderEntityThumb } from '../entityVisuals.js?v=20260313-ui-refresh-2';

function getNodeRarity(node = {}) {
  if (node.unlocked) {
    return 'rare';
  }
  if (node.canResearch) {
    return 'epic';
  }
  return 'common';
}

export function scripturePanel(state, registries, deps = {}) {
  const { tooltipAttr, formatNumber, formatCostSummary } = deps;

  const nodes = getScriptureSnapshot(state, registries);
  const scriptureWorkers = state.workforce.assignedWorkers.scriptureHall ?? 0;
  const availableCount = nodes.filter((node) => node.canResearch).length;
  const unlockedCount = nodes.filter((node) => node.unlocked).length;

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>藏经阁工作</h3><span class="tag">道蕴核心</span></div>
        <div class="mini-grid">
          <div class="card">
            <div class="entity-row entity-row-compact">
              ${renderEntityThumb({
                kind: 'generic',
                title: '藏经阁',
                subtitle: '研修中',
                badge: '经',
                tone: 'scripture-hall',
                className: 'entity-thumb-small',
              })}
              <div class="entity-copy">
                <div class="muted">当前工人</div>
                <strong>${scriptureWorkers}</strong>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="entity-row entity-row-compact">
              ${renderEntityThumb({
                kind: 'generic',
                title: '可参悟',
                subtitle: '研究节点',
                badge: '悟',
                tone: 'scripture-ready',
                className: 'entity-thumb-small',
              })}
              <div class="entity-copy">
                <div class="muted">可参悟节点</div>
                <strong>${availableCount}</strong>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="entity-row entity-row-compact">
              ${renderEntityThumb({
                kind: 'generic',
                title: '已参悟',
                subtitle: '经卷积累',
                badge: '录',
                tone: 'scripture-unlocked',
                className: 'entity-thumb-small',
              })}
              <div class="entity-copy">
                <div class="muted">已参悟节点</div>
                <strong>${unlockedCount}</strong>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="entity-row entity-row-compact">
              ${renderEntityThumb({
                kind: 'resource',
                title: '道蕴',
                subtitle: '持续积累',
                badge: '道',
                tone: 'dao',
                className: 'entity-thumb-small',
              })}
              <div class="entity-copy">
                <div class="muted">研修建议</div>
                <strong>${availableCount > 0 ? '优先点亮可参悟节点' : '继续挂机积攒道蕴'}</strong>
              </div>
            </div>
          </div>
        </div>
        <div class="card" ${tooltipAttr([`当前工人：${scriptureWorkers}`, '增加工人可持续提升道蕴获取效率。'])}>
          <div class="entity-row">
            ${renderEntityThumb({
              kind: 'disciple',
              title: '经阁值守',
              subtitle: '静修抄录',
              badge: '修',
              tone: 'scripture-worker',
            })}
            <div class="entity-copy">
              <div class="card-title"><strong>经阁值守</strong><span class="tag">研修加速</span></div>
              <div class="muted">藏经阁负责把挂机获得的道蕴转成长期科技树推进。工人越多，越快进入后续兵道、万灵与工坊体系。</div>
              <div class="inline-actions">
                <button class="ghost" data-action="assign-scripture-worker" data-amount="-1">减少 1 人</button>
                <button class="ghost" data-action="assign-scripture-worker" data-amount="1">增加 1 人</button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-title"><h3>研究节点</h3><span class="tag">可参悟 ${availableCount}</span></div>
        <div class="log-list">
          ${nodes.map((node) => {
            const buttonLabel = node.unlocked ? '已参悟' : (node.canResearch ? '参悟' : (node.available ? '资源不足' : '前置未满足'));
            const statusLabel = node.unlocked ? '已参悟' : (node.canResearch ? '可参悟' : (node.available ? '资源不足' : '待解锁'));
            return `
              <div class="log-item" ${tooltipAttr([
                `节点：${node.name}`,
                `纪元：${node.era}`,
                `道蕴消耗：${formatNumber(node.daoCost)}`,
                `资源消耗：${formatCostSummary(node.resourceCosts)}`,
                node.blockedByNames?.length ? `前置：${node.blockedByNames.join(' · ')}` : '前置已满足',
                Object.keys(node.missingCosts ?? {}).length ? `缺少资源：${formatCostSummary(node.missingCosts)}` : '资源已满足',
                `状态：${statusLabel}`,
              ])}>
                ${renderEntityThumb({
                  kind: 'generic',
                  title: node.name,
                  subtitle: node.era,
                  rarity: getNodeRarity(node),
                  badge: node.name,
                  tone: node.id,
                })}
                <div>
                  <div class="card-title">
                    <strong>${node.name}</strong>
                    <span class="tag">${statusLabel}</span>
                  </div>
                  <div class="muted">${node.era} · 道蕴 ${formatNumber(node.daoCost)}</div>
                  <div class="muted">资源消耗：${formatCostSummary(node.resourceCosts)}</div>
                  <div class="muted">${node.blockedByNames?.length ? `前置：${node.blockedByNames.join(' · ')}` : '前置已满足，可继续推进。'}</div>
                </div>
                <div class="inline-actions">
                  <button ${node.unlocked || !node.canResearch ? 'disabled' : ''} data-action="research-node" data-id="${node.id}">${buttonLabel}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    </div>
  `;
}
