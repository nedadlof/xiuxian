function handleWarehouseUiAction({ action, element, app }) {
  switch (action) {
    case 'warehouse-seal':
      app.bus.emit('action:warehouse/seal', { sealId: element.dataset.id });
      return true;
    case 'set-warehouse-strategy':
      app.bus.emit('action:warehouse/set-strategy', { strategyId: element.dataset.id });
      return true;
    case 'toggle-warehouse-auto-seal':
      app.bus.emit('action:warehouse/toggle-auto-seal', {});
      return true;
    default:
      return false;
  }
}

export { handleWarehouseUiAction };
