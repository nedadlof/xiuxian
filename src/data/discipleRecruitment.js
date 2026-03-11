const RECRUIT_MODE_COSTS = Object.freeze({
  standard: { dao: 1200, lingStone: 180, herb: 60 },
  advanced: { seekImmortalToken: 1 },
  faction: { seekImmortalToken: 1 },
  targeted: { tianmingSeal: 1 },
});

const TOKEN_PURCHASES = Object.freeze({
  seekImmortalToken: {
    resourceId: 'seekImmortalToken',
    name: '寻仙令',
    description: '用于高级招募与阵营定向池，适合集中冲击高品弟子与当期 UP 池。',
    purchaseCost: { dao: 6000, spiritCrystal: 6, lingStone: 260 },
  },
  tianmingSeal: {
    resourceId: 'tianmingSeal',
    name: '天命印',
    description: '用于天命直收，可锁定单名候选弟子直接收入门墙。',
    purchaseCost: { dao: 12000, spiritCrystal: 12, lingStone: 520 },
  },
});

const MODE_LABELS = Object.freeze({
  standard: '普通招募',
  advanced: '高级招募',
  faction: '阵营定向池',
  targeted: '天命直收',
});

const RARITY_WEIGHTS = Object.freeze({
  standard: {
    common: 10,
    rare: 7,
    epic: 3,
    legendary: 1,
  },
  advanced: {
    common: 0,
    rare: 8,
    epic: 6,
    legendary: 3,
  },
  faction: {
    common: 0,
    rare: 8,
    epic: 6,
    legendary: 3,
  },
});

const DUPLICATE_SHARD_REWARDS = Object.freeze({
  common: 12,
  rare: 32,
  epic: 88,
  legendary: 188,
});

const RECRUIT_PITY = Object.freeze({
  advancedEpic: 5,
  advancedLegendary: 10,
});

const FACTION_META = Object.freeze({
  'danxin-valley': {
    id: 'danxin-valley',
    label: '丹心谷',
    description: '重炼丹、养息与长线成长。',
  },
  'qingmu-grove': {
    id: 'qingmu-grove',
    label: '青木林泽',
    description: '偏灵植、山门经营与木系守成。',
  },
  'xuanbing-furnace': {
    id: 'xuanbing-furnace',
    label: '玄兵炉宗',
    description: '体修、铸兵与前线承伤一体。',
  },
  'yunque-merchant': {
    id: 'yunque-merchant',
    label: '云阙商盟',
    description: '资源调度、矿脉经营与战利增益见长。',
  },
  'jianxu-palace': {
    id: 'jianxu-palace',
    label: '剑墟宫',
    description: '主打剑修爆发、机动与后期压制。',
  },
  'youming-lantern': {
    id: 'youming-lantern',
    label: '幽冥灯府',
    description: '偏禁术、诡修与残局续航。',
  },
});

const ROTATING_BANNERS = Object.freeze([
  {
    id: 'banner-dan-jian',
    name: '丹剑同辉',
    description: '韩立与叶苍穹权重提升，适合追求长线核心与高爆发主将。',
    upDiscipleIds: ['han-li', 'ye-cangqiong'],
    upMultiplier: 3.2,
  },
  {
    id: 'banner-qingmu',
    name: '青木归藏',
    description: '苏轻禾与林疏权重提升，偏资源经营与防守建设。',
    upDiscipleIds: ['su-qinghe', 'lin-shu'],
    upMultiplier: 3.2,
  },
  {
    id: 'banner-yunyou',
    name: '云幽异录',
    description: '云凰卫宁与沐轻烟权重提升，兼顾经济与诡道续航。',
    upDiscipleIds: ['yunhuang-weining', 'mu-qingyan'],
    upMultiplier: 3.2,
  },
]);

function multiplyCost(costMap, count = 1) {
  return Object.fromEntries(
    Object.entries(costMap ?? {}).map(([resourceId, amount]) => [resourceId, amount * count]),
  );
}

function getRarityWeight(mode, rarity) {
  return RARITY_WEIGHTS[mode]?.[rarity] ?? 1;
}

function getRotationIndex(now = Date.now()) {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return Math.floor(now / weekMs);
}

export function getRecruitModeCost(mode, count = 1) {
  return multiplyCost(RECRUIT_MODE_COSTS[mode] ?? {}, count);
}

export function getRecruitModeLabel(mode) {
  return MODE_LABELS[mode] ?? mode ?? '招募';
}

export function getRecruitTokenDefinition(resourceId) {
  const token = TOKEN_PURCHASES[resourceId];
  return token ? { ...token, purchaseCost: { ...token.purchaseCost } } : null;
}

export function listRecruitTokenDefinitions() {
  return Object.values(TOKEN_PURCHASES).map((token) => ({
    ...token,
    purchaseCost: { ...token.purchaseCost },
  }));
}

export function getDuplicateShardReward(rarity) {
  return DUPLICATE_SHARD_REWARDS[rarity] ?? DUPLICATE_SHARD_REWARDS.common;
}

export function getRecruitPityThresholds() {
  return { ...RECRUIT_PITY };
}

export function getFactionMeta(factionId) {
  return FACTION_META[factionId] ? { ...FACTION_META[factionId] } : null;
}

export function listFactionMeta() {
  return Object.values(FACTION_META).map((entry) => ({ ...entry }));
}

export function listRotatingBanners() {
  return ROTATING_BANNERS.map((banner) => ({
    ...banner,
    upDiscipleIds: [...banner.upDiscipleIds],
  }));
}

export function getActiveRecruitBanner(now = Date.now()) {
  const banners = listRotatingBanners();
  if (!banners.length) {
    return null;
  }
  return banners[getRotationIndex(now) % banners.length] ?? banners[0];
}

export function getDiscipleRecruitWeight(disciple, {
  mode = 'standard',
  banner = null,
} = {}) {
  let weight = getRarityWeight(mode, disciple?.rarity ?? 'common');
  if (banner?.upDiscipleIds?.includes(disciple?.id)) {
    weight *= banner.upMultiplier ?? 2;
  }
  return weight;
}

export function filterCandidatesByGuarantee(candidates, guaranteeTier = null) {
  const source = Array.isArray(candidates) ? candidates : [];
  if (guaranteeTier === 'legendary') {
    const hits = source.filter((disciple) => disciple.rarity === 'legendary');
    return hits.length ? hits : source;
  }
  if (guaranteeTier === 'epic+') {
    const hits = source.filter((disciple) => disciple.rarity === 'legendary' || disciple.rarity === 'epic');
    return hits.length ? hits : source;
  }
  return source;
}

export function pickDiscipleFromPool(candidates, {
  mode = 'standard',
  banner = null,
  guaranteeTier = null,
  random = Math.random,
} = {}) {
  const weighted = filterCandidatesByGuarantee(candidates, guaranteeTier)
    .map((disciple) => ({
      disciple,
      weight: getDiscipleRecruitWeight(disciple, { mode, banner }),
    }))
    .filter((entry) => entry.weight > 0);

  if (!weighted.length) {
    return null;
  }

  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * totalWeight;

  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.disciple;
    }
  }

  return weighted[weighted.length - 1]?.disciple ?? null;
}
