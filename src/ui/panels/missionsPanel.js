import { getCommissionSnapshot } from '../../systems/commissionSystem.js';

function renderRewardSummary(reward = {}, formatCostSummary) {
  return Object.keys(reward ?? {}).length ? formatCostSummary(reward) : '暂无';
}

function renderProgressPercent(active) {
  const total = Math.max(active?.durationSeconds ?? 1, 1);
  const remaining = Math.max(active?.remainingSeconds ?? total, 0);
  const elapsed = total - remaining;
  return Math.max(0, Math.min(Math.round((elapsed / total) * 100), 100));
}

function renderTeamNames(teamSnapshot = {}) {
  const members = teamSnapshot.members ?? [];
  return members.length ? members.map((member) => member.name).join(' · ') : '未配置出征队';
}

function renderAffinitySummary(evaluation = {}) {
  const affinities = evaluation?.matchedAffinities ?? [];
  return affinities.length ? affinities.map((affinity) => affinity.label).join(' · ') : '暂无定向加成';
}

function renderMissionSourceLabel(mission = {}) {
  if (mission.sourceType === 'special') {
    return '限时诏令';
  }
  if (mission.sourceType === 'case') {
    return '卷宗悬案';
  }
  return mission.evaluation?.tier?.label ?? '待定';
}

function renderHistoryLabel(mission = {}, formatCostSummary) {
  if (mission.resultType === 'interrupted') {
    return `中断撤回 · 进度 ${Math.round(renderProgressPercent(mission))}%`;
  }

  const sourceLabel = renderMissionSourceLabel(mission);
  const reputation = mission.reputationReward ? ` · 声望 +${mission.reputationReward}` : '';
  return `${sourceLabel} · 奖励 ${renderRewardSummary(mission.evaluation?.totalReward, formatCostSummary)}${reputation}`;
}

function renderAftereffectSummary(aftereffect = {}) {
  const parts = [];
  if ((aftereffect.remainingBoardRefreshes ?? 0) > 0) {
    parts.push(`影响榜单 ${aftereffect.remainingBoardRefreshes} 次`);
  }
  if ((aftereffect.remainingSpecialSpawns ?? 0) > 0) {
    parts.push(`影响诏令 ${aftereffect.remainingSpecialSpawns} 次`);
  }
  return parts.join(' · ') || '即将消散';
}

function renderEventEffectSummary(option = {}, formatCostSummary) {
  const parts = [];
  const multiplier = Number(option.effect?.remainingSecondsMultiplier) || 1;
  if (multiplier < 1) {
    parts.push(`加快委托 ${Math.round((1 - multiplier) * 100)}%`);
  } else if (multiplier > 1) {
    parts.push(`延长委托 ${Math.round((multiplier - 1) * 100)}%`);
  }
  if ((option.effect?.scoreBonus ?? 0) > 0) {
    parts.push(`完成度 +${option.effect.scoreBonus}`);
  }
  const rewardBonus = renderRewardSummary(option.effect?.rewardBonus, formatCostSummary);
  if (rewardBonus !== '暂无') {
    parts.push(`额外收益 ${rewardBonus}`);
  }
  return parts.join(' · ') || '无额外效果';
}

function renderThemeTagSummary(theme = {}) {
  const boardTags = (theme.preferredTags ?? []).join(' · ') || '无';
  const specialTags = (theme.specialPreferredTags ?? []).join(' · ') || boardTags;
  return `榜单偏向 ${boardTags} / 诏令偏向 ${specialTags}`;
}

function renderThemeBonusSummary(theme = {}, formatCostSummary) {
  const parts = [];
  if ((theme.scoreBonus ?? 0) > 0) {
    parts.push(`榜单评分 +${theme.scoreBonus}`);
  }
  if ((theme.specialScoreBonus ?? 0) > 0) {
    parts.push(`诏令评分 +${theme.specialScoreBonus}`);
  }
  const rewardBonus = renderRewardSummary(theme.rewardBonus, formatCostSummary);
  if (rewardBonus !== '暂无') {
    parts.push(`榜单加赠 ${rewardBonus}`);
  }
  const specialRewardBonus = renderRewardSummary(theme.specialRewardBonus, formatCostSummary);
  if (specialRewardBonus !== '暂无') {
    parts.push(`诏令加赠 ${specialRewardBonus}`);
  }
  return parts.join(' · ') || '当前无额外风向加成';
}

