# 修仙宗门放置游戏 Web 原型

一个以“挂机修仙 + 宗门经营 + 战斗养成联动”为核心的网页游戏原型项目。

当前版本已经具备可游玩的基础循环，重点围绕以下目标持续迭代：

- 前期成长反馈足够快，玩家能持续获得升级与解锁体验
- 中后期形成明确追求，需要通过多系统联动来突破关卡与数值墙
- 战斗、弟子、灵兽、炼丹、锻造、仓库、委托等玩法互相喂数值与掉落
- UI 采用偏古典、简洁的卷轴式风格，保持信息量的同时降低页面割裂感

## 当前核心玩法

- 宗门经营：分配工人、升级建筑、积累基础资源
- 仓库策略：管理库存上限、封存与仓储策略
- 藏经阁：消耗道蕴参悟经卷，逐步解锁更深层的玩法成长线
- 兵营与战争：训练兵种、配置阵法、推进关卡，体验“前期易推进、后期高门槛”的战斗节奏
- 弟子系统：招募、培养、编队出征，参与战斗与联动掉落
- 灵兽系统：激活、觉醒、羁绊、巡游，为战斗和长期养成提供支撑
- 炼丹锻造：生产丹药、武器、工坊订单，为中后期成长提供深度追求
- 委托系统：接取与结算宗门事务，补充资源与声望成长
- 日志系统：汇总挂机期间的重要事件，便于查看离线收益与系统变化

## 项目特点

- 纯前端原型，无需 Node.js 构建流程
- 使用原生 ES Module 组织代码
- 本地存档基于浏览器存储，可直接体验挂机与离线结算
- 自带 UI Smoke 自动化脚本，便于验证主要玩法流程没有回归

## 目录说明

```text
web/
├─ index.html                 # 游戏主入口
├─ smoke.html                 # UI Smoke 测试入口
├─ styles/                    # 全局样式与主题
├─ src/
│  ├─ app.js                  # 应用装配入口
│  ├─ main.js                 # 页面启动入口
│  ├─ core/                   # store、engine、save、registry 等基础设施
│  ├─ data/                   # 数值、配置、静态定义
│  ├─ systems/                # 战争、经济、弟子灵兽、委托、仓库等系统逻辑
│  ├─ ui/                     # 页面渲染、交互事件、面板模块
│  └─ dev/                    # 开发和 smoke 相关逻辑
├─ tools/
│  └─ run_ui_smoke.py         # 浏览器级 UI 冒烟测试脚本
└─ docs/                      # 设计文档与开发摘要
```

## 启动方式

### 方式一：使用 Python 启动本地静态服务器

项目依赖浏览器通过 HTTP 加载 ES Module，因此不建议直接双击 `index.html` 用 `file://` 打开。

在项目根目录执行：

```powershell
python -m http.server 8130
```

如果本机使用 `py`：

```powershell
py -m http.server 8130
```

启动后在浏览器访问：

```text
http://127.0.0.1:8130/index.html
```

### 方式二：使用任意静态服务器

只要能把当前目录作为 Web 根目录启动即可，例如：

- VS Code Live Server
- Nginx
- Caddy
- 其他本地静态资源服务器

启动后同样访问：

```text
http://127.0.0.1:<端口>/index.html
```

## UI Smoke 测试

项目内置了一套浏览器级冒烟测试，会自动打开 `smoke.html`，验证主要核心链路是否正常。

推荐命令：

```powershell
python tools\run_ui_smoke.py --timeout 25
```

或者直接使用封装脚本：

```powershell
.\run_ui_smoke.ps1 --timeout 25
```

Windows 下也可以：

```powershell
.\run_ui_smoke.cmd --timeout 25
```

当前 smoke 主要覆盖这些方向：

- Tab 切换
- 存档与重置
- 兵营招募与阵法调整
- 交易、炼丹、锻造、工坊订单
- 仓库策略
- 弟子与灵兽成长
- 委托循环
- 战争偏好、一键挑战、战报与联动掉落
- 日志页渲染

## 开发说明

- 游戏主入口是 [index.html](./index.html)
- 页面渲染入口是 [src/main.js](./src/main.js) 和 [src/ui/renderApp.js](./src/ui/renderApp.js)
- 系统逻辑集中在 [src/systems](./src/systems)
- 数值与静态配置集中在 [src/data](./src/data)
- 最新开发过程摘要持续追加在 [docs/module-summary-latest.md](./docs/module-summary-latest.md)

如果只是继续做玩法开发，推荐阅读顺序：

1. [src/app.js](./src/app.js)
2. [src/core/store.js](./src/core/store.js)
3. [src/systems/warSystem.js](./src/systems/warSystem.js)
4. [src/systems/economySystem.js](./src/systems/economySystem.js)
5. [src/systems/disciplesBeastsSystem.js](./src/systems/disciplesBeastsSystem.js)
6. [src/ui/panels](./src/ui/panels)

## 存档说明

- 游戏数据默认保存在浏览器本地存储中
- 页面右上角提供“存档”和“重置”按钮
- 重置会清空当前本地存档，操作前请确认

## 当前定位

本项目当前更接近“高可玩性挂机修仙网页游戏原型”，而不是最终上线版本。

接下来的开发重点会继续围绕：

- 提高前中后期节奏分层
- 增强各玩法之间的掉落联动与长期追求
- 继续优化古典风格 UI 与信息层次
- 在不引入逻辑冲突的前提下逐步扩展更多可玩内容
