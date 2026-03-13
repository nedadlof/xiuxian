function handleBeastsUiAction({ action, element, app }) {
  switch (action) {
    case 'toggle-beast':
      app.bus.emit('action:beasts/toggleActive', { beastId: element.dataset.id });
      return true;
    case 'awaken-beast':
      app.bus.emit('action:beasts/awaken', { beastId: element.dataset.id });
      return true;
    case 'temper-beast':
      app.bus.emit('action:beasts/temper', { beastId: element.dataset.id });
      return true;
    case 'apply-recommended-beasts':
      app.bus.emit('action:beasts/applyRecommendedLineup');
      return true;
    default:
      return false;
  }
}

export { handleBeastsUiAction };
