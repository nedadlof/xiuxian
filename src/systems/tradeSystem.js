import { appendLog } from './shared/logs.js';

function getTradeRoutes(registries) {
  return registries.systems.get('tradeRoutes') ?? [];
}

function isRouteUnlocked(state, route) {
  return !route.unlockNodeId || state.scripture.unlockedNodes.includes(route.unlockNodeId);
}

function getExchangeOutput(route, multiplier = 1) {
  return Math.floor(route.lotSize * multiplier * route.rate);
}

export function createTradeSystem() {
  return {
    id: 'trade-system',
    setup({ store, bus, registries }) {
      store.update((draft) => {
        draft.trade.unlocked = !!draft.scripture.flags?.tradeUnlocked;
      }, { type: 'trade/setup' });

      bus.on('action:trade/exchange', ({ routeId, multiplier }) => {
        exchangeResource({ store, registries }, routeId, multiplier);
      });
    },
    tick({ store }) {
      store.update((draft) => {
        draft.trade.unlocked = !!draft.scripture.flags?.tradeUnlocked;
      }, { type: 'trade/tick' });
    },
  };
}

export function exchangeResource({ store, registries }, routeId, multiplier = 1) {
  let success = false;

  store.update((draft) => {
    const route = getTradeRoutes(registries).find((item) => item.id === routeId);
    const safeMultiplier = Math.max(1, Math.floor(multiplier));
    if (!route || !draft.scripture.flags?.tradeUnlocked || !isRouteUnlocked(draft, route)) {
      return;
    }

    const sourceCost = route.lotSize * safeMultiplier;
    const output = getExchangeOutput(route, safeMultiplier);
    if ((draft.resources[route.sourceId] ?? 0) < sourceCost || output <= 0) {
      return;
    }

    draft.resources[route.sourceId] -= sourceCost;
    draft.resources[route.targetId] = (draft.resources[route.targetId] ?? 0) + output;
    draft.trade.unlocked = true;
    draft.trade.totalExchanged += output;
    draft.trade.lastRouteId = routeId;
    appendLog(draft, 'trade', `${route.name}：${sourceCost} ${route.sourceId} → ${output} ${route.targetId}`);
    success = true;
  }, { type: 'trade/exchange', routeId, multiplier });

  return success;
}

export function getTradeSnapshot(state, registries) {
  const routes = getTradeRoutes(registries).map((route) => {
    const unlocked = isRouteUnlocked(state, route) && !!state.scripture.flags?.tradeUnlocked;
    const output = getExchangeOutput(route, 1);
    return {
      ...route,
      unlocked,
      output,
      affordable: (state.resources[route.sourceId] ?? 0) >= route.lotSize,
    };
  });

  return {
    unlocked: !!state.scripture.flags?.tradeUnlocked,
    routes,
    totalExchanged: state.trade.totalExchanged ?? 0,
    lastRouteId: state.trade.lastRouteId ?? null,
  };
}
