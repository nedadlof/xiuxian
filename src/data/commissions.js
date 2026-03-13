const COMMISSION_BOARD_SIZE = 3;
const COMMISSION_REROLL_COOLDOWN_SECONDS = 90;
const COMMISSION_COMPLETION_COOLDOWN_SECONDS = 75;
const COMMISSION_INTERRUPTION_COOLDOWN_SECONDS = 180;
const COMMISSION_SPECIAL_RESPAWN_SECONDS = 150;
const COMMISSION_SPECIAL_OFFER_LIMIT = 1;
const COMMISSION_EVENT_TRIGGER_PROGRESS = 0.5;
const COMMISSION_REROLL_COST = Object.freeze({
  dao: 1800,
  spiritCrystal: 6,
});
const COMMISSION_THEME_ROTATION_SECONDS = 720;

const COMMISSION_THEME_DEFINITIONS = Object.freeze([
  {
    id: 'verdant-harvest',
    name: '青木采潮',
    description: '宗门近期灵植旺盛，资源、丹养与护持类委托更容易浮上榜单。',
    effectSummary: '资源与丹养委托更常见，命中风向时可额外带回药材与丹息。',
    preferredTags: ['resource', 'alchemy', 'support'],
    specialPreferredTags: ['trade', 'control'],
    durationSeconds: COMMISSION_THEME_ROTATION_SECONDS,
    scoreBonus: 36,
    specialScoreBonus: 24,
    rewardBonus: { herb: 72, pills: 8, dao: 120 },
    specialRewardBonus: { spiritCrystal: 6, dao: 120 },
  },
  {
    id: 'border-clarion',
    name: '边境战号',
    description: '外山门戒备升级，巡防、防守与突发战务的权重明显提高。',
    effectSummary: '边防委托与紧急诏令更易出现，完成时附带额外军备与道统赏金。',
    preferredTags: ['defense', 'patrol', 'battle'],
    specialPreferredTags: ['battle', 'emergency', 'event'],
    durationSeconds: COMMISSION_THEME_ROTATION_SECONDS,
    scoreBonus: 42,
    specialScoreBonus: 32,
    rewardBonus: { iron: 60, wood: 48, dao: 180 },
    specialRewardBonus: { talisman: 10, spiritCrystal: 8, dao: 160 },
  },
  {
    id: 'market-undercurrent',
    name: '夜市暗潮',
    description: '坊市风声浮动，押运、黑线缉查与商脉相关的任务更容易成批出现。',
    effectSummary: '贸易相关榜单更偏多，命中风向时会追加灵石与情报收益。',
    preferredTags: ['trade', 'escort', 'control'],
    specialPreferredTags: ['trade', 'control', 'urgent'],
    durationSeconds: COMMISSION_THEME_ROTATION_SECONDS,
    scoreBonus: 40,
    specialScoreBonus: 28,
    rewardBonus: { lingStone: 180, spiritCrystal: 6, dao: 140 },
    specialRewardBonus: { lingStone: 220, spiritCrystal: 10 },
  },
  {
    id: 'relic-resonance',
    name: '遗府回响',
    description: '古迹禁制接连松动，勘验、遗迹与稀有诏令会受到明显牵引。',
    effectSummary: '遗迹与稀有委托更易浮现，成功后更容易回收碎片与禁制材料。',
    preferredTags: ['explore', 'relic', 'rare'],
    specialPreferredTags: ['relic', 'rare', 'event'],
    durationSeconds: COMMISSION_THEME_ROTATION_SECONDS,
    scoreBonus: 44,
    specialScoreBonus: 34,
    rewardBonus: { discipleShard: 18, talisman: 10, spiritCrystal: 8 },
    specialRewardBonus: { discipleShard: 24, tianmingSeal: 1, spiritCrystal: 8 },
  },
]);

const COMMISSION_STANDING_DEFINITIONS = Object.freeze([
  {
    id: 'outer-errand',
    name: '外务新签',
    description: '刚接入宗门委派体系，仍以熟悉各类常规委托为主。',
    requiredReputation: 0,
    boardSizeBonus: 0,
    specialOfferLimitBonus: 0,
    rerollDiscount: 0,
    reputationBonus: 0,
    perkSummary: '基础榜单 3 项，基础限时诏令 1 条，无刷新折扣。',
  },
  {
    id: 'hall-steward',
    name: '执务堂吏',
    description: '开始获得执务堂信任，能同时筛选更多榜单并降低调度损耗。',
    requiredReputation: 80,
    boardSizeBonus: 1,
    specialOfferLimitBonus: 0,
    rerollDiscount: 0.12,
    reputationBonus: 0.05,
    perkSummary: '委托榜单 +1 项，刷新消耗降低 12%。',
  },
  {
    id: 'banner-envoy',
    name: '巡界行令',
    description: '宗门将更多机密差事交给你，限时诏令与重点任务明显增多。',
    requiredReputation: 220,
    boardSizeBonus: 1,
    specialOfferLimitBonus: 1,
    rerollDiscount: 0.2,
    reputationBonus: 0.1,
    perkSummary: '维持 4 项委托榜单，限时诏令上限 +1，刷新消耗降低 20%。',
  },
  {
    id: 'heaven-ledger',
    name: '天机总务',
    description: '已成为宗门高阶委派总务，处理委托时更擅长滚动资源与情报网络。',
    requiredReputation: 420,
    boardSizeBonus: 1,
    specialOfferLimitBonus: 1,
    rerollDiscount: 0.3,
    reputationBonus: 0.18,
    perkSummary: '维持高阶委派通路，限时诏令上限 +1，刷新消耗降低 30%，声望收益提升。',
  },
]);

const COMMISSION_MILESTONE_DEFINITIONS = Object.freeze([
  {
    id: 'first-banner',
    name: '初执令旗',
    description: '首次在委派体系中稳定立足，执务堂发下基础补给。',
    requirements: {
      minReputation: 12,
      minClaimedCount: 1,
    },
    reward: {
      spiritCrystal: 18,
      herb: 120,
      dao: 1200,
    },
  },
  {
    id: 'route-expander',
    name: '通路开拓',
    description: '完成多轮委托后，宗门追加巡路经费与招募文牒。',
    requirements: {
      minReputation: 90,
      minClaimedCount: 4,
    },
    reward: {
      lingStone: 480,
      spiritCrystal: 24,
      seekImmortalToken: 2,
      dao: 1800,
    },
  },
  {
    id: 'special-warrant',
    name: '夜榜敕令',
    description: '开始接住限时诏令后，执务堂开放更高优先级的外务资源。',
    requirements: {
      minReputation: 180,
      minClaimedCount: 7,
      minSpecialClaimedCount: 1,
    },
    reward: {
      tianmingSeal: 1,
      spiritCrystal: 36,
      talisman: 42,
      dao: 2600,
    },
  },
  {
    id: 'grand-commission-ledger',
    name: '总务秘册',
    description: '委派网络趋于成熟，宗门奖励一批高价值调度物资与命格资源。',
    requirements: {
      minReputation: 320,
      minClaimedCount: 10,
      minSpecialClaimedCount: 2,
    },
    reward: {
      seekImmortalToken: 3,
      tianmingSeal: 1,
      discipleShard: 80,
      spiritCrystal: 50,
      dao: 3600,
    },
  },
]);

const COMMISSION_SUPPLY_DEFINITIONS = Object.freeze([
  {
    id: 'expedite-writ',
    name: '加急牒文',
    description: '执务堂发放的加急通关文书，可压缩本次或下一次委托的执行时间。',
    unlockStandingId: 'outer-errand',
    cost: {
      dao: 1200,
      spiritCrystal: 4,
    },
    effect: {
      type: 'expedite',
      activeRemainingMultiplier: 0.72,
      nextDurationMultiplier: 0.86,
      nextScoreBonus: 18,
    },
  },
  {
    id: 'bounty-ledger',
    name: '赏格账册',
    description: '预支一批委托赏格和后勤药资，为当前或下一次委托追加收益。',
    unlockStandingId: 'hall-steward',
    cost: {
      herb: 120,
      pills: 12,
      dao: 900,
    },
    effect: {
      type: 'bounty',
      activeScoreBonus: 24,
      activeRewardBonus: {
        dao: 260,
        spiritCrystal: 6,
      },
      nextScoreBonus: 24,
      nextRewardBonus: {
        dao: 320,
        spiritCrystal: 8,
        herb: 60,
      },
    },
  },
  {
    id: 'shadow-bulletin',
    name: '夜行密报',
    description: '黑市线报会被优先递送到执务堂，能迅速拉近下一道限时诏令。',
    unlockStandingId: 'banner-envoy',
    cost: {
      talisman: 18,
      spiritCrystal: 10,
      dao: 1500,
    },
    effect: {
      type: 'special-intel',
      specialSpawnAdvanceSeconds: 150,
    },
  },
]);

