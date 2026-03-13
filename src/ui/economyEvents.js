function handleEconomyUiAction({ action, element, app }) {
  switch (action) {
    case 'recruit-workers':
      app.bus.emit('action:economy/recruitWorkers', { amount: Number(element.dataset.amount) });
      return true;
    case 'build-dormitory':
      app.bus.emit('action:economy/buildDormitory', {});
      return true;
    case 'upgrade-dormitory':
      app.bus.emit('action:economy/upgradeDormitory', { dormitoryId: element.dataset.id });
      return true;
    case 'upgrade-building':
      app.bus.emit('action:economy/upgradeBuilding', { buildingId: element.dataset.id });
      return true;
    case 'assign-worker':
      app.bus.emit('action:economy/assignWorkers', { workerKey: element.dataset.key, amount: Number(element.dataset.amount) });
      return true;
    case 'assign-scripture-worker':
      app.bus.emit('action:economy/assignWorkers', { workerKey: 'scriptureHall', amount: Number(element.dataset.amount) });
      return true;
    case 'refine-preparation':
      app.bus.emit('action:economy/refinePreparation', { preparationId: element.dataset.id });
      return true;
    case 'forge-weapon':
      app.bus.emit('action:economy/forgeWeapon', { blueprintId: element.dataset.blueprintId });
      return true;
    case 'strengthen-weapon':
      app.bus.emit('action:economy/strengthenWeapon', { weaponId: element.dataset.weaponId });
      return true;
    case 'reforge-weapon':
      app.bus.emit('action:economy/reforgeWeapon', { weaponId: element.dataset.weaponId });
      return true;
    case 'cycle-weapon-reforge-lock':
      app.bus.emit('action:economy/cycleWeaponReforgeLock', { weaponId: element.dataset.weaponId });
      return true;
    case 'cycle-weapon-reforge-focus':
      app.bus.emit('action:economy/cycleWeaponReforgeFocus', { weaponId: element.dataset.weaponId });
      return true;
    case 'dismantle-weapon':
      app.bus.emit('action:economy/dismantleWeapon', { weaponId: element.dataset.weaponId });
      return true;
    case 'brew-pill':
      app.bus.emit('action:economy/brewPill', { recipeId: element.dataset.recipeId });
      return true;
    case 'refresh-workshop-orders':
      app.bus.emit('action:economy/refreshWorkshopOrders', {});
      return true;
    case 'fulfill-workshop-order':
      app.bus.emit('action:economy/fulfillWorkshopOrder', { orderId: element.dataset.orderId });
      return true;
    default:
      return false;
  }
}

export { handleEconomyUiAction };
