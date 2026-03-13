import { getEconomyOverviewSnapshot, getEconomySnapshot } from '../../systems/economySystem.js';
import { getTradeSnapshot } from '../../systems/tradeSystem.js';

const SPECIAL_COST_LABELS = Object.freeze({
  weaponEssence: '器魂',
  affairsCredit: '事务点',
});

function renderRarityLabel(rarity = 'common') {
  switch (rarity) {
    case 'legendary':
      return '传说';
    case 'epic':
      return '史诗';
    case 'rare':
      return '稀有';
    default:
      return '常规';
  }
}

function renderEffectSummary(effects = [], getResourceLabel) {
  if (!(effects?.length > 0)) {
    return '暂无加成';
  }

  return effects.map((effect) => {
    const value = typeof effect.value === 'number' ? `${Math.round(effect.value * 100)}%` : effect.value;
    switch (effect.type) {
      case 'battleAttack':
        return `攻势 +${value}`;
      case 'battleDefense':
        return `守势 +${value}`;
      case 'battleSustain':
        return `续航 +${value}`;
      case 'battleLoot':
        return `战利 +${value}`;
      case 'unitPowerMultiplier':
        return `兵阵战力 +${value}`;
      case 'resourceMultiplier':
        return `${getResourceLabel(effect.resourceId)}产出 +${value}`;
      default:
        return `${effect.type} ${value}`;
    }
  }).join(' · ');
}

function renderWorkshopCost(costMap = {}, formatNumber, getResourceLabel) {
  const entries = Object.entries(costMap ?? {}).filter(([, value]) => (value ?? 0) > 0);
  if (!entries.length) {
    return '无';
  }

  return entries
    .map(([resourceId, amount]) => `${SPECIAL_COST_LABELS[resourceId] ?? getResourceLabel(resourceId)} ${formatNumber(amount)}`)
    .join(' · ');
}

function renderRequirements(requirements = []) {
  return requirements?.length ? requirements.join(' · ') : '已满足当前解锁条件';
}

function renderWeaponAffixes(weapon = {}, getResourceLabel) {
  if (!(weapon.affixEffects?.length > 0)) {
    return '本次锻造未额外滚出词条';
  }

  return weapon.affixEffects
    .map((effect) => `${effect.name}：${renderEffectSummary([effect], getResourceLabel)}`)
    .join(' · ');
}