function renderEvaluationThemeSummary(evaluation = {}, formatCostSummary) {
  if (!evaluation?.themeApplied) {
    return '当前风向未命中本委托标签';
  }

  const parts = [`风向 ${evaluation.themeName ?? '未知'}`];
  if ((evaluation.themeMatchedTags?.length ?? 0) > 0) {
    parts.push(`命中 ${evaluation.themeMatchedTags.join(' · ')}`);
  }
  if ((evaluation.themeScoreBonus ?? 0) > 0) {
    parts.push(`评分 +${evaluation.themeScoreBonus}`);
  }
  const rewardBonus = renderRewardSummary(evaluation.themeRewardBonus, formatCostSummary);
  if (rewardBonus !== '暂无') {
    parts.push(`加赠 ${rewardBonus}`);
  }
  return parts.join(' · ');
}

function renderBiasTag(item = {}) {
  const biasSources = [];
  if (item.favoredByTheme) {
    biasSources.push('风向');
  }
  if (item.favoredByAftereffect) {
    biasSources.push('余波');
  }
  return biasSources.length ? `${biasSources.join(' / ')}偏向` : null;
}

function renderStandingSummary(standing = {}) {
  if (!standing.current) {
    return '当前未建立委托阶位';
  }

  const parts = [
    `榜单 ${standing.boardSize ?? 0} 项`,
    `诏令上限 ${standing.specialOfferLimit ?? 0}`,
    `累计结算 ${standing.claimedCount ?? 0} 次`,
  ];
  if ((standing.specialClaimedCount ?? 0) > 0) {
    parts.push(`限时诏令 ${standing.specialClaimedCount} 次`);
  }
  return parts.join(' · ');
}

function renderStandingProgress(standing = {}) {
  if (!standing.next) {
    return '已达到当前委托阶位上限';
  }

  return `距 ${standing.next.name} 还差 ${standing.remainingToNext ?? 0} 声望`;
}

function renderReputationReward(value = 0) {
  return value > 0 ? `声望 +${value}` : '暂无声望收益';
}

function renderAffairsCreditReward(value = 0) {
  return value > 0 ? `事务点 +${value}` : '暂无事务点收益';
}

function renderMilestoneRequirementSummary(milestone = {}) {
  const requirements = [];
  if ((milestone.requirements?.minReputation ?? 0) > 0) {
    requirements.push(`声望 ${milestone.requirements.minReputation}`);
  }
  if ((milestone.requirements?.minClaimedCount ?? 0) > 0) {
    requirements.push(`累计结算 ${milestone.requirements.minClaimedCount} 次`);
  }
  if ((milestone.requirements?.minSpecialClaimedCount ?? 0) > 0) {
    requirements.push(`限时诏令 ${milestone.requirements.minSpecialClaimedCount} 次`);
  }
  return requirements.join(' · ') || '无额外条件';
}

function renderMilestoneRemainingSummary(milestone = {}) {
  if (milestone.claimed) {
    return '已领取';
  }
  if (milestone.claimable) {
    return '已达成，可立即领取';
  }

  const remaining = [];
  if ((milestone.remainingReputation ?? 0) > 0) {
    remaining.push(`还差 ${milestone.remainingReputation} 声望`);
  }
  if ((milestone.remainingClaimedCount ?? 0) > 0) {
    remaining.push(`再结算 ${milestone.remainingClaimedCount} 次`);
  }
  if ((milestone.remainingSpecialClaimedCount ?? 0) > 0) {
    remaining.push(`再完成 ${milestone.remainingSpecialClaimedCount} 次限时诏令`);
  }
  return remaining.join(' · ') || '尚未达成';
}

function renderSupplyEffectSummary(supply = {}, formatCostSummary) {
  const effect = supply.effect ?? {};
  if (effect.type === 'expedite') {
    const activeCut = Math.round((1 - (Number(effect.activeRemainingMultiplier) || 1)) * 100);
    const nextCut = Math.round((1 - (Number(effect.nextDurationMultiplier) || 1)) * 100);
    return `当前委托可加急 ${activeCut}% / 下一次委托缩短 ${nextCut}%`;
  }
  if (effect.type === 'bounty') {
    return `追加赏格 ${renderRewardSummary(effect.nextRewardBonus, formatCostSummary)}，并提高下一次委托完成度`;
  }
  if (effect.type === 'special-intel') {
    return `提前 ${effect.specialSpawnAdvanceSeconds ?? 0} 秒拉近下一道限时诏令`;
  }
  return '补给效果待定';
}

function renderPreparationBoostSummary(boost = {}, formatCostSummary) {
  const parts = [];
  if ((Number(boost.durationMultiplier) || 1) < 1) {
    parts.push(`时长缩短 ${Math.round((1 - boost.durationMultiplier) * 100)}%`);
  }
  if ((Number(boost.scoreBonus) || 0) > 0) {
    parts.push(`完成度 +${boost.scoreBonus}`);
  }
  const rewardBonus = renderRewardSummary(boost.rewardBonus, formatCostSummary);
  if (rewardBonus !== '暂无') {
    parts.push(`额外赏格 ${rewardBonus}`);
  }
  return parts.join(' · ') || '暂无筹备增益';
}

