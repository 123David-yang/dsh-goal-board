# dsh-goal-board · Goal 甘特看板

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供的 **goal 阶段级进度看板**。

它不记录单个工具调用，而是把一次长任务切成若干「章节（阶段）」，回答三个问题：

1. 这个 goal 现在走到第几章？
2. 每一章做了什么、产出什么、还剩什么没做？
3. 距离目标还有多远（阶段数 / 轮次 / 预估时间）？

![看板截图](docs/screenshot.png)

## 特性

- **甘特时间轴**：计划条（虚线）与实际条（实线）叠加，按时间跨度自动切换刻度（15 分钟 / 1 小时 / 6 小时 / 1 天）
- **当前章节**：自动定位进行中的阶段，显示本阶段耗时、工具调用数、检查项进度、最近轮次
- **阶段总结汇报**：每阶段一张卡片 —— 摘要、检查项、产出物
- **距目标面板**：剩余阶段、剩余轮次、预估剩余时间
- **内嵌渲染**：作为 main 面板直接长在 DSH 里，Shadow DOM 隔离样式；也可一键新标签打开
- **不闪、不跳**：内容指纹（signature）不变时只移动时间游标，不重建 DOM；阶段状态变化才重绘
- **多会话切换**：页头下拉可直接切换到其它会话的 goal（● 表示该会话有 goal）
- **零依赖、零构建**：只用 Node 内置模块，浏览器侧手写 bundle，装完即用
- **完全离线**：只读本机会话文件，不发任何网络请求，不落任何数据

## 安装

### 方式一：插件市场（推荐）

仓库打了 `dsh-plugin` topic 后会自动进入市场索引，在 DSH Web GUI 的插件页搜索 `goal-board` 一键安装。

### 方式二：CLI

```bash
dsh plugin add github:123David-yang/dsh-goal-board
```

### 方式三：手动脚本

```powershell
# Windows
pwsh -File scripts/install.ps1
```

脚本会自动定位 `$env:DSH_HOME/profiles/web`（或 `~/.dsh/profiles/web`），把插件复制进 `node_modules` 并注册 `cordis.patch.yml`。

安装后**重启一次 DSH**，左侧栏出现「看板」图标。

## 使用

- **会话顶部的「看板」标签页**（就在「对话 / 轨迹」旁边）——点开即在当前会话内展示，
  不跳转、不新开页面；切换会话时自动跟随
- 渲染走 Shadow DOM，样式与宿主完全隔离，不会污染 DSH 自己的 CSS
- 也可以直接访问 `http://127.0.0.1:3080/goal-board` 看独立页面

页面每 10 秒自动拉一次 `/api/goal-board`，阶段状态变化会实时反映。

## 阶段从哪来

优先读取工作区里的 `goal-board/board.config.json`：

```jsonc
{
  "title": "GOAL 甘特看板",
  "phases": [
    {
      "id": "P1",
      "title": "数据采集层",
      "desc": "一句话说明这一章干什么",
      "status": "done",                        // done | active | pending | blocked
      "plannedStart": "2026-11-05T00:05:00+08:00",
      "plannedEnd":   "2026-11-05T00:14:00+08:00",
      "startedAt":    "2026-11-05T00:05:40+08:00",
      "endedAt":      "2026-11-05T00:13:30+08:00",
      "summary": "这一章实际做了什么（显示在总结卡上）",
      "checks": [{ "label": "子任务", "done": true }],
      "deliverables": [{ "label": "文件", "path": "relative/or/absolute/path" }]
    }
  ]
}
```

没有配置文件时自动降级：按 `goal_round` 轮次切分阶段；再没有就按对话轮次切分。**不配置也能用**，只是信息更薄。

阶段进度 = `checks` 完成比例；没有 checks 时按状态估算（done=100 / active=40 / pending=0）。

## 数据来源

| 数据 | 位置 |
|---|---|
| goal 状态、轮次、token、轮次大纲 | `$DSH_HOME/storages/session_projcache/sessions/*.json` |
| 精确事件时间线（turn / tool / goal 变更） | `$DSH_HOME/sessions/<cwd>/<session>/session.v4.jsonl.zstd` |

会话日志是**多帧拼接的 zstd**（每次写入一帧），Node 原生的 `zstdDecompressSync` 只解第一帧。插件按帧魔数 `28 B5 2F FD` 逐帧解压再合并 —— 这是本插件最关键的一段兼容逻辑。

## 隐私

- 只读：不写会话、不改配置
- 离线：不发任何网络请求，无遥测
- 不落盘：解析结果只在内存里按 mtime 缓存 1 秒
- 路由受 DSH 的 `connection.requestRejection` 信任围栏保护（Host/Origin + 登录 cookie），绑到局域网也不会裸奔

## 兼容性

- DSH Web profile，`@deepseek-ai/dsh` **0.2.x**
- Node.js **>= 22**（依赖 `zlib.zstdDecompressSync`；更低版本会退化为只读投影缓存，日志事件不可用）
- 平台：Windows / macOS / Linux（Windows 为主线开发环境）

## 开发

```bash
node test/host.test.mjs     # 数据层 + 路由 + 鉴权
node test/render.test.mjs   # 用 DOM 桩跑一遍渲染
```

## 结构

```
dsh-goal-board/
├── lib/
│   ├── index.js          host 半侧：/goal-board 与 /api/goal-board
│   ├── board-data.js     会话发现、zstd 解码、阶段模型
│   ├── view.js           HTML 模板（内联 CSS/JS/首屏数据）
│   ├── client.js         浏览器半侧：侧栏图标 / 主区页面 / 头部按钮
│   └── assets/           board.css、board.js
├── scripts/install.ps1   手动安装
├── test/                 自测与演示数据
└── cordis.patch.yml      插件注册清单
```

## License

MIT


