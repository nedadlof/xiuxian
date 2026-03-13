import { getBeastMenagerieSnapshot } from '../../systems/disciplesBeastsSystem.js';

function formatBondPercent(value) {
  const safeValue = Number(value) || 0;
  const sign = safeValue >= 0 ? '+' : '';
  return `${sign}${Math.round(safeValue * 100)}%`;
}

function getBondEffectLabel(effect = {}) {
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
      return effect.resourceId === 'lingStone' ? '灵石产出' : `${effect.resourceId ?? '资源'}产出`;
    default:
      return effect.type ?? '效果';
  }
}

function renderBondEffectSummary(effects = []) {
  if (!effects.length) {
    return '暂无加成';
  }

  return effects.map((effect) => `${getBondEffectLabel(effect)} ${formatBondPercent(effect.value)}`).join(' · ');
}

function renderLineupNames(lineup, emptyLabel = '未激活') {
  if (!lineup?.beasts?.length) {
    return emptyLabel;
  }

  return lineup.beasts.map((beast) => beast.name).join(' · ');
}

function renderBondList(snapshot, emptyLabel = '当前未激活灵兽羁绊') {
  if (!snapshot?.activeBonds?.length) {
    return `<div class="muted">${emptyLabel}</div>`;
  }

  return snapshot.activeBonds.map((bond) => `
    <div class="card">
      <div class="card-title"><strong>${bond.name}</strong><span class="tag">${renderBondEffectSummary(bond.effects)}</span></div>
      <div class="muted">${bond.description}</div>
    </div>
  `).join('');
}

export function beastsPanel(state, registries, deps = {}) {
  const { tooltipAttr, formatCostSummary } = deps;
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

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>万象森罗录</h3><span class="tag">激活 ${state.beasts.activeIds.length}/3</span></div>
        <div class="card">
          <div class="card-title"><strong>灵兽养成</strong><span class="tag">灵兽碎片 ${state.resources?.beastShard ?? 0}</span></div>
          <div class="muted">战斗胜利掉落的灵兽碎片、灵晶与副产资源，现在可以沿着觉醒、兽契、兽阵三条线回流成长，灵兽不再只是单卡激活，而是一个可编队的长期玩法。</div>
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
            ${renderBondList(activeBondSnapshot, '当前阵列尚未激活羁绊，可尝试套用推荐兽阵。')}
          </div>
          <div class="card">
            <div class="card-title"><strong>推荐可激活羁绊</strong><span class="tag">推荐阵列</span></div>
            ${renderBondList(recommendedBondSnapshot, '当前推荐更偏单兽强度，暂未形成羁绊联动。')}
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
