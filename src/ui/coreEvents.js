function handleCoreUiAction({ action, element, app }) {
  switch (action) {
    case 'switch-tab':
      app.store.update((draft) => { draft.meta.activeTab = element.dataset.tab; }, { type: 'ui/switch-tab' });
      return true;
    case 'save-game':
      app.saveManager.save();
      return true;
    case 'reset-game':
      if (window.confirm('\u786e\u5b9a\u6e05\u7a7a\u5f53\u524d\u5b58\u6863\u5417\uff1f')) {
        app.saveManager.clear();
        window.location.reload();
      }
      return true;
    default:
      return false;
  }
}

export { handleCoreUiAction };

