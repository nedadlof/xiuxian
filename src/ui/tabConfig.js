const APP_TABS = Object.freeze([
  ['overview', '概览'],
  ['economy', '产业'],
  ['scripture', '藏经阁'],
  ['barracks', '兵营'],
  ['war', '战争'],
  ['disciples', '弟子'],
  ['missions', '委托'],
  ['beasts', '灵兽'],
  ['logs', '日志'],
]);

const DEFAULT_TAB = 'overview';
const TAB_KEYS = Object.freeze(APP_TABS.map(([key]) => key));

export { APP_TABS, DEFAULT_TAB, TAB_KEYS };
