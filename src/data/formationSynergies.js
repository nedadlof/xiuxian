const FORMATION_SYNERGIES = [
  {
    id: 'iron-wall',
    name: '\u94c1\u58c1\u9635',
    description: '\u5927\u91cf\u9632\u5fa1\u5355\u4f4d\u6784\u6210\u7684\u9635\u578b\uff0c\u66f4\u80fd\u62b5\u5fa1\u6b63\u9762\u51b2\u51fb\u3002',
    requirements: [
      { type: 'tagTypeCount', tag: 'defense', min: 2 },
    ],
    modifiers: { attack: 0, defense: 0.08, sustain: 0.03 },
  },
  {
    id: 'arrow-storm',
    name: '\u7bad\u96e8\u9635',
    description: '\u8fdc\u7a0b\u5355\u4f4d\u8d8a\u591a\uff0c\u9f50\u5c04\u7684\u706b\u529b\u4e8c\u6b21\u589e\u5e45\u3002',
    requirements: [
      { type: 'totalTagCount', tag: 'ranged', min: 10 },
    ],
    modifiers: { attack: 0.07, defense: 0, sustain: 0 },
  },
  {
    id: 'spirit-menders',
    name: '\u7075\u6108\u9635',
    description: '\u8f85\u52a9\u4e0e\u7eed\u822a\u5355\u4f4d\u7684\u5360\u6bd4\u8fbe\u6807\u540e\uff0c\u961f\u4f0d\u7eed\u822a\u5927\u5e45\u63d0\u5347\u3002',
    requirements: [
      { type: 'anyOfTags', tags: ['support', 'sustain'] },
      { type: 'totalTagsCombined', tags: ['support', 'sustain'], min: 8 },
    ],
    modifiers: { attack: 0, defense: 0.03, sustain: 0.08 },
  },
  {
    id: 'mixed-arms',
    name: '\u6df7\u7f16\u9635',
    description: '\u5175\u79cd\u4e30\u5bcc\u65f6\uff0c\u8fdb\u653b\u3001\u9632\u5b88\u4e0e\u7eed\u822a\u4f1a\u540c\u65f6\u589e\u76ca\u3002',
    requirements: [
      { type: 'distinctTags', min: 5 },
    ],
    modifiers: { attack: 0.03, defense: 0.03, sustain: 0.03 },
  },
  {
    id: 'control-net',
    name: '\u63a7\u573a\u9635',
    description: '\u63a7\u5236\u4e0e\u8fdc\u7a0b\u7ed3\u5408\uff0c\u8ba9\u654c\u65b9\u96be\u4ee5\u63a5\u8fd1\u5e76\u4e27\u5931\u8282\u594f\u3002',
    requirements: [
      { type: 'allOfTags', tags: ['control', 'ranged'] },
    ],
    modifiers: { attack: 0.04, defense: 0.02, sustain: 0 },
  },
];

function buildSynergyContext(unitRoster = []) {
  const active = unitRoster.filter((unit) => (unit.count ?? 0) > 0);
  const tagTotals = {};
  const tagTypes = {};
  const distinctTags = new Set();

  for (const unit of active) {
    const count = unit.count ?? 0;
    for (const tag of unit.tags ?? []) {
      distinctTags.add(tag);
      tagTotals[tag] = (tagTotals[tag] ?? 0) + count;
      tagTypes[tag] ??= new Set();
      tagTypes[tag].add(unit.id);
    }
  }

  return {
    activeUnits: active,
    tagTotals,
    tagTypeCounts: Object.fromEntries(Object.entries(tagTypes).map(([tag, set]) => [tag, set.size])),
    distinctTagCount: distinctTags.size,
  };
}

function isSynergyRequirementMet(requirement, context) {
  const type = requirement?.type ?? '';

  if (type === 'hasTag') {
    return (context.tagTotals?.[requirement.tag] ?? 0) > 0;
  }
  if (type === 'allOfTags') {
    return (requirement.tags ?? []).every((tag) => (context.tagTotals?.[tag] ?? 0) > 0);
  }
  if (type === 'anyOfTags') {
    return (requirement.tags ?? []).some((tag) => (context.tagTotals?.[tag] ?? 0) > 0);
  }
  if (type === 'totalTagCount') {
    return (context.tagTotals?.[requirement.tag] ?? 0) >= (requirement.min ?? 0);
  }
  if (type === 'tagTypeCount') {
    return (context.tagTypeCounts?.[requirement.tag] ?? 0) >= (requirement.min ?? 0);
  }
  if (type === 'distinctTags') {
    return (context.distinctTagCount ?? 0) >= (requirement.min ?? 0);
  }
  if (type === 'totalTagsCombined') {
    const total = (requirement.tags ?? []).reduce((sum, tag) => sum + (context.tagTotals?.[tag] ?? 0), 0);
    return total >= (requirement.min ?? 0);
  }

  return false;
}

function resolveFormationSynergies(unitRoster = [], definitions = FORMATION_SYNERGIES) {
  const context = buildSynergyContext(unitRoster);
  const active = [];
  const modifiers = { attack: 0, defense: 0, sustain: 0 };

  for (const synergy of definitions ?? []) {
    const requirements = synergy.requirements ?? [];
    const met = requirements.length === 0 || requirements.every((req) => isSynergyRequirementMet(req, context));
    if (!met) continue;

    active.push({
      id: synergy.id,
      name: synergy.name,
      description: synergy.description ?? '',
      modifiers: { ...(synergy.modifiers ?? {}) },
    });
    modifiers.attack += synergy.modifiers?.attack ?? 0;
    modifiers.defense += synergy.modifiers?.defense ?? 0;
    modifiers.sustain += synergy.modifiers?.sustain ?? 0;
  }

  return { active, modifiers };
}

export { FORMATION_SYNERGIES, resolveFormationSynergies };