const COMMISSION_AFFAIRS_SHOP_DEFINITIONS = Object.freeze([
  {
    id: 'ledger-annex',
    name: '外榜副册',
    description: '执务堂增开一页副册，可长期多维护一项委托榜单。',
    unlockStandingId: 'outer-errand',
    cost: 5,
    effect: {
      boardSizeBonus: 1,
    },
  },
  {
    id: 'relay-beacon',
    name: '夜烽驿灯',
    description: '增设夜行驿灯后，限时诏令可长期多容纳一条并更早抵达。',
    unlockStandingId: 'banner-envoy',
    cost: 18,
    effect: {
      specialOfferLimitBonus: 1,
      specialRespawnMultiplier: 0.88,
    },
  },
  {
    id: 'frugal-ledger',
    name: '减耗账法',
    description: '执务堂重新编排调度账法，长期降低委托榜刷新损耗。',
    unlockStandingId: 'hall-steward',
    cost: 10,
    effect: {
      rerollDiscountBonus: 0.12,
    },
  },
  {
    id: 'merit-tally',
    name: '功簿并算',
    description: '功绩结算更细致后，后续委托会额外产出事务点。',
    unlockStandingId: 'banner-envoy',
    cost: 16,
    effect: {
      affairsCreditBonus: 0.25,
    },
  },
]);

const COMMISSION_CASE_FILE_DEFINITIONS = Object.freeze([
  {
    id: 'market-smoke-dossier',
    name: '夜市失踪案',
    description: '执务堂从多份日常委托里拼出了夜市失踪弟子的残线，需要顺着货路、暗号与掩护人脉追查幕后黑手。',
    unlockStandingId: 'outer-errand',
    requiredProgress: 1,
    preferredTags: ['resource', 'trade', 'escort', 'explore', 'defense', 'support'],
    durationSeconds: 210,
    recommendedScore: 420,
    reward: { lingStone: 360, spiritCrystal: 18, talisman: 18, dao: 1800 },
    bonusReward: { seekImmortalToken: 1, herb: 160 },
    tags: ['trade', 'control', 'explore'],
    affinities: [
      {
        id: 'merchant-trace',
        label: '商路缉线',
        description: '熟悉商路与坊市脉络的弟子更容易追上夜市转运的暗线。',
        score: 74,
        reward: { lingStone: 120, spiritCrystal: 6 },
        match: { factionId: 'yunque-merchant' },
      },
      {
        id: 'triad-shadowstep',
        label: '三脉潜行',
        description: '多阵营出征更容易在夜市巷线中接上不同渠道的口风。',
        score: 48,
        reward: { talisman: 10 },
        match: { minUniqueFactions: 3 },
      },
      {
        id: 'control-sweep',
        label: '封街清场',
        description: '擅长控场与追捕的队伍能更稳地压住逃窜路线。',
        score: 42,
        reward: { dao: 240 },
        match: { effectType: 'battleControl' },
      },
    ],
  },
  {
    id: 'sealed-vault-cipher',
    name: '封库残卷',
    description: '几份遗迹勘验的碎片指向一处被封存的外库，需在各方势力抢先前拼出阵纹缺口与钥印顺序。',
    unlockStandingId: 'hall-steward',
    requiredProgress: 3,
    preferredTags: ['explore', 'relic', 'alchemy', 'rare', 'support'],
    durationSeconds: 245,
    recommendedScore: 560,
    reward: { discipleShard: 72, spiritCrystal: 26, talisman: 24, dao: 2200 },
    bonusReward: { tianmingSeal: 1, herb: 180 },
    tags: ['explore', 'relic', 'rare'],
    affinities: [
      {
        id: 'resonance-key',
        label: '共鸣对钥',
        description: '高共鸣阵容更容易从封库余波中比对出正确的开印频率。',
        score: 68,
        reward: { discipleShard: 20, spiritCrystal: 8 },
        match: { bondId: 'resonance-surge' },
      },
      {
        id: 'dual-breakseal',
        label: '双星破封',
        description: '高阶核心同出时，破解外库封锁的效率会显著提升。',
        score: 58,
        reward: { talisman: 10, dao: 220 },
        match: { bondId: 'dual-legend' },
      },
      {
        id: 'alchemy-decode',
        label: '丹识解纹',
        description: '丹房弟子擅长从残留药息中辨认封库曾经的供奉用途。',
        score: 40,
        reward: { herb: 90 },
        match: { stationId: 'alchemy' },
      },
    ],
  },
  {
    id: 'frontier-mutiny-ledger',
    name: '边关哗变录',
    description: '边境巡防与急报委托不断指向同一批失踪军需，执务堂要求你循着哗变前的物资流向做一次彻底清查。',
    unlockStandingId: 'banner-envoy',
    requiredProgress: 4,
    preferredTags: ['defense', 'patrol', 'battle', 'event', 'control'],
    durationSeconds: 255,
    recommendedScore: 640,
    reward: { iron: 220, wood: 180, spiritCrystal: 32, talisman: 26, dao: 2600 },
    bonusReward: { tianmingSeal: 1, seekImmortalToken: 1 },
    tags: ['battle', 'defense', 'event'],
    affinities: [
      {
        id: 'frontier-command',
        label: '边军统筹',
        description: '老成的防守型队伍更擅长梳理军需缺口与驻防异动。',
        score: 66,
        reward: { iron: 88, wood: 60 },
        match: { effectType: 'battleDefense' },
      },
      {
        id: 'elder-writ',
        label: '长老军令',
        description: '长老坐镇能压住边关人心波动，让搜证过程更顺畅。',
        score: 44,
        reward: { dao: 360, spiritCrystal: 6 },
        match: { minElders: 1 },
      },
      {
        id: 'banner-network',
        label: '巡旗联络',
        description: '具备多阵营联络能力的队伍更容易对接多处边哨情报。',
        score: 46,
        reward: { talisman: 12 },
        match: { minUniqueFactions: 3 },
      },
    ],
  },
]);

