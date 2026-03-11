import { createGameApp } from '../app.js?v=20260310-11';
import { SAVE_KEY } from '../core/save.js';
import { renderGame } from '../ui/renderApp.js?v=20260310-11';
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
  scripture: '藏经阁',
  barracks: '兵营',
  war: '关卡推进',
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
      harness.goToTab('barracks');
      const beforeUnits = totalTrainedUnits(harness.app.store.getState());
      clickAction('train-unit', (element) => element.dataset.amount === '5');
      const afterTrain = totalTrainedUnits(harness.app.store.getState());
      assert(afterTrain >= beforeUnits + 5, `招募未生效: before=${beforeUnits}, after=${afterTrain}`);
      clickAction('auto-arrange');
      assert(root.textContent.includes('阵型加成'), '兵营页未渲染阵型加成');
      return `兵种数量 ${beforeUnits} -> ${afterTrain}`;
    });

    await runCase('Trade Exchange Flow', async () => {
      harness.ensureResearchPath(['wanwu-shengfa', 'fansu-shangdao']);
      harness.goToTab('economy');
      const beforeTrade = harness.app.store.getState().trade.totalExchanged;
      const routeButton = findActionElement('trade-route', (element) => !element.disabled && element.dataset.multiplier === '1');
      routeButton.click();
      const afterState = harness.app.store.getState();
      assert(afterState.trade.totalExchanged > beforeTrade, `交易未生效: before=${beforeTrade}, after=${afterState.trade.totalExchanged}`);
      assert(root.textContent.includes('交易坊'), '产业页未渲染交易坊');
      return `交易次数 ${beforeTrade} -> ${afterState.trade.totalExchanged}`;
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
      harness.goToTab('missions');
      const beforeState = harness.app.store.getState();
      const beforeLingStone = beforeState.resources?.lingStone ?? 0;
      clickAction('start-commission', (element) => !element.disabled);
      let commissionState = harness.app.store.getState();
      assert(commissionState.commissions?.active, '委托未成功开始');
      harness.app.engine.runTick(300, 'smoke');
      commissionState = harness.app.store.getState();
      assert((commissionState.commissions?.completed?.length ?? 0) > 0, '委托未在挂机后完成');
      clickAction('claim-commission', (element) => !element.disabled);
      const afterState = harness.app.store.getState();
      assert((afterState.commissions?.history?.length ?? 0) > 0, '委托记录未写入历史');
      assert((afterState.resources?.lingStone ?? 0) >= beforeLingStone, '委托结算后资源未增加');
      return `委托完成并结算，历史 ${afterState.commissions.history.length} 条`;
    });

    await runCase('War Auto Preferences And Controls', async () => {
      harness.goToTab('war');
      clickAction('battle-auto-strategy', (element) => element.dataset.id === 'focus-lowest-hp');
      clickAction('battle-auto-speed', (element) => element.dataset.id === 'fast');

      let state = harness.app.store.getState();
      assert(state.war.autoPreferences?.strategyId === 'focus-lowest-hp', `默认自动战斗策略未更新: ${state.war.autoPreferences?.strategyId}`);
      assert(state.war.autoPreferences?.speedId === 'fast', `默认自动战斗速度未更新: ${state.war.autoPreferences?.speedId}`);

      clickAction('challenge-stage', (element) => !element.disabled && element.dataset.id === state.war.currentStageId);
      state = harness.app.store.getState();
      assert(state.war.currentBattle, '自动战斗用例未成功发起战斗');
      assert(state.war.currentBattle.autoStrategy === 'focus-lowest-hp', `战斗内自动策略未继承: ${state.war.currentBattle.autoStrategy}`);
      assert(state.war.currentBattle.autoSpeed === 'fast', `战斗内自动速度未继承: ${state.war.currentBattle.autoSpeed}`);

      clickAction('battle-auto-toggle');
      state = harness.app.store.getState();
      assert(state.war.currentBattle?.autoMode === true, '自动战斗开关未开启');

      clickAction('battle-auto-strategy', (element) => element.dataset.id === 'focus-backline');
      clickAction('battle-auto-speed', (element) => element.dataset.id === 'slow');
      state = harness.app.store.getState();
      assert(state.war.currentBattle?.autoStrategy === 'focus-backline', `战斗内自动策略未切换: ${state.war.currentBattle?.autoStrategy}`);
      assert(state.war.currentBattle?.autoSpeed === 'slow', `战斗内自动速度未切换: ${state.war.currentBattle?.autoSpeed}`);

      clickAction('battle-retreat');
      state = harness.app.store.getState();
      assert(!state.war.currentBattle, '撤退后战斗未结束');
      return '默认偏好已保存，战斗内自动模式/策略/速度切换成功并可正常撤退';
    });

    await runCase('War Battle Loop', async () => {
      harness.goToTab('war');
      const beforeReports = harness.app.store.getState().war.battleReports.length;
      clickAction('challenge-stage', (element) => !element.disabled && element.dataset.id === harness.app.store.getState().war.currentStageId);
      assert(harness.app.store.getState().war.currentBattle, '未成功发起战斗');

      let steps = 0;
      while (harness.app.store.getState().war.currentBattle && steps < 24) {
        const targetButton = root.querySelector('[data-action="select-battle-target"]');
        if (targetButton) {
          targetButton.click();
        }
        clickAction('battle-attack');
        clearUiTimers(harness.uiState);
        steps += 1;
      }

      const afterState = harness.app.store.getState();
      const afterReports = afterState.war.battleReports.length;
      assert((afterState.war.battleReports?.[0]?.expeditionSupport?.bondCount ?? 0) > 0, '战报未记录出征羁绊');
      assert(afterReports > beforeReports, `战斗未生成战报: before=${beforeReports}, after=${afterReports}`);
      assert(root.textContent.includes('战斗回放'), '战争页未渲染战斗回放');
      assert(root.textContent.includes('历次战报'), '战争页未渲染历次战报');
      return `完成战斗指令 ${steps} 次，战报 ${beforeReports} -> ${afterReports}`;
    });

    await runCase('War Replay Controls', async () => {
      harness.goToTab('war');
      const report = harness.app.store.getState().war.battleReports[0];
      assert(report, '不存在可回放的战报');
      assert((report.rounds?.length ?? 0) > 0, '战报没有可回放回合');

      harness.uiState.warSelectedReportId = report.id;
      renderGame(root, harness.app, harness.uiState);

      const beforeReplay = { ...(harness.uiState.warReplay ?? {}) };
      clickAction('war-replay-speed', (element) => element.dataset.speed === '850');
      assert(harness.uiState.warReplay?.speedMs === 850, `回放速度未切换: ${harness.uiState.warReplay?.speedMs}`);

      clickAction('war-replay-next');
      const afterNext = harness.uiState.warReplay ?? {};
      const advanced = (afterNext.roundIndex ?? 0) > (beforeReplay.roundIndex ?? 0)
        || (afterNext.actionIndex ?? 0) > (beforeReplay.actionIndex ?? 0);
      assert(advanced, `回放未前进一步: before=${JSON.stringify(beforeReplay)}, after=${JSON.stringify(afterNext)}`);

      const jumpButtons = [...root.querySelectorAll('[data-action="war-replay-jump"]')];
      const jumpTarget = jumpButtons[jumpButtons.length - 1];
      assert(jumpTarget, '未找到回放跳转按钮');
      jumpTarget.click();
      const expectedRound = Number(jumpTarget.dataset.round) || 0;
      assert((harness.uiState.warReplay?.roundIndex ?? -1) === expectedRound, `回放跳转失败: expected=${expectedRound}, actual=${harness.uiState.warReplay?.roundIndex}`);

      clickAction('war-replay-reset');
      assert((harness.uiState.warReplay?.roundIndex ?? -1) === 0 && (harness.uiState.warReplay?.actionIndex ?? -1) === 0, '回放重置失败');
      return `回放速度=${harness.uiState.warReplay?.speedMs}，跳转回合=${expectedRound}，已重置到开场`;
    });

    await runCase('Beasts Unlock And Toggle', async () => {
      harness.ensureResources({ beastShard: 3 });
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
      harness.goToTab('beasts');
      const stateBefore = harness.app.store.getState();
      const beastId = stateBefore.beasts.unlocked[0];
      assert(beastId, '未解锁首只灵兽');
      const wasActive = stateBefore.beasts.activeIds.includes(beastId);
      clickAction('toggle-beast', (element) => element.dataset.id === beastId);
      const afterState = harness.app.store.getState();
      const isActive = afterState.beasts.activeIds.includes(beastId);
      assert(isActive !== wasActive, '灵兽切换激活状态未生效');
      return `灵兽 ${beastId} 激活状态 ${wasActive} -> ${isActive}`;
    });

    await runCase('Save And Hydrate Cycle', async () => {
      clickAction('save-game');
      const raw = window.localStorage.getItem(SAVE_KEY);
      assert(raw, 'hydrate 用例前未找到存档');

      const hydratedApp = createGameApp();
      const hydrated = hydratedApp.hydrate();
      assert(hydrated, 'hydrate() 未读取到存档');

      const sourceState = harness.app.store.getState();
      const loadedState = hydratedApp.store.getState();

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
