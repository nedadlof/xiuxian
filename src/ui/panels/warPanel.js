import { getWarSnapshot } from '../../systems/warSystem.js?v=20260312-war-simple';
import { getWarReportOutcomeLabel, getWarEndingReasonLabel } from '../warReportUi.js';
import {
  getAutoBattleStrategyOptions,
  getAutoBattleStrategyMeta,
  getAutoBattleSpeedOptions,
  getAutoBattleSpeedMeta,
} from '../warBattleUi.js';
import { renderEntityThumb } from '../entityVisuals.js?v=20260313-ui-refresh';

function rewardLine(label, reward = {}, formatCostSummary) {
  const summary = formatCostSummary(reward);
  return summary === '无' ? '' : `<div class="muted">${label}：${summary}</div>`;
}

function getStageTargetPower(stage) {
  return stage?.recommendedBattlePower ?? stage?.enemyBattlePower ?? stage?.enemyPower ?? 0;
}

function getStagePressureMeta(powerGap = 0) {
  if (powerGap <= 0) {
    return {
      label: '可直接突破',
      summary: '当前军势已经达到推荐线附近，可以直接一键挑战，优先把首通奖励和联动掉落滚起来。',
    };
  }

  if (powerGap <= 90) {
    return {
      label: '再补一手',
      summary: '距离推荐线不远，补少量兵力、专武专丹或首通材料后，通常就能稳定推进。',
    };
  }

  if (powerGap <= 260) {
    return {
      label: '需要养成',
      summary: '建议先回刷高收益关卡，补灵兽、弟子和工坊联动，再回来冲关会更稳。',
    };
  }

  return {
    label: '明显卡关',
    summary: '这个阶段已经进入后期壁垒，需要更多长线游玩时间，逐步把兵种克制、灵兽羁绊和战备适配都拉满。',
  };
}

function getStageThumbKind(stage) {
  if ((stage?.encounterType ?? '').includes('boss') || (stage?.difficultyLabel ?? '').includes('古')) {
    return 'beast';
  }
  return 'unit';
}

function renderStageCard(stage, deps = {}) {
  const {
    tooltipAttr,
    formatNumber,
    formatCostSummary,
    getEncounterTypeLabel,
  } = deps;
  const linkedRewardLine = rewardLine('联动掉落', stage.rewardPreview?.linkedReward ?? {}, formatCostSummary);
  const stageTargetPower = getStageTargetPower(stage);

  return `
    <div class="card" ${tooltipAttr([
      stage.description,
      `难度层级：${stage.difficultyLabel ?? '常规推进'}`,
      `建议军势：${formatNumber(stageTargetPower)}`,
      `基础奖励：${formatCostSummary(stage.rewardPreview?.baseReward ?? stage.reward)}`,
      `联动掉落：${formatCostSummary(stage.rewardPreview?.linkedReward ?? {})}`,
      stage.progressionGoal ? `推进目标：${stage.progressionGoal}` : null,
      stage.unlocked ? '状态：可挑战' : `解锁条件：${stage.lockReasons?.join(' · ') ?? '未满足'}`,
    ])}>
      <div class="entity-row">
        ${renderEntityThumb({
          kind: getStageThumbKind(stage),
          title: stage.name,
          subtitle: stage.terrain ?? stage.world ?? '',
          rarity: stage.cleared ? 'rare' : ((stage.difficultyLabel ?? '').includes('后') ? 'epic' : 'common'),
          badge: stage.name,
          tone: `${stage.world ?? ''}/${stage.terrain ?? ''}/${stage.encounterType ?? ''}`,
        })}
        <div class="entity-copy">
          <div class="card-title">
            <strong>${stage.name}</strong>
            <span class="tag">${stage.current ? '当前目标' : getEncounterTypeLabel(stage.encounterType)}</span>
          </div>
          <div class="muted">${stage.world} · ${stage.terrain} · ${stage.difficultyLabel ?? '常规推进'}</div>
          ${rewardLine('基础奖励', stage.rewardPreview?.baseReward ?? stage.reward, formatCostSummary)}
          ${rewardLine('固定掉落', stage.rewardPreview?.guaranteedLoot ?? {}, formatCostSummary)}
          ${rewardLine('首通奖励', stage.rewardPreview?.firstClearBonus ?? {}, formatCostSummary)}
          ${linkedRewardLine}
          <div class="detail-list">
            <span>建议军势 ${formatNumber(stageTargetPower)}</span>
            <span>${stage.cleared ? '已通关，可继续刷取资源' : (stage.progressionGoal ?? '首通会额外掉落材料')}</span>
            <span>${(stage.mechanics?.length ?? 0) > 0 ? `机制 ${stage.mechanics.length} 项` : '无特殊机制'}</span>
          </div>
        </div>
      </div>
      <div class="inline-actions">
        <button class="${stage.current ? 'secondary' : 'ghost'}" data-action="select-stage" data-id="${stage.id}">${stage.current ? '当前目标' : '设为目标'}</button>
        <button ${stage.unlocked ? '' : 'disabled'} data-action="quick-challenge-stage" data-id="${stage.id}">${stage.cleared ? '再次扫荡' : '一键挑战'}</button>
      </div>
    </div>
  `;
}