const COMMISSION_DIRECTIVE_DEFINITIONS = Object.freeze([
  {
    id: 'all-domain-gazette',
    name: '百务总牒',
    description: '执务堂要求你先把宗门各路委托跑通，趁机摸清最近的外务脉络。',
    unlockStandingId: 'outer-errand',
    requiredProgress: 1,
    preferredTags: ['resource', 'trade', 'escort', 'explore', 'defense', 'support', 'alchemy', 'patrol', 'control'],
    focusScoreBonus: 18,
    focusRewardBonus: { dao: 180, herb: 40 },
    reward: { spiritCrystal: 12, dao: 1200, herb: 120 },
    reputationReward: 8,
    affairsCreditReward: 3,
  },
  {
    id: 'market-watch',
    name: '夜市稽查',
    description: '近来坊市与押运线索繁杂，执务堂要求优先梳理商路、暗线与夜市情报。',
    unlockStandingId: 'outer-errand',
    requiredProgress: 2,
    preferredTags: ['trade', 'escort', 'control'],
    focusScoreBonus: 26,
    focusRewardBonus: { lingStone: 120, dao: 180 },
    reward: { lingStone: 280, spiritCrystal: 10, talisman: 8, dao: 1400 },
    reputationReward: 10,
    affairsCreditReward: 4,
  },
  {
    id: 'verdant-provision',
    name: '药脉整备',
    description: '宗门近期要补充丹养与后勤储备，相关委托会被记入重点考绩。',
    unlockStandingId: 'outer-errand',
    requiredProgress: 2,
    preferredTags: ['resource', 'alchemy', 'support'],
    focusScoreBonus: 24,
    focusRewardBonus: { herb: 80, pills: 8, dao: 120 },
    reward: { herb: 220, pills: 18, spiritCrystal: 8, dao: 1300 },
    reputationReward: 10,
    affairsCreditReward: 4,
  },
  {
    id: 'relic-probe',
    name: '遗府勘签',
    description: '执务堂要你集中筛查遗迹与秘库线索，为后续高阶卷宗提前铺路。',
    unlockStandingId: 'hall-steward',
    requiredProgress: 2,
    preferredTags: ['explore', 'relic', 'rare'],
    focusScoreBonus: 34,
    focusRewardBonus: { discipleShard: 12, spiritCrystal: 6 },
    reward: { discipleShard: 36, talisman: 14, spiritCrystal: 14, dao: 1700 },
    reputationReward: 14,
    affairsCreditReward: 5,
  },
  {
    id: 'frontier-order',
    name: '边巡整军',
    description: '边境情势尚未完全稳住，巡防与镇压类委托会得到额外奖掖。',
    unlockStandingId: 'hall-steward',
    requiredProgress: 2,
    preferredTags: ['defense', 'patrol', 'battle'],
    focusScoreBonus: 30,
    focusRewardBonus: { iron: 70, wood: 50, dao: 160 },
    reward: { iron: 180, wood: 140, spiritCrystal: 10, dao: 1600 },
    reputationReward: 12,
    affairsCreditReward: 5,
  },
]);

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
    affinities: [
      {
        id: 'alchemy-station',
        label: '丹房采补',
        description: '炼丹系弟子熟悉药岭灵材脉络，可额外回收丹材。',
        score: 72,
        reward: { herb: 48, pills: 10 },
        match: { stationId: 'alchemy' },
      },
      {
        id: 'herb-garden-station',
        label: '灵植照料',
        description: '药园弟子擅长辨认药性，巡采效率更高。',
        score: 68,
        reward: { herb: 76 },
        match: { stationId: 'herbGarden' },
      },
      {
        id: 'preservation-support',
        label: '封灵护养',
        description: '具备资源护持能力的随队弟子可减少灵植损耗。',
        score: 44,
        reward: { wood: 36, pills: 6 },
        match: { effectType: 'resourcePreservation' },
      },
      {
        id: 'qingmu-lineage',
        label: '青木脉络',
        description: '青木系弟子更擅长山野采集与草木引灵。',
        score: 40,
        reward: { wood: 40 },
        match: { factionId: 'qingmu-grove' },
      },
    ],
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
    affinities: [
      {
        id: 'merchant-bloodline',
        label: '商脉照应',
        description: '商盟出身的弟子能够稳住商路关系，抬高结算收益。',
        score: 84,
        reward: { lingStone: 160, spiritCrystal: 10 },
        match: { factionId: 'yunque-merchant' },
      },
      {
        id: 'loot-routing',
        label: '货线调度',
        description: '战利品型弟子会顺手优化押运路线，带回更多货值。',
        score: 50,
        reward: { lingStone: 120 },
        match: { effectType: 'battleLoot' },
      },
      {
        id: 'elder-escort',
        label: '长老镇场',
        description: '长老压阵可稳定商会信心，押运途中更少波折。',
        score: 36,
        reward: { dao: 360 },
        match: { minElders: 1 },
      },
      {
        id: 'multi-faction-network',
        label: '三脉商网',
        description: '多阵营组合更适合沿路打通人脉与接头点。',
        score: 55,
        reward: { spiritCrystal: 8 },
        match: { bondId: 'triad-journey' },
      },
    ],
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
    affinities: [
      {
        id: 'resonance-probe',
        label: '共鸣探脉',
        description: '高共鸣队伍更容易感知遗迹暗层与隐匿回路。',
        score: 56,
        reward: { discipleShard: 18, talisman: 10 },
        match: { bondId: 'resonance-surge' },
      },
      {
        id: 'legend-breakthrough',
        label: '双星破禁',
        description: '高阶核心弟子同行时，破禁和抢点效率明显提升。',
        score: 66,
        reward: { iron: 72, spiritCrystal: 8 },
        match: { bondId: 'dual-legend' },
      },
      {
        id: 'attack-expedition',
        label: '强袭勘探',
        description: '擅长进攻的队伍更容易在遗迹争夺中抢下关键点。',
        score: 44,
        reward: { talisman: 12 },
        match: { effectType: 'battleAttack' },
      },
      {
        id: 'nether-lantern',
        label: '幽灯引痕',
        description: '幽冥一脉更擅长追踪残魂与禁制余烬。',
        score: 40,
        reward: { discipleShard: 12 },
        match: { factionId: 'youming-lantern' },
      },
    ],
  },
  {
    id: 'spirit-spring-refining',
    name: '灵泉炼养',
    description: '驻守灵泉旁路，采炼泉眼灵雾并压缩为修行资粮。',
    durationSeconds: 150,
    recommendedScore: 300,
    reward: { pills: 24, spiritCrystal: 16, dao: 980 },
    bonusReward: { herb: 110 },
    tags: ['alchemy', 'support'],
    affinities: [
      {
        id: 'alchemy-mastery',
        label: '丹息控泉',
        description: '炼丹系弟子能够稳定灵泉药性，增加炼养产出。',
        score: 70,
        reward: { pills: 12, spiritCrystal: 8 },
        match: { stationId: 'alchemy' },
      },
      {
        id: 'sustain-expedition',
        label: '稳脉续航',
        description: '续航型出征能力有助于长时间控泉炼养。',
        score: 48,
        reward: { dao: 220 },
        match: { effectType: 'battleSustain' },
      },
      {
        id: 'shared-lineage',
        label: '同门默契',
        description: '同门弟子配合更适合处理高精细炼养流程。',
        score: 38,
        reward: { herb: 42 },
        match: { bondId: 'shared-faction' },
      },
      {
        id: 'resonance-threshold',
        label: '泉眼共振',
        description: '总共鸣足够高时，可额外压榨灵泉涌流。',
        score: 34,
        reward: { spiritCrystal: 6 },
        match: { minTotalResonance: 4 },
      },
    ],
  },
  {
    id: 'border-watch',
    name: '边境守望',
    description: '沿山门边境巡防异动，稳定外门商路与驻地安全。',
    durationSeconds: 210,
    recommendedScore: 360,
    reward: { iron: 160, wood: 120, dao: 1280 },
    bonusReward: { spiritCrystal: 14 },
    tags: ['defense', 'patrol'],
    affinities: [
      {
        id: 'defense-frontline',
        label: '守阵老练',
        description: '防守型弟子能更稳地守住边境据点。',
        score: 64,
        reward: { iron: 60, wood: 44 },
        match: { effectType: 'battleDefense' },
      },
      {
        id: 'elder-command',
        label: '长老镇边',
        description: '长老亲临可压住边境骚动，减少驻防损耗。',
        score: 44,
        reward: { dao: 260 },
        match: { bondId: 'elder-banner' },
      },
      {
        id: 'smithy-line',
        label: '玄兵备甲',
        description: '锻造一系弟子会顺手补齐守备器械。',
        score: 42,
        reward: { iron: 52 },
        match: { stationId: 'smithy' },
      },
      {
        id: 'forest-cover',
        label: '山林伏哨',
        description: '林木系弟子善于借地形布置巡防哨线。',
        score: 34,
        reward: { wood: 48 },
        match: { factionId: 'qingmu-grove' },
      },
    ],
  },
  {
    id: 'night-market-trace',
    name: '夜市缉线',
    description: '暗中追查坊市黑线交易，截留灵符与禁物流向。',
    durationSeconds: 195,
    recommendedScore: 390,
    reward: { talisman: 36, lingStone: 260, dao: 1380 },
    bonusReward: { spiritCrystal: 20 },
    tags: ['trade', 'control'],
    affinities: [
      {
        id: 'sword-sweep',
        label: '剑修清场',
        description: '爆发型弟子可快速压住夜市乱局，提升截获效率。',
        score: 60,
        reward: { talisman: 14, lingStone: 90 },
        match: { factionId: 'jianxu-palace' },
      },
      {
        id: 'triad-contacts',
        label: '异脉接线',
        description: '三脉同行更容易混入多个渠道摸清暗线。',
        score: 52,
        reward: { spiritCrystal: 8 },
        match: { minUniqueFactions: 3 },
      },
      {
        id: 'legend-pressure',
        label: '名望威压',
        description: '高稀有度弟子同行时，夜市势力更容易松口。',
        score: 46,
        reward: { dao: 240 },
        match: { rarity: 'legendary' },
      },
      {
        id: 'resonance-hunt',
        label: '共鸣追缉',
        description: '高共鸣阵容能够更快锁定禁物流动轨迹。',
        score: 34,
        reward: { lingStone: 80 },
        match: { minTotalResonance: 4 },
      },
    ],
  },
]);

