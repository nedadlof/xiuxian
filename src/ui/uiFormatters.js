const RESOURCE_LABELS = {
  lingStone: '灵石',
  wood: '灵木',
  herb: '灵草',
  iron: '玄铁',
  pills: '丹药',
  talisman: '符箓',
  spiritCrystal: '灵晶',
  dao: '道蕴',
  beastShard: '兽魂碎片',
  discipleShard: '命魂残片',
  seekImmortalToken: '寻仙令',
  tianmingSeal: '天命印',
};

const RESOURCE_DISPLAY_ORDER = Object.freeze([
  'lingStone',
  'wood',
  'herb',
  'iron',
  'pills',
  'talisman',
  'spiritCrystal',
  'dao',
  'beastShard',
  'discipleShard',
  'seekImmortalToken',
  'tianmingSeal',
]);

const ENCOUNTER_TYPE_LABELS = {
  normal: '普通',
  elite: '精英',
  boss: '首领',
};

const TAG_LABELS = {
  melee: '近战',
  ranged: '远程',
  burst: '爆发',
  defense: '防御',
  support: '辅助',
  magic: '术法',
  control: '控制',
  fire: '火系',
  undead: '亡灵',
  wood: '木系',
  pierce: '穿透',
  flying: '飞行',
  dot: '持续伤害',
  command: '统御',
  sustain: '续航',
  summon: '召唤',
};

const RARITY_META = {
  common: { label: '普通', rank: 1, className: 'tag-rarity-common' },
  rare: { label: '稀有', rank: 2, className: 'tag-rarity-rare' },
  epic: { label: '史诗', rank: 3, className: 'tag-rarity-epic' },
  legendary: { label: '传说', rank: 4, className: 'tag-rarity-legendary' },
};

function formatNumber(value) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return `${Math.floor(value ?? 0)}`;
}

function formatTime(timestamp) {
  const seconds = Math.max(Math.floor((timestamp - Date.now()) / 1000), 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}小时 ${minutes}分钟` : `${minutes}分钟`;
}

function getResourceLabel(resourceId) {
  return RESOURCE_LABELS[resourceId] ?? resourceId ?? '未知';
}

function formatResourceAmount(resourceId, amount, joiner = '') {
  return `${getResourceLabel(resourceId)}${joiner}${formatNumber(amount)}`;
}

function formatCostSummary(costMap = {}) {
  const entries = Object.entries(costMap ?? {}).filter(([, value]) => (value ?? 0) > 0);
  if (!entries.length) return '无';
  return entries.map(([resourceId, value]) => `${getResourceLabel(resourceId)} ${formatNumber(value)}`).join(' · ');
}

function formatResourceRate(resourceId, amountPerUnit, unit = 'second') {
  const unitLabel = unit === 'hour' ? '小时' : '秒';
  const sign = amountPerUnit >= 0 ? '+' : '';
  return `${getResourceLabel(resourceId)} ${sign}${formatNumber(amountPerUnit)}/${unitLabel}`;
}

function getEncounterTypeLabel(type) {
  return ENCOUNTER_TYPE_LABELS[type] ?? type ?? '未知';
}

function getTagLabel(tag) {
  return TAG_LABELS[tag] ?? tag ?? '未知';
}

function getRarityMeta(rarity) {
  return RARITY_META[rarity] ?? RARITY_META.common;
}

function getRarityLabel(rarity) {
  return getRarityMeta(rarity).label;
}

function getRarityRank(rarity) {
  return getRarityMeta(rarity).rank;
}

function getRarityTagClass(rarity) {
  return getRarityMeta(rarity).className;
}

export {
  RESOURCE_DISPLAY_ORDER,
  formatNumber,
  formatTime,
  getResourceLabel,
  formatResourceAmount,
  formatCostSummary,
  formatResourceRate,
  getEncounterTypeLabel,
  getTagLabel,
  getRarityLabel,
  getRarityRank,
  getRarityTagClass,
};
