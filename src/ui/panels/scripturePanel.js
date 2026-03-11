import { getScriptureSnapshot } from '../../systems/scriptureSystem.js';

export function scripturePanel(state, registries, deps = {}) {
  const { tooltipAttr, formatNumber, formatCostSummary } = deps;

  const nodes = getScriptureSnapshot(state, registries);
  const scriptureWorkers = state.workforce.assignedWorkers.scriptureHall ?? 0;
  const availableCount = nodes.filter((node) => node.canResearch).length;

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>\u85cf\u7ecf\u9601\u5de5\u4f5c</h3><span class="tag">\u9053\u8574\u6838\u5fc3</span></div>
        <div class="card" ${tooltipAttr([`\u5f53\u524d\u5de5\u4eba\uff1a${scriptureWorkers}`, '\u589e\u52a0\u5de5\u4eba\u53ef\u6301\u7eed\u63d0\u5347\u9053\u8574\u83b7\u53d6\u6548\u7387\u3002'])}>
          <div class="muted">\u5f53\u524d\u5de5\u4eba</div>
          <strong>${scriptureWorkers}</strong>
          <div class="inline-actions">
            <button class="ghost" data-action="assign-scripture-worker" data-amount="-1">\u51cf\u5c11 1 \u4eba</button>
            <button class="ghost" data-action="assign-scripture-worker" data-amount="1">\u589e\u52a0 1 \u4eba</button>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-title"><h3>\u7814\u7a76\u8282\u70b9</h3><span class="tag">\u53ef\u53c2\u609f ${availableCount}</span></div>
        <div class="log-list">
          ${nodes.map((node) => {
            const buttonLabel = node.unlocked ? '\u5df2\u53c2\u609f' : (node.canResearch ? '\u53c2\u609f' : (node.available ? '\u8d44\u6e90\u4e0d\u8db3' : '\u524d\u7f6e\u672a\u6ee1\u8db3'));
            const statusLabel = node.unlocked ? '\u5df2\u53c2\u609f' : (node.canResearch ? '\u53ef\u53c2\u609f' : (node.available ? '\u8d44\u6e90\u4e0d\u8db3' : '\u5f85\u89e3\u9501'));
            return `
              <div class="log-item" ${tooltipAttr([
                `\u8282\u70b9\uff1a${node.name}`,
                `\u7eaa\u5143\uff1a${node.era}`,
                `\u9053\u8574\u6d88\u8017\uff1a${formatNumber(node.daoCost)}`,
                `\u8d44\u6e90\u6d88\u8017\uff1a${formatCostSummary(node.resourceCosts)}`,
                node.blockedByNames?.length ? `\u524d\u7f6e\uff1a${node.blockedByNames.join(' \u00b7 ')}` : '\u524d\u7f6e\u5df2\u6ee1\u8db3',
                Object.keys(node.missingCosts ?? {}).length ? `\u7f3a\u5c11\u8d44\u6e90\uff1a${formatCostSummary(node.missingCosts)}` : '\u8d44\u6e90\u5df2\u6ee1\u8db3',
                `\u72b6\u6001\uff1a${statusLabel}`
              ])}>
                <div>
                  <strong>${node.name}</strong>
                  <div class="muted">${node.era} \u00b7 ${statusLabel}</div>
                </div>
                <button ${node.unlocked || !node.canResearch ? 'disabled' : ''} data-action="research-node" data-id="${node.id}">${buttonLabel}</button>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    </div>
  `;
}

