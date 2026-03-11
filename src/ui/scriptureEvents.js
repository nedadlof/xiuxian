function handleScriptureUiAction({ action, element, app }) {
  switch (action) {
    case 'research-node':
      app.bus.emit('action:scripture/research', { nodeId: element.dataset.id });
      return true;
    default:
      return false;
  }
}

export { handleScriptureUiAction };

