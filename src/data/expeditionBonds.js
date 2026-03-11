const EXPEDITION_BOND_DEFINITIONS = Object.freeze([
  {
    id: 'shared-faction',
    name: '同门同心',
    description: '至少 2 名同阵营弟子同时出征，守势更稳，续航更长。',
    matches: ({ memberCount, factionCounts }) => memberCount >= 2 && Object.values(factionCounts).some((count) => count >= 2),
    effects: [
      { type: 'battleDefense', value: 0.1 },
      { type: 'battleSustain', value: 0.06 },
    ],
  },
  {
    id: 'triad-journey',
    name: '三脉同游',
    description: '3 名不同阵营弟子同时出征，军势更加开阔，整体战力抬升。',
    matches: ({ memberCount, uniqueFactionCount }) => memberCount >= 3 && uniqueFactionCount >= 3,
    effects: [
      { type: 'battleAttack', value: 0.08 },
      { type: 'unitPowerMultiplier', value: 0.05 },
    ],
  },
  {
    id: 'dual-legend',
    name: '天命双星',
    description: '至少 2 名传说弟子同行，爆发与压制力显著提升。',
    matches: ({ legendaryCount }) => legendaryCount >= 2,
    effects: [
      { type: 'battleAttack', value: 0.12 },
      { type: 'battleSustain', value: 0.08 },
    ],
  },
  {
    id: 'resonance-surge',
    name: '命魂激荡',
    description: '队伍总共鸣达到 4 级，命魂互相牵引，攻守同步增强。',
    matches: ({ totalResonance }) => totalResonance >= 4,
    effects: [
      { type: 'battleAttack', value: 0.06 },
      { type: 'battleDefense', value: 0.06 },
    ],
  },
  {
    id: 'elder-banner',
    name: '长老压阵',
    description: '有长老随队压阵，军心更定，战线更稳。',
    matches: ({ elderCount }) => elderCount >= 1,
    effects: [
      { type: 'battleDefense', value: 0.08 },
      { type: 'battleSustain', value: 0.05 },
    ],
  },
]);

function normalizeTeamMembers(teamMembers = []) {
  const seen = new Set();
  const normalized = [];

  for (const member of teamMembers) {
    if (!member?.id || seen.has(member.id)) {
      continue;
    }
    seen.add(member.id);
    normalized.push({
      id: member.id,
      name: member.name ?? member.id,
      faction: member.faction ?? null,
      rarity: member.rarity ?? 'common',
      resonanceLevel: Math.max(0, Number(member.resonanceLevel) || 0),
      elder: Boolean(member.elder),
    });
  }

  return normalized;
}

function buildBondContext(teamMembers = []) {
  const members = normalizeTeamMembers(teamMembers);
  const factionCounts = members.reduce((result, member) => {
    if (member.faction) {
      result[member.faction] = (result[member.faction] ?? 0) + 1;
    }
    return result;
  }, {});

  return {
    members,
    memberCount: members.length,
    uniqueFactionCount: Object.keys(factionCounts).length,
    factionCounts,
    legendaryCount: members.filter((member) => member.rarity === 'legendary').length,
    elderCount: members.filter((member) => member.elder).length,
    totalResonance: members.reduce((sum, member) => sum + (member.resonanceLevel ?? 0), 0),
  };
}

export function listExpeditionBondDefinitions() {
  return EXPEDITION_BOND_DEFINITIONS.map((bond) => ({
    ...bond,
    effects: bond.effects.map((effect) => ({ ...effect })),
  }));
}

export function getExpeditionBondSnapshot(teamMembers = []) {
  const context = buildBondContext(teamMembers);
  const activeBonds = EXPEDITION_BOND_DEFINITIONS
    .filter((bond) => bond.matches(context))
    .map((bond) => ({
      id: bond.id,
      name: bond.name,
      description: bond.description,
      effects: bond.effects.map((effect) => ({ ...effect })),
    }));

  return {
    ...context,
    activeBonds,
  };
}

export function getExpeditionBondEffects(teamMembers = []) {
  const snapshot = getExpeditionBondSnapshot(teamMembers);
  return snapshot.activeBonds.flatMap((bond) => bond.effects.map((effect) => ({
    ...effect,
    source: 'expedition-bond',
    bondId: bond.id,
    bondName: bond.name,
  })));
}
