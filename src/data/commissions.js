const COMMISSION_DEFINITIONS = Object.freeze([
  {
    id: 'herb-ridge-patrol',
    name: '药岭巡采',
    description: '带队巡查药岭，收拢散落灵植与炼丹辅材。',
    durationSeconds: 120,
    recommendedScore: 240,
    reward: { herb: 180, wood: 90, pills: 16, dao: 800 },
    bonusReward: { spiritCrystal: 10 },
    tags: ['resource', 'alchemy'],
  },
  {
    id: 'merchant-escort',
    name: '商路护送',
    description: '护送云阙商队往返坊市，回收灵石与晶货。',
    durationSeconds: 180,
    recommendedScore: 340,
    reward: { lingStone: 420, spiritCrystal: 24, dao: 1200 },
    bonusReward: { seekImmortalToken: 1 },
    tags: ['trade', 'escort'],
  },
  {
    id: 'ruins-survey',
    name: '遗迹勘验',
    description: '潜入旧宗遗迹勘验阵纹残痕，有机会带回珍贵战利。',
    durationSeconds: 240,
    recommendedScore: 460,
    reward: { talisman: 42, iron: 130, discipleShard: 58, dao: 1600 },
    bonusReward: { tianmingSeal: 1, spiritCrystal: 18 },
    tags: ['explore', 'relic'],
  },
]);

const RARITY_SCORE = Object.freeze({
  common: 70,
  rare: 100,
  epic: 145,
  legendary: 200,
});

const OUTCOME_TIERS = Object.freeze([
  { id: 'perfect', minRatio: 1.15, label: '圆满完成', rewardMultiplier: 1.35, bonusMultiplier: 1 },
  { id: 'success', minRatio: 1, label: '顺利完成', rewardMultiplier: 1, bonusMultiplier: 0.75 },
  { id: 'partial', minRatio: 0.7, label: '勉强完成', rewardMultiplier: 0.72, bonusMultiplier: 0.35 },
  { id: 'failed', minRatio: 0, label: '铩羽而归', rewardMultiplier: 0.38, bonusMultiplier: 0 },
]);

function cloneRewardMap(reward = {}) {
  return Object.fromEntries(Object.entries(reward ?? {}).map(([resourceId, amount]) => [resourceId, amount]));
}

function scaleRewardMap(reward = {}, multiplier = 1) {
  return Object.fromEntries(
    Object.entries(reward ?? {})
      .map(([resourceId, amount]) => [resourceId, Math.max(0, Math.round((amount ?? 0) * multiplier))])
      .filter(([, amount]) => amount > 0),
  );
}

function mergeRewardMaps(baseReward = {}, bonusReward = {}) {
  const merged = { ...baseReward };

  for (const [resourceId, amount] of Object.entries(bonusReward ?? {})) {
    merged[resourceId] = (merged[resourceId] ?? 0) + amount;
  }

  return merged;
}

function getTeamMemberBaseScore(member = {}) {
  return (RARITY_SCORE[member.rarity] ?? RARITY_SCORE.common)
    + ((Number(member.level) || 1) * 24)
    + ((Number(member.resonanceLevel) || 0) * 55)
    + (member.elder ? 90 : 0);
}

function getOutcomeTier(scoreRatio = 0) {
  return OUTCOME_TIERS.find((tier) => scoreRatio >= tier.minRatio) ?? OUTCOME_TIERS[OUTCOME_TIERS.length - 1];
}

export function listCommissionDefinitions() {
  return COMMISSION_DEFINITIONS.map((definition) => ({
    ...definition,
    reward: cloneRewardMap(definition.reward),
    bonusReward: cloneRewardMap(definition.bonusReward),
    tags: [...(definition.tags ?? [])],
  }));
}

export function getCommissionDefinition(commissionId) {
  const definition = COMMISSION_DEFINITIONS.find((item) => item.id === commissionId);
  return definition
    ? {
      ...definition,
      reward: cloneRewardMap(definition.reward),
      bonusReward: cloneRewardMap(definition.bonusReward),
      tags: [...(definition.tags ?? [])],
    }
    : null;
}

export function evaluateCommissionTeam(teamSnapshot = {}, definition = {}) {
  const members = [...(teamSnapshot.members ?? [])];
  const memberScore = members.reduce((sum, member) => sum + getTeamMemberBaseScore(member), 0);
  const bondScore = (teamSnapshot.bonds?.activeBonds?.length ?? 0) * 70
    + (teamSnapshot.bonds?.uniqueFactionCount ?? 0) * 28
    + (teamSnapshot.bonds?.totalResonance ?? 0) * 18;
  const totalScore = Math.round(memberScore + bondScore);
  const recommendedScore = Math.max(definition.recommendedScore ?? 1, 1);
  const scoreRatio = totalScore / recommendedScore;
  const tier = getOutcomeTier(scoreRatio);
  const reward = scaleRewardMap(definition.reward, tier.rewardMultiplier);
  const bonusReward = scaleRewardMap(definition.bonusReward, tier.bonusMultiplier);

  return {
    totalScore,
    scoreRatio,
    memberScore,
    bondScore,
    tier,
    reward,
    bonusReward,
    totalReward: mergeRewardMaps(reward, bonusReward),
  };
}