function renderProgressionCurveCard(currentStage, army, deps = {}) {
  const { formatNumber } = deps;
  if (!currentStage) {
    return '';
  }

  const currentBattlePower = army?.previewBattlePower ?? 0;
  const targetBattlePower = getStageTargetPower(currentStage);
  const pressureMeta = getStagePressureMeta(currentStage.powerGap ?? (targetBattlePower - currentBattlePower));

  return `
    <section class="panel">
      <div class="panel-title"><h3>推进节奏</h3><span class="tag">${pressureMeta.label}</span></div>
      <div class="mini-grid">
        <div class="card"><div class="muted">当前层级</div><strong>${currentStage.difficultyLabel ?? '常规推进'}</strong></div>
        <div class="card"><div class="muted">建议军势</div><strong>${formatNumber(targetBattlePower)}</strong></div>
        <div class="card"><div class="muted">当前军势</div><strong>${formatNumber(currentBattlePower)}</strong></div>
        <div class="card"><div class="muted">差距</div><strong>${formatNumber(Math.max(currentStage.powerGap ?? (targetBattlePower - currentBattlePower), 0))}</strong></div>
      </div>
      <div class="muted">${pressureMeta.summary}</div>
      <div class="muted">推进目标：${currentStage.progressionGoal ?? '补强当前阵容和联动收益后继续挑战。'}</div>
    </section>
  `;
}

function renderCurrentBattleCard(activeBattle, deps = {}) {
  const {
    formatNumber,
  } = deps;
  const playerHpPercent = activeBattle.playerTeam?.maxHp
    ? Math.max(4, Math.round((activeBattle.playerTeam.hp / activeBattle.playerTeam.maxHp) * 100))
    : 0;
  const enemyHpPercent = activeBattle.enemyTeam?.maxHp
    ? Math.max(4, Math.round((activeBattle.enemyTeam.hp / activeBattle.enemyTeam.maxHp) * 100))
    : 0;

  return `
    <section class="panel">
      <div class="panel-title"><h3>当前战况</h3><span class="tag">${activeBattle.autoMode ? '自动中' : '推演中'}</span></div>
      <div class="mini-grid">
        <div class="card"><div class="muted">关卡</div><strong>${activeBattle.stageName}</strong></div>
        <div class="card"><div class="muted">回合</div><strong>${activeBattle.round}/${activeBattle.battleRoundLimit}</strong></div>
        <div class="card"><div class="muted">我方生命</div><strong>${formatNumber(activeBattle.playerTeam.hp)}/${formatNumber(activeBattle.playerTeam.maxHp)}</strong></div>
        <div class="card"><div class="muted">敌方生命</div><strong>${formatNumber(activeBattle.enemyTeam.hp)}/${formatNumber(activeBattle.enemyTeam.maxHp)}</strong></div>
      </div>
      <div class="war-hp-grid">
        <div>
          <div class="muted">我方血线</div>
          <div class="war-progress-track"><span class="war-progress-fill ally" style="width:${playerHpPercent}%"></span></div>
        </div>
        <div>
          <div class="muted">敌方血线</div>
          <div class="war-progress-track"><span class="war-progress-fill enemy" style="width:${enemyHpPercent}%"></span></div>
        </div>
      </div>
      <div class="muted">战斗已简化为自动推演主流程。若推演未立即结算，可以继续点击“一键推进”快速结束本场。</div>
      <div class="inline-actions">
        <button data-action="quick-challenge-stage" data-id="${activeBattle.stageId}">一键推进</button>
        <button class="ghost" data-action="battle-retreat">撤退</button>
      </div>
    </section>
  `;
}