function renderShopEffectSummary(item = {}) {
  const effect = item.effect ?? {};
  const parts = [];
  if ((effect.boardSizeBonus ?? 0) > 0) {
    parts.push(`委托榜单 +${effect.boardSizeBonus}`);
  }
  if ((effect.specialOfferLimitBonus ?? 0) > 0) {
    parts.push(`诏令上限 +${effect.specialOfferLimitBonus}`);
  }
  if ((effect.rerollDiscountBonus ?? 0) > 0) {
    parts.push(`刷新折扣 ${Math.round(effect.rerollDiscountBonus * 100)}%`);
  }
  if ((effect.affairsCreditBonus ?? 0) > 0) {
    parts.push(`事务点收益 +${Math.round(effect.affairsCreditBonus * 100)}%`);
  }
  if ((effect.specialRespawnMultiplier ?? 1) < 1) {
    parts.push(`诏令刷新加快 ${Math.round((1 - effect.specialRespawnMultiplier) * 100)}%`);
  }
  return parts.join(' · ') || '长期效果待定';
}

function renderCaseFileStatus(caseFile = {}) {
  if (caseFile.resolved) {
    return '已结案';
  }
  if (caseFile.pendingClaim) {
    return '待领取';
  }
  if (caseFile.active) {
    return '追查中';
  }
  if (caseFile.instanceId) {
    return '可派遣';
  }
  if (!caseFile.unlocked) {
    return `需 ${caseFile.requiredStanding?.name ?? '更高阶位'}`;
  }
  return '搜证中';
}

function renderCaseFileProgressSummary(caseFile = {}) {
  if (caseFile.resolved) {
    return '该卷宗已归档结案，不会再次出现在执务堂。';
  }
  if (caseFile.pendingClaim) {
    return '悬案已侦破，结案奖励会在待结算列表中领取。';
  }
  if (caseFile.active) {
    return '当前队伍正在顺着现有线索追查此案。';
  }
  if (!caseFile.unlocked) {
    return `需达到 ${caseFile.requiredStanding?.name ?? '更高阶位'} 后才能发起结案行动。`;
  }
  if (caseFile.instanceId) {
    return '线索已齐备，可立即派出队伍追查悬案。';
  }
  return `还需 ${caseFile.remainingProgress ?? 0} 点线索才能显化悬案。`;
}

function renderAutoDispatchSummary(autoDispatch = {}) {
  if (!autoDispatch.enabled) {
    return '当前保持手动委派，你可以随时切换为自动排程。';
  }

  return autoDispatch.currentMode?.description ?? '已开启自动排程。';
}

function renderAutoDispatchStateLine(autoDispatch = {}) {
  if (!autoDispatch.enabled) {
    return '自动结算、自动派遣与自动抉择均处于停用状态。';
  }

  return `自动结算 ${autoDispatch.autoClaim ? '开启' : '关闭'} · 途中事件自动抉择 ${autoDispatch.autoResolveEvents ? '开启' : '关闭'}`;
}

