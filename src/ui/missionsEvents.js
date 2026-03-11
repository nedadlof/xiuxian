function handleMissionsUiAction({ action, element, app }) {
  switch (action) {
    case 'start-commission':
      app.bus.emit('action:commissions/start', { commissionId: element.dataset.id });
      return true;
    case 'claim-commission':
      app.bus.emit('action:commissions/claim', { commissionId: element.dataset.id });
      return true;
    default:
      return false;
  }
}

export { handleMissionsUiAction };
