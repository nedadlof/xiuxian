import { createGameApp } from '../app.js?v=20260312-warehouse';
import { SAVE_KEY } from '../core/save.js';
import { getCraftingSnapshot } from '../systems/shared/crafting.js';
import { renderGame } from '../ui/renderApp.js?v=20260312-warehouse';
import { APP_TABS } from '../ui/tabConfig.js';

const statusEl = document.getElementById('smoke-status');
const summaryEl = document.getElementById('smoke-summary');
const reportEl = document.getElementById('smoke-report');
const root = document.getElementById('app');
const runButton = document.getElementById('run-smoke');
const query = new URLSearchParams(window.location.search);
const reportUrl = query.get('reportUrl');
let reportPublished = false;

const TAB_EXPECTATIONS = {
  overview: '宗门概览',
  economy: '工人与宿舍',
  warehouse: '宗门仓库',
  scripture: '藏经阁',
  barracks: '兵营',
  war: '战斗总览',
  disciples: '弟子堂',
  beasts: '万象森罗录',
  logs: '宗门日志',
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createResultCard(result) {
  const card = document.createElement('div');
  card.className = `card smoke-result ${result.ok ? 'pass' : 'fail'}`;
  card.innerHTML = `
    <div class="card-title"><strong>${result.name}</strong><span class="tag">${result.ok ? 'PASS' : 'FAIL'}</span></div>
    <pre>${result.detail}</pre>
  `;
  return card;
}

function setStatus(text, tone = '') {
  statusEl.textContent = text;
  statusEl.className = `tag ${tone}`.trim();
}

async function publishReport(payload) {
  if (!reportUrl || reportPublished) return;
  reportPublished = true;
  await fetch(reportUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function clearUiTimers(uiState) {
  if (uiState.warReplayTimerId != null) {
    window.clearTimeout(uiState.warReplayTimerId);
    uiState.warReplayTimerId = null;
  }
  if (uiState.warAutoTimerId != null) {
    window.clearTimeout(uiState.warAutoTimerId);
    uiState.warAutoTimerId = null;
  }
  if (uiState.warReplay) {
    uiState.warReplay.autoplay = false;
  }
}

function totalTrainedUnits(state) {
  return Object.values(state.war?.trainedUnits ?? {}).reduce((sum, value) => sum + Math.max(Number(value) || 0, 0), 0);
}

function findActionElement(action, predicate = null) {
  const elements = [...root.querySelectorAll(`[data-action="${action}"]`)];
  const element = predicate ? elements.find(predicate) : elements[0];
  assert(element, `未找到按钮: ${action}`);
  return element;
}

function clickAction(action, predicate = null) {
  const element = findActionElement(action, predicate);
  assert(!element.disabled, `按钮已禁用: ${action}`);
  element.click();
  return element;
}

function createHarness() {
  window.localStorage.removeItem(SAVE_KEY);
  const app = createGameApp();
  const uiState = {};

  function render() {
    renderGame(root, app, uiState);
    clearUiTimers(uiState);
  }

  app.store.subscribe(() => {
    render();
  });

  function goToTab(tabKey) {
    if (!root.innerHTML) {
      render();
    }
    if (app.store.getState().meta.activeTab !== tabKey) {
      clickAction('switch-tab', (element) => element.dataset.tab === tabKey);
    }
    clearUiTimers(uiState);
    assert(app.store.getState().meta.activeTab === tabKey, `切换到 ${tabKey} 失败`);
    const expectedHeading = TAB_EXPECTATIONS[tabKey] ?? (tabKey === 'missions' ? '宗门委托' : tabKey);
    assert(root.textContent.includes(expectedHeading), `Tab ${tabKey} 未渲染预期标题: ${expectedHeading}`);
  }

  function appendLog(message) {
    app.store.update((draft) => {
      draft.logs.unshift({
        id: `smoke-log-${Date.now()}-${draft.logs.length}`,
        category: 'smoke',
        message,
        createdAt: Date.now() + 10 * 60 * 1000,
      });
      draft.logs = draft.logs.slice(0, 80);
    }, { type: 'smoke/log' });
  }

  function ensureResources(resourceMap) {
    app.store.update((draft) => {
      for (const [resourceId, amount] of Object.entries(resourceMap ?? {})) {
        draft.resources[resourceId] = Math.max(draft.resources?.[resourceId] ?? 0, amount);
      }
    }, { type: 'smoke/resources' });
  }

  function ensureResearchPath(nodeIds) {
    goToTab('scripture');
    for (const nodeId of nodeIds) {
      const unlocked = app.store.getState().scripture.unlockedNodes.includes(nodeId);
      if (unlocked) {
        continue;
      }
      clickAction('research-node', (element) => element.dataset.id === nodeId);
      assert(app.store.getState().scripture.unlockedNodes.includes(nodeId), `节点未成功参悟: ${nodeId}`);
    }
  }

  function withPatchedConfirmAndReload(confirmResult, callback) {
    const originalConfirm = window.confirm;
    const locationProto = Object.getPrototypeOf(window.location);
    const originalProtoReload = locationProto.reload;
    let reloadCalls = 0;
    let reloadHookInstalled = false;

    window.confirm = () => confirmResult;
    try {
      locationProto.reload = function patchedReload() {
        reloadCalls += 1;
      };
      reloadHookInstalled = true;
    } catch (error) {
      reloadHookInstalled = false;
    }

    let originalOwnReload;
    let hadOwnReload = false;
    try {
      hadOwnReload = Object.prototype.hasOwnProperty.call(window.location, 'reload');
      originalOwnReload = window.location.reload;
      window.location.reload = function patchedOwnReload() {
        reloadCalls += 1;
      };
      reloadHookInstalled = true;
    } catch (error) {
      // Ignore if the instance property is not writable.
    }

    try {
      return callback({
        getReloadCalls: () => reloadCalls,
        reloadHookInstalled,
      });
    } finally {
      window.confirm = originalConfirm;
      if (reloadHookInstalled) {
        try {
          locationProto.reload = originalProtoReload;
        } catch (error) {
          // Ignore cleanup failure on locked browser objects.
        }
      }
      if (hadOwnReload) {
        try {
          window.location.reload = originalOwnReload;
        } catch (error) {
          // Ignore cleanup failure on locked browser objects.
        }
      } else {
        try {
          delete window.location.reload;
        } catch (error) {
          // Ignore cleanup failure on locked browser objects.
        }
      }
    }
  }

  return {
    app,
    uiState,
    render,
    goToTab,
    appendLog,
    ensureResources,
    ensureResearchPath,
    withPatchedConfirmAndReload,
  };
}

async function runSmoke() {
  const results = [];
  reportEl.innerHTML = '';
  root.innerHTML = '';
  reportPublished = false;
  setStatus('执行中', 'tag-saved-pulse');
  summaryEl.textContent = '执行中';
  const watchdogId = window.setTimeout(() => {
    publishReport({
      ok: false,
      passed: results.filter((item) => item.ok).length,
      total: results.length,
      results,
      error: 'Smoke watchdog timeout',
      title: 'SMOKE WATCHDOG TIMEOUT',
      finishedAt: new Date().toISOString(),
    }).catch(() => {});
  }, 20000);

  async function runCase(name, fn) {
    const startedAt = performance.now();
    try {
      const detail = await fn();
      const duration = Math.round(performance.now() - startedAt);
      const result = { name, ok: true, detail: `${detail}\n耗时: ${duration}ms` };
      results.push(result);
      reportEl.appendChild(createResultCard(result));
    } catch (error) {
      const duration = Math.round(performance.now() - startedAt);
      const message = error instanceof Error ? (error.stack || error.message) : String(error);
      const result = { name, ok: false, detail: `${message}\n耗时: ${duration}ms` };
      results.push(result);
      reportEl.appendChild(createResultCard(result));
      throw error;
    }
  }

  const harness = createHarness();

  try {
    await runCase('Render Default Overview', async () => {
      harness.render();
      assert(root.textContent.includes('宗门概览'), '默认页未渲染宗门概览');
      return '默认 overview 渲染成功';
    });

    await runCase('Navigate All Tabs', async () => {
      for (const [tabKey] of APP_TABS) {
        harness.goToTab(tabKey);
      }
      return `完成 ${APP_TABS.length} 个 tab 切换`;
    });

    await runCase('Save Game Control', async () => {
      harness.goToTab('overview');
      clickAction('save-game');
      const raw = window.localStorage.getItem(SAVE_KEY);
      assert(raw, '未写入本地存档');
      const payload = JSON.parse(raw);
      assert(payload?.state?.meta?.lastSavedAt > 0, `存档时间戳无效: ${payload?.state?.meta?.lastSavedAt}`);
      assert(harness.app.store.getState().meta.lastSavedAt > 0, 'store meta 未同步存档时间');
      return `save key=${SAVE_KEY}，lastSavedAt=${payload.state.meta.lastSavedAt}`;
    });

    await runCase('Barracks Recruit And Arrange', async () => {
      harness.ensureResearchPath(['wanwu-shengfa', 'fansu-shangdao', 'bingdao-chushi']);
      harness.ensureResources({ lingStone: 5000, wood: 1200, herb: 600, iron: 400, pills: 120, talisman: 120 });
      harness.goToTab('barracks');
      const beforeUnits = totalTrainedUnits(harness.app.store.getState());
      clickAction('train-unit', (element) => element.dataset.amount === '5');
      const afterTrain = totalTrainedUnits(harness.app.store.getState());
      assert(afterTrain >= beforeUnits + 5, `招募未生效: before=${beforeUnits}, after=${afterTrain}`);
      clickAction('auto-arrange');
      const beforeFormation = harness.app.store.getState().war.formationId;
      const beforePreparedUnits = totalTrainedUnits(harness.app.store.getState());
      const applyButton = root.querySelector('[data-action="apply-recommended-formation"]');
      if (applyButton) {
        applyButton.click();
      }
      const afterState = harness.app.store.getState();
      const afterFormation = afterState.war.formationId;
      const afterPreparedUnits = totalTrainedUnits(afterState);
      const recommendedUnit = harness.app.registries.units.list().find((unit) => (afterState.war.trainedUnits?.[unit.id] ?? 0) > 0);
      if (recommendedUnit) {
        assert((afterState.war.formationRows?.[recommendedUnit.id] ?? 0) > 0, `推荐整备未写入站位: ${recommendedUnit.id}`);
      }
      assert(afterPreparedUnits >= beforePreparedUnits, `推荐整备未补兵: before=${beforePreparedUnits}, after=${afterPreparedUnits}`);
      assert(root.textContent.includes('阵型加成'), '兵营页未渲染阵型加成');
      assert(root.textContent.includes('兵种克制'), '兵营页未渲染兵种克制');
      assert(root.textContent.includes('推荐配队'), '兵营页未渲染推荐配队');
      return `兵种数量 ${beforeUnits} -> ${afterPreparedUnits}，阵法 ${beforeFormation} -> ${afterFormation}`;
    });

    await runCase('Trade Exchange And Preparation Flow', async () => {
      harness.ensureResources({
        herb: 1200,
        pills: 240,
        iron: 480,
        wood: 1600,
        talisman: 180,
        spiritCrystal: 120,
      });
      harness.ensureResearchPath(['wanwu-shengfa', 'fansu-shangdao', 'bingdao-chushi', 'tiandi-zhenwen', 'wuxing-xiangsheng', 'qimen-dunjia']);
      harness.goToTab('economy');
      const beforeTrade = harness.app.store.getState().trade.totalExchanged;
      const beforePreparation = harness.app.store.getState().preparations?.levels?.['alchemy-tonic'] ?? 0;
      const routeButton = findActionElement('trade-route', (element) => !element.disabled && element.dataset.multiplier === '1');
      routeButton.click();
      clickAction('refine-preparation', (element) => element.dataset.id === 'alchemy-tonic');
      const afterState = harness.app.store.getState();
      assert(afterState.trade.totalExchanged > beforeTrade, `交易未生效: before=${beforeTrade}, after=${afterState.trade.totalExchanged}`);
      assert((afterState.preparations?.levels?.['alchemy-tonic'] ?? 0) > beforePreparation, `战备炼制未生效: before=${beforePreparation}, after=${afterState.preparations?.levels?.['alchemy-tonic'] ?? 0}`);
      assert(root.textContent.includes('交易坊'), '产业页未渲染交易坊');
      assert(root.textContent.includes('战备炼制'), '产业页未渲染战备炼制');
      return `交易次数 ${beforeTrade} -> ${afterState.trade.totalExchanged}，养气丹录 ${beforePreparation} -> ${afterState.preparations?.levels?.['alchemy-tonic'] ?? 0}`;
    });

    await runCase('Forge And Alchemy Craft Loop', async () => {
      harness.ensureResources({
        lingStone: 50000,
        wood: 8000,
        herb: 8000,
        iron: 8000,
        pills: 2400,
        talisman: 1400,
        spiritCrystal: 1600,
      });
      harness.app.store.update((draft) => {
        draft.scripture.unlockedNodes = [...new Set([
          ...(draft.scripture.unlockedNodes ?? []),
          'wanwu-shengfa',
          'fansu-shangdao',
          'bingdao-chushi',
          'tiandi-zhenwen',
          'wuxing-xiangsheng',
          'qimen-dunjia',
          'zhangu-jiwu',
          'wanling-ganying',
          'youming-dujing',
          'huanxin-mizang',
          'shenbing-bailian',
          'danxin-dao',
        ])];
        draft.buildings.smithy = { ...(draft.buildings.smithy ?? {}), level: Math.max(draft.buildings.smithy?.level ?? 0, 4) };
        draft.buildings.alchemy = { ...(draft.buildings.alchemy ?? {}), level: Math.max(draft.buildings.alchemy?.level ?? 0, 4) };
        draft.commissions.reputation = Math.max(draft.commissions?.reputation ?? 0, 120);
        draft.commissions.affairsCredit = Math.max(draft.commissions?.affairsCredit ?? 0, 80);
        draft.war.clearedStages = [...new Set([
          ...(draft.war.clearedStages ?? []),
          'stage-cultivation-2',
          'stage-cultivation-3',
          'stage-ancient-1',
          'stage-ancient-2',
          'stage-ancient-3',
        ])];
      }, { type: 'smoke/crafting-setup' });
      harness.goToTab('economy');
      assert(root.textContent.includes('锻炉百兵'), '经济页未渲染锻炉百兵');
      assert(root.textContent.includes('丹阁百方'), '经济页未渲染丹阁百方');
      assert(root.textContent.includes('工坊订单'), '经济页未渲染工坊订单');
      assert(root.textContent.includes('兵丹共鸣'), '经济页未渲染兵丹共鸣');
      const beforeState = harness.app.store.getState();
      const beforeWeaponCount = beforeState.crafting?.forgedWeapons?.length ?? 0;
      const beforePillCount = beforeState.crafting?.brewedPills?.length ?? 0;
      const beforeEssence = beforeState.crafting?.weaponEssence ?? 0;
      const beforeReputation = beforeState.commissions?.reputation ?? 0;
      const beforeAffairsCredit = beforeState.commissions?.affairsCredit ?? 0;
      const beforeOrderHistory = beforeState.crafting?.fulfillmentHistory?.length ?? 0;
      clickAction('forge-weapon', (element) => element.dataset.blueprintId === 'greenvine-fan' && !element.disabled);
      clickAction('forge-weapon', (element) => element.dataset.blueprintId === 'xuanzhu-sword' && !element.disabled);
      let craftingState = harness.app.store.getState();
      assert((craftingState.crafting?.forgedWeapons?.length ?? 0) >= beforeWeaponCount + 2, '锻造未生成武器库存');
      const forgedWeapons = craftingState.crafting.forgedWeapons ?? [];
      const strengthenTargetId = forgedWeapons.find((weapon) => weapon.blueprintId === 'greenvine-fan')?.id;
      const dismantleTargetId = forgedWeapons.find((weapon) => weapon.id !== strengthenTargetId)?.id;
      assert(dismantleTargetId && strengthenTargetId, '锻造后武器数量不足以验证分解与强化');
      clickAction('dismantle-weapon', (element) => element.dataset.weaponId === dismantleTargetId);
      craftingState = harness.app.store.getState();
      assert((craftingState.crafting?.weaponEssence ?? 0) > beforeEssence, '分解武器未回收器魂');
      const strengthenBefore = (craftingState.crafting?.forgedWeapons ?? []).find((weapon) => weapon.id === strengthenTargetId)?.strengthenLevel ?? 0;
      clickAction('strengthen-weapon', (element) => element.dataset.weaponId === strengthenTargetId && !element.disabled);
      craftingState = harness.app.store.getState();
      const strengthenAfter = (craftingState.crafting?.forgedWeapons ?? []).find((weapon) => weapon.id === strengthenTargetId)?.strengthenLevel ?? 0;
      assert(strengthenAfter > strengthenBefore, `武器强化未生效: before=${strengthenBefore}, after=${strengthenAfter}`);
      harness.app.store.update((draft) => {
        draft.crafting.weaponEssence = Math.max(draft.crafting?.weaponEssence ?? 0, 120);
        draft.commissions.affairsCredit = Math.max(draft.commissions?.affairsCredit ?? 0, 120);
      }, { type: 'smoke/crafting-reforge-buffer' });
      clickAction('cycle-weapon-reforge-lock', (element) => element.dataset.weaponId === strengthenTargetId && !element.disabled);
      clickAction('cycle-weapon-reforge-focus', (element) => element.dataset.weaponId === strengthenTargetId && !element.disabled);
      craftingState = harness.app.store.getState();
      const reforgePlan = craftingState.crafting?.reforgePlans?.[strengthenTargetId] ?? null;
      assert(reforgePlan?.lockedAffixId, `武器锁词方案未写入: ${JSON.stringify(reforgePlan)}`);
      assert(reforgePlan?.focusType, `武器洗练倾向未写入: ${JSON.stringify(reforgePlan)}`);
      const reforgeBefore = (craftingState.crafting?.forgedWeapons ?? []).find((weapon) => weapon.id === strengthenTargetId)?.reforgeCount ?? 0;
      clickAction('reforge-weapon', (element) => element.dataset.weaponId === strengthenTargetId && !element.disabled);
      craftingState = harness.app.store.getState();
      const reforgeAfter = (craftingState.crafting?.forgedWeapons ?? []).find((weapon) => weapon.id === strengthenTargetId)?.reforgeCount ?? 0;
      assert(reforgeAfter > reforgeBefore, `武器洗练未生效: before=${reforgeBefore}, after=${reforgeAfter}`);
      clickAction('brew-pill', (element) => element.dataset.recipeId === 'qinglan-yangqi' && !element.disabled);
      craftingState = harness.app.store.getState();
      assert((craftingState.crafting?.brewedPills?.length ?? 0) > beforePillCount, '炼丹未生成成药批次');
      const craftingSnapshot = getCraftingSnapshot(craftingState);
      assert(
        craftingSnapshot.resonance?.active?.some((entry) => entry.id === 'verdant-revival'),
        `兵丹共鸣未按预期激活: ${JSON.stringify(craftingSnapshot.resonance?.active?.map((entry) => entry.id) ?? [])}`,
      );
      clickAction('fulfill-workshop-order', (element) => !element.disabled);
      craftingState = harness.app.store.getState();
      assert((craftingState.crafting?.fulfillmentHistory?.length ?? 0) > beforeOrderHistory, '工坊订单未写入交付记录');
      assert((craftingState.commissions?.reputation ?? 0) > beforeReputation, '工坊订单未增加声望');
      assert((craftingState.commissions?.affairsCredit ?? 0) >= beforeAffairsCredit, '工坊订单异常扣减事务点');
      assert(root.textContent.includes('器库库存'), '经济页未渲染器库库存');
      assert(root.textContent.includes('成药库存'), '经济页未渲染成药库存');
      return `锻造库存 ${beforeWeaponCount} -> ${craftingState.crafting?.forgedWeapons?.length ?? 0}，器魂 ${beforeEssence} -> ${craftingState.crafting?.weaponEssence ?? 0}，强化 ${strengthenBefore} -> ${strengthenAfter}，洗练 ${reforgeBefore} -> ${reforgeAfter}，共鸣=${craftingSnapshot.resonance?.active?.map((entry) => entry.name).join('/') || 'none'}，成药 ${beforePillCount} -> ${craftingState.crafting?.brewedPills?.length ?? 0}，声望 ${beforeReputation} -> ${craftingState.commissions?.reputation ?? 0}`;
      });

    await runCase('Warehouse Seal And Strategy Flow', async () => {
      harness.ensureResources({
        lingStone: 4000,
        spiritCrystal: 200,
        herb: 1200,
        wood: 1400,
        pills: 120,
      });
      harness.goToTab('warehouse');
      assert(root.textContent.includes('仓储法策'), '仓库页未渲染仓储法策');
      const beforeState = harness.app.store.getState();
      const beforeSealTotal = Object.values(beforeState.warehouse?.seals ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
      clickAction('warehouse-seal', (element) => element.dataset.id === 'spirit-cellar');
      clickAction('warehouse-seal', (element) => element.dataset.id === 'herbal-rack');
      let state = harness.app.store.getState();
      assert((state.warehouse?.seals?.['spirit-cellar'] ?? 0) >= 1, '灵泉地窖未成功封存');
      assert((state.warehouse?.seals?.['herbal-rack'] ?? 0) >= 1, '百草封架未成功封存');
      const afterManualSealTotal = Object.values(state.warehouse?.seals ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
      clickAction('set-warehouse-strategy', (element) => element.dataset.id === 'growth-cycle');
      state = harness.app.store.getState();
      assert(state.warehouse?.activeStrategyId === 'growth-cycle', `仓策未切换成功: ${state.warehouse?.activeStrategyId}`);
      clickAction('toggle-warehouse-auto-seal');
      state = harness.app.store.getState();
      assert(state.warehouse?.autoSealEnabled, '仓库自动封存未开启');
      harness.app.engine.runTick(1, 'smoke');
      state = harness.app.store.getState();
      const afterSealTotal = Object.values(state.warehouse?.seals ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
      assert(afterManualSealTotal >= beforeSealTotal + 2, `手动封存次数异常: before=${beforeSealTotal}, afterManual=${afterManualSealTotal}`);
      assert(afterSealTotal > afterManualSealTotal, `自动封存未追加次数: manual=${afterManualSealTotal}, after=${afterSealTotal}`);
      return `总仓阶=${Object.values(state.warehouse?.seals ?? {}).join('/')}，仓策=${state.warehouse?.activeStrategyId}`;
    });

    await runCase('Disciples Train And Team Flow', async () => {
      harness.ensureResources({
        spiritCrystal: 400,
        lingStone: 4000,
        dao: 9999999,
        herb: 600,
        wood: 600,
        iron: 400,
        pills: 120,
        talisman: 120,
      });
      harness.ensureResearchPath(['wanwu-shengfa', 'fansu-shangdao', 'bingdao-chushi', 'tiandi-zhenwen', 'wuxing-xiangsheng']);
      harness.goToTab('disciples');
      const stateBefore = harness.app.store.getState();
      assert((stateBefore.disciples.unlocked?.length ?? 0) >= 3, '弟子候选池数量不足');
      clickAction('buy-recruit-token', (element) => element.dataset.resource === 'tianmingSeal');
      clickAction('set-recruit-focus', (element) => element.dataset.id === 'wu-tie');
      clickAction('recruit-targeted');
      let recruitedState = harness.app.store.getState();
      assert(recruitedState.disciples.owned.includes('wu-tie'), '天命直收未招得乌铁');
      for (let index = 0; index < 11; index += 1) {
        clickAction('buy-recruit-token', (element) => element.dataset.resource === 'seekImmortalToken');
      }
      clickAction('recruit-advanced', (element) => element.dataset.count === '10');
      recruitedState = harness.app.store.getState();
      const ownedId = recruitedState.disciples.owned.find((id) => id === 'han-li');
      assert(ownedId, '高级十连保底未招得韩立');
      assert((recruitedState.resources?.discipleShard ?? 0) > 0, '重复弟子未转化命魂残片');
      clickAction('set-recruit-faction', (element) => element.dataset.faction === 'qingmu-grove');
      clickAction('recruit-faction', (element) => element.dataset.count === '1');
      recruitedState = harness.app.store.getState();
      assert(recruitedState.disciples.recruit?.lastResult?.mode === 'faction', '阵营定向池未生效');
      harness.goToTab('disciples');
      const beforeLevel = recruitedState.disciples.levels?.[ownedId] ?? 1;
      const beforeResonance = recruitedState.disciples.resonance?.[ownedId] ?? 0;
      clickAction('train-disciple', (element) => element.dataset.id === ownedId && element.dataset.amount === '1');
      clickAction('advance-disciple', (element) => element.dataset.id === ownedId);
      clickAction('set-leader', (element) => element.dataset.id === ownedId);
      clickAction('toggle-support', (element) => element.dataset.id === 'wu-tie');
      clickAction('toggle-support', (element) => element.dataset.id === 'su-qinghe');
      clickAction('apply-team');
      const afterState = harness.app.store.getState();
      const afterLevel = afterState.disciples.levels?.[ownedId] ?? 1;
      const afterResonance = afterState.disciples.resonance?.[ownedId] ?? 0;
      assert(afterState.disciples.expeditionTeam.supportIds.includes('wu-tie'), '出征副将未包含乌铁');
      assert(afterState.disciples.expeditionTeam.supportIds.includes('su-qinghe'), '出征副将未包含苏轻荷');
      assert(root.textContent.includes('三脉同游'), '出征羁绊预览未显示三脉同游');
      assert(afterResonance > beforeResonance, `弟子共鸣突破未生效: before=${beforeResonance}, after=${afterResonance}`);
      assert(afterLevel > beforeLevel, `弟子培养未生效: before=${beforeLevel}, after=${afterLevel}`);
      assert(afterState.disciples.expeditionTeam.leaderId === ownedId, '弟子出征主将未应用');
      return `弟子 ${ownedId} 等级 ${beforeLevel} -> ${afterLevel}`;
    });

    await runCase('Commission Idle Loop', async () => {
      harness.ensureResources({ spiritCrystal: 80, dao: 9999999 });
      harness.goToTab('missions');
      assert(root.textContent.includes('宗门风向'), 'Commission theme panel missing');
      assert(root.textContent.includes('委派阶位'), 'Commission standing panel missing');
      assert(root.textContent.includes('执务策令'), 'Commission directive panel missing');
      assert(root.textContent.includes('专长命中'), 'Commission affinity summary missing');
      clickAction('select-commission-directive', (element) => element.dataset.id === 'all-domain-gazette' && !element.disabled);
      const beforeState = harness.app.store.getState();
      assert(beforeState.commissions?.activeDirectiveId === 'all-domain-gazette', 'Commission directive was not selected');
      assert(beforeState.commissions?.currentThemeId, 'Commission theme was not initialized');
      assert((beforeState.commissions?.currentThemeExpiresAt ?? 0) > Date.now(), 'Commission theme expiry missing');
      const beforeReputation = beforeState.commissions?.reputation ?? 0;
      const beforeBoard = (beforeState.commissions?.boardIds ?? []).join(',');
      clickAction('reroll-commission-board', (element) => !element.disabled);
      let commissionState = harness.app.store.getState();
      const rerolledBoard = (commissionState.commissions?.boardIds ?? []).join(',');
      assert((commissionState.commissions?.rerollCooldownUntil ?? 0) > Date.now(), 'Commission reroll cooldown missing');
      assert(rerolledBoard && rerolledBoard !== beforeBoard, 'Commission board did not change after reroll');
      const afterRerollDao = commissionState.resources?.dao ?? 0;
      clickAction('start-commission', (element) => !element.disabled);
      commissionState = harness.app.store.getState();
      assert(commissionState.commissions?.active, '委托未成功开始');
      const interruptedDefinitionId = commissionState.commissions?.active?.definitionId;
      clickAction('cancel-commission');
      commissionState = harness.app.store.getState();
      assert(!commissionState.commissions?.active, 'Commission stayed active after cancel');
      assert(commissionState.commissions?.history?.some((entry) => entry.resultType === 'interrupted'), 'Interrupted commission missing from history');
      assert((commissionState.commissions?.cooldowns?.[interruptedDefinitionId] ?? 0) > Date.now(), 'Interrupted commission cooldown missing');
      clickAction('start-commission', (element) => !element.disabled);
      commissionState = harness.app.store.getState();
      assert(commissionState.commissions?.active, 'Unable to start a new commission after cancel');
      harness.app.engine.runTick(120, 'runtime');
      commissionState = harness.app.store.getState();
      assert(commissionState.commissions?.active?.eventState?.pendingEvent, 'Commission event did not trigger mid-run');
      clickAction('resolve-commission-event', (element) => !element.disabled);
      commissionState = harness.app.store.getState();
      assert(!commissionState.commissions?.active?.eventState?.pendingEvent, 'Commission event was not resolved');
      assert((commissionState.commissions?.active?.eventState?.resolvedEvents?.length ?? 0) > 0, 'Commission event resolution was not recorded');
      assert(commissionState.commissions?.aftereffect, 'Commission aftereffect was not created');
      harness.app.engine.runTick(300, 'smoke');
      commissionState = harness.app.store.getState();
      assert((commissionState.commissions?.completed?.length ?? 0) > 0, '委托未在挂机后完成');
      clickAction('claim-commission', (element) => !element.disabled);
      const afterState = harness.app.store.getState();
      assert(afterState.commissions?.history?.some((entry) => entry.resultType === 'completed'), 'Completed commission missing from history');
      assert((afterState.commissions?.reputation ?? 0) > beforeReputation, 'Commission claim did not increase reputation');
      assert(afterState.commissions?.directiveRewardReady, 'Commission directive did not reach reward-ready state');
      clickAction('claim-commission-directive');
      const afterDirectiveState = harness.app.store.getState();
      assert((afterDirectiveState.commissions?.completedDirectiveCount ?? 0) > (afterState.commissions?.completedDirectiveCount ?? 0), 'Commission directive reward was not claimed');
      assert(root.textContent.includes('卷宗悬案'), 'Commission case file panel missing');
      const caseButton = [...root.querySelectorAll('[data-action="start-commission"]')].find((element) => element.dataset.sourceType === 'case' && !element.disabled);
      assert(caseButton, 'No commission case file became dispatchable');
      caseButton.click();
      commissionState = harness.app.store.getState();
      assert(commissionState.commissions?.active?.sourceType === 'case', 'Case file did not start');
      harness.app.engine.runTick(240, 'smoke');
      harness.app.engine.runTick(240, 'smoke');
      commissionState = harness.app.store.getState();
      const completedCase = commissionState.commissions?.completed?.find((entry) => entry.sourceType === 'case');
      assert(completedCase, 'Case file did not complete');
      assert((commissionState.commissions?.resolvedCaseFileIds ?? []).includes(completedCase.definitionId), 'Case file was not marked as resolved');
      clickAction('claim-commission', (element) => element.dataset.id === completedCase.id);
      const afterCaseState = harness.app.store.getState();
      assert(afterCaseState.commissions?.history?.some((entry) => entry.sourceType === 'case' && entry.definitionId === completedCase.definitionId), 'Case file settlement did not enter history');
      assert(root.textContent.includes('委派奖励册'), 'Commission milestone panel missing');
      const claimableMilestone = [...root.querySelectorAll('[data-action="claim-commission-milestone"]')].find((element) => !element.disabled);
      assert(claimableMilestone, 'No commission milestone became claimable');
      claimableMilestone.click();
      const afterMilestoneState = harness.app.store.getState();
      assert((afterMilestoneState.commissions?.claimedMilestoneIds?.length ?? 0) > (afterCaseState.commissions?.claimedMilestoneIds?.length ?? 0), 'Commission milestone was not claimed');
      const supplyButton = [...root.querySelectorAll('[data-action="purchase-commission-supply"]')].find((element) => !element.disabled);
      assert(supplyButton, 'No commission supply was purchasable');
      supplyButton.click();
      const afterSupplyState = harness.app.store.getState();
      assert(afterSupplyState.commissions?.preparationBoost || (afterSupplyState.commissions?.nextSpecialSpawnAt ?? 0) <= (afterMilestoneState.commissions?.nextSpecialSpawnAt ?? Infinity), 'Commission supply had no visible effect');
      const shopButton = [...root.querySelectorAll('[data-action="purchase-commission-shop-item"]')].find((element) => !element.disabled);
      assert(shopButton, 'No commission shop item was purchasable');
      shopButton.click();
      const afterShopState = harness.app.store.getState();
      assert((afterShopState.commissions?.purchasedShopItemIds?.length ?? 0) > (afterSupplyState.commissions?.purchasedShopItemIds?.length ?? 0), 'Commission shop item was not purchased');
      assert(root.textContent.includes('委托排程'), 'Commission auto dispatch panel missing');
      const beforeAutoClaimed = afterShopState.commissions?.claimedCount ?? 0;
      clickAction('toggle-commission-auto-dispatch');
      commissionState = harness.app.store.getState();
      assert(commissionState.commissions?.autoDispatch?.enabled, 'Commission auto dispatch was not enabled');
      harness.app.engine.runTick(1, 'smoke');
      commissionState = harness.app.store.getState();
      assert(commissionState.commissions?.active || (commissionState.commissions?.completed?.length ?? 0) > 0, 'Commission auto dispatch did not pick a mission');
      harness.app.engine.runTick(480, 'smoke');
      harness.app.engine.runTick(480, 'smoke');
      commissionState = harness.app.store.getState();
      assert((commissionState.commissions?.claimedCount ?? 0) > beforeAutoClaimed, 'Commission auto dispatch did not auto-settle missions');
      assert(!commissionState.commissions?.active?.eventState?.pendingEvent, 'Commission auto dispatch left an event unresolved');
      assert((afterCaseState.resources?.dao ?? 0) > afterRerollDao, 'Commission rewards did not increase dao after settlement');
      return `刷新委托榜并验证中断/冷却，含卷宗结案与自动排程，历史 ${commissionState.commissions.history.length} 条`;
    });

    await runCase('War Auto Preferences And Quick Flow', async () => {
      harness.goToTab('war');
      clickAction('battle-auto-strategy', (element) => element.dataset.id === 'focus-lowest-hp');
      clickAction('battle-auto-speed', (element) => element.dataset.id === 'fast');

      let state = harness.app.store.getState();
      assert(state.war.autoPreferences?.strategyId === 'focus-lowest-hp', `默认自动战斗策略未更新: ${state.war.autoPreferences?.strategyId}`);
      assert(state.war.autoPreferences?.speedId === 'fast', `默认自动战斗速度未更新: ${state.war.autoPreferences?.speedId}`);

      const beforeReports = state.war.battleReports.length;
      clickAction('quick-challenge-stage', (element) => !element.disabled && element.dataset.id === state.war.currentStageId);
      state = harness.app.store.getState();
      assert(state.war.battleReports.length > beforeReports, `一键挑战未生成战报: before=${beforeReports}, after=${state.war.battleReports.length}`);
      assert(root.textContent.includes('最近战果'), '战争页未渲染最近战果');
      assert(root.textContent.includes('本关联动收益'), '战争页未渲染本关联动收益');

      const latestReport = state.war.battleReports[0];
      assert(latestReport, '一键挑战后缺少最新战报');
      return `默认偏好已保存，一键挑战成功产出战报 ${beforeReports} -> ${state.war.battleReports.length}，最近战果=${latestReport.stageName}`;
    });

    await runCase('War Battle Reward Linkage', async () => {
      harness.app.store.update((draft) => {
        draft.buildings.alchemy = { ...(draft.buildings.alchemy ?? {}), level: Math.max(draft.buildings.alchemy?.level ?? 0, 1) };
        draft.buildings.smithy = { ...(draft.buildings.smithy ?? {}), level: Math.max(draft.buildings.smithy?.level ?? 0, 1) };
        draft.buildings.talismanWorkshop = { ...(draft.buildings.talismanWorkshop ?? {}), level: Math.max(draft.buildings.talismanWorkshop?.level ?? 0, 1) };
        draft.war.currentStageId = 'stage-mortal-1';
        draft.war.trainedUnits['shield-guard'] = Math.max(draft.war.trainedUnits['shield-guard'] ?? 0, 18);
        draft.war.trainedUnits['spirit-archer'] = Math.max(draft.war.trainedUnits['spirit-archer'] ?? 0, 18);
        const unlockedBeastId = draft.beasts.unlocked?.[0] ?? null;
        if (unlockedBeastId && !draft.beasts.activeIds.includes(unlockedBeastId)) {
          draft.beasts.activeIds.push(unlockedBeastId);
        }
      }, { type: 'smoke/war-linked-reward-setup' });
      harness.goToTab('war');
      const beforeReports = harness.app.store.getState().war.battleReports.length;
      clickAction('quick-challenge-stage', (element) => !element.disabled && element.dataset.id === harness.app.store.getState().war.currentStageId);

      const afterState = harness.app.store.getState();
      const afterReports = afterState.war.battleReports.length;
      assert(afterReports > beforeReports, `战斗未生成战报: before=${beforeReports}, after=${afterReports}`);
      const latestReport = afterState.war.battleReports?.[0];
      assert(latestReport?.victory, `联动奖励验证战斗失败: ${JSON.stringify({ victory: latestReport?.victory, reward: latestReport?.reward })}`);
      const linkedReward = latestReport?.rewardBreakdown?.linkedReward ?? {};
      assert(Object.keys(linkedReward).length > 0, `战报未写入联动奖励: ${JSON.stringify(linkedReward)}`);
      assert((latestReport?.expeditionSupport?.memberNames?.length ?? 0) > 0, '战报未记录出征弟子');
      assert(root.textContent.includes('联动掉落'), '战争页未展示联动掉落');
      return `战报 ${beforeReports} -> ${afterReports}，联动奖励=${JSON.stringify(linkedReward)}`;
    });

    await runCase('War Stage Surface Simplicity', async () => {
      harness.goToTab('war');
      assert(root.textContent.includes('战斗总览'), '战争页未渲染战斗总览');
      assert(root.textContent.includes('战前建议'), '战争页未渲染战前建议');
      assert(root.textContent.includes('兵种克制'), '战争页未渲染兵种克制');
      assert(root.textContent.includes('推荐配队'), '战争页未渲染推荐配队');
      assert(root.querySelector('[data-action="apply-recommended-formation"]'), '战争页未提供一键套用推荐');
      if (root.textContent.includes('本次整备仍缺')) {
        assert(root.textContent.includes('优先补'), '战争页缺少整备差额引导');
      }
      assert(root.textContent.includes('一键挑战') || root.textContent.includes('再次扫荡'), '战争页未提供简化挑战入口');
      assert(!root.textContent.includes('战斗回放'), '战争页仍保留旧版战斗回放入口');
      assert(!root.textContent.includes('历次战报'), '战争页仍保留旧版历次战报大面板');
      const adviceButton = root.querySelector('[data-action="switch-tab"][data-tab="economy"], [data-action="switch-tab"][data-tab="disciples"], [data-action="switch-tab"][data-tab="beasts"]');
      assert(adviceButton, '战前建议未提供强化跳转入口');
      adviceButton.click();
      assert(['economy', 'disciples', 'beasts'].includes(harness.app.store.getState().meta.activeTab), '战前建议跳转未生效');
      harness.goToTab('war');
      return '战争页已收敛为总览 + 战前建议 + 联动收益 + 最近战果 + 关卡列表的简化主流程';
    });

    await runCase('Beasts Unlock And Toggle', async () => {
      harness.ensureResources({ beastShard: 12, spiritCrystal: 160, pills: 120, talisman: 80 });
      harness.ensureResearchPath([
        'wanwu-shengfa',
        'fansu-shangdao',
        'bingdao-chushi',
        'tiandi-zhenwen',
        'wuxing-xiangsheng',
        'qimen-dunjia',
        'zhangu-jiwu',
        'wanling-ganying',
      ]);
      harness.app.store.update((draft) => {
        draft.war.currentStageId = 'stage-mortal-2';
        for (const extraBeastId of ['earthfiend-shadowwolf', 'jiuying', 'qiongqi']) {
          if (!draft.beasts.unlocked.includes(extraBeastId)) {
            draft.beasts.unlocked.push(extraBeastId);
          }
        }
        draft.warehouse.autoSealEnabled = false;
        draft.commissions.autoDispatch = {
          ...(draft.commissions.autoDispatch ?? {}),
          enabled: false,
        };
        draft.beasts.activeIds = [];
        draft.beasts.awakeningLevels.qiongqi = Math.max(draft.beasts.awakeningLevels?.qiongqi ?? 0, 2);
        draft.beasts.awakeningLevels.jiuying = Math.max(draft.beasts.awakeningLevels?.jiuying ?? 0, 1);
        draft.beasts.bondLevels.qiongqi = Math.max(draft.beasts.bondLevels?.qiongqi ?? 0, 3);
        draft.beasts.bondLevels.jiuying = Math.max(draft.beasts.bondLevels?.jiuying ?? 0, 3);
      }, { type: 'smoke/beast-lineup-setup' });
      harness.goToTab('beasts');
      const stateBefore = harness.app.store.getState();
      const beastId = stateBefore.beasts.unlocked[0];
      assert(beastId, '未解锁首只灵兽');
      const wasActive = stateBefore.beasts.activeIds.includes(beastId);
      const beforeAwakening = stateBefore.beasts.awakeningLevels?.[beastId] ?? 0;
      const beforeBond = stateBefore.beasts.bondLevels?.[beastId] ?? 0;
      const beforeShard = stateBefore.resources?.beastShard ?? 0;
      const beforeCrystal = stateBefore.resources?.spiritCrystal ?? 0;
      clickAction('toggle-beast', (element) => element.dataset.id === beastId);
      clickAction('awaken-beast', (element) => element.dataset.id === beastId);
      clickAction('temper-beast', (element) => element.dataset.id === beastId);
      const afterState = harness.app.store.getState();
      const isActive = afterState.beasts.activeIds.includes(beastId);
      const afterAwakening = afterState.beasts.awakeningLevels?.[beastId] ?? 0;
      const afterBond = afterState.beasts.bondLevels?.[beastId] ?? 0;
      const afterShard = afterState.resources?.beastShard ?? 0;
      const afterCrystal = afterState.resources?.spiritCrystal ?? 0;
      const beforeApplyIds = [...(afterState.beasts.activeIds ?? [])];
      assert(isActive !== wasActive, '灵兽切换激活状态未生效');
      assert(afterAwakening > beforeAwakening, `灵兽觉醒未生效: before=${beforeAwakening}, after=${afterAwakening}`);
      assert(afterBond > beforeBond, `灵兽灌灵未生效: before=${beforeBond}, after=${afterBond}`);
      assert(afterShard < beforeShard, `灵兽觉醒未消耗碎片: before=${beforeShard}, after=${afterShard}`);
      assert(afterCrystal < beforeCrystal, `灵兽灌灵未消耗灵晶: before=${beforeCrystal}, after=${afterCrystal}`);
      const applyButton = root.querySelector('[data-action="apply-recommended-beasts"]');
      assert(applyButton, '灵兽页未提供一键套用推荐兽阵');
      assert(!applyButton.disabled, '推荐兽阵按钮被异常禁用');
      applyButton.click();
      const lineupState = harness.app.store.getState();
      const afterApplyIds = [...(lineupState.beasts.activeIds ?? [])];
      assert(afterApplyIds.length >= 3, `推荐兽阵未补齐阵列: ${afterApplyIds.join(',')}`);
      assert(afterApplyIds.join(',') !== beforeApplyIds.join(','), `推荐兽阵未改变激活阵列: before=${beforeApplyIds.join(',')}, after=${afterApplyIds.join(',')}`);
      assert(root.textContent.includes('灵兽巡游'), '灵兽页未渲染灵兽巡游');
      const beforeRouteRewards = ['herb', 'wood', 'beastShard', 'pills']
        .reduce((sum, resourceId) => sum + (lineupState.resources?.[resourceId] ?? 0), 0);
      const beforeExpeditionHistory = lineupState.beasts.expedition?.history?.length ?? 0;
      clickAction('start-beast-expedition', (element) => element.dataset.route === 'verdant-trail');
      let expeditionState = harness.app.store.getState();
      assert(expeditionState.beasts.expedition?.active?.routeId === 'verdant-trail', '灵兽巡游未成功开始');
      harness.app.store.update((draft) => {
        if (draft.beasts.expedition?.active?.eventState) {
          draft.beasts.expedition.active.eventState.triggerProgress = 0;
        }
      }, { type: 'smoke/beast-expedition-event-ready' });
      harness.app.engine.runTick(1, 'runtime');
      expeditionState = harness.app.store.getState();
      assert(expeditionState.beasts.expedition?.active?.eventState?.pendingEvent, '灵兽巡游奇遇未触发');
      assert(root.textContent.includes('巡游奇遇'), '灵兽页未渲染巡游奇遇');
      const claimDuringEventButton = root.querySelector('[data-action="claim-beast-expedition"]');
      assert(claimDuringEventButton?.disabled, '奇遇未处理前不应允许直接领取巡游奖励');
      const pendingOptionId = expeditionState.beasts.expedition.active.eventState.pendingEvent.options?.[0]?.id;
      assert(pendingOptionId, '巡游奇遇缺少可选项');
      clickAction('resolve-beast-expedition-event', (element) => element.dataset.optionId === pendingOptionId);
      expeditionState = harness.app.store.getState();
      assert(!expeditionState.beasts.expedition?.active?.eventState?.pendingEvent, '灵兽巡游奇遇未成功结算');
      assert((expeditionState.beasts.expedition?.active?.eventState?.resolvedEvents?.length ?? 0) > 0, '巡游奇遇未写入已结算记录');
      harness.app.store.update((draft) => {
        draft.beasts.collection ??= { relicIds: [], routeInsight: {}, recentDiscoveries: [] };
        draft.beasts.collection.routeInsight ??= {};
        draft.beasts.collection.routeInsight['verdant-trail'] = 92;
        if (draft.beasts.expedition?.active) {
          draft.beasts.expedition.active.completesAt = Date.now() - 1000;
        }
      }, { type: 'smoke/beast-expedition-complete' });
      clickAction('claim-beast-expedition');
      expeditionState = harness.app.store.getState();
      const afterRouteRewards = ['herb', 'wood', 'beastShard', 'pills']
        .reduce((sum, resourceId) => sum + (expeditionState.resources?.[resourceId] ?? 0), 0);
      const latestExpeditionHistory = expeditionState.beasts.expedition?.history?.[0];
      const claimedRouteReward = ['herb', 'wood', 'beastShard', 'pills']
        .reduce((sum, resourceId) => sum + (latestExpeditionHistory?.rewardMap?.[resourceId] ?? 0), 0);
      assert(!expeditionState.beasts.expedition?.active, '灵兽巡游领取后仍残留进行中状态');
      assert((expeditionState.beasts.expedition?.history?.length ?? 0) > beforeExpeditionHistory, '灵兽巡游未写入历史');
      assert(claimedRouteReward > 0, `灵兽巡游历史未记录有效奖励: before=${beforeRouteRewards}, after=${afterRouteRewards}, history=${JSON.stringify(latestExpeditionHistory?.rewardMap ?? {})}`);
      assert((expeditionState.beasts.collection?.relicIds?.length ?? 0) > 0, '灵兽巡游未解锁异宝图鉴');
      assert(root.textContent.includes('灵兽养成'), '灵兽页未渲染养成说明');
      assert(root.textContent.includes('兽契共鸣'), '灵兽页未渲染兽契共鸣');
      assert(root.textContent.includes('灵兽羁绊'), '灵兽页未渲染灵兽羁绊');
      assert(root.textContent.includes('巡游图鉴'), '灵兽页未渲染巡游图鉴');
      assert(root.textContent.includes('露痕琥珀'), '灵兽页未展示新解锁的巡游异宝');
      assert(root.textContent.includes('灾庭猎阵'), '灵兽页未展示推荐兽阵羁绊');
      return `灵兽 ${beastId} 激活状态 ${wasActive} -> ${isActive}，觉醒 ${beforeAwakening} -> ${afterAwakening}，兽契 ${beforeBond} -> ${afterBond}，推荐兽阵=${afterApplyIds.join('/')}，巡游记录=${expeditionState.beasts.expedition?.history?.length ?? 0}，异宝=${expeditionState.beasts.collection?.relicIds?.join('/') ?? 'none'}`;
    });

    await runCase('Save And Hydrate Cycle', async () => {
      harness.goToTab('missions');
      if (!harness.app.store.getState().commissions?.active) {
        clickAction('start-commission', (element) => !element.disabled);
      }
      harness.app.store.update((draft) => {
        draft.meta.lastTickAt = Date.now() - 5 * 60 * 1000;
      }, { type: 'smoke/offline-last-tick' });
      clickAction('save-game');
      const raw = window.localStorage.getItem(SAVE_KEY);
      assert(raw, 'hydrate 用例前未找到存档');

      const hydratedApp = createGameApp();
      const hydrated = hydratedApp.hydrate();
      assert(hydrated, 'hydrate() 未读取到存档');

      const sourceState = harness.app.store.getState();
      const loadedState = hydratedApp.store.getState();
      const sessionSummary = hydratedApp.getSessionSummary?.();
      hydratedApp.store.update((draft) => {
        draft.meta.activeTab = 'overview';
      }, { type: 'smoke/hydrate-overview' });
      const hydratedUiState = {};
      renderGame(root, hydratedApp, hydratedUiState);
      clearUiTimers(hydratedUiState);
      assert((sessionSummary?.offlineSeconds ?? 0) >= 299, 'Offline session summary missing expected duration');
      assert((sessionSummary?.commissions?.newCompletedCount ?? 0) >= 1, 'Offline session summary missing completed commissions');
      assert(root.textContent.includes('离线进度'), 'Overview did not render offline summary');
      assert(root.textContent.includes('委托进展'), 'Overview did not render commission offline progress');
      renderGame(root, harness.app, harness.uiState);
      clearUiTimers(harness.uiState);

      assert(loadedState.scripture.unlockedNodes.includes('bingdao-chushi'), '读档后缺少兵道初识');
      assert((loadedState.war.battleReports?.length ?? 0) >= 1, '读档后缺少战报');
      assert((loadedState.disciples.expeditionTeam?.leaderId ?? null) === sourceState.disciples.expeditionTeam.leaderId, '读档后弟子出征主将不一致');
      assert((loadedState.beasts.unlocked?.length ?? 0) >= 1, '读档后缺少已解锁灵兽');
      assert(JSON.stringify(loadedState.war.trainedUnits ?? {}) === JSON.stringify(sourceState.war.trainedUnits ?? {}), '读档后兵种训练数据不一致');
      return `hydrate 成功：战报=${loadedState.war.battleReports.length}，兵种=${Object.keys(loadedState.war.trainedUnits ?? {}).length}，灵兽=${loadedState.beasts.unlocked.length}`;
    });

    await runCase('Reset Game Control', async () => {
      clickAction('save-game');
      assert(window.localStorage.getItem(SAVE_KEY), 'reset 用例前未生成存档');

      let detail = '';
      harness.withPatchedConfirmAndReload(true, ({ getReloadCalls, reloadHookInstalled }) => {
        clickAction('reset-game');
        assert(window.localStorage.getItem(SAVE_KEY) == null, 'reset-game 未清空存档');
        const reloadCalls = getReloadCalls();
        if (reloadHookInstalled && reloadCalls > 0) {
          detail = `reset-game 在确认后成功清空存档，并观测到 reload 调用 ${reloadCalls} 次`;
        } else {
          detail = 'reset-game 在确认后成功清空存档；当前浏览器环境未返回可观测的 reload 信号';
        }
      });

      return detail;
    });

    await runCase('Logs Tab Smoke Entry', async () => {
      harness.appendLog('smoke harness 验证日志渲染');
      harness.goToTab('logs');
      assert(root.textContent.includes('smoke harness 验证日志渲染'), '日志页未显示 smoke 日志');
      return '日志页渲染 smoke 注入日志成功';
    });

    const passed = results.filter((item) => item.ok).length;
    summaryEl.textContent = `${passed}/${results.length} 通过`;
    setStatus('全部通过', 'tag-saved-pulse');
    document.title = `SMOKE PASS ${passed}/${results.length}`;
    await publishReport({
      ok: true,
      passed,
      total: results.length,
      results,
      title: document.title,
      finishedAt: new Date().toISOString(),
    });
    window.clearTimeout(watchdogId);
  } catch (error) {
    const passed = results.filter((item) => item.ok).length;
    summaryEl.textContent = `${passed}/${results.length} 通过`;
    setStatus('存在失败', '');
    document.title = `SMOKE FAIL ${passed}/${results.length}`;
    await publishReport({
      ok: false,
      passed,
      total: results.length,
      results,
      error: error instanceof Error ? (error.stack || error.message) : String(error),
      title: document.title,
      finishedAt: new Date().toISOString(),
    });
    window.clearTimeout(watchdogId);
    console.error(error);
  }
}

runButton?.addEventListener('click', () => {
  runSmoke();
});

runSmoke();