const SPECIAL_COMMISSION_DEFINITIONS = Object.freeze([
  {
    id: 'rift-emergency',
    name: '裂隙急报',
    description: '山门外侧临时出现灵潮裂隙，需要速派精锐压制并夺回溢散灵材。',
    durationSeconds: 165,
    recommendedScore: 420,
    reward: { spiritCrystal: 42, dao: 1900, talisman: 24 },
    bonusReward: { tianmingSeal: 1 },
    tags: ['event', 'emergency', 'battle'],
    eventType: 'emergency',
    eventLabel: '灵潮异变',
    expiresSeconds: 240,
    affinities: [
      {
        id: 'burst-response',
        label: '急袭压制',
        description: '高爆发队伍更适合处理突发裂隙清剿。',
        score: 76,
        reward: { spiritCrystal: 16, talisman: 10 },
        match: { effectType: 'battleAttack' },
      },
      {
        id: 'dual-legend-response',
        label: '双星镇场',
        description: '双传奇同出时，更容易在裂隙前线稳住局面。',
        score: 64,
        reward: { dao: 520 },
        match: { bondId: 'dual-legend' },
      },
      {
        id: 'resonance-seal',
        label: '共鸣封裂',
        description: '高共鸣阵容有利于快速封住灵潮外泄点。',
        score: 48,
        reward: { spiritCrystal: 12 },
        match: { minTotalResonance: 4 },
      },
    ],
  },
  {
    id: 'black-market-sweep',
    name: '黑市突缉',
    description: '坊市黑线忽然转移，需要连夜截断渠道并收缴稀缺符契。',
    durationSeconds: 180,
    recommendedScore: 430,
    reward: { lingStone: 480, spiritCrystal: 26, talisman: 30, dao: 1760 },
    bonusReward: { seekImmortalToken: 1 },
    tags: ['event', 'trade', 'control'],
    eventType: 'urgent',
    eventLabel: '夜榜缉令',
    expiresSeconds: 260,
    affinities: [
      {
        id: 'trade-net',
        label: '商网追缉',
        description: '商路出身与多阵营关系网更容易锁定黑市流向。',
        score: 68,
        reward: { lingStone: 140, spiritCrystal: 8 },
        match: { factionId: 'yunque-merchant' },
      },
      {
        id: 'triad-night-raid',
        label: '三脉夜行',
        description: '三脉同行更适合同时压住多条黑线。',
        score: 54,
        reward: { talisman: 12 },
        match: { minUniqueFactions: 3 },
      },
      {
        id: 'legend-pressure-special',
        label: '名望震慑',
        description: '传奇弟子坐镇能让黑市势力更快松口。',
        score: 42,
        reward: { dao: 320 },
        match: { rarity: 'legendary' },
      },
    ],
  },
  {
    id: 'ancient-vault-flare',
    name: '秘库余焰',
    description: '古秘库封印松动，需抢在各方之前回收残卷、命魂碎片与禁制零件。',
    durationSeconds: 210,
    recommendedScore: 500,
    reward: { discipleShard: 72, spiritCrystal: 22, iron: 110, dao: 2100 },
    bonusReward: { tianmingSeal: 1, seekImmortalToken: 1 },
    tags: ['event', 'relic', 'rare'],
    eventType: 'rare',
    eventLabel: '秘库现世',
    expiresSeconds: 320,
    affinities: [
      {
        id: 'relic-break',
        label: '破禁夺卷',
        description: '高阶核心队伍更适合抢夺秘库核心区。',
        score: 74,
        reward: { discipleShard: 24, spiritCrystal: 10 },
        match: { bondId: 'dual-legend' },
      },
      {
        id: 'resonance-vault',
        label: '共鸣开锁',
        description: '高共鸣队伍更容易定位秘库阵锁薄弱点。',
        score: 52,
        reward: { iron: 44, discipleShard: 12 },
        match: { bondId: 'resonance-surge' },
      },
      {
        id: 'elder-protocol',
        label: '长老戒律',
        description: '长老压阵有助于稳住秘库内部禁制回流。',
        score: 40,
        reward: { dao: 360 },
        match: { minElders: 1 },
      },
    ],
  },
]);

const COMMISSION_EVENT_DEFINITIONS = Object.freeze([
  {
    id: 'rogue-trader',
    name: '半路商客',
    description: '途中有游商提出临时交换路线资源，可能加快任务，也可能错失一部分稳定收益。',
    tags: ['trade', 'escort'],
    options: [
      {
        id: 'quick-deal',
        label: '快换通行',
        description: '立刻换取通行凭引，缩短剩余时间并补一笔灵石。',
        effect: {
          remainingSecondsMultiplier: 0.82,
          rewardBonus: { lingStone: 120, dao: 180 },
          aftereffect: {
            id: 'trade-route-favor',
            label: '商路余温',
            description: '游商人脉尚未散去，下一轮更容易刷出贸易向委托，并提前迎来夜榜诏令。',
            preferredTags: ['trade', 'escort', 'control'],
            remainingBoardRefreshes: 1,
            remainingSpecialSpawns: 1,
            specialSpawnAdvanceSeconds: 60,
          },
        },
      },
      {
        id: 'steady-route',
        label: '稳守原线',
        description: '不改商路，保持阵容节奏，额外提升整体完成度。',
        effect: {
          scoreBonus: 52,
          rewardBonus: { spiritCrystal: 6 },
          aftereffect: {
            id: 'stable-escort-discipline',
            label: '稳路章法',
            description: '队伍节奏更稳，后续榜单更偏向护送与防守委托。',
            preferredTags: ['escort', 'defense', 'patrol'],
            remainingBoardRefreshes: 1,
            remainingSpecialSpawns: 0,
            specialSpawnAdvanceSeconds: 0,
          },
        },
      },
    ],
  },
  {
    id: 'spirit-vein-quake',
    name: '地脉震荡',
    description: '任务区域突发地脉震荡，队伍可选择强行压制，或绕行换取更安全的推进。',
    tags: ['resource', 'alchemy', 'defense', 'patrol'],
    options: [
      {
        id: 'suppress-vein',
        label: '压住地脉',
        description: '强行稳住地脉，额外回收一批资源，但会拖慢推进。',
        effect: {
          remainingSecondsMultiplier: 1.18,
          rewardBonus: { herb: 80, wood: 60, iron: 50 },
          scoreBonus: 28,
          aftereffect: {
            id: 'vein-residue',
            label: '地脉余震',
            description: '地脉波动尚未平复，下一轮更容易吸引资源与遗迹类委托。',
            preferredTags: ['resource', 'alchemy', 'relic'],
            remainingBoardRefreshes: 1,
            remainingSpecialSpawns: 1,
            specialSpawnAdvanceSeconds: 30,
          },
        },
      },
      {
        id: 'bypass-fracture',
        label: '绕开裂段',
        description: '避开危险区域，整体推进更快，但收益更保守。',
        effect: {
          remainingSecondsMultiplier: 0.86,
          rewardBonus: { dao: 160 },
          aftereffect: {
            id: 'safe-route-scouting',
            label: '绕行踏勘',
            description: '避险路线留下新线索，后续更容易出现巡防与夜榜任务。',
            preferredTags: ['patrol', 'control', 'trade'],
            remainingBoardRefreshes: 1,
            remainingSpecialSpawns: 0,
            specialSpawnAdvanceSeconds: 0,
          },
        },
      },
    ],
  },
  {
    id: 'sealed-side-chamber',
    name: '封闭侧室',
    description: '遗迹或秘库旁出现额外封闭侧室，队伍可以抢时间破禁，或只记录线索后续上报。',
    tags: ['relic', 'explore', 'rare'],
    options: [
      {
        id: 'force-open',
        label: '强拆破禁',
        description: '投入更多精力破禁，显著提高战利，但也会延后完成时间。',
        effect: {
          remainingSecondsMultiplier: 1.22,
          scoreBonus: 48,
          rewardBonus: { discipleShard: 18, spiritCrystal: 10, talisman: 12 },
          aftereffect: {
            id: 'vault-heat',
            label: '秘库热迹',
            description: '秘库余波未散，接下来更容易刷出遗迹、高价值限时诏令。',
            preferredTags: ['relic', 'rare', 'explore'],
            remainingBoardRefreshes: 1,
            remainingSpecialSpawns: 1,
            specialSpawnAdvanceSeconds: 75,
          },
        },
      },
      {
        id: 'mark-and-report',
        label: '留印上报',
        description: '保留主线节奏，带回情报换取宗门额外奖赏。',
        effect: {
          remainingSecondsMultiplier: 0.9,
          rewardBonus: { dao: 260, spiritCrystal: 4 },
          aftereffect: {
            id: 'sealed-clue-ledger',
            label: '封印线报',
            description: '情报已入卷宗，后续榜单更偏向勘验与秘档类任务。',
            preferredTags: ['explore', 'relic', 'support'],
            remainingBoardRefreshes: 1,
            remainingSpecialSpawns: 0,
            specialSpawnAdvanceSeconds: 0,
          },
        },
      },
    ],
  },
  {
    id: 'urgent-casualty',
    name: '前线伤员',
    description: '途中遇到前线伤员与残阵，可选择优先救援，或抽调力量直扑任务目标。',
    tags: ['event', 'emergency', 'battle', 'support'],
    sourceTypes: ['special'],
    options: [
      {
        id: 'rescue-first',
        label: '先救伤员',
        description: '花时间稳住局面，换取更高的宗门评价和额外资源回报。',
        effect: {
          remainingSecondsMultiplier: 1.14,
          scoreBonus: 70,
          rewardBonus: { dao: 420, spiritCrystal: 8 },
          aftereffect: {
            id: 'frontline-gratitude',
            label: '前线回报',
            description: '前线伤员上报了额外情报，接下来更快迎来高价值诏令。',
            preferredTags: ['event', 'emergency', 'battle'],
            remainingBoardRefreshes: 0,
            remainingSpecialSpawns: 1,
            specialSpawnAdvanceSeconds: 90,
          },
        },
      },
      {
        id: 'push-objective',
        label: '直扑目标',
        description: '保持突击速度，更快完成限时任务并保住事件窗口。',
        effect: {
          remainingSecondsMultiplier: 0.78,
          rewardBonus: { lingStone: 140, talisman: 10 },
          aftereffect: {
            id: 'assault-momentum',
            label: '强袭余势',
            description: '队伍士气正盛，下一轮更偏向突击与缉令类任务。',
            preferredTags: ['battle', 'control', 'rare'],
            remainingBoardRefreshes: 1,
            remainingSpecialSpawns: 1,
            specialSpawnAdvanceSeconds: 45,
          },
        },
      },
    ],
  },
]);

