import { getBeastSnapshot } from '../../systems/disciplesBeastsSystem.js';

export function beastsPanel(state, registries, deps = {}) {
  const { tooltipAttr } = deps;
  const beasts = getBeastSnapshot(state, registries);

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>\u4e07\u8c61\u68ee\u7f57\u5f55</h3><span class="tag">\u6fc0\u6d3b ${state.beasts.activeIds.length}/3</span></div>
        <div class="log-list">
          ${beasts.map((beast) => `
            <div class="log-item" ${tooltipAttr([beast.description ?? '\u6682\u65e0\u63cf\u8ff0', beast.unlocked ? '\u5df2\u89e3\u9501' : '\u672a\u89e3\u9501'])}>
              <div>
                <strong>${beast.name}</strong>
                <div class="muted">${beast.unlocked ? (beast.active ? '\u5df2\u6fc0\u6d3b' : '\u5df2\u89e3\u9501') : '\u672a\u89e3\u9501'}</div>
              </div>
              <button ${beast.unlocked ? '' : 'disabled'} data-action="toggle-beast" data-id="${beast.id}">${beast.active ? '\u64a4\u4e0b' : '\u6fc0\u6d3b'}</button>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}

