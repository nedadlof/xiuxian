function handleTradeUiAction({ action, element, app }) {
  switch (action) {
    case 'trade-route':
      app.bus.emit('action:trade/exchange', { routeId: element.dataset.id, multiplier: Number(element.dataset.multiplier) });
      return true;
    default:
      return false;
  }
}

export { handleTradeUiAction };