const RARITY_SCORE = Object.freeze({
  common: 70,
  rare: 100,
  epic: 145,
  legendary: 200,
});

const OUTCOME_TIERS = Object.freeze([
  { id: 'perfect', minRatio: 1.15, label: '圆满完成', rewardMultiplier: 1.35, bonusMultiplier: 1, affinityMultiplier: 1 },
  { id: 'success', minRatio: 1, label: '顺利完成', rewardMultiplier: 1, bonusMultiplier: 0.75, affinityMultiplier: 0.9 },
  { id: 'partial', minRatio: 0.7, label: '勉强完成', rewardMultiplier: 0.72, bonusMultiplier: 0.35, affinityMultiplier: 0.6 },
  { id: 'failed', minRatio: 0, label: '铩羽而归', rewardMultiplier: 0.38, bonusMultiplier: 0, affinityMultiplier: 0.25 },
]);

function cloneRewardMap(reward = {}) {
  return Object.fromEntries(Object.entries(reward ?? {}).map(([resourceId, amount]) => [resourceId, amount]));
}

function cloneAffinity(affinity = {}) {
  return {
    ...affinity,
    reward: cloneRewardMap(affinity.reward),
    match: { ...(affinity.match ?? {}) },
  };
}

function cloneDefinition(definition = {}) {
  return {
    ...definition,
    reward: cloneRewardMap(definition.reward),
    bonusReward: cloneRewardMap(definition.bonusReward),
    tags: [...(definition.tags ?? [])],
    affinities: (definition.affinities ?? []).map((affinity) => cloneAffinity(affinity)),
  };
}

function cloneThemeDefinition(definition = {}) {
  return {
    ...definition,
    preferredTags: [...(definition.preferredTags ?? [])],
    specialPreferredTags: [...(definition.specialPreferredTags ?? [])],
    rewardBonus: cloneRewardMap(definition.rewardBonus),
    specialRewardBonus: cloneRewardMap(definition.specialRewardBonus),
  };
}

function cloneStandingDefinition(definition = {}) {
  return {
    ...definition,
  };
}

function cloneMilestoneDefinition(definition = {}) {
  return {
    ...definition,
    requirements: {
      ...(definition.requirements ?? {}),
    },
    reward: cloneRewardMap(definition.reward),
  };
}

function cloneSupplyDefinition(definition = {}) {
  return {
    ...definition,
    cost: cloneRewardMap(definition.cost),
    effect: {
      ...(definition.effect ?? {}),
      activeRewardBonus: cloneRewardMap(definition.effect?.activeRewardBonus),
      nextRewardBonus: cloneRewardMap(definition.effect?.nextRewardBonus),
    },
  };
}

function cloneAffairsShopDefinition(definition = {}) {
  return {
    ...definition,
    effect: {
      ...(definition.effect ?? {}),
    },
  };
}

function cloneCaseFileDefinition(definition = {}) {
  return {
    ...cloneDefinition(definition),
    unlockStandingId: definition.unlockStandingId ?? null,
    requiredProgress: Math.max(Number(definition.requiredProgress) || 0, 1),
    preferredTags: [...(definition.preferredTags ?? [])],
  };
}

function cloneDirectiveDefinition(definition = {}) {
  return {
    ...definition,
    unlockStandingId: definition.unlockStandingId ?? null,
    requiredProgress: Math.max(Number(definition.requiredProgress) || 0, 1),
    preferredTags: [...(definition.preferredTags ?? [])],
    focusScoreBonus: Math.max(Number(definition.focusScoreBonus) || 0, 0),
    focusRewardBonus: cloneRewardMap(definition.focusRewardBonus),
    reward: cloneRewardMap(definition.reward),
    reputationReward: Math.max(Number(definition.reputationReward) || 0, 0),
    affairsCreditReward: Math.max(Number(definition.affairsCreditReward) || 0, 0),
  };
}

function cloneCommissionEventDefinition(definition = {}) {
  return {
    ...definition,
    tags: [...(definition.tags ?? [])],
    sourceTypes: [...(definition.sourceTypes ?? [])],
    options: (definition.options ?? []).map((option) => ({
      ...option,
      effect: {
        ...option.effect,
        rewardBonus: cloneRewardMap(option.effect?.rewardBonus),
        aftereffect: option.effect?.aftereffect
          ? {
            ...option.effect.aftereffect,
            preferredTags: [...(option.effect.aftereffect.preferredTags ?? [])],
          }
          : null,
      },
    })),
  };
}

function scaleRewardMap(reward = {}, multiplier = 1) {
  return Object.fromEntries(
    Object.entries(reward ?? {})
      .map(([resourceId, amount]) => [resourceId, Math.max(0, Math.round((amount ?? 0) * multiplier))])
      .filter(([, amount]) => amount > 0),
  );
}