function renderLatestReportCard(report, deps = {}) {
  const {
    tooltipAttr,
    formatCostSummary,
  } = deps;
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-title"><h3>最近战果</h3><span class="tag">暂无</span></div>
        <div class="card"><div class="muted">当前还没有战斗结算记录，先选一关一键挑战即可。</div></div>
      </section>
    `;
  }

  return `
    <section class="panel">
      <div class="panel-title"><h3>最近战果</h3><span class="tag">${getWarReportOutcomeLabel(report)}</span></div>
      <div class="card" ${tooltipAttr([
        `结局：${getWarReportOutcomeLabel(report)}`,
        `结束方式：${getWarEndingReasonLabel(report)}`,
        `总奖励：${formatCostSummary(report.reward)}`,
        `弟子/灵兽/产业联动：${formatCostSummary(report.rewardBreakdown?.linkedReward ?? {})}`,
      ])}>
        <div class="entity-row">
          ${renderEntityThumb({
            kind: report.victory ? 'unit' : 'beast',
            title: report.stageName,
            subtitle: getWarReportOutcomeLabel(report),
            rarity: report.victory ? 'rare' : 'common',
            badge: report.stageName,
            tone: `${report.stageName}/${report.endingReason ?? ''}`,
          })}
          <div class="entity-copy">
            <div class="card-title"><strong>${report.stageName}</strong><span class="tag">${getWarEndingReasonLabel(report)}</span></div>
            <div class="muted">总奖励：${formatCostSummary(report.reward)}</div>
            ${rewardLine('基础奖励', report.rewardBreakdown?.baseReward ?? {}, formatCostSummary)}
            ${rewardLine('随机掉落', report.rewardBreakdown?.randomLoot ?? {}, formatCostSummary)}
            ${rewardLine('联动掉落', report.rewardBreakdown?.linkedReward ?? {}, formatCostSummary)}
            <div class="muted">出征弟子：${report.expeditionSupport?.memberNames?.join(' · ') || '未派出弟子'}</div>
            <div class="muted">灵兽/羁绊联动：灵兽 ${report.expeditionSupport?.bondCount ?? 0} 条羁绊 · 总共鸣 ${report.expeditionSupport?.totalResonance ?? 0}</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderRewardFocusCard(currentStage, deps = {}) {
  const {
    formatCostSummary,
  } = deps;
  if (!currentStage) {
    return '';
  }

  const linked = currentStage.rewardPreview?.linkedReward ?? {};
  const focusParts = [];
  if ((linked.seekImmortalToken ?? 0) > 0 || (linked.tianmingSeal ?? 0) > 0 || (linked.discipleShard ?? 0) > 0) {
    focusParts.push('弟子招募线');
  }
  if ((linked.beastShard ?? 0) > 0) {
    focusParts.push('灵兽养成线');
  }
  if ((linked.pills ?? 0) > 0 || (linked.herb ?? 0) > 0) {
    focusParts.push('炼丹线');
  }
  if ((linked.iron ?? 0) > 0 || (linked.talisman ?? 0) > 0) {
    focusParts.push('锻造符阵线');
  }

  return `
    <section class="panel">
      <div class="panel-title"><h3>本关联动收益</h3><span class="tag">${focusParts.join(' / ') || '基础修炼资源'}</span></div>
      <div class="card">
        <div class="muted">当前目标关卡会根据弟子出征、灵兽激活和炼丹锻造产业状态补出额外掉落。</div>
        <div class="muted">当前联动掉落：${formatCostSummary(linked)}</div>
        <div class="muted">基础奖励：${formatCostSummary(currentStage.rewardPreview?.baseReward ?? currentStage.reward)}</div>
      </div>
    </section>
  `;
}

function renderBattleAdviceCard(advice = [], deps = {}) {
  const { tooltipAttr } = deps;
  if (!(advice?.length > 0)) {
    return `
      <section class="panel">
        <div class="panel-title"><h3>战前建议</h3><span class="tag">已就绪</span></div>
        <div class="card"><div class="muted">当前阵容与目标关卡匹配度较高，可以直接一键挑战，优先把战利滚起来。</div></div>
      </section>
    `;
  }

  return `
    <section class="panel">
      <div class="panel-title"><h3>战前建议</h3><span class="tag">${advice.length} 条</span></div>
      <div class="log-list">
        ${advice.map((item) => `
          <div class="log-item" ${tooltipAttr([item.summary, `建议方向：${item.prepName}`, `推荐去向：${item.targetTab}`])}>
            <div>
              <strong>${item.title}</strong>
              <div class="muted">${item.summary}</div>
            </div>
            <button class="ghost" data-action="switch-tab" data-tab="${item.targetTab}">${item.actionLabel}</button>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderCounterFocusCard(counterAdvice = []) {
  if (!(counterAdvice?.length > 0)) {
    return '';
  }

  return `
    <section class="panel">
      <div class="panel-title"><h3>兵种克制</h3><span class="tag">当前关卡</span></div>
      <div class="card">
        <div class="muted">优先考虑这些兵种来针对当前目标关卡的敌方构成。</div>
        <div class="detail-list">
          ${counterAdvice.map((item) => `<span>${item.unitName}${item.count > 0 ? ` x${item.count}` : ''} · 克 ${item.counterHits.join('/') || '无'}${item.weakHits.length ? ` · 忌 ${item.weakHits.join('/')}` : ''}</span>`).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderTacticalPlanCard(recommendation, lastRecommendedPrep, deps = {}) {
  const { formatCostSummary, getResourceLabel } = deps;
  if (!recommendation?.formation && !(recommendation?.squad?.length > 0)) {
    return '';
  }

  const shortageSummary = formatCostSummary?.(lastRecommendedPrep?.missingResources ?? {}) ?? '无';
  const shortageFocus = (lastRecommendedPrep?.suggestedRewardFocus ?? []).map((resourceId) => getResourceLabel?.(resourceId) ?? resourceId).join(' / ');

  return `
    <section class="panel">
      <div class="panel-title"><h3>推荐配队</h3><span class="tag">当前关卡</span></div>
      <div class="card">
        ${recommendation.formation ? `<div class="muted">推荐阵法：${recommendation.formation.name}</div>` : ''}
        ${recommendation.formation ? `<div class="inline-actions"><button class="secondary" data-action="apply-recommended-formation" data-id="${recommendation.formation.id}">一键整备出战</button></div>` : ''}
        <div class="detail-list">
          ${(recommendation.squad ?? []).map((item) => `<span>${item.unitName}${item.count > 0 ? ` x${item.count}` : ''}/${item.targetCount || item.count || 0} · 克 ${item.counters.join('/') || '无'}${item.weakHits.length ? ` · 忌 ${item.weakHits.join('/')}` : ''}</span>`).join('')}
        </div>
        ${lastRecommendedPrep && shortageSummary !== '无' ? `<div class="muted">本次整备仍缺：${shortageSummary}</div>` : ''}
        ${lastRecommendedPrep && shortageSummary !== '无' ? `<div class="muted">优先补：${shortageFocus || '基础军备资源'}</div>` : ''}
      </div>
    </section>
  `;
}

export function warPanel(state, registries, deps = {}) {
  const {
    tooltipAttr,
    formatNumber,
    formatCostSummary,
    getEncounterTypeLabel,
  } = deps;
  const war = getWarSnapshot(state, registries);
  const currentStage = war.currentStage;
  const latestReport = war.reports?.[0] ?? null;
  const defaultAutoStrategy = war.autoPreferences?.strategyId ?? 'skill-first';
  const defaultAutoSpeed = war.autoPreferences?.speedId ?? 'normal';
  const currentBattlePower = war.army?.previewBattlePower ?? 0;
  const currentTargetPower = getStageTargetPower(currentStage);
  const pressureMeta = getStagePressureMeta(currentStage?.powerGap ?? (currentTargetPower - currentBattlePower));

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>战斗总览</h3><span class="tag">简化推演</span></div>
        <div class="mini-grid">
          <div class="card"><div class="muted">当前目标</div><strong>${currentStage?.name ?? '未选择'}</strong></div>
          <div class="card"><div class="muted">难度分层</div><strong>${currentStage?.difficultyLabel ?? '常规推进'}</strong></div>
          <div class="card"><div class="muted">建议军势</div><strong>${formatNumber(currentTargetPower)}</strong></div>
          <div class="card"><div class="muted">当前军势</div><strong>${formatNumber(currentBattlePower)}</strong></div>
          <div class="card"><div class="muted">已通关</div><strong>${state.war.clearedStages.length} 关</strong></div>
          <div class="card"><div class="muted">推进压强</div><strong>${pressureMeta.label}</strong></div>
        </div>
        <div class="inline-actions">
          ${getAutoBattleStrategyOptions().map((strategy) => `<button class="${defaultAutoStrategy === strategy.id ? 'secondary' : 'ghost'}" data-action="battle-auto-strategy" data-id="${strategy.id}">${strategy.label}</button>`).join('')}
        </div>
        <div class="inline-actions">
          ${getAutoBattleSpeedOptions().map((speed) => `<button class="${defaultAutoSpeed === speed.id ? 'secondary' : 'ghost'}" data-action="battle-auto-speed" data-id="${speed.id}">${speed.label}</button>`).join('')}
        </div>
        <div class="muted">主流程已经简化为“设目标 -> 一键挑战 -> 直接看结果与掉落”。前期会更快给到首通回报，后期则会明显提高养成要求。</div>
        <div class="muted">默认策略：${getAutoBattleStrategyMeta(defaultAutoStrategy).label} · 推演速度：${getAutoBattleSpeedMeta(defaultAutoSpeed).label}</div>
      </section>

      ${renderProgressionCurveCard(currentStage, war.army, { formatNumber })}
      ${renderRewardFocusCard(currentStage, { formatCostSummary })}
      ${renderCounterFocusCard(war.counterAdvice)}
      ${renderTacticalPlanCard(war.tacticalRecommendation, war.lastRecommendedPrep, { formatCostSummary, getResourceLabel: deps.getResourceLabel })}
      ${renderBattleAdviceCard(war.battleAdvice, { tooltipAttr })}
      ${war.activeBattle ? renderCurrentBattleCard(war.activeBattle, { formatNumber }) : ''}
      ${renderLatestReportCard(latestReport, { tooltipAttr, formatCostSummary })}

      <section class="panel">
        <div class="panel-title"><h3>关卡列表</h3><span class="tag">${war.stages.length} 关</span></div>
        <div class="stage-grid">
          ${war.stages.map((stage) => renderStageCard(stage, {
            tooltipAttr,
            formatNumber,
            formatCostSummary,
            getEncounterTypeLabel,
          })).join('')}
        </div>
      </section>
    </div>
  `;
}