function renderSpecialOfferCard(offer, deps = {}) {
  const {
    tooltipAttr,
    formatNumber,
    formatCostSummary,
    formatTime,
  } = deps;
  const biasTag = renderBiasTag(offer);

  return `
    <div class="card" ${tooltipAttr([
      offer.description,
      `事件：${offer.eventLabel ?? '限时诏令'}`,
      `剩余存在时间：${offer.expiresInSeconds} 秒`,
      `推荐评分：${offer.recommendedScore}`,
      `定向专长：${renderAffinitySummary(offer.evaluation)}`,
      `风向加成：${renderEvaluationThemeSummary(offer.evaluation, formatCostSummary)}`,
      `声望收益：${renderReputationReward(offer.reputationReward)}`,
      `事务点收益：${renderAffairsCreditReward(offer.affairsCreditReward)}`,
      `基础奖励：${renderRewardSummary(offer.reward, formatCostSummary)}`,
      `额外奖励：${renderRewardSummary(offer.bonusReward, formatCostSummary)}`,
      `定向奖励：${renderRewardSummary(offer.evaluation?.affinityReward, formatCostSummary)}`,
    ])}>
      <div class="card-title">
        <strong>${offer.name}</strong>
        <span class="tag">${biasTag ?? (offer.eventLabel ?? '限时诏令')}</span>
      </div>
      <div class="muted">${offer.description}</div>
      <div class="detail-list">
        <span>剩余 ${offer.expiresInSeconds} 秒</span>
        <span>推荐评分 ${offer.recommendedScore}</span>
        <span>队伍评分 ${offer.evaluation?.totalScore ?? 0}</span>
        <span>专长加分 +${formatNumber(offer.evaluation?.strategyScore ?? 0)}</span>
      </div>
      <div class="muted">${offer.eventLabel ?? '限时诏令'} · ${biasTag ?? '自然出现'}</div>
      <div class="muted">专长命中：${renderAffinitySummary(offer.evaluation)}</div>
      <div class="muted">风向加成：${renderEvaluationThemeSummary(offer.evaluation, formatCostSummary)}</div>
      <div class="muted">${renderReputationReward(offer.reputationReward)}</div>
      <div class="muted">${renderAffairsCreditReward(offer.affairsCreditReward)}</div>
      <div class="muted">预计收益：${renderRewardSummary(offer.evaluation?.totalReward, formatCostSummary)}</div>
      <div class="muted">${offer.canStart ? `存在至 ${formatTime(offer.expiresAt)}` : '当前无法接取该限时诏令'}</div>
      <div class="inline-actions">
        <button ${offer.canStart ? '' : 'disabled'} data-action="start-commission" data-id="${offer.instanceId}" data-source-type="special">接取限时诏令</button>
      </div>
    </div>
  `;
}

