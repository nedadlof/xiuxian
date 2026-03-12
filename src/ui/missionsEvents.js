function handleMissionsUiAction({ action, element, app }) {
  switch (action) {
    case 'start-commission':
      app.bus.emit('action:commissions/start', { commissionId: element.dataset.id });
      return true;
    case 'claim-commission':
      app.bus.emit('action:commissions/claim', { commissionId: element.dataset.id });
      return true;
    case 'cancel-commission':
      app.bus.emit('action:commissions/cancel');
      return true;
    case 'reroll-commission-board':
      app.bus.emit('action:commissions/reroll');
      return true;
    case 'resolve-commission-event':
      app.bus.emit('action:commissions/resolve-event', { optionId: element.dataset.optionId });
      return true;
    case 'claim-commission-milestone':
      app.bus.emit('action:commissions/claim-milestone', { milestoneId: element.dataset.id });
      return true;
    case 'purchase-commission-supply':
      app.bus.emit('action:commissions/procure', { supplyId: element.dataset.id });
      return true;
    case 'purchase-commission-shop-item':
      app.bus.emit('action:commissions/purchase-shop-item', { itemId: element.dataset.id });
      return true;
    case 'toggle-commission-auto-dispatch':
      app.bus.emit('action:commissions/toggle-auto-dispatch');
      return true;
    case 'cycle-commission-auto-priority':
      app.bus.emit('action:commissions/cycle-auto-priority');
      return true;
    case 'toggle-commission-auto-resolve-events':
      app.bus.emit('action:commissions/toggle-auto-resolve-events');
      return true;
    default:
      return false;
  }
}

export { handleMissionsUiAction };
