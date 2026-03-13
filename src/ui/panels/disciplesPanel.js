import { getExpeditionBondSnapshot } from '../../data/expeditionBonds.js';
import { getDisciplesSnapshot } from '../../systems/disciplesBeastsSystem.js';

function sortByRarity(getRarityRank, left, right) {
  const rankGap = (getRarityRank?.(right.rarity) ?? 0) - (getRarityRank?.(left.rarity) ?? 0);
  if (rankGap !== 0) {
    return rankGap;
  }

  return left.id.localeCompare(right.id);
}

function renderRarityTag(disciple, { getRarityLabel, getRarityTagClass }) {
  return `<span class="tag ${getRarityTagClass?.(disciple.rarity) ?? ''}">${getRarityLabel?.(disciple.rarity) ?? '普通'}</span>`;
}

function renderBatchSummary(batch) {
  if (!batch.length) {
    return '<span>暂无最新批次</span>';
  }

  return batch.map((entry) => `<span>${entry.discipleName}${entry.duplicate ? ` · +${entry.shardReward} 碎片` : ''}</span>`).join('');
}

function renderResonanceSummary(disciple) {
  return `命魂共鸣 ${disciple.resonanceLevel ?? 0}/5 · ${disciple.resonanceTitle ?? '凡躯'}`;
}

function renderProgressionAdviceCard(advice, formatCostSummary) {
  if (!advice) {
    return '';
  }

  return `
    <div class="card">
      <div class="card-title"><strong>推进建议</strong><span class="tag">${advice.tag ?? '当前最赚'}</span></div>
      <div class="muted">${advice.summary ?? '先按当前建议推进。'}</div>
      ${advice.detail ? `<div class="muted">${advice.detail}</div>` : ''}
      ${advice.cost ? `<div class="muted">建议投入：${formatCostSummary(advice.cost)}</div>` : ''}
    </div>
  `;
}

function getFactionLabel(factionOptions, factionId) {
  return factionOptions.find((item) => item.id === factionId)?.label ?? factionId ?? '散修';
}

function buildTeamMembers(disciples, team = {}) {
  const orderedIds = [team.leaderId ?? null, ...(team.supportIds ?? [])].filter(Boolean);
  const seen = new Set();
  return orderedIds
    .filter((discipleId) => {
      if (seen.has(discipleId)) {
        return false;
      }
      seen.add(discipleId);
      return true;
    })
    .map((discipleId) => disciples.find((disciple) => disciple.id === discipleId))
    .filter(Boolean);
}

function formatBondPercent(value) {
  const safeValue = Number(value) || 0;
  const sign = safeValue >= 0 ? '+' : '';
  return `${sign}${Math.round(safeValue * 100)}%`;
}

function getBondEffectLabel(effectType) {
  switch (effectType) {
    case 'battleAttack':
      return '攻势';
    case 'battleDefense':
      return '守势';
    case 'battleSustain':
      return '续航';
    case 'battleLoot':
      return '战利';
    case 'unitPowerMultiplier':
      return '战力';
    default:
      return effectType;
  }
}

function renderBondEffectSummary(effects = []) {
  return effects.map((effect) => `${getBondEffectLabel(effect.type)} ${formatBondPercent(effect.value)}`).join(' · ');
}

function renderBondList(snapshot) {
  if (!snapshot?.activeBonds?.length) {
    return '<div class="muted">当前未激活羁绊</div>';
  }

  return snapshot.activeBonds.map((bond) => `
    <div class="card">
      <div class="card-title"><strong>${bond.name}</strong><span class="tag">${renderBondEffectSummary(bond.effects)}</span></div>
      <div class="muted">${bond.description}</div>
    </div>
  `).join('');
}

function renderTeamNames(teamMembers = [], emptyLabel = '未选择') {
  if (!teamMembers.length) {
    return emptyLabel;
  }

  return teamMembers.map((member) => member.name).join(' · ');
}

function isSameTeam(left, right) {
  return (left?.leaderId ?? null) === (right?.leaderId ?? null)
    && JSON.stringify(left?.supportIds ?? []) === JSON.stringify(right?.supportIds ?? []);
}