export function missionsPanel(state, registries, deps = {}) {
  const {
    tooltipAttr,
    formatNumber,
    formatTime,
    formatCostSummary,
  } = deps;
  const missions = getCommissionSnapshot(state, registries);
  const active = missions.active;
  const currentTheme = missions.currentTheme;
  const standing = missions.standing;
  const milestones = missions.milestones ?? [];
  const supplies = missions.supplies ?? [];
  const affairsShop = missions.affairsShop ?? [];
  const caseFiles = missions.caseFiles ?? [];
  const autoDispatch = missions.autoDispatch ?? {};
  const preparationBoost = missions.preparationBoost ?? null;
  const progressPercent = renderProgressPercent(active);
  const readyCount = missions.available.filter((mission) => !mission.coolingDown).length;
  const readyCaseCount = caseFiles.filter((caseFile) => Boolean(caseFile.instanceId)).length;
  const pendingEvent = active?.eventState?.pendingEvent ?? null;
  const aftereffect = missions.aftereffect ?? null;

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>宗门委托</h3><span class="tag">${active ? '执行中' : '待派遣'}</span></div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>当前出征阵</strong><span class="tag">${missions.teamSnapshot.members.length} / 3</span></div>
            <div class="muted">成员：${renderTeamNames(missions.teamSnapshot)}</div>
            <div class="muted">羁绊：${missions.teamSnapshot.bonds?.activeBonds?.map((bond) => bond.name).join(' · ') || '未激活'}</div>
            <div class="muted">阵营 ${missions.teamSnapshot.bonds?.uniqueFactionCount ?? 0} · 总共鸣 ${missions.teamSnapshot.bonds?.totalResonance ?? 0}</div>
            <div class="inline-actions">
              <button class="ghost" data-action="switch-tab" data-tab="disciples">前往弟子页调阵</button>
            </div>
          </div>

          <div class="card">
            <div class="card-title"><strong>委派阶位</strong><span class="tag">${standing.current?.name ?? '未定'}</span></div>
            <div class="muted">当前声望 ${standing.reputation ?? 0} · 进度 ${standing.progressPercent ?? 0}%</div>
            <div class="muted">事务点 ${standing.affairsCredit ?? 0}</div>
            <div class="war-progress-track"><span class="war-progress-fill ally" style="width:${standing.progressPercent ?? 0}%"></span></div>
            <div class="muted">${standing.current?.description ?? '暂无阶位说明'}</div>
            <div class="muted">${standing.current?.perkSummary ?? renderStandingSummary(standing)}</div>
            <div class="muted">${renderStandingProgress(standing)}</div>
          </div>

          <div class="card">
            <div class="card-title"><strong>榜单调度</strong><span class="tag">${readyCount} / ${missions.available.length} 可接</span></div>
            <div class="muted">刷新消耗：${renderRewardSummary(missions.reroll.cost, formatCostSummary)}</div>
            <div class="muted">${renderStandingSummary(standing)}</div>
            <div class="muted">${missions.reroll.remainingSeconds > 0 ? `冷却至 ${formatTime(missions.reroll.cooldownUntil)}` : '当前可立即刷新榜单'}</div>
            <div class="muted">${missions.reroll.affordable ? '刷新只影响常驻委托榜，限时诏令会按自己的时间轴刷新。' : '当前资源不足，无法刷新榜单。'}</div>
            <div class="inline-actions">
              <button ${missions.reroll.canReroll && missions.reroll.affordable ? '' : 'disabled'} data-action="reroll-commission-board">刷新榜单</button>
            </div>
          </div>

          <div class="card">
            <div class="card-title"><strong>委托排程</strong><span class="tag">${autoDispatch.enabled ? (autoDispatch.currentMode?.name ?? '已启用') : '手动'}</span></div>
            <div class="muted">${renderAutoDispatchSummary(autoDispatch)}</div>
            <div class="muted">${renderAutoDispatchStateLine(autoDispatch)}</div>
            <div class="muted">当前优先级：${autoDispatch.currentMode?.name ?? '未定'} · 已解锁悬案 ${readyCaseCount} 宗</div>
            <div class="inline-actions">
              <button data-action="toggle-commission-auto-dispatch">${autoDispatch.enabled ? '关闭排程' : '开启排程'}</button>
              <button class="ghost" data-action="cycle-commission-auto-priority">切换优先级</button>
              <button class="ghost" data-action="toggle-commission-auto-resolve-events">${autoDispatch.autoResolveEvents ? '事件自动' : '事件手动'}</button>
            </div>
          </div>

          <div class="card">
            <div class="card-title"><strong>执行状态</strong><span class="tag">${active ? `${progressPercent}%` : '空闲'}</span></div>
            ${active ? `
              <div class="muted">${active.sourceType === 'board' ? '常驻委托' : renderMissionSourceLabel(active)} · ${active.sourceType === 'special' ? (active.eventLabel ?? '紧急令') : active.name}</div>
              <div class="war-progress-track"><span class="war-progress-fill ally" style="width:${progressPercent}%"></span></div>
              <div class="detail-list">
                <span>剩余 ${Math.ceil(active.remainingSeconds ?? 0)} 秒</span>
                <span>队伍评分 ${active.evaluation?.totalScore ?? 0}</span>
                <span>评级 ${active.evaluation?.tier?.label ?? '待定'}</span>
              </div>
              <div class="muted">专长命中：${renderAffinitySummary(active.evaluation)}</div>
              <div class="muted">风向加成：${renderEvaluationThemeSummary(active.evaluation, formatCostSummary)}</div>
              <div class="muted">${renderReputationReward(active.reputationReward)}</div>
              <div class="muted">${renderAffairsCreditReward(active.affairsCreditReward)}</div>
              <div class="muted">预计收益：${renderRewardSummary(active.evaluation?.totalReward, formatCostSummary)}</div>
              <div class="muted">途中抉择：${active.eventState?.resolvedEvents?.length ? active.eventState.resolvedEvents.map((entry) => `${entry.eventName} / ${entry.optionLabel}`).join(' · ') : '尚未触发'}</div>
              <div class="inline-actions">
                <button class="secondary" data-action="cancel-commission">中断委托</button>
              </div>
            ` : `
              <div class="muted">当前没有进行中的委托。配置出征队后，可以派队进行挂机委托。</div>
            `}
          </div>
        </div>
      </section>

      ${currentTheme ? `
        <section class="panel">
          <div class="panel-title"><h3>宗门风向</h3><span class="tag">剩余 ${currentTheme.expiresInSeconds} 秒</span></div>
          <div class="card">
            <div class="card-title"><strong>${currentTheme.name}</strong><span class="tag">全局主题</span></div>
            <div class="muted">${currentTheme.description}</div>
            <div class="muted">${currentTheme.effectSummary ?? '当前风向会持续影响委托榜与限时诏令的生成。'}</div>
            <div class="muted">${renderThemeTagSummary(currentTheme)}</div>
            <div class="muted">${renderThemeBonusSummary(currentTheme, formatCostSummary)}</div>
          </div>
        </section>
      ` : ''}

      <section class="panel">
        <div class="panel-title"><h3>卷宗悬案</h3><span class="tag">${readyCaseCount ? `${readyCaseCount} 宗待破` : '持续搜证中'}</span></div>
        <div class="grid">
          ${caseFiles.map((caseFile) => `
            <div class="card" ${tooltipAttr([
              caseFile.description,
              `线索来源：${(caseFile.preferredTags ?? []).join(' · ') || '无'}`,
              `当前线索：${caseFile.progress ?? 0} / ${caseFile.requiredProgress ?? 0}`,
              `推荐评分：${caseFile.recommendedScore ?? 0}`,
              `预估声望：${renderReputationReward(caseFile.reputationReward)}`,
              `预估事务点：${renderAffairsCreditReward(caseFile.affairsCreditReward)}`,
              `基础奖励：${renderRewardSummary(caseFile.reward, formatCostSummary)}`,
              `额外奖励：${renderRewardSummary(caseFile.bonusReward, formatCostSummary)}`,
              caseFile.unlocked ? null : `解锁阶位：${caseFile.requiredStanding?.name ?? '未定'}`,
            ])}>
              <div class="card-title"><strong>${caseFile.name}</strong><span class="tag">${renderCaseFileStatus(caseFile)}</span></div>
              <div class="muted">${caseFile.description}</div>
              <div class="muted">线索来源：${(caseFile.preferredTags ?? []).join(' · ') || '无'}</div>
              <div class="war-progress-track"><span class="war-progress-fill ally" style="width:${caseFile.progressPercent ?? 0}%"></span></div>
              <div class="detail-list">
                <span>线索 ${caseFile.progress ?? 0} / ${caseFile.requiredProgress ?? 0}</span>
                <span>推荐评分 ${caseFile.recommendedScore ?? 0}</span>
                <span>队伍评分 ${caseFile.evaluation?.totalScore ?? 0}</span>
                <span>评级 ${caseFile.evaluation?.tier?.label ?? '待定'}</span>
              </div>
              <div class="muted">${renderCaseFileProgressSummary(caseFile)}</div>
              <div class="muted">预计收益：${renderRewardSummary(caseFile.evaluation?.totalReward, formatCostSummary)}</div>
              <div class="muted">${renderReputationReward(caseFile.reputationReward)} · ${renderAffairsCreditReward(caseFile.affairsCreditReward)}</div>
              <div class="inline-actions">
                <button ${caseFile.canStart ? '' : 'disabled'} data-action="start-commission" data-id="${caseFile.instanceId ?? ''}" data-source-type="case">
                  ${caseFile.resolved ? '已结案' : (caseFile.instanceId ? '追查悬案' : '继续搜证')}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h3>委派补给局</h3><span class="tag">${supplies.filter((item) => item.unlocked).length} 项可用</span></div>
        ${preparationBoost ? `
          <div class="card">
            <div class="card-title"><strong>已备下轮补给</strong><span class="tag">${preparationBoost.name ?? '筹备加持'}</span></div>
            <div class="muted">${preparationBoost.description ?? '下一次委托会继承当前补给效果。'}</div>
            <div class="muted">${renderPreparationBoostSummary(preparationBoost, formatCostSummary)}</div>
          </div>
        ` : ''}
        <div class="grid">
          ${supplies.map((supply) => `
            <div class="card" ${tooltipAttr([
              supply.description,
              `作用目标：${supply.targetLabel}`,
              `花费：${renderRewardSummary(supply.cost, formatCostSummary)}`,
              `效果：${renderSupplyEffectSummary(supply, formatCostSummary)}`,
              supply.unlocked ? null : `解锁阶位：${supply.requiredStanding?.name ?? '未定'}`,
            ])}>
              <div class="card-title"><strong>${supply.name}</strong><span class="tag">${supply.unlocked ? supply.targetLabel : `需 ${supply.requiredStanding?.name ?? '更高阶位'}`}</span></div>
              <div class="muted">${supply.description}</div>
              <div class="muted">效果：${renderSupplyEffectSummary(supply, formatCostSummary)}</div>
              <div class="muted">花费：${renderRewardSummary(supply.cost, formatCostSummary)}</div>
              <div class="muted">${supply.unlocked ? (supply.affordable ? '当前资源足够，可立即调拨。' : '资源不足，暂时无法调拨。') : `达到 ${supply.requiredStanding?.name ?? '更高阶位'} 后开放。`}</div>
              <div class="inline-actions">
                <button ${supply.unlocked && supply.affordable ? '' : 'disabled'} data-action="purchase-commission-supply" data-id="${supply.id}">调拨补给</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h3>事务商店</h3><span class="tag">${standing.affairsCredit ?? 0} 点</span></div>
        <div class="grid">
          ${affairsShop.map((item) => `
            <div class="card" ${tooltipAttr([
              item.description,
              `长期效果：${renderShopEffectSummary(item)}`,
              `价格：${item.cost ?? 0} 事务点`,
              item.unlocked ? null : `解锁阶位：${item.requiredStanding?.name ?? '更高阶位'}`,
            ])}>
              <div class="card-title"><strong>${item.name}</strong><span class="tag">${item.purchased ? '已购置' : `${item.cost ?? 0} 点`}</span></div>
              <div class="muted">${item.description}</div>
              <div class="muted">长期效果：${renderShopEffectSummary(item)}</div>
              <div class="muted">${item.unlocked ? (item.affordable ? '事务点足够，可立即购置。' : '事务点不足，继续结算委托即可。') : `达到 ${item.requiredStanding?.name ?? '更高阶位'} 后开放。`}</div>
              <div class="inline-actions">
                <button ${item.unlocked && item.affordable && !item.purchased ? '' : 'disabled'} data-action="purchase-commission-shop-item" data-id="${item.id}">
                  ${item.purchased ? '已购置' : '购置强化'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h3>委派奖励册</h3><span class="tag">${milestones.filter((item) => item.claimable).length} 可领</span></div>
        <div class="grid">
          ${milestones.map((milestone) => `
            <div class="card" ${tooltipAttr([
              milestone.description,
              `达成条件：${renderMilestoneRequirementSummary(milestone)}`,
              `当前状态：${renderMilestoneRemainingSummary(milestone)}`,
              `奖励：${renderRewardSummary(milestone.reward, formatCostSummary)}`,
            ])}>
              <div class="card-title"><strong>${milestone.name}</strong><span class="tag">${milestone.claimed ? '已领取' : (milestone.claimable ? '可领取' : '推进中')}</span></div>
              <div class="muted">${milestone.description}</div>
              <div class="muted">达成条件：${renderMilestoneRequirementSummary(milestone)}</div>
              <div class="muted">奖励：${renderRewardSummary(milestone.reward, formatCostSummary)}</div>
              <div class="muted">${renderMilestoneRemainingSummary(milestone)}</div>
              <div class="inline-actions">
                <button ${milestone.claimable ? '' : 'disabled'} data-action="claim-commission-milestone" data-id="${milestone.id}">
                  ${milestone.claimed ? '已领取' : '领取奖励'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      ${aftereffect ? `
        <section class="panel">
          <div class="panel-title"><h3>委托余波</h3><span class="tag">${renderAftereffectSummary(aftereffect)}</span></div>
          <div class="card">
            <div class="card-title"><strong>${aftereffect.label}</strong><span class="tag">${aftereffect.sourceEventName ?? '途中事件'}</span></div>
            <div class="muted">${aftereffect.description}</div>
            <div class="muted">偏向标签：${(aftereffect.preferredTags ?? []).join(' · ') || '无'}</div>
            <div class="muted">${renderAftereffectSummary(aftereffect)}</div>
          </div>
        </section>
      ` : ''}

      ${pendingEvent ? `
        <section class="panel">
          <div class="panel-title"><h3>途中事件</h3><span class="tag">待抉择</span></div>
          <div class="card">
            <div class="card-title"><strong>${pendingEvent.name}</strong><span class="tag">${active?.sourceType === 'board' ? '常驻委托' : renderMissionSourceLabel(active)}</span></div>
            <div class="muted">${pendingEvent.description}</div>
            <div class="grid">
              ${pendingEvent.options.map((option) => `
                <div class="card" ${tooltipAttr([
                  option.description,
                  `效果：${renderEventEffectSummary(option, formatCostSummary)}`,
                ])}>
                  <div class="card-title"><strong>${option.label}</strong><span class="tag">${option.default ? '离线默认' : '主动选择'}</span></div>
                  <div class="muted">${option.description}</div>
                  <div class="muted">${renderEventEffectSummary(option, formatCostSummary)}</div>
                  <div class="inline-actions">
                    <button data-action="resolve-commission-event" data-option-id="${option.id}">选择此策</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>
      ` : ''}

      <section class="panel">
        <div class="panel-title"><h3>委托榜单</h3><span class="tag">${missions.available.length} 项</span></div>
        <div class="grid">
          ${missions.available.length ? missions.available.map((mission) => {
            const biasTag = renderBiasTag(mission);
            return `
              <div class="card" ${tooltipAttr([
                mission.description,
                `推荐评分：${mission.recommendedScore}`,
                `预计评级：${mission.evaluation?.tier?.label ?? '待定'}`,
                `定向专长：${renderAffinitySummary(mission.evaluation)}`,
                `风向加成：${renderEvaluationThemeSummary(mission.evaluation, formatCostSummary)}`,
                `声望收益：${renderReputationReward(mission.reputationReward)}`,
                `事务点收益：${renderAffairsCreditReward(mission.affairsCreditReward)}`,
                `基础奖励：${renderRewardSummary(mission.reward, formatCostSummary)}`,
                `额外奖励：${renderRewardSummary(mission.bonusReward, formatCostSummary)}`,
                `定向奖励：${renderRewardSummary(mission.evaluation?.affinityReward, formatCostSummary)}`,
                biasTag ? `偏向来源：${biasTag}` : null,
                mission.coolingDown ? `冷却结束：${formatTime(mission.cooldownUntil)}` : '当前可立即派遣',
              ])}>
                <div class="card-title"><strong>${mission.name}</strong><span class="tag">${biasTag ?? `${mission.durationSeconds} 秒`}</span></div>
                <div class="muted">${mission.description}</div>
                <div class="detail-list">
                  <span>推荐评分 ${mission.recommendedScore}</span>
                  <span>队伍评分 ${mission.evaluation?.totalScore ?? 0}</span>
                  <span>专长加分 +${formatNumber(mission.evaluation?.strategyScore ?? 0)}</span>
                  <span>命中 ${mission.evaluation?.matchCount ?? 0} 条</span>
                </div>
                <div class="muted">专长命中：${renderAffinitySummary(mission.evaluation)}</div>
                <div class="muted">风向加成：${renderEvaluationThemeSummary(mission.evaluation, formatCostSummary)}</div>
                <div class="muted">${renderReputationReward(mission.reputationReward)}</div>
                <div class="muted">${renderAffairsCreditReward(mission.affairsCreditReward)}</div>
                <div class="muted">预计收益：${renderRewardSummary(mission.evaluation?.totalReward, formatCostSummary)}</div>
                <div class="muted">${mission.coolingDown ? `委托冷却中，剩余 ${mission.cooldownRemainingSeconds} 秒` : `预计评级：${mission.evaluation?.tier?.label ?? '待定'}`}</div>
                <div class="inline-actions">
                  <button ${mission.canStart ? '' : 'disabled'} data-action="start-commission" data-id="${mission.id}" data-source-type="board">
                    ${mission.coolingDown ? '冷却中' : '派遣委托'}
                  </button>
                </div>
              </div>
            `;
          }).join('') : '<div class="card"><div class="muted">当前暂无可展示的委托，稍后再刷新榜单。</div></div>'}
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h3>限时诏令</h3><span class="tag">${missions.specialOffers.length ? `${missions.specialOffers.length} 条激活` : '等待刷新'}</span></div>
        ${missions.specialOffers.length ? `
          <div class="grid">
            ${missions.specialOffers.map((offer) => renderSpecialOfferCard(offer, {
              tooltipAttr,
              formatNumber,
              formatCostSummary,
              formatTime,
            })).join('')}
          </div>
        ` : `
          <div class="card">
            <div class="muted">当前没有激活中的限时诏令。</div>
            <div class="muted">${missions.specialState.nextSpawnInSeconds > 0 ? `下一道诏令约在 ${missions.specialState.nextSpawnInSeconds} 秒后出现。` : '新的限时诏令正在汇聚。'}</div>
          </div>
        `}
      </section>

      <section class="panel">
        <div class="panel-title"><h3>待结算委托</h3><span class="tag">${missions.completed.length} 项</span></div>
        <div class="log-list">
          ${missions.completed.length ? missions.completed.map((mission) => `
            <div class="log-item" ${tooltipAttr([
              `完成评级：${mission.evaluation?.tier?.label ?? '待定'}`,
              `队伍成员：${mission.teamSnapshot?.members?.map((member) => member.name).join(' · ') || '未记录'}`,
              `定向专长：${renderAffinitySummary(mission.evaluation)}`,
              `风向加成：${renderEvaluationThemeSummary(mission.evaluation, formatCostSummary)}`,
              `声望收益：${renderReputationReward(mission.reputationReward)}`,
              `事务点收益：${renderAffairsCreditReward(mission.affairsCreditReward)}`,
              `奖励：${renderRewardSummary(mission.evaluation?.totalReward, formatCostSummary)}`,
            ])}>
              <div>
                <strong>${mission.name}</strong>
                <div class="muted">${renderMissionSourceLabel(mission)} · ${renderReputationReward(mission.reputationReward)} · ${renderAffairsCreditReward(mission.affairsCreditReward)}</div>
              </div>
              <div class="inline-actions">
                <button class="secondary" data-action="claim-commission" data-id="${mission.id}">结算领取</button>
              </div>
            </div>
          `).join('') : '<div class="card"><div class="muted">当前没有待领取的委托。</div></div>'}
        </div>
        ${missions.history.length ? `
          <div class="card">
            <div class="card-title"><strong>委托记录</strong><span class="tag">${missions.history.length} 条</span></div>
            <div class="detail-list">
              ${missions.history.map((mission) => `<span>${mission.name} · ${renderHistoryLabel(mission, formatCostSummary)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </section>
    </div>
  `;
}
