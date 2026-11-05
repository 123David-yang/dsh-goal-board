/**
 * goal-board · 页面模板
 * 把 CSS / JS / 首屏数据内联成一张自包含 HTML；页面随后每 10 秒拉一次 /api/goal-gantt。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cache = new Map();

function asset(name) {
  const file = path.join(HERE, 'assets', name);
  const mtime = fs.statSync(file).mtimeMs;
  const hit = cache.get(file);
  if (hit && hit.mtime === mtime) return hit.text;
  const text = fs.readFileSync(file, 'utf8');
  cache.set(file, { mtime, text });
  return text;
}

const escapeJson = (text) => text.replace(/</g, '\\u003c');

export function renderPage(model) {
  const css = asset('board.css');
  const js = asset('board.js');
  const data = escapeJson(JSON.stringify(model));
  const title = model.board?.title || 'GOAL 甘特看板';

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<div class="app">

  <div id="net-banner" class="net-banner" style="display:none">
    <b id="net-title">连接中断</b><span id="net-body">正在重试，数据可能不是最新的</span>
  </div>

  <header class="topbar">
    <div class="brand">
      <div class="logo">◱</div>
      <div>
        <h1 id="board-title">GOAL 甘特看板</h1>
        <div class="sub" id="board-sub">DSH Goal Gantt Board</div>
      </div>
    </div>
    <div class="objective">
      <div class="obj-label" id="obj-label">目标 OBJECTIVE</div>
      <div class="obj-text" id="goal-objective">—</div>
      <label class="session-pick">
        <span id="session-label">会话</span>
        <select id="session-select" class="select"></select>
      </label>
    </div>
    <div class="head-right">
      <div class="ring" id="ring"><span id="ring-val">0%</span></div>
      <div class="chips" id="head-chips"></div>
    </div>
  </header>

  <main>
    <section class="panel hero" id="hero"></section>

    <section class="panel gantt-panel">
      <div class="panel-h"><span id="gantt-title">进度</span><div class="ph-right"><span class="hint" id="gantt-hint"></span><div class="gantt-tools" id="gantt-tools"><button type="button" data-mode="now" class="on">聚焦现在</button><button type="button" data-mode="6h">6h</button><button type="button" data-mode="24h">24h</button><button type="button" data-mode="all">全部</button></div></div></div>
      <div class="gantt">
        <div class="gaxis"><div class="spacer"></div><div class="ticks" id="gaxis"></div></div>
        <div class="gbody">
          <div class="gcol" id="glabels"></div>
          <div class="gtracks" id="gtracks"></div>
        </div>
      </div>
    </section>

    <section class="panel phases-panel">
      <div class="panel-h"><span id="phases-title">阶段</span><span class="hint" id="phases-hint"></span></div>
      <div class="phases" id="phases"></div>
    </section>
  </main>

  <footer class="foot" id="foot"></footer>
</div>
<script>window.__BOARD__ = ${data};</script>
<script>${js}</script>
</body>
</html>`;
}