function mergeRewardMaps(...rewardMaps) {
  const merged = {};

  for (const reward of rewardMaps) {
    for (const [resourceId, amount] of Object.entries(reward ?? {})) {
      merged[resourceId] = (merged[resourceId] ?? 0) + amount;
    }
  }

  return Object.fromEntries(Object.entries(merged).filter(([, amount]) => amount > 0));
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

function addCount(map, key, amount = 1) {
  if (!key) {
    return;
  }
  map[key] = (map[key] ?? 0) + amount;
}

function buildCommissionTeamProfile(teamSnapshot = {}) {
  const members = [...(teamSnapshot.members ?? [])];
  const stationCounts = {};
  const factionCounts = {};
  const rarityCounts = {};
  const effectTypeCounts = {};

  for (const member of members) {
    addCount(stationCounts, member.station);
    addCount(factionCounts, member.faction);
    addCount(rarityCounts, member.rarity);
    for (const effectType of member.expeditionEffectTypes ?? []) {
      addCount(effectTypeCounts, effectType);
    }
  }

  return {
    members,
    memberCount: members.length,
    stationCounts,
    factionCounts,
    rarityCounts,
    effectTypeCounts,
    bondIds: new Set((teamSnapshot.bonds?.activeBonds ?? []).map((bond) => bond.id).filter(Boolean)),
    uniqueFactionCount: teamSnapshot.bonds?.uniqueFactionCount ?? Object.keys(factionCounts).length,
    totalResonance: teamSnapshot.bonds?.totalResonance ?? members.reduce((sum, member) => sum + (Number(member.resonanceLevel) || 0), 0),
    elderCount: members.filter((member) => member.elder).length,
    legendaryCount: members.filter((member) => member.rarity === 'legendary').length,
  };
}

function matchesAffinity(profile, affinity = {}) {
  const match = affinity.match ?? {};
  const minCount = Math.max(match.minCount ?? 1, 1);

  if (match.stationId && (profile.stationCounts[match.stationId] ?? 0) < minCount) return false;
  if (match.factionId && (profile.factionCounts[match.factionId] ?? 0) < minCount) return false;
  if (match.rarity && (profile.rarityCounts[match.rarity] ?? 0) < minCount) return false;
  if (match.effectType && (profile.effectTypeCounts[match.effectType] ?? 0) < minCount) return false;
  if (match.bondId && !profile.bondIds.has(match.bondId)) return false;
  if ((match.minUniqueFactions ?? 0) > profile.uniqueFactionCount) return false;
  if ((match.minTotalResonance ?? 0) > profile.totalResonance) return false;
  if ((match.minElders ?? 0) > profile.elderCount) return false;
  if ((match.minLegendary ?? 0) > profile.legendaryCount) return false;

  return true;
}

function resolveAffinityMatch(profile, affinity = {}) {
  if (!matchesAffinity(profile, affinity)) {
    return null;
  }

  return {
    id: affinity.id,
    label: affinity.label,
    description: affinity.description,
    score: affinity.score ?? 0,
    reward: cloneRewardMap(affinity.reward),
    match: { ...(affinity.match ?? {}) },
  };
}

function shuffleDefinitions(definitions = []) {
  const next = [...definitions];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function uniqueTags(...tagLists) {
  return [...new Set(tagLists.flatMap((tags) => tags ?? []).filter(Boolean))];
}

function getThemeBiasTags(theme = null, sourceType = 'board') {
  if (!theme) {
    return [];
  }

  return sourceType === 'special'
    ? uniqueTags(theme.preferredTags, theme.specialPreferredTags)
    : uniqueTags(theme.preferredTags);
}

function resolveCommissionThemeEffect(definition = {}, theme = null, sourceType = 'board') {
  if (!theme) {
    return {
      themeApplied: false,
      themeId: null,
      themeName: null,
      themeDescription: null,
      themeMatchedTags: [],
      themeScoreBonus: 0,
      themeRewardBonus: {},
    };
  }

  const definitionTags = new Set(definition.tags ?? []);
  const matchedTags = getThemeBiasTags(theme, sourceType).filter((tag) => definitionTags.has(tag));
  if (!matchedTags.length) {
    return {
      themeApplied: false,
      themeId: theme.id ?? null,
      themeName: theme.name ?? null,
      themeDescription: theme.description ?? null,
      themeMatchedTags: [],
      themeScoreBonus: 0,
      themeRewardBonus: {},
    };
  }

  const scoreBonus = sourceType === 'special'
    ? (theme.specialScoreBonus ?? theme.scoreBonus ?? 0)
    : (theme.scoreBonus ?? 0);
  const rewardBonus = sourceType === 'special'
    ? mergeRewardMaps(theme.rewardBonus, theme.specialRewardBonus)
    : cloneRewardMap(theme.rewardBonus);

  return {
    themeApplied: true,
    themeId: theme.id ?? null,
    themeName: theme.name ?? null,
    themeDescription: theme.description ?? null,
    themeMatchedTags: matchedTags,
    themeScoreBonus: scoreBonus,
    themeRewardBonus: rewardBonus,
  };
}

function getStandingTierBonus(tierId = 'failed') {
  const mapping = {
    perfect: 8,
    success: 6,
    partial: 4,
    failed: 2,
  };
  return mapping[tierId] ?? 2;
}

export function listCommissionDefinitions() {
  return COMMISSION_DEFINITIONS.map((definition) => cloneDefinition(definition));
}

export function listCommissionThemeDefinitions() {
  return COMMISSION_THEME_DEFINITIONS.map((definition) => cloneThemeDefinition(definition));
}

export function listCommissionStandingDefinitions() {
  return COMMISSION_STANDING_DEFINITIONS.map((definition) => cloneStandingDefinition(definition));
}

export function listCommissionMilestoneDefinitions() {
  return COMMISSION_MILESTONE_DEFINITIONS.map((definition) => cloneMilestoneDefinition(definition));
}

export function listCommissionSupplyDefinitions() {
  return COMMISSION_SUPPLY_DEFINITIONS.map((definition) => cloneSupplyDefinition(definition));
}

export function listCommissionAffairsShopDefinitions() {
  return COMMISSION_AFFAIRS_SHOP_DEFINITIONS.map((definition) => cloneAffairsShopDefinition(definition));
}

export function listCommissionCaseFileDefinitions() {
  return COMMISSION_CASE_FILE_DEFINITIONS.map((definition) => cloneCaseFileDefinition(definition));
}

export function listCommissionDirectiveDefinitions() {
  return COMMISSION_DIRECTIVE_DEFINITIONS.map((definition) => cloneDirectiveDefinition(definition));
}

export function listSpecialCommissionDefinitions() {
  return SPECIAL_COMMISSION_DEFINITIONS.map((definition) => cloneDefinition(definition));
}

export function listCommissionEventDefinitions() {
  return COMMISSION_EVENT_DEFINITIONS.map((definition) => cloneCommissionEventDefinition(definition));
}

export function getCommissionDefinition(commissionId) {
  const definition = COMMISSION_DEFINITIONS.find((item) => item.id === commissionId);
  return definition ? cloneDefinition(definition) : null;
}

export function getSpecialCommissionDefinition(commissionId) {
  const definition = SPECIAL_COMMISSION_DEFINITIONS.find((item) => item.id === commissionId);
  return definition ? cloneDefinition(definition) : null;
}

export function getCommissionThemeDefinition(themeId) {
  const definition = COMMISSION_THEME_DEFINITIONS.find((item) => item.id === themeId);
  return definition ? cloneThemeDefinition(definition) : null;
}

export function getCommissionStandingDefinition(standingId) {
  const definition = COMMISSION_STANDING_DEFINITIONS.find((item) => item.id === standingId);
  return definition ? cloneStandingDefinition(definition) : null;
}

export function getCommissionMilestoneDefinition(milestoneId) {
  const definition = COMMISSION_MILESTONE_DEFINITIONS.find((item) => item.id === milestoneId);
  return definition ? cloneMilestoneDefinition(definition) : null;
}

export function getCommissionSupplyDefinition(supplyId) {
  const definition = COMMISSION_SUPPLY_DEFINITIONS.find((item) => item.id === supplyId);
  return definition ? cloneSupplyDefinition(definition) : null;
}

export function getCommissionAffairsShopDefinition(itemId) {
  const definition = COMMISSION_AFFAIRS_SHOP_DEFINITIONS.find((item) => item.id === itemId);
  return definition ? cloneAffairsShopDefinition(definition) : null;
}

export function getCommissionCaseFileDefinition(caseFileId) {
  const definition = COMMISSION_CASE_FILE_DEFINITIONS.find((item) => item.id === caseFileId);
  return definition ? cloneCaseFileDefinition(definition) : null;
}

export function getCommissionDirectiveDefinition(directiveId) {
  const definition = COMMISSION_DIRECTIVE_DEFINITIONS.find((item) => item.id === directiveId);
  return definition ? cloneDirectiveDefinition(definition) : null;
}

export function getCommissionStandingByReputation(reputation = 0) {
  const safeReputation = Math.max(Number(reputation) || 0, 0);
  const current = [...COMMISSION_STANDING_DEFINITIONS]
    .reverse()
    .find((definition) => safeReputation >= (definition.requiredReputation ?? 0))
    ?? COMMISSION_STANDING_DEFINITIONS[0];
  return current ? cloneStandingDefinition(current) : null;
}

export function getNextCommissionStandingByReputation(reputation = 0) {
  const safeReputation = Math.max(Number(reputation) || 0, 0);
  const next = COMMISSION_STANDING_DEFINITIONS.find((definition) => safeReputation < (definition.requiredReputation ?? 0));
  return next ? cloneStandingDefinition(next) : null;
}

export function getCommissionStandingProgress(reputation = 0) {
  const safeReputation = Math.max(Number(reputation) || 0, 0);
  const current = getCommissionStandingByReputation(safeReputation);
  const next = getNextCommissionStandingByReputation(safeReputation);
  const currentFloor = current?.requiredReputation ?? 0;
  const nextTarget = next?.requiredReputation ?? currentFloor;
  const needed = next ? Math.max(nextTarget - currentFloor, 1) : 1;
  const gained = next ? Math.max(safeReputation - currentFloor, 0) : needed;

  return {
    reputation: safeReputation,
    current,
    next,
    currentFloor,
    nextTarget,
    remainingToNext: next ? Math.max(nextTarget - safeReputation, 0) : 0,
    progressPercent: next ? Math.max(0, Math.min(Math.round((gained / needed) * 100), 100)) : 100,
  };
}

export function rollCommissionTheme({ excludeIds = [] } = {}) {
  const exclude = new Set(excludeIds ?? []);
  const candidates = shuffleDefinitions(COMMISSION_THEME_DEFINITIONS.filter((definition) => !exclude.has(definition.id)));
  const picked = candidates[0] ?? COMMISSION_THEME_DEFINITIONS[0] ?? null;
  return picked ? cloneThemeDefinition(picked) : null;
}

export function getCommissionEventTriggerProgress() {
  return COMMISSION_EVENT_TRIGGER_PROGRESS;
}

export function pickCommissionEventDefinition({ definition = {}, sourceType = 'board', usedEventIds = [] } = {}) {
  const used = new Set(usedEventIds ?? []);
  const definitionTags = new Set(definition.tags ?? []);
  const candidates = COMMISSION_EVENT_DEFINITIONS.filter((eventDefinition) => {
    if (used.has(eventDefinition.id)) {
      return false;
    }
    if ((eventDefinition.sourceTypes?.length ?? 0) > 0 && !eventDefinition.sourceTypes.includes(sourceType)) {
      return false;
    }
    return (eventDefinition.tags ?? []).some((tag) => definitionTags.has(tag));
  });

  const picked = shuffleDefinitions(candidates)[0] ?? null;
  return picked ? cloneCommissionEventDefinition(picked) : null;
}

export function getCommissionEventDefinition(eventId) {
  const definition = COMMISSION_EVENT_DEFINITIONS.find((item) => item.id === eventId);
  return definition ? cloneCommissionEventDefinition(definition) : null;
}

export function isCommissionCoolingDown(cooldowns = {}, commissionId, now = Date.now()) {
  return (cooldowns?.[commissionId] ?? 0) > now;
}

export function rollCommissionBoard({
  cooldowns = {},
  excludeIds = [],
  lockedIds = [],
  preferredTags = [],
  boardSize = COMMISSION_BOARD_SIZE,
  now = Date.now(),
} = {}) {
  const exclude = new Set(excludeIds ?? []);
  const locked = new Set(lockedIds ?? []);
  const preferred = new Set(preferredTags ?? []);
  const candidates = shuffleDefinitions(COMMISSION_DEFINITIONS.filter((definition) => !locked.has(definition.id)));
  const favored = candidates.filter((definition) => (definition.tags ?? []).some((tag) => preferred.has(tag)));
  const others = candidates.filter((definition) => !(definition.tags ?? []).some((tag) => preferred.has(tag)));
  const orderedCandidates = [...favored, ...others];
  const readyPreferred = orderedCandidates.filter((definition) => !exclude.has(definition.id) && !isCommissionCoolingDown(cooldowns, definition.id, now));
  const readyExcluded = orderedCandidates.filter((definition) => exclude.has(definition.id) && !isCommissionCoolingDown(cooldowns, definition.id, now));
  const coolingPreferred = orderedCandidates.filter((definition) => !exclude.has(definition.id) && isCommissionCoolingDown(cooldowns, definition.id, now));
  const coolingExcluded = orderedCandidates.filter((definition) => exclude.has(definition.id) && isCommissionCoolingDown(cooldowns, definition.id, now));

  return [...readyPreferred, ...readyExcluded, ...coolingPreferred, ...coolingExcluded]
    .slice(0, Math.max(boardSize, 0))
    .map((definition) => definition.id);
}

export function rollSpecialCommissionDefinition({ excludeIds = [], preferredTags = [] } = {}) {
  const exclude = new Set(excludeIds ?? []);
  const preferred = new Set(preferredTags ?? []);
  const candidates = shuffleDefinitions(SPECIAL_COMMISSION_DEFINITIONS.filter((definition) => !exclude.has(definition.id)));
  const favored = candidates.filter((definition) => (definition.tags ?? []).some((tag) => preferred.has(tag)));
  const others = candidates.filter((definition) => !(definition.tags ?? []).some((tag) => preferred.has(tag)));
  const ordered = [...favored, ...others];
  const picked = ordered[0] ?? SPECIAL_COMMISSION_DEFINITIONS[0] ?? null;
  return picked ? cloneDefinition(picked) : null;
}

export function getCommissionBoardSize() {
  return COMMISSION_BOARD_SIZE;
}

export function getCommissionSpecialRespawnSeconds() {
  return COMMISSION_SPECIAL_RESPAWN_SECONDS;
}

export function getCommissionSpecialOfferLimit() {
  return COMMISSION_SPECIAL_OFFER_LIMIT;
}

export function getCommissionRerollCost() {
  return cloneRewardMap(COMMISSION_REROLL_COST);
}

export function getCommissionRerollCooldownSeconds() {
  return COMMISSION_REROLL_COOLDOWN_SECONDS;
}

export function getCommissionThemeRotationSeconds() {
  return COMMISSION_THEME_ROTATION_SECONDS;
}

export function getCommissionStandingBoardSize(reputation = 0) {
  const standing = getCommissionStandingByReputation(reputation);
  return COMMISSION_BOARD_SIZE + Math.max(standing?.boardSizeBonus ?? 0, 0);
}

export function getCommissionStandingSpecialOfferLimit(reputation = 0) {
  const standing = getCommissionStandingByReputation(reputation);
  return COMMISSION_SPECIAL_OFFER_LIMIT + Math.max(standing?.specialOfferLimitBonus ?? 0, 0);
}

export function getCommissionStandingRerollCost(reputation = 0) {
  const standing = getCommissionStandingByReputation(reputation);
  const discount = Math.max(0, Math.min(standing?.rerollDiscount ?? 0, 0.8));
  return Object.fromEntries(
    Object.entries(COMMISSION_REROLL_COST).map(([resourceId, amount]) => [
      resourceId,
      Math.max(1, Math.round((amount ?? 0) * (1 - discount))),
    ]),
  );
}

export function getCommissionRecoveryCooldownSeconds(resultType = 'complete') {
  return resultType === 'interrupt'
    ? COMMISSION_INTERRUPTION_COOLDOWN_SECONDS
    : COMMISSION_COMPLETION_COOLDOWN_SECONDS;
}

export function calculateCommissionReputationReward(definition = {}, evaluation = {}, options = {}) {
  const standing = options.standing ?? getCommissionStandingByReputation(options.reputation ?? 0);
  const base = Math.max(6, Math.round((evaluation.recommendedScore ?? definition.recommendedScore ?? 200) / 45));
  const tierBonus = getStandingTierBonus(evaluation.tier?.id);
  const sourceBonus = options.sourceType === 'special'
    ? 6
    : (options.sourceType === 'case' ? 10 : 0);
  const themeBonus = evaluation.themeApplied ? 2 : 0;
  const affinityBonus = Math.min(evaluation.matchCount ?? 0, 3);
  const standingBonus = Math.round(base * Math.max(standing?.reputationBonus ?? 0, 0));
  return Math.max(base + tierBonus + sourceBonus + themeBonus + affinityBonus + standingBonus, 1);
}

export function getCommissionSupplyAvailability(definition = {}, standing = null) {
  const requiredStanding = getCommissionStandingDefinition(definition.unlockStandingId ?? '');
  const standingRequirements = listCommissionStandingDefinitions();
  const currentIndex = standingRequirements.findIndex((item) => item.id === standing?.id);
  const requiredIndex = standingRequirements.findIndex((item) => item.id === requiredStanding?.id);
  return {
    requiredStanding,
    unlocked: requiredStanding ? currentIndex >= requiredIndex && requiredIndex >= 0 : true,
  };
}

export function getCommissionAffairsShopAvailability(definition = {}, standing = null, purchasedIds = []) {
  const standingAvailability = getCommissionSupplyAvailability(definition, standing);
  return {
    ...standingAvailability,
    purchased: new Set(purchasedIds ?? []).has(definition.id),
  };
}

export function calculateCommissionCaseFileClueGain(caseFileDefinition = {}, commissionDefinition = {}, options = {}) {
  const caseTags = new Set(caseFileDefinition.preferredTags ?? []);
  const commissionTags = [...new Set(commissionDefinition.tags ?? [])];
  const matchedTagCount = commissionTags.filter((tag) => caseTags.has(tag)).length;
  if (!matchedTagCount) {
    return 0;
  }

  let gain = 1;
  if ((options.sourceType ?? 'board') === 'special') {
    gain += 1;
  }
  if ((options.evaluation?.tier?.id ?? 'failed') === 'perfect') {
    gain += 1;
  }
  return Math.max(gain, 1);
}

export function getCommissionCaseFileAvailability(
  definition = {},
  standing = null,
  progressValue = 0,
  resolvedIds = [],
  offeredIds = [],
) {
  const standingAvailability = getCommissionSupplyAvailability(definition, standing);
  const requiredProgress = Math.max(Number(definition.requiredProgress) || 0, 1);
  const progress = Math.max(Number(progressValue) || 0, 0);
  const resolved = new Set(resolvedIds ?? []).has(definition.id);
  const offered = new Set(offeredIds ?? []).has(definition.id);

  return {
    ...standingAvailability,
    progress,
    requiredProgress,
    remainingProgress: Math.max(requiredProgress - progress, 0),
    progressPercent: Math.min(Math.round((progress / requiredProgress) * 100), 100),
    resolved,
    offered,
    ready: standingAvailability.unlocked && !resolved && progress >= requiredProgress,
  };
}

export function getCommissionCaseFileProgress(progressMap = {}, options = {}) {
  const standing = options.standing ?? null;
  const resolvedIds = options.resolvedIds ?? [];
  const offeredIds = options.offeredIds ?? [];

  return COMMISSION_CASE_FILE_DEFINITIONS.map((definition) => ({
    ...cloneCaseFileDefinition(definition),
    ...getCommissionCaseFileAvailability(
      definition,
      standing,
      progressMap?.[definition.id] ?? 0,
      resolvedIds,
      offeredIds,
    ),
  }));
}

export function getCommissionDirectiveAvailability(definition = {}, standing = null) {
  return getCommissionSupplyAvailability(definition, standing);
}

export function rollCommissionDirectiveDefinitions({
  standing = null,
  excludeIds = [],
  preferredTags = [],
  offerSize = 3,
} = {}) {
  const exclude = new Set(excludeIds ?? []);
  const preferred = new Set(preferredTags ?? []);
  const available = COMMISSION_DIRECTIVE_DEFINITIONS
    .filter((definition) => getCommissionDirectiveAvailability(definition, standing).unlocked)
    .filter((definition) => !exclude.has(definition.id));
  const shuffled = shuffleDefinitions(available);
  const favored = shuffled.filter((definition) => (definition.preferredTags ?? []).some((tag) => preferred.has(tag)));
  const others = shuffled.filter((definition) => !(definition.preferredTags ?? []).some((tag) => preferred.has(tag)));
  const ordered = [...favored, ...others];
  return ordered.slice(0, Math.max(offerSize, 0)).map((definition) => cloneDirectiveDefinition(definition));
}

export function calculateCommissionDirectiveProgressGain(directiveDefinition = {}, commissionDefinition = {}, options = {}) {
  const directiveTags = new Set(directiveDefinition.preferredTags ?? []);
  const commissionTags = [...new Set(commissionDefinition.tags ?? [])];
  const matchedTagCount = commissionTags.filter((tag) => directiveTags.has(tag)).length;
  if (!matchedTagCount) {
    return 0;
  }

  let gain = 1;
  if ((options.sourceType ?? 'board') === 'special') {
    gain += 1;
  }
  if ((options.sourceType ?? 'board') === 'case') {
    gain += 1;
  }
  if ((options.evaluation?.tier?.id ?? 'failed') === 'perfect') {
    gain += 1;
  }
  return Math.max(gain, 1);
}

export function getCommissionAffairsUpgradeEffects(purchasedIds = []) {
  const purchased = new Set(purchasedIds ?? []);
  const aggregate = {
    boardSizeBonus: 0,
    specialOfferLimitBonus: 0,
    rerollDiscountBonus: 0,
    specialRespawnMultiplier: 1,
    affairsCreditBonus: 0,
  };

  for (const definition of COMMISSION_AFFAIRS_SHOP_DEFINITIONS) {
    if (!purchased.has(definition.id)) {
      continue;
    }
    aggregate.boardSizeBonus += Math.max(definition.effect?.boardSizeBonus ?? 0, 0);
    aggregate.specialOfferLimitBonus += Math.max(definition.effect?.specialOfferLimitBonus ?? 0, 0);
    aggregate.rerollDiscountBonus += Math.max(definition.effect?.rerollDiscountBonus ?? 0, 0);
    aggregate.affairsCreditBonus += Math.max(definition.effect?.affairsCreditBonus ?? 0, 0);
    if ((definition.effect?.specialRespawnMultiplier ?? 1) > 0) {
      aggregate.specialRespawnMultiplier *= definition.effect.specialRespawnMultiplier;
    }
  }

  return aggregate;
}

export function calculateCommissionAffairsCreditReward(definition = {}, evaluation = {}, options = {}) {
  const base = Math.max(3, Math.round((evaluation.recommendedScore ?? definition.recommendedScore ?? 200) / 100));
  const tierWeight = {
    perfect: 1.6,
    success: 1.25,
    partial: 1,
    failed: 0.7,
  }[evaluation.tier?.id ?? 'failed'] ?? 1;
  const sourceBonus = options.sourceType === 'special'
    ? 2
    : (options.sourceType === 'case' ? 4 : 0);
  const upgradeBonus = Math.max(options.affairsCreditBonus ?? 0, 0);
  return Math.max(Math.round((base + sourceBonus) * tierWeight * (1 + upgradeBonus)), 1);
}

export function isCommissionMilestoneReached(milestone = {}, progress = {}) {
  const requirements = milestone.requirements ?? {};
  if ((progress.reputation ?? 0) < (requirements.minReputation ?? 0)) return false;
  if ((progress.claimedCount ?? 0) < (requirements.minClaimedCount ?? 0)) return false;
  if ((progress.specialClaimedCount ?? 0) < (requirements.minSpecialClaimedCount ?? 0)) return false;
  return true;
}

export function getCommissionMilestoneProgress(progress = {}, claimedIds = []) {
  const claimed = new Set(claimedIds ?? []);

  return COMMISSION_MILESTONE_DEFINITIONS.map((definition) => {
    const reached = isCommissionMilestoneReached(definition, progress);
    const claimedAlready = claimed.has(definition.id);
    return {
      ...cloneMilestoneDefinition(definition),
      reached,
      claimed: claimedAlready,
      claimable: reached && !claimedAlready,
      remainingReputation: Math.max((definition.requirements?.minReputation ?? 0) - (progress.reputation ?? 0), 0),
      remainingClaimedCount: Math.max((definition.requirements?.minClaimedCount ?? 0) - (progress.claimedCount ?? 0), 0),
      remainingSpecialClaimedCount: Math.max((definition.requirements?.minSpecialClaimedCount ?? 0) - (progress.specialClaimedCount ?? 0), 0),
    };
  });
}

export function evaluateCommissionTeam(teamSnapshot = {}, definition = {}, options = {}) {
  const themeEffect = resolveCommissionThemeEffect(
    definition,
    options.theme ?? null,
    options.sourceType ?? 'board',
  );
  const profile = buildCommissionTeamProfile(teamSnapshot);
  const memberScore = profile.members.reduce((sum, member) => sum + getTeamMemberBaseScore(member), 0);
  const bondScore = (teamSnapshot.bonds?.activeBonds?.length ?? 0) * 70
    + (profile.uniqueFactionCount ?? 0) * 28
    + (profile.totalResonance ?? 0) * 18;
  const matchedAffinities = (definition.affinities ?? [])
    .map((affinity) => resolveAffinityMatch(profile, affinity))
    .filter(Boolean);
  const strategyScore = matchedAffinities.reduce((sum, affinity) => sum + (affinity.score ?? 0), 0);
  const totalScore = Math.round(memberScore + bondScore + strategyScore + (themeEffect.themeScoreBonus ?? 0));
  const recommendedScore = Math.max(definition.recommendedScore ?? 1, 1);
  const scoreRatio = totalScore / recommendedScore;
  const tier = getOutcomeTier(scoreRatio);
  const reward = scaleRewardMap(definition.reward, tier.rewardMultiplier);
  const bonusReward = scaleRewardMap(definition.bonusReward, tier.bonusMultiplier);
  const affinityRewardBase = mergeRewardMaps(...matchedAffinities.map((affinity) => affinity.reward));
  const affinityReward = scaleRewardMap(affinityRewardBase, tier.affinityMultiplier);

  return {
    recommendedScore,
    totalScore,
    scoreRatio,
    memberScore,
    bondScore,
    strategyScore,
    ...themeEffect,
    eventScoreBonus: 0,
    matchedAffinities,
    matchCount: matchedAffinities.length,
    teamProfile: profile,
    tier,
    reward,
    bonusReward,
    affinityReward,
    themeRewardBonus: cloneRewardMap(themeEffect.themeRewardBonus),
    eventRewardBonus: {},
    totalReward: mergeRewardMaps(reward, bonusReward, affinityReward, themeEffect.themeRewardBonus),
  };
}

export function applyCommissionEventOutcome(definition = {}, evaluation = {}, eventOption = {}) {
  const scoreBonus = Number(eventOption.effect?.scoreBonus) || 0;
  const rewardBonus = cloneRewardMap(eventOption.effect?.rewardBonus);
  const totalScore = Math.max(
    (evaluation.memberScore ?? 0)
      + (evaluation.bondScore ?? 0)
      + (evaluation.strategyScore ?? 0)
      + (evaluation.themeScoreBonus ?? 0)
      + (evaluation.eventScoreBonus ?? 0)
      + scoreBonus,
    0,
  );
  const recommendedScore = Math.max(evaluation.recommendedScore ?? definition.recommendedScore ?? 1, 1);
  const scoreRatio = totalScore / recommendedScore;
  const tier = getOutcomeTier(scoreRatio);
  const reward = scaleRewardMap(definition.reward, tier.rewardMultiplier);
  const bonusReward = scaleRewardMap(definition.bonusReward, tier.bonusMultiplier);
  const affinityRewardBase = mergeRewardMaps(...(evaluation.matchedAffinities ?? []).map((affinity) => affinity.reward));
  const affinityReward = scaleRewardMap(affinityRewardBase, tier.affinityMultiplier);
  const mergedEventRewardBonus = mergeRewardMaps(evaluation.eventRewardBonus, rewardBonus);

  return {
    ...evaluation,
    recommendedScore,
    totalScore,
    scoreRatio,
    tier,
    reward,
    bonusReward,
    affinityReward,
    themeRewardBonus: cloneRewardMap(evaluation.themeRewardBonus),
    eventScoreBonus: (evaluation.eventScoreBonus ?? 0) + scoreBonus,
    eventRewardBonus: mergedEventRewardBonus,
    totalReward: mergeRewardMaps(
      reward,
      bonusReward,
      affinityReward,
      evaluation.themeRewardBonus,
      mergedEventRewardBonus,
    ),
  };
}
