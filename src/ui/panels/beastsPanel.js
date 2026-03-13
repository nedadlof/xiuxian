import { getBeastMenagerieSnapshot } from '../../systems/disciplesBeastsSystem.js';

function formatBondPercent(value) {
  const safeValue = Number(value) || 0;
  const sign = safeValue >= 0 ? '+' : '';
  return `${sign}${Math.round(safeValue * 100)}%`;
}

function formatDuration(seconds = 0) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}时${minutes}分`;
  }
  if (minutes > 0) {
    return `${minutes}分${remainSeconds > 0 ? `${remainSeconds}秒` : ''}`;
  }
  return `${remainSeconds}秒`;
}

function renderResourceMap(resourceMap = {}, getResourceLabel) {
  const entries = Object.entries(resourceMap ?? {});
  if (!entries.length) {
    return '暂无';
  }

  return entries.map(([resourceId, amount]) => `${getResourceLabel?.(resourceId) ?? resourceId} ${amount}`).join(' · ');
}

function getBondEffectLabel(effect = {}, getResourceLabel) {
  switch (effect.type) {
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
    case 'resourceMultiplier':
      return `${getResourceLabel?.(effect.resourceId) ?? effect.resourceId ?? '资源'}产出`;
    default:
      return effect.type ?? '效果';
  }
}

function renderBondEffectSummary(effects = [], getResourceLabel) {
  if (!effects.length) {
    return '暂无加成';
  }

  return effects.map((effect) => `${getBondEffectLabel(effect, getResourceLabel)} ${formatBondPercent(effect.value)}`).join(' · ');
}

function renderLineupNames(lineup, emptyLabel = '未激活') {
  if (!lineup?.beasts?.length) {
    return emptyLabel;
  }

  return lineup.beasts.map((beast) => beast.name).join(' · ');
}

function renderBondList(snapshot, emptyLabel = '当前未激活灵兽羁绊', getResourceLabel) {
  if (!snapshot?.activeBonds?.length) {
    return `<div class="muted">${emptyLabel}</div>`;
  }

  return snapshot.activeBonds.map((bond) => `
    <div class="card">
      <div class="card-title"><strong>${bond.name}</strong><span class="tag">${renderBondEffectSummary(bond.effects, getResourceLabel)}</span></div>
      <div class="muted">${bond.description}</div>
    </div>
  `).join('');
}

function renderExpeditionHistory(history = [], getResourceLabel) {
  if (!history.length) {
    return '<div class="muted">暂无巡游记录，派出一只灵兽去外巡后会记录最近收获。</div>';
  }

  return history.map((entry) => `
    <div class="log-item">
      <div>
        <strong>${entry.routeName}</strong>
        <div class="muted">${entry.beastName} · ${entry.qualityLabel} · 收益 ${renderResourceMap(entry.rewardMap, getResourceLabel)}</div>
        <div class="muted">${entry.eventState?.resolvedEvents?.length
          ? `奇遇抉择：${entry.eventState.resolvedEvents.map((event) => `${event.eventName} / ${event.optionLabel}`).join(' · ')}`
          : '本次巡游未触发额外奇遇。'}</div>
        <div class="muted">${entry.discoveredRelics?.length
          ? `巡游异宝：${entry.discoveredRelics.map((relic) => relic.name).join('、')}`
          : `图鉴见闻 +${entry.routeInsightGain ?? 0}`}</div>
      </div>
      <span class="tag">已带回</span>
    </div>
  `).join('');
}

function getRelicRarityLabel(rarity = '') {
  switch (rarity) {
    case 'legendary':
      return '传说';
    case 'epic':
      return '稀世';
    case 'rare':
      return '珍奇';
    default:
      return '异宝';
  }
}

function renderRelicRouteProgress(routes = [], getResourceLabel) {
  if (!routes.length) {
    return '<div class="muted">暂无可追踪路线，后续巡游开放后会逐步记录图鉴见闻。</div>';
  }

  return routes.map((route) => `
    <div class="log-item">
      <div>
        <strong>${route.routeName}</strong>
        <div class="muted">${route.completed ? '该路线异宝已全部收录，可继续巡游补资源。' : `当前见闻 ${route.currentInsight}/${route.threshold}，再推进即可解锁下一件异宝。`}</div>
        <div class="muted">${route.nextRelic
          ? `下一件：${route.nextRelic.name} · ${route.nextRelic.description} · 效果 ${renderBondEffectSummary(route.nextRelic.effects, getResourceLabel)}`
          : '下一件：已完成整条路线图鉴收录。'}</div>
      </div>
      <span class="tag">${route.ownedCount}/${route.totalCount}</span>
    </div>
  `).join('');
}

function renderRelicCollectionList(relics = [], routeNameById = {}, getResourceLabel) {
  if (!relics.length) {
    return '<div class="muted">暂无异宝定义。</div>';
  }

  return relics.map((relic) => `
    <div class="log-item">
      <div>
        <strong>${relic.owned ? relic.name : '未鉴定异宝'}</strong>
        <div class="muted">${routeNameById[relic.routeId] ?? relic.routeId} · ${getRelicRarityLabel(relic.rarity)} · ${relic.owned ? relic.description : '继续在该路线巡游累积见闻后可解锁。'}</div>
        <div class="muted">${relic.owned ? `单件效果：${renderBondEffectSummary(relic.effects, getResourceLabel)}` : '收录后会提供单件增益，并推进对应套装收集进度。'}</div>
      </div>
      <span class="tag">${relic.owned ? '已收录' : '未发现'}</span>
    </div>
  `).join('');
}

function renderRelicSetList(sets = [], getResourceLabel) {
  if (!sets.length) {
    return '<div class="muted">暂无套装共鸣。</div>';
  }

  return sets.map((setDefinition) => `
    <div class="card">
      <div class="card-title"><strong>${setDefinition.name}</strong><span class="tag">${setDefinition.active ? '已激活' : `${setDefinition.ownedCount}/${setDefinition.requiredCount}`}</span></div>
      <div class="muted">${setDefinition.description}</div>
      <div class="muted">套装效果：${renderBondEffectSummary(setDefinition.effects, getResourceLabel)}</div>
    </div>
  `).join('');
}

function renderRelicDiscoveries(discoveries = []) {
  if (!discoveries.length) {
    return '<div class="muted">最近还没有新异宝入藏，继续推进巡游即可逐步补全图鉴。</div>';
  }

  return discoveries.map((entry) => `
    <div class="log-item">
      <div>
        <strong>${entry.relicName}</strong>
        <div class="muted">${entry.routeName ?? entry.routeId ?? '未知路线'} · ${entry.beastName ?? '巡游灵兽'} · ${entry.qualityLabel ?? '巡游收获'}</div>
      </div>
      <span class="tag">新收录</span>
    </div>
  `).join('');
}

export function beastsPanel(state, registries, deps = {}) {
  const { tooltipAttr, formatCostSummary, getResourceLabel } = deps;
  const menagerie = getBeastMenagerieSnapshot(state, registries);
  const beasts = menagerie.beasts;
  const currentStage = registries.stages.get(state.war?.currentStageId);
  const featuredBeast = menagerie.featuredBeast;
  const activeLineup = menagerie.activeLineup;
  const recommendedLineup = menagerie.recommendedLineup;
  const activeBondSnapshot = menagerie.activeBondSnapshot;
  const recommendedBondSnapshot = recommendedLineup?.activeBondSnapshot ?? { activeBonds: [], totalFitScore: 0 };
  const activeNames = renderLineupNames(activeLineup, '未激活');
  const recommendedNames = renderLineupNames(recommendedLineup, '暂无推荐');
  const recommendedBondNames = recommendedBondSnapshot.activeBonds?.map((bond) => bond.name).join('、') || '暂无羁绊联动';
  const expedition = menagerie.expedition ?? { active: null, history: [], routes: [] };
  const collection = menagerie.collection ?? { relics: [], sets: [], routes: [], recentDiscoveries: [], totalOwned: 0, totalCount: 0 };
  const activeRelicSetCount = collection.sets?.filter((setDefinition) => setDefinition.active).length ?? 0;
  const routeNameById = Object.fromEntries((collection.routes ?? []).map((route) => [route.routeId, route.routeName]));
  const nextRelicRoute = collection.routes?.find((route) => !route.completed && route.nextRelic) ?? null;

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>万象森罗录</h3><span class="tag">激活 ${state.beasts.activeIds.length}/3</span></div>
        <div class="card">
          <div class="card-title"><strong>灵兽养成</strong><span class="tag">灵兽碎片 ${state.resources?.beastShard ?? 0}</span></div>
          <div class="muted">战斗胜利掉落的灵兽碎片、灵晶与副产资源，现在可以沿着觉醒、兽契、兽阵、巡游四条线回流成长。灵兽不只是上阵位，也开始承担挂机探索与资源调度职责。</div>
        </div>
        <div class="mini-grid">
          <div class="card"><div class="muted">当前目标</div><strong>${currentStage?.name ?? '未选择关卡'}</strong></div>
          <div class="card"><div class="muted">当前出战</div><strong>${activeNames}</strong></div>
          <div class="card"><div class="muted">激活羁绊</div><strong>${activeBondSnapshot?.activeBonds?.length ?? 0} 条</strong></div>
          <div class="card"><div class="muted">推荐兽阵</div><strong>${recommendedNames}</strong></div>
        </div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>兽契共鸣</strong><span class="tag">${recommendedBondSnapshot.totalFitScore ?? 0} 项命中</span></div>
            <div class="muted">${recommendedLineup
              ? `当前推荐以 ${featuredBeast?.name ?? recommendedLineup.beasts?.[0]?.name ?? '灵兽'} 为核心，针对 ${currentStage?.name ?? '当前关卡'} 的标签命中 ${recommendedBondSnapshot.totalFitScore ?? 0} 项。${recommendedBondSnapshot.activeBonds?.length ? `可额外触发 ${recommendedBondNames}。` : '当前更偏单兽强度与关卡契合。'}`
              : '当前还没有可编入出战位的灵兽，先推进灵兽解锁路线。'}</div>
          </div>
          <div class="card">
            <div class="card-title"><strong>推荐兽阵</strong><span class="tag">${recommendedLineup?.score ? `评分 ${Math.round(recommendedLineup.score)}` : '等待解锁'}</span></div>
            <div class="muted">推荐编队：${recommendedNames}</div>
            <div class="muted">推荐羁绊：${recommendedBondNames}</div>
            <div class="muted">总觉醒 ${recommendedBondSnapshot.totalAwakening ?? 0} · 总兽契 ${recommendedBondSnapshot.totalBond ?? 0}</div>
            <div class="inline-actions">
              <button data-action="apply-recommended-beasts" ${recommendedLineup && !recommendedLineup.sameAsActive ? '' : 'disabled'}>一键套用推荐兽阵</button>
              <span class="muted">${recommendedLineup?.sameAsActive ? '当前出战阵列已与推荐一致' : '推荐会直接替换当前 3 个激活位'}</span>
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>灵兽羁绊</strong><span class="tag">当前阵列</span></div>
            ${renderBondList(activeBondSnapshot, '当前阵列尚未激活羁绊，可尝试套用推荐兽阵。', getResourceLabel)}
          </div>
          <div class="card">
            <div class="card-title"><strong>推荐可激活羁绊</strong><span class="tag">推荐阵列</span></div>
            ${renderBondList(recommendedBondSnapshot, '当前推荐更偏单兽强度，暂未形成羁绊联动。', getResourceLabel)}
          </div>
        </div>
        <div class="panel-title"><h3>灵兽巡游</h3><span class="tag">${expedition.active ? (expedition.active.completed ? '待收取' : '进行中') : '空闲'}</span></div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>当前巡游</strong><span class="tag">${expedition.active?.routeName ?? '未派遣'}</span></div>
            ${expedition.active ? `
              <div class="muted">${expedition.active.beastName} 正在执行 ${expedition.active.routeName}，当前品质 ${expedition.active.qualityLabel}</div>
              <div class="muted">预计收获：${renderResourceMap(expedition.active.rewardMap, getResourceLabel)}</div>
              <div class="muted">${expedition.active.eventState?.pendingEvent
                ? '途中遭遇奇遇，需先做出抉择后才能继续收取本次巡游收益。'
                : (expedition.active.completed ? '巡游已经结束，可以立刻收取。' : `剩余时间 ${formatDuration(expedition.active.remainingSeconds)}`)}</div>
              ${expedition.active.eventState?.pendingEvent ? `
                <div class="card">
                  <div class="card-title"><strong>巡游奇遇</strong><span class="tag">待抉择</span></div>
                  <div class="muted">${expedition.active.eventState.pendingEvent.name}</div>
                  <div class="muted">${expedition.active.eventState.pendingEvent.description}</div>
                  <div class="inline-actions">
                    ${(expedition.active.eventState.pendingEvent.options ?? []).map((option) => `
                      <button data-action="resolve-beast-expedition-event" data-option-id="${option.id}">${option.label}</button>
                    `).join('')}
                  </div>
                  <div class="muted">${(expedition.active.eventState.pendingEvent.options ?? []).map((option) => `${option.label}：${option.description}`).join(' · ')}</div>
                </div>
              ` : ''}
              <div class="inline-actions">
                <button data-action="claim-beast-expedition" ${(expedition.active.completed && !expedition.active.eventState?.pendingEvent) ? '' : 'disabled'}>收取巡游战利</button>
                <span class="muted">${expedition.active.eventState?.pendingEvent
                  ? '先完成奇遇抉择，再继续结算本次巡游。'
                  : (expedition.active.completed ? '收取后即可继续派出下一次巡游' : '巡游期间会保留当前灵兽养成与上阵效果')}</span>
              </div>
            ` : '<div class="muted">当前没有进行中的巡游，可从下方路线中选择一条并派出推荐灵兽。</div>'}
          </div>
          <div class="card">
            <div class="card-title"><strong>最近收获</strong><span class="tag">${expedition.history?.length ?? 0} 条</span></div>
            <div class="log-list">
              ${renderExpeditionHistory(expedition.history, getResourceLabel)}
            </div>
          </div>
        </div>
        <div class="log-list">
          ${expedition.routes.map((route) => `
            <div class="log-item" ${tooltipAttr([
              route.description ?? '暂无描述',
              `偏好标签：${(route.preferredTags ?? []).join(' / ') || '暂无'}`,
              `推荐灵兽：${route.recommendedBeast?.name ?? '待解锁'}`,
              `预计耗时：${formatDuration(route.durationSeconds)}`,
              `预计收益：${renderResourceMap(route.rewardPreview, getResourceLabel)}`,
            ])}>
              <div>
                <strong>${route.name}</strong>
                <div class="muted">${route.description}</div>
                <div class="muted">偏好标签：${(route.preferredTags ?? []).join(' / ') || '暂无'} · 推荐灵兽：${route.recommendedBeast?.name ?? '待解锁'} · 品质 ${route.qualityLabel}</div>
                <div class="muted">预计耗时 ${formatDuration(route.durationSeconds)} · 预计收益 ${renderResourceMap(route.rewardPreview, getResourceLabel)}</div>
                <div class="muted">${route.unlocked ? (route.bonusUnlocked ? '本次派遣预计触发额外收获。' : '当前可稳定获得基础巡游收益。') : `需至少解锁 ${route.minUnlockedBeasts ?? 1} 只灵兽后开放。`}</div>
              </div>
              <div class="inline-actions">
                <button data-action="start-beast-expedition" data-route="${route.id}" ${route.canStart ? '' : 'disabled'}>${route.active ? '巡游进行中' : '派遣推荐灵兽'}</button>
                <span class="muted">${route.canStart ? `由 ${route.recommendedBeast?.name ?? '推荐灵兽'} 执行` : (expedition.active ? '当前已有巡游任务，需先收取' : '暂未满足开放条件')}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="panel-title"><h3>巡游图鉴</h3><span class="tag">收录 ${collection.totalOwned}/${collection.totalCount}</span></div>
        <div class="mini-grid">
          <div class="card"><div class="muted">已收录异宝</div><strong>${collection.totalOwned}/${collection.totalCount}</strong></div>
          <div class="card"><div class="muted">激活套装</div><strong>${activeRelicSetCount} 套</strong></div>
          <div class="card"><div class="muted">最近发现</div><strong>${collection.recentDiscoveries?.[0]?.relicName ?? '暂无'}</strong></div>
          <div class="card"><div class="muted">当前追踪路线</div><strong>${nextRelicRoute?.routeName ?? '全部收录'}</strong></div>
        </div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>路线见闻</strong><span class="tag">${nextRelicRoute?.nextRelic?.name ?? '已收录完成'}</span></div>
            <div class="log-list">
              ${renderRelicRouteProgress(collection.routes, getResourceLabel)}
            </div>
          </div>
          <div class="card">
            <div class="card-title"><strong>异宝收藏</strong><span class="tag">${collection.totalOwned} 件已收录</span></div>
            <div class="log-list">
              ${renderRelicCollectionList(collection.relics, routeNameById, getResourceLabel)}
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>套装共鸣</strong><span class="tag">${activeRelicSetCount ? '已生效' : '待补全'}</span></div>
            ${renderRelicSetList(collection.sets, getResourceLabel)}
          </div>
          <div class="card">
            <div class="card-title"><strong>最近发现</strong><span class="tag">${collection.recentDiscoveries?.length ?? 0} 条</span></div>
            <div class="log-list">
              ${renderRelicDiscoveries(collection.recentDiscoveries)}
            </div>
          </div>
        </div>
        <div class="log-list">
          ${beasts.map((beast) => {
            const inRecommendedLineup = recommendedLineup?.beastIds?.includes(beast.id);
            return `
              <div class="log-item" ${tooltipAttr([
                beast.description ?? '暂无描述',
                beast.unlocked ? '已解锁' : '未解锁',
                `觉醒 ${beast.awakeningLevel}/5`,
                `兽契 ${beast.bondLevel}/10`,
                `关卡契合 ${beast.fitScore ?? 0}`,
                `下一级觉醒：${formatCostSummary?.(beast.awakeningCost) ?? ''}`,
                `灌灵消耗：${formatCostSummary?.(beast.bondCost) ?? ''}`,
              ])}>
                <div>
                  <strong>${beast.name}</strong>
                  <div class="muted">${beast.unlocked ? (beast.active ? '已激活' : '已解锁') : '未解锁'} · ${beast.tier} · ${beast.archetype ?? '异兽'}${inRecommendedLineup ? ' · 推荐上阵' : ''}</div>
                  <div class="muted">${beast.description ?? '暂无描述'}</div>
                  <div class="muted">觉醒 ${beast.awakeningLevel}/5 · 兽契 ${beast.bondLevel}/10 · 关卡契合 ${beast.fitScore ?? 0}</div>
                  <div class="muted">偏好标签：${(beast.favoredTags ?? []).join(' / ') || '暂无'} · 兽性词条：${(beast.traitLines ?? []).join(' · ') || '暂无'}</div>
                  <div class="muted">下一级觉醒：${formatCostSummary?.(beast.awakeningCost) ?? ''}</div>
                  <div class="muted">灌灵消耗：${formatCostSummary?.(beast.bondCost) ?? ''}</div>
                </div>
                <div class="inline-actions">
                  <button ${beast.unlocked ? '' : 'disabled'} data-action="toggle-beast" data-id="${beast.id}">${beast.active ? '撤下' : '激活'}</button>
                  <button class="ghost" ${(beast.unlocked && beast.canAwaken) ? '' : 'disabled'} data-action="awaken-beast" data-id="${beast.id}">${beast.canAwaken ? '觉醒' : '已满阶'}</button>
                  <button class="ghost" ${(beast.unlocked && beast.canTemper) ? '' : 'disabled'} data-action="temper-beast" data-id="${beast.id}">${beast.canTemper ? '灵契灌灵' : '契约已满'}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    </div>
  `;
}
