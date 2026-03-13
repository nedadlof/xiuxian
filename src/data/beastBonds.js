const BEAST_BOND_DEFINITIONS = Object.freeze([
  {
    id: 'shadow-plunder-pact',
    name: '影掠同狩',
    description: '影狼为穷奇锁定猎物与财路，速推关卡时更容易把胜势转成战利。',
    requiredBeastIds: ['earthfiend-shadowwolf', 'qiongqi'],
    matches: ({ beastIds }) => beastIds.includes('earthfiend-shadowwolf') && beastIds.includes('qiongqi'),
    effects: [
      { type: 'battleAttack', value: 0.05 },
      { type: 'battleLoot', value: 0.12 },
    ],
  },
  {
    id: 'embers-of-ruin',
    name: '焚天乱界',
    description: '九婴开焚杀号令、混沌稳住后阵，适合打当前卡关阶段的攻守双修阵。',
    requiredBeastIds: ['jiuying', 'hundun'],
    matches: ({ beastIds }) => beastIds.includes('jiuying') && beastIds.includes('hundun'),
    effects: [
      { type: 'battleAttack', value: 0.1 },
      { type: 'battleDefense', value: 0.08 },
    ],
  },
  {
    id: 'gluttonous-vanguard',
    name: '吞岳夺藏',
    description: '饕餮稳住资源回流，穷奇补足掠夺节奏，更适合挂机刷养成资源。',
    requiredBeastIds: ['taotie', 'qiongqi'],
    matches: ({ beastIds }) => beastIds.includes('taotie') && beastIds.includes('qiongqi'),
    effects: [
      { type: 'battleLoot', value: 0.08 },
      { type: 'resourceMultiplier', resourceId: 'lingStone', value: 0.14 },
    ],
  },
  {
    id: 'abyss-fortress',
    name: '混岳藏锋',
    description: '需饕餮、混沌、穷奇同阵且总觉醒达到 4 阶，形成兼顾容错与收益的稳推兽阵。',
    requiredBeastIds: ['taotie', 'hundun', 'qiongqi'],
    matches: ({ beastIds, totalAwakening }) => (
      beastIds.includes('taotie')
      && beastIds.includes('hundun')
      && beastIds.includes('qiongqi')
      && totalAwakening >= 4
    ),
    effects: [
      { type: 'battleDefense', value: 0.12 },
      { type: 'battleSustain', value: 0.1 },
      { type: 'battleLoot', value: 0.06 },
    ],
  },
  {
    id: 'cataclysm-hunt-court',
    name: '灾庭猎阵',
    description: '需影狼、九婴、穷奇同阵且总兽契达到 6 阶，成型后是偏激进的推图与收割兽阵。',
    requiredBeastIds: ['earthfiend-shadowwolf', 'jiuying', 'qiongqi'],
    matches: ({ beastIds, totalBond }) => (
      beastIds.includes('earthfiend-shadowwolf')
      && beastIds.includes('jiuying')
      && beastIds.includes('qiongqi')
      && totalBond >= 6
    ),
    effects: [
      { type: 'battleAttack', value: 0.12 },
      { type: 'unitPowerMultiplier', value: 0.08 },
      { type: 'battleLoot', value: 0.1 },
    ],
  },
]);

function normalizeBeastRoster(beastRoster = []) {
  const seen = new Set();
  const roster = [];

  for (const beast of beastRoster) {
    if (!beast?.id || seen.has(beast.id)) {
      continue;
    }

    seen.add(beast.id);
    roster.push({
      id: beast.id,
      name: beast.name ?? beast.id,
      archetype: beast.archetype ?? '异兽',
      favoredTags: Array.isArray(beast.favoredTags) ? [...beast.favoredTags] : [],
      awakeningLevel: Math.max(0, Number(beast.awakeningLevel) || 0),
      bondLevel: Math.max(0, Number(beast.bondLevel) || 0),
      fitScore: Math.max(0, Number(beast.fitScore) || 0),
    });
  }

  return roster;
}

function buildBondContext(beastRoster = []) {
  const beasts = normalizeBeastRoster(beastRoster);
  const beastIds = beasts.map((beast) => beast.id);
  const uniqueArchetypes = [...new Set(beasts.map((beast) => beast.archetype).filter(Boolean))];
  const tagCoverage = beasts.reduce((result, beast) => {
    for (const tag of beast.favoredTags ?? []) {
      result[tag] = (result[tag] ?? 0) + 1;
    }
    return result;
  }, {});

  return {
    beasts,
    beastIds,
    beastCount: beasts.length,
    uniqueArchetypes,
    uniqueArchetypeCount: uniqueArchetypes.length,
    totalAwakening: beasts.reduce((sum, beast) => sum + (beast.awakeningLevel ?? 0), 0),
    totalBond: beasts.reduce((sum, beast) => sum + (beast.bondLevel ?? 0), 0),
    totalFitScore: beasts.reduce((sum, beast) => sum + (beast.fitScore ?? 0), 0),
    tagCoverage,
  };
}

export function listBeastBondDefinitions() {
  return BEAST_BOND_DEFINITIONS.map((bond) => ({
    ...bond,
    requiredBeastIds: [...(bond.requiredBeastIds ?? [])],
    effects: bond.effects.map((effect) => ({ ...effect })),
  }));
}

export function getBeastBondSnapshot(beastRoster = []) {
  const context = buildBondContext(beastRoster);
  const activeBonds = BEAST_BOND_DEFINITIONS
    .filter((bond) => bond.matches(context))
    .map((bond) => ({
      id: bond.id,
      name: bond.name,
      description: bond.description,
      requiredBeastIds: [...(bond.requiredBeastIds ?? [])],
      effects: bond.effects.map((effect) => ({ ...effect })),
    }));

  return {
    beasts: context.beasts,
    beastIds: context.beastIds,
    beastCount: context.beastCount,
    uniqueArchetypes: context.uniqueArchetypes,
    uniqueArchetypeCount: context.uniqueArchetypeCount,
    totalAwakening: context.totalAwakening,
    totalBond: context.totalBond,
    totalFitScore: context.totalFitScore,
    tagCoverage: { ...context.tagCoverage },
    activeBonds,
  };
}

export function getBeastBondEffects(beastRoster = []) {
  const snapshot = getBeastBondSnapshot(beastRoster);
  return snapshot.activeBonds.flatMap((bond) => bond.effects.map((effect) => ({
    ...effect,
    source: 'beast-bond',
    sourceType: 'beast-bond',
    bondId: bond.id,
    bondName: bond.name,
  })));
}
