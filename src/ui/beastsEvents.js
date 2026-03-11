function handleBeastsUiAction({ action, element, app }) {
  switch (action) {
    case 'toggle-beast':
      app.bus.emit('action:beasts/toggleActive', { beastId: element.dataset.id });
      return true;
    default:
      return false;
  }
}

export { handleBeastsUiAction };

