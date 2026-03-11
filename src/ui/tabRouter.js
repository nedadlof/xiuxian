import { DEFAULT_TAB, TAB_KEYS } from './tabConfig.js';

function getTabContent({ activeTab, state, registries, uiState, panels }) {
  const renderers = panels ?? {};
  const resolvedTab = TAB_KEYS.includes(activeTab) ? activeTab : DEFAULT_TAB;
  return renderers[resolvedTab]?.(state, registries, uiState) ?? '';
}

export { getTabContent };