export function economyPanel(state, registries, deps = {}) {
  const {
    tooltipAttr,
    formatNumber,
    formatCostSummary,
    formatResourceRate,
    formatResourceAmount,
    getResourceLabel,
  } = deps;

  const overview = getEconomyOverviewSnapshot(state, registries);
  const buildings = getEconomySnapshot(state, registries);
  const trade = getTradeSnapshot(state, registries);
  const manufacturing = overview.crafting ?? {
    arsenal: { weaponEssence: 0, slotCount: 0, unlockedBlueprintCount: 0, totalBlueprintCount: 0, activeWeapons: [], inventory: [], unlockedBlueprints: [], lockedBlueprints: [] },
    alchemy: { slotCount: 0, unlockedRecipeCount: 0, totalRecipeCount: 0, activeBatches: [], inventory: [], unlockedRecipes: [], lockedRecipes: [] },
  };

  return `
    <div class="grid">
      <section class="panel">
        <div class="panel-title"><h3>工人与宿舍</h3><span class="tag">扩张核心</span></div>
        <div class="mini-grid">
          <div class="card"><div class="muted">总工人</div><strong>${overview.workforce.totalWorkers}</strong></div>
          <div class="card"><div class="muted">空闲工人</div><strong>${overview.workforce.idleWorkers}</strong></div>
          <div class="card"><div class="muted">人口上限</div><strong>${overview.workforce.populationCap}</strong></div>
          <div class="card"><div class="muted">挂机预估</div><strong>${formatCostSummary(overview.offlineYieldByResource)}</strong></div>
        </div>
        <div class="inline-actions">
          <button data-action="recruit-workers" data-amount="1" ${tooltipAttr([`招募 1 人`, `花费：${formatCostSummary(overview.recruitCosts.one)}`])}>招募 1 人</button>
          <button data-action="recruit-workers" data-amount="5" ${tooltipAttr([`招募 5 人`, `花费：${formatCostSummary(overview.recruitCosts.five)}`])}>招募 5 人</button>
          <button ${overview.dormitoryPlan.canBuild ? '' : 'disabled'} data-action="build-dormitory" ${tooltipAttr([`新建宿舍`, `花费：${formatCostSummary(overview.dormitoryPlan.nextCost)}`, `新增容量：${overview.dormitoryPlan.nextCapacity}`])}>新建宿舍</button>
        </div>
        <div class="log-list">
          ${overview.dormitorySnapshots.map((dormitory) => `
            <div class="log-item" ${tooltipAttr([`当前容量：${dormitory.capacity}`, `升级后容量：${dormitory.nextCapacity}`, `升级花费：${formatCostSummary(dormitory.upgradeCost)}`])}>
              <div>
                <strong>${dormitory.name}</strong>
                <div class="muted">Lv.${dormitory.level} · 容量 ${dormitory.capacity}</div>
              </div>
              <button class="secondary" data-action="upgrade-dormitory" data-id="${dormitory.id}">升级</button>
            </div>
          `).join('') || '<div class="card">暂无宿舍数据</div>'}
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h3>产业建筑</h3><span class="tag">资源循环</span></div>
        <div class="log-list">
          ${buildings.map((building) => `
            <div class="log-item" ${tooltipAttr([
              `等级：${building.level}`,
              `工人：${building.workers}`,
              `当前产出：${formatResourceRate(building.resourceId, building.productionPerSecond, 'second')}`,
              `升级后产出：${formatResourceRate(building.resourceId, building.nextProductionPerSecond, 'second')}`,
              `升级花费：${formatCostSummary(building.nextCost)}`,
              building.unlocked ? '状态：已解锁' : `解锁条件：${building.unlockNodeName ?? '未知节点'}`,
            ])}>
              <div>
                <strong>${building.name}</strong>
                <div class="muted">Lv.${building.level} · 工人 ${building.workers} · 库存 ${formatNumber(building.currentStored)}/${formatNumber(building.storageCap)}</div>
              </div>
              <div class="inline-actions">
                <button class="ghost" ${building.unlocked && building.level > 0 ? '' : 'disabled'} data-action="assign-worker" data-key="${building.workerKey}" data-amount="-1">-工人</button>
                <button class="ghost" ${building.unlocked && building.level > 0 ? '' : 'disabled'} data-action="assign-worker" data-key="${building.workerKey}" data-amount="1">+工人</button>
                <button ${building.unlocked ? '' : 'disabled'} data-action="upgrade-building" data-id="${building.id}">${building.level > 0 ? '升级' : '建造'}</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h3>战备炼制</h3><span class="tag">战利品落地</span></div>
        <div class="card">
          <div class="muted">战斗掉落的灵草、丹药、玄铁和符箓，仍可继续投入宗门常备战备。永久战备负责托底，而新开放的锻炉与丹阁负责做出高波动、高成长的主动消费线。</div>
        </div>
        <div class="log-list">
          ${overview.preparations.map((preparation) => `
            <div class="log-item" ${tooltipAttr([
              preparation.description,
              `依托建筑：${preparation.buildingName}`,
              `当前等级：${preparation.level}/${preparation.maxLevel}`,
              `下一次消耗：${formatCostSummary(preparation.nextCost)}`,
              `累计效果：${renderEffectSummary(preparation.totalEffects, getResourceLabel)}`,
              preparation.unlocked ? '状态：已开放炼制' : '状态：对应建筑尚未开放',
            ])}>
              <div>
                <strong>${preparation.name}</strong>
                <div class="muted">${preparation.buildingName} · Lv.${preparation.level}/${preparation.maxLevel}</div>
                <div class="muted">${preparation.description}</div>
                <div class="muted">累计效果：${renderEffectSummary(preparation.totalEffects, getResourceLabel)}</div>
                <div class="muted">下一次消耗：${formatCostSummary(preparation.nextCost)}</div>
              </div>
              <button ${preparation.canRefine ? '' : 'disabled'} data-action="refine-preparation" data-id="${preparation.id}">${preparation.level >= preparation.maxLevel ? '已满级' : '炼制一次'}</button>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h3>锻炉百兵</h3><span class="tag">兵谱 ${manufacturing.arsenal.unlockedBlueprintCount}/${manufacturing.arsenal.totalBlueprintCount}</span></div>
        <div class="card">
          <div class="muted">锻炉会把生产、委托和战斗掉落的材料继续压进 108 式兵谱。每次锻造都会生成随机成色与词条，当前自动取最强 ${manufacturing.arsenal.slotCount} 件镇库生效，低品质装备则可分解回收器魂继续强化。</div>
        </div>
        <div class="mini-grid">
          <div class="card"><div class="muted">器魂储量</div><strong>${formatNumber(manufacturing.arsenal.weaponEssence ?? 0)}</strong></div>
          <div class="card"><div class="muted">镇库槽位</div><strong>${manufacturing.arsenal.slotCount}</strong></div>
          <div class="card"><div class="muted">已锻成兵器</div><strong>${manufacturing.arsenal.inventory.length}</strong></div>
          <div class="card"><div class="muted">当前镇库首席</div><strong>${manufacturing.arsenal.activeWeapons?.[0]?.name ?? '暂无'}</strong></div>
        </div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>当前镇库</strong><span class="tag">${manufacturing.arsenal.activeWeapons?.length ?? 0} 件生效</span></div>
            <div class="log-list">
              ${(manufacturing.arsenal.activeWeapons?.length
                ? manufacturing.arsenal.activeWeapons.map((weapon) => `
                  <div class="log-item" ${tooltipAttr([
                    weapon.blueprint?.description ?? '暂无说明',
                    `成色：${weapon.qualityLabel} (${Math.round((weapon.qualityRoll ?? 1) * 100)}%)`,
                    `兵模：${weapon.blueprint?.modelProfile ?? '暂无'}`,
                    `主效：${renderEffectSummary(weapon.baseEffects, getResourceLabel)}`,
                    `词条：${renderWeaponAffixes(weapon, getResourceLabel)}`,
                  ])}>
                    <div>
                      <strong>${weapon.name}</strong>
                      <div class="muted">${renderRarityLabel(weapon.blueprint?.rarity)} · ${weapon.qualityLabel} · 强化 +${weapon.strengthenLevel ?? 0}</div>
                      <div class="muted">总效果：${renderEffectSummary(weapon.totalEffects, getResourceLabel)}</div>
                    </div>
                    <span class="tag">镇库中</span>
                  </div>
                `).join('')
                : '<div class="muted">当前还没有足够强的武器入库，先从下方兵谱里锻出第一批常备神兵。</div>')}
            </div>
          </div>
          <div class="card">
            <div class="card-title"><strong>器库库存</strong><span class="tag">${manufacturing.arsenal.inventory.length} 件</span></div>
            <div class="log-list">
              ${(manufacturing.arsenal.inventory?.length
                ? manufacturing.arsenal.inventory.slice(0, 10).map((weapon) => `
                  <div class="log-item" ${tooltipAttr([
                    weapon.blueprint?.description ?? '暂无说明',
                    `兵模：${weapon.blueprint?.modelProfile ?? '暂无'}`,
                    `总效果：${renderEffectSummary(weapon.totalEffects, getResourceLabel)}`,
                    `词条：${renderWeaponAffixes(weapon, getResourceLabel)}`,
                    `强化花费：${renderWorkshopCost(weapon.strengthenCost, formatNumber, getResourceLabel)}`,
                    `分解返还：${renderWorkshopCost(weapon.dismantleReward, formatNumber, getResourceLabel)}`,
                  ])}>
                    <div>
                      <strong>${weapon.name}</strong>
                      <div class="muted">${weapon.qualityLabel} · ${renderRarityLabel(weapon.blueprint?.rarity)} · 强化 +${weapon.strengthenLevel ?? 0}${weapon.active ? ' · 已镇库' : ''}</div>
                      <div class="muted">总效果：${renderEffectSummary(weapon.totalEffects, getResourceLabel)}</div>
                      <div class="muted">词条：${renderWeaponAffixes(weapon, getResourceLabel)}</div>
                    </div>
                    <div class="inline-actions">
                      <button data-action="strengthen-weapon" data-weapon-id="${weapon.id}" ${weapon.canStrengthen ? '' : 'disabled'}>强化</button>
                      <button class="secondary" data-action="dismantle-weapon" data-weapon-id="${weapon.id}">分解</button>
                    </div>
                  </div>
                `).join('')
                : '<div class="muted">当前器库为空，锻炉产出的兵器会先进入这里，随后自动选出最强镇库位。</div>')}
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>可锻兵谱</strong><span class="tag">${manufacturing.arsenal.unlockedBlueprints?.length ?? 0} 式已开放</span></div>
            <div class="log-list">
              ${(manufacturing.arsenal.unlockedBlueprints?.length
                ? manufacturing.arsenal.unlockedBlueprints.map((blueprint) => `
                  <div class="log-item" ${tooltipAttr([
                    blueprint.description,
                    `兵模：${blueprint.modelProfile}`,
                    `基础效果：${renderEffectSummary(blueprint.effects, getResourceLabel)}`,
                    `锻造消耗：${renderWorkshopCost(blueprint.cost, formatNumber, getResourceLabel)}`,
                    `开放条件：${renderRequirements(blueprint.requirements)}`,
                  ])}>
                    <div>
                      <strong>${blueprint.name}</strong>
                      <div class="muted">${renderRarityLabel(blueprint.rarity)} · ${blueprint.modelProfile}</div>
                      <div class="muted">基础效果：${renderEffectSummary(blueprint.effects, getResourceLabel)}</div>
                      <div class="muted">锻造消耗：${renderWorkshopCost(blueprint.cost, formatNumber, getResourceLabel)}</div>
                    </div>
                    <button data-action="forge-weapon" data-blueprint-id="${blueprint.id}" ${blueprint.craftable ? '' : 'disabled'}>锻造一次</button>
                  </div>
                `).join('')
                : '<div class="muted">当前锻炉尚未开放足够兵谱，先提升铁匠铺等级、委托声望与主线推进。</div>')}
            </div>
          </div>
          <div class="card">
            <div class="card-title"><strong>即将开放</strong><span class="tag">${manufacturing.arsenal.lockedBlueprints?.length ?? 0} 条</span></div>
            <div class="log-list">
              ${(manufacturing.arsenal.lockedBlueprints?.length
                ? manufacturing.arsenal.lockedBlueprints.map((blueprint) => `
                  <div class="log-item">
                    <div>
                      <strong>${blueprint.name}</strong>
                      <div class="muted">${blueprint.modelProfile}</div>
                      <div class="muted">解锁条件：${renderRequirements(blueprint.requirements)}</div>
                    </div>
                    <span class="tag">未开放</span>
                  </div>
                `).join('')
                : '<div class="muted">当前兵谱已经全部开放，继续筛词条、强化与分解即可滚动优化镇库阵容。</div>')}
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h3>丹阁百方</h3><span class="tag">丹方 ${manufacturing.alchemy.unlockedRecipeCount}/${manufacturing.alchemy.totalRecipeCount}</span></div>
        <div class="card">
          <div class="muted">丹阁会把灵草、丹坯、灵晶与事务点继续压成 108 卷丹方。新炼成的丹药批次会自动选取最强 ${manufacturing.alchemy.slotCount} 批入匣生效，兼顾战斗、资源和后勤周转。</div>
        </div>
        <div class="mini-grid">
          <div class="card"><div class="muted">丹匣槽位</div><strong>${manufacturing.alchemy.slotCount}</strong></div>
          <div class="card"><div class="muted">已炼成批次</div><strong>${manufacturing.alchemy.inventory.length}</strong></div>
          <div class="card"><div class="muted">当前主丹</div><strong>${manufacturing.alchemy.activeBatches?.[0]?.name ?? '暂无'}</strong></div>
          <div class="card"><div class="muted">事务点</div><strong>${formatNumber(state.commissions?.affairsCredit ?? 0)}</strong></div>
        </div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>丹匣生效</strong><span class="tag">${manufacturing.alchemy.activeBatches?.length ?? 0} 批生效</span></div>
            <div class="log-list">
              ${(manufacturing.alchemy.activeBatches?.length
                ? manufacturing.alchemy.activeBatches.map((batch) => `
                  <div class="log-item" ${tooltipAttr([
                    batch.recipe?.description ?? '暂无说明',
                    `药性：${batch.recipe?.profile ?? '暂无'}`,
                    `成色：${batch.potencyLabel} (${Math.round((batch.potencyRoll ?? 1) * 100)}%)`,
                    `效果：${renderEffectSummary(batch.totalEffects, getResourceLabel)}`,
                  ])}>
                    <div>
                      <strong>${batch.name}</strong>
                      <div class="muted">${renderRarityLabel(batch.recipe?.rarity)} · ${batch.potencyLabel} · 批量 ${batch.servings ?? 1}</div>
                      <div class="muted">生效效果：${renderEffectSummary(batch.totalEffects, getResourceLabel)}</div>
                    </div>
                    <span class="tag">入匣中</span>
                  </div>
                `).join('')
                : '<div class="muted">当前丹匣为空，先从丹方中炼出几批成药，系统会自动选最强批次生效。</div>')}
            </div>
          </div>
          <div class="card">
            <div class="card-title"><strong>成药库存</strong><span class="tag">${manufacturing.alchemy.inventory.length} 批</span></div>
            <div class="log-list">
              ${(manufacturing.alchemy.inventory?.length
                ? manufacturing.alchemy.inventory.slice(0, 10).map((batch) => `
                  <div class="log-item" ${tooltipAttr([
                    batch.recipe?.description ?? '暂无说明',
                    `药性：${batch.recipe?.profile ?? '暂无'}`,
                    `效果：${renderEffectSummary(batch.totalEffects, getResourceLabel)}`,
                  ])}>
                    <div>
                      <strong>${batch.name}</strong>
                      <div class="muted">${batch.potencyLabel} · ${renderRarityLabel(batch.recipe?.rarity)} · 批量 ${batch.servings ?? 1}${batch.active ? ' · 当前生效' : ''}</div>
                      <div class="muted">效果：${renderEffectSummary(batch.totalEffects, getResourceLabel)}</div>
                    </div>
                    <span class="tag">${batch.active ? '已入匣' : '待替换'}</span>
                  </div>
                `).join('')
                : '<div class="muted">当前还没有已炼成的高阶丹药批次。</div>')}
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="card">
            <div class="card-title"><strong>可炼丹方</strong><span class="tag">${manufacturing.alchemy.unlockedRecipes?.length ?? 0} 卷已开放</span></div>
            <div class="log-list">
              ${(manufacturing.alchemy.unlockedRecipes?.length
                ? manufacturing.alchemy.unlockedRecipes.map((recipe) => `
                  <div class="log-item" ${tooltipAttr([
                    recipe.description,
                    `药性：${recipe.profile}`,
                    `基础效果：${renderEffectSummary(recipe.effects, getResourceLabel)}`,
                    `炼制消耗：${renderWorkshopCost(recipe.cost, formatNumber, getResourceLabel)}`,
                    `开放条件：${renderRequirements(recipe.requirements)}`,
                  ])}>
                    <div>
                      <strong>${recipe.name}</strong>
                      <div class="muted">${renderRarityLabel(recipe.rarity)} · ${recipe.profile}</div>
                      <div class="muted">基础效果：${renderEffectSummary(recipe.effects, getResourceLabel)}</div>
                      <div class="muted">炼制消耗：${renderWorkshopCost(recipe.cost, formatNumber, getResourceLabel)}</div>
                    </div>
                    <button data-action="brew-pill" data-recipe-id="${recipe.id}" ${recipe.craftable ? '' : 'disabled'}>炼制一批</button>
                  </div>
                `).join('')
                : '<div class="muted">当前丹房尚未开放足够丹方，继续提升炼丹坊等级、委托声望与主线进度。</div>')}
            </div>
          </div>
          <div class="card">
            <div class="card-title"><strong>后续丹卷</strong><span class="tag">${manufacturing.alchemy.lockedRecipes?.length ?? 0} 条</span></div>
            <div class="log-list">
              ${(manufacturing.alchemy.lockedRecipes?.length
                ? manufacturing.alchemy.lockedRecipes.map((recipe) => `
                  <div class="log-item">
                    <div>
                      <strong>${recipe.name}</strong>
                      <div class="muted">${recipe.profile}</div>
                      <div class="muted">解锁条件：${renderRequirements(recipe.requirements)}</div>
                    </div>
                    <span class="tag">未开放</span>
                  </div>
                `).join('')
                : '<div class="muted">当前丹方已经全部开放，后续主要目标会转为追求高成色批次。</div>')}
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h3>交易坊</h3><span class="tag">${trade.unlocked ? '已开放' : '未开放'}</span></div>
        <div class="log-list">
          ${trade.routes.map((route) => `
            <div class="log-item" ${tooltipAttr([`投入：${formatResourceAmount(route.sourceId, route.lotSize, ' ')}`, `产出：${formatResourceAmount(route.targetId, route.output, ' ')}`, route.unlocked ? '状态：已开放' : '状态：未开放'])}>
              <div>
                <strong>${route.name}</strong>
                <div class="muted">${getResourceLabel(route.sourceId)} → ${getResourceLabel(route.targetId)}</div>
              </div>
              <div class="inline-actions">
                <button ${route.unlocked ? '' : 'disabled'} class="ghost" data-action="trade-route" data-id="${route.id}" data-multiplier="1">兑换</button>
                <button ${route.unlocked ? '' : 'disabled'} class="secondary" data-action="trade-route" data-id="${route.id}" data-multiplier="5">批量×5</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}