export function disciplesPanel(state, registries, deps = {}) {
  const {
    tooltipAttr,
    formatTime,
    formatNumber,
    formatCostSummary,
    getRarityLabel,
    getRarityRank,
    getRarityTagClass,
    uiState,
  } = deps;

  const disciples = getDisciplesSnapshot(state, registries).sort((left, right) => sortByRarity(getRarityRank, left, right));
  const progressionAdvice = disciples.progressionAdvice ?? null;
  const recruitPool = disciples.recruitPool ?? {
    focusId: null,
    availableCount: 0,
    recruitableCount: 0,
    lastRecruit: null,
    lastBatch: [],
    history: [],
    modes: {},
    tokens: [],
    activeBanner: null,
    selectedFactionId: null,
    factionOptions: [],
    shardBalance: 0,
    pity: {
      current: { advancedEpic: 0, advancedLegendary: 0 },
      thresholds: { advancedEpic: 5, advancedLegendary: 10 },
    },
  };
  const owned = disciples.filter((item) => item.owned);
  const recruitable = disciples.filter((item) => item.unlocked && !item.owned);
  const focusDisciple = recruitPool.focusId ? disciples.find((item) => item.id === recruitPool.focusId) : null;
  const selectedFaction = recruitPool.factionOptions.find((item) => item.id === recruitPool.selectedFactionId) ?? null;
  const activeTeam = disciples.expedition ?? {
    leaderId: state.disciples.expeditionTeam?.leaderId ?? null,
    supportIds: [...(state.disciples.expeditionTeam?.supportIds ?? [])],
    members: [],
    bonds: { activeBonds: [], totalResonance: 0, uniqueFactionCount: 0 },
  };
  const pendingTeam = {
    leaderId: uiState?.pendingTeam?.leaderId ?? activeTeam.leaderId ?? null,
    supportIds: [...(uiState?.pendingTeam?.supportIds ?? activeTeam.supportIds ?? [])],
  };
  const pendingMembers = buildTeamMembers(disciples, pendingTeam);
  const pendingBondSnapshot = getExpeditionBondSnapshot(pendingMembers);
  const resonanceReadyCount = owned.filter((item) => item.canAdvanceResonance).length;
  const resonancePriorityTarget = [...owned]
    .filter((item) => item.canAdvanceResonance)
    .sort((left, right) => sortByRarity(getRarityRank, left, right))[0] ?? null;

  return `
    <div class="grid">
      <section class="panel">
        ${renderProgressionAdviceCard(progressionAdvice, formatCostSummary)}
        <div class="panel-title"><h3>仙缘招募</h3><span class="tag">已解锁 ${recruitPool.availableCount} 位</span></div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>普通招募</strong><span class="tag">命魂残片 ${formatNumber?.(recruitPool.shardBalance ?? 0) ?? recruitPool.shardBalance}</span></div>
            <div class="muted">适合补齐已解锁名册，也能稳定刷出重复弟子转化命魂残片。</div>
            <div class="inline-actions">
              <button ${recruitPool.modes.standard?.affordable ? '' : 'disabled'} data-action="recruit-normal" data-count="1" ${tooltipAttr([`花费：${formatCostSummary(recruitPool.modes.standard?.cost)}`, '随机招募 1 次'])}>单抽</button>
              <button ${recruitPool.modes.standard?.tenAffordable ? '' : 'disabled'} data-action="recruit-normal" data-count="10" ${tooltipAttr([`花费：${formatCostSummary(recruitPool.modes.standard?.tenCost)}`, '连续招募 10 次'])}>十连</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title"><strong>高级招募</strong><span class="tag">寻仙令 ${recruitPool.tokens.find((item) => item.resourceId === 'seekImmortalToken')?.owned ?? 0}</span></div>
            <div class="muted">${recruitPool.activeBanner ? `当前轮换：${recruitPool.activeBanner.name} · UP ${recruitPool.activeBanner.upNames.join('、')}` : '当前暂无轮换池'}</div>
            <div class="muted">${recruitPool.activeBanner?.description ?? '偏向高品质弟子。'}</div>
            <div class="muted">保底进度：史诗 ${recruitPool.pity.current.advancedEpic}/${recruitPool.pity.thresholds.advancedEpic} · 传说 ${recruitPool.pity.current.advancedLegendary}/${recruitPool.pity.thresholds.advancedLegendary}</div>
            <div class="inline-actions">
              <button ${recruitPool.modes.advanced?.affordable ? '' : 'disabled'} data-action="recruit-advanced" data-count="1" ${tooltipAttr([`花费：${formatCostSummary(recruitPool.modes.advanced?.cost)}`, '受当前 UP 池影响'])}>单抽</button>
              <button ${recruitPool.modes.advanced?.tenAffordable ? '' : 'disabled'} data-action="recruit-advanced" data-count="10" ${tooltipAttr([`花费：${formatCostSummary(recruitPool.modes.advanced?.tenCost)}`, '十连会逐抽计算保底'])}>十连</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title"><strong>阵营定向池</strong><span class="tag">${selectedFaction?.label ?? '未选择'}</span></div>
            <div class="muted">${selectedFaction?.description ?? '先锁定阵营，再用寻仙令集中抽取该阵营门人。'}</div>
            <div class="inline-actions">
              ${recruitPool.factionOptions.map((faction) => `
                <button class="${recruitPool.selectedFactionId === faction.id ? 'secondary' : 'ghost'}" data-action="set-recruit-faction" data-faction="${faction.id}" ${tooltipAttr([faction.label, faction.description, `当前可抽成员 ${faction.memberCount} 位`])}>${faction.label}</button>
              `).join('') || '<span class="muted">暂无可选阵营</span>'}
            </div>
            <div class="inline-actions">
              <button ${recruitPool.modes.faction?.affordable ? '' : 'disabled'} data-action="recruit-faction" data-count="1" data-faction="${recruitPool.selectedFactionId ?? ''}" ${tooltipAttr([`花费：${formatCostSummary(recruitPool.modes.faction?.cost)}`, selectedFaction ? `锁定阵营：${selectedFaction.label}` : '尚未选择阵营'])}>单抽</button>
              <button ${recruitPool.modes.faction?.tenAffordable ? '' : 'disabled'} data-action="recruit-faction" data-count="10" data-faction="${recruitPool.selectedFactionId ?? ''}" ${tooltipAttr([`花费：${formatCostSummary(recruitPool.modes.faction?.tenCost)}`, selectedFaction ? `锁定阵营：${selectedFaction.label}` : '尚未选择阵营'])}>十连</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title"><strong>天命直收</strong><span class="tag">天命印 ${recruitPool.tokens.find((item) => item.resourceId === 'tianmingSeal')?.owned ?? 0}</span></div>
            <div class="muted">${focusDisciple ? `${focusDisciple.name} · ${focusDisciple.title ?? '已设目标'}` : '尚未设定目标'}</div>
            <div class="muted">${focusDisciple ? (focusDisciple.recruitFlavor ?? focusDisciple.description ?? '已设定定向收录目标。') : '锁定一名候选弟子后，可直接收入门墙。'}</div>
            <div class="inline-actions">
              <button ${recruitPool.modes.targeted?.affordable ? '' : 'disabled'} data-action="recruit-targeted" ${tooltipAttr([focusDisciple ? `目标：${focusDisciple.name}` : '尚未设定目标', `花费：${formatCostSummary(recruitPool.modes.targeted?.cost)}`])}>直接收录</button>
              <button class="ghost" ${focusDisciple ? '' : 'disabled'} data-action="clear-recruit-focus">清除目标</button>
            </div>
          </div>
        </div>
        <div class="grid">
          ${recruitPool.tokens.map((token) => `
            <div class="card" ${tooltipAttr([token.description, `购入花费：${formatCostSummary(token.purchaseCost)}`])}>
              <div class="card-title"><strong>${token.name}</strong><span class="tag">持有 ${token.owned}</span></div>
              <div class="muted">${token.description}</div>
              <div class="inline-actions">
                <button class="ghost" ${token.affordable ? '' : 'disabled'} data-action="buy-recruit-token" data-resource="${token.resourceId}">购入一枚</button>
              </div>
            </div>
          `).join('')}
          <div class="card">
            <div class="card-title"><strong>命魂共鸣</strong><span class="tag">可突破 ${resonanceReadyCount} 位</span></div>
            <div class="muted">重复弟子会转化为命魂残片，可用于提升已入门弟子的共鸣阶位，放大驻守与出征效果。</div>
            <div class="muted">${resonancePriorityTarget ? `优先建议：${resonancePriorityTarget.name} · ${renderResonanceSummary(resonancePriorityTarget)} · 下一次需要 ${formatCostSummary(resonancePriorityTarget.resonanceCost)}` : '当前还没有可继续共鸣的弟子。'}</div>
          </div>
        </div>
        <div class="card">
          <div class="card-title"><strong>本次批次</strong><span class="tag">${recruitPool.lastBatch.length || 0} 抽</span></div>
          <div class="detail-list">${renderBatchSummary(recruitPool.lastBatch)}</div>
        </div>
        ${recruitPool.lastRecruit ? `
          <div class="card">
            <div class="card-title"><strong>最近招募</strong><span class="tag">${recruitPool.lastRecruit.modeLabel}</span></div>
            <div class="muted">${recruitPool.lastRecruit.discipleName}${recruitPool.lastRecruit.duplicate ? ` 转化为 ${recruitPool.lastRecruit.shardReward} 命魂残片` : ' 已收入门墙'}</div>
          </div>
        ` : ''}
      </section>
      <section class="panel">
        <div class="panel-title"><h3>候选名册</h3><span class="tag">未入门 ${recruitPool.recruitableCount} 位</span></div>
        <div class="log-list">
          ${recruitable.length > 0 ? recruitable.map((disciple) => `
            <div class="log-item" ${tooltipAttr([
              disciple.description ?? '暂无描述',
              `稀有度：${getRarityLabel?.(disciple.rarity) ?? '普通'}`,
              disciple.title ?? null,
              disciple.archetype ? `定位：${disciple.archetype}` : null,
              disciple.faction ? `阵营：${getFactionLabel(recruitPool.factionOptions, disciple.faction)}` : null,
              disciple.recruitFlavor ? `招募传闻：${disciple.recruitFlavor}` : null,
              disciple.inspiration ? `角色包装：${disciple.inspiration}` : null,
            ])}>
              <div>
                <div class="card-title">
                  <strong>${disciple.name}</strong>
                  ${renderRarityTag(disciple, { getRarityLabel, getRarityTagClass })}
                </div>
                <div class="muted">${disciple.title ?? '已解锁'}${disciple.archetype ? ` · ${disciple.archetype}` : ''}</div>
                <div class="muted">${getFactionLabel(recruitPool.factionOptions, disciple.faction)} · ${disciple.recruitFlavor ?? disciple.description ?? '暂无招募传闻'}</div>
              </div>
              <div class="inline-actions">
                <button class="${disciple.recruitFocused ? 'secondary' : 'ghost'}" data-action="set-recruit-focus" data-id="${disciple.id}">${disciple.recruitFocused ? '已定向' : '设为目标'}</button>
              </div>
            </div>
          `).join('') : `
            <div class="card">
              <div class="muted">暂无可招募弟子</div>
              <strong>当前解锁弟子已全部入门，可以继续抽取重复角色转化碎片。</strong>
            </div>
          `}
        </div>
      </section>
      <section class="panel">
        <div class="panel-title"><h3>弟子堂</h3><span class="tag">已入门 ${owned.length} 位</span></div>
        <div class="log-list">
          ${owned.length > 0 ? owned.map((disciple) => `
            <div class="log-item" ${tooltipAttr([
              disciple.description ?? '暂无描述',
              `稀有度：${getRarityLabel?.(disciple.rarity) ?? '普通'}`,
              '已入门',
              disciple.title ?? null,
              disciple.archetype ? `定位：${disciple.archetype}` : null,
              disciple.faction ? `阵营：${getFactionLabel(recruitPool.factionOptions, disciple.faction)}` : null,
              disciple.inspiration ? `角色包装：${disciple.inspiration}` : null,
              disciple.stationedAt ? `驻守：${disciple.stationedAt}` : null,
              disciple.cooldownUntil ? `冷却至：${formatTime(disciple.cooldownUntil)}` : null,
              `等级：Lv.${disciple.level}`,
              `培养花费：${formatCostSummary(disciple.trainingCost)}`,
              renderResonanceSummary(disciple),
              `共鸣增幅：+${Math.round((disciple.resonanceBonus ?? 0) * 100)}%`,
              disciple.canAdvanceResonance ? `下次突破：${formatCostSummary(disciple.resonanceCost)}` : '命魂共鸣已满阶',
              `当前倍率：x${(disciple.effectMultiplier ?? 1).toFixed(2)}`,
              disciple.canAdvanceResonance ? `突破后倍率：x${(disciple.nextEffectMultiplier ?? disciple.effectMultiplier ?? 1).toFixed(2)}` : null,
            ])}>
              <div>
                <div class="card-title">
                  <strong>${disciple.name}</strong>
                  ${renderRarityTag(disciple, { getRarityLabel, getRarityTagClass })}
                  <span class="tag">${disciple.resonanceTitle ?? '凡躯'}</span>
                </div>
                <div class="muted">${disciple.title ?? '已入门'}${disciple.archetype ? ` · ${disciple.archetype}` : ''}</div>
                <div class="muted">${getFactionLabel(recruitPool.factionOptions, disciple.faction)} · Lv.${disciple.level} · ${renderResonanceSummary(disciple)} · ${(disciple.elder ? '长老' : (disciple.mode === 'expedition' ? '已出征' : (disciple.stationedAt ? `驻守 ${disciple.stationedAt}` : '待命')))} · x${(disciple.effectMultiplier ?? 1).toFixed(2)}</div>
              </div>
              <div class="inline-actions">
                <button class="ghost" data-action="station-disciple" data-id="${disciple.id}" data-building="${disciple.station ?? ''}">驻守</button>
                <button class="${pendingTeam.leaderId === disciple.id ? 'secondary' : 'ghost'}" data-action="set-leader" data-id="${disciple.id}">主将</button>
                <button class="${pendingTeam.supportIds.includes(disciple.id) ? 'secondary' : 'ghost'}" data-action="toggle-support" data-id="${disciple.id}">副将</button>
                <button class="ghost" ${disciple.canTrain ? '' : 'disabled'} data-action="train-disciple" data-id="${disciple.id}" data-amount="1" ${tooltipAttr([`培养花费：${formatCostSummary(disciple.trainingCost)}`, `当前等级：Lv.${disciple.level}`, `当前倍率：x${(disciple.effectMultiplier ?? 1).toFixed(2)}`])}>培养</button>
                <button class="ghost" ${disciple.canTrain ? '' : 'disabled'} data-action="train-disciple" data-id="${disciple.id}" data-amount="5">x5</button>
                <button class="ghost" ${disciple.canAdvanceResonance ? '' : 'disabled'} data-action="advance-disciple" data-id="${disciple.id}" ${tooltipAttr([
                  renderResonanceSummary(disciple),
                  disciple.canAdvanceResonance ? `突破花费：${formatCostSummary(disciple.resonanceCost)}` : '命魂共鸣已满阶',
                  disciple.canAdvanceResonance ? `倍率提升至：x${(disciple.nextEffectMultiplier ?? disciple.effectMultiplier ?? 1).toFixed(2)}` : null,
                ])}>共鸣突破</button>
                <button ${state.scripture.flags?.elderModeUnlocked ? '' : 'disabled'} data-action="promote-elder" data-id="${disciple.id}">晋升长老</button>
              </div>
            </div>
          `).join('') : `
            <div class="card">
              <div class="muted">当前没有已入门弟子</div>
              <strong>先通过招募池收录弟子，才能参与驻守、培养与出征。</strong>
            </div>
          `}
        </div>
      </section>
      <section class="panel">
        <div class="panel-title"><h3>出征羁绊</h3><span class="tag">最多 1 主将 + 2 副将</span></div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>当前生效队伍</strong><span class="tag">${activeTeam.members.length} / 3</span></div>
            <div class="muted">主将：${activeTeam.leaderId ? (disciples.find((item) => item.id === activeTeam.leaderId)?.name ?? activeTeam.leaderId) : '未选择'}</div>
            <div class="muted">副将：${renderTeamNames(activeTeam.members.filter((member) => member.id !== activeTeam.leaderId), '未选择')}</div>
            <div class="muted">阵营数 ${activeTeam.bonds?.uniqueFactionCount ?? 0} · 总共鸣 ${activeTeam.bonds?.totalResonance ?? 0}</div>
            <div class="grid">
              ${renderBondList(activeTeam.bonds)}
            </div>
          </div>
          <div class="card">
            <div class="card-title"><strong>待应用预览</strong><span class="tag">${pendingMembers.length} / 3</span></div>
            <div class="muted">成员：${renderTeamNames(pendingMembers)}</div>
            <div class="muted">阵营数 ${pendingBondSnapshot.uniqueFactionCount} · 总共鸣 ${pendingBondSnapshot.totalResonance}</div>
            <div class="grid">
              ${renderBondList(pendingBondSnapshot)}
            </div>
            <div class="inline-actions">
              <button class="secondary" data-action="apply-team" ${pendingMembers.length ? '' : 'disabled'}>应用出征队</button>
              <span class="muted">${isSameTeam(pendingTeam, activeTeam) ? '当前预览与已生效队伍一致' : '切换队伍后，新的羁绊会立刻影响战斗结算'}</span>
            </div>
          </div>
        </div>
        ${recruitPool.history.length ? `
          <div class="card">
            <div class="card-title"><strong>招募记录</strong><span class="tag">最近 ${recruitPool.history.length} 次</span></div>
            <div class="detail-list">
              ${recruitPool.history.map((entry) => `<span>${entry.modeLabel} · ${entry.discipleName}${entry.duplicate ? ` · +${entry.shardReward} 碎片` : ''}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </section>
    </div>
  `;
}
