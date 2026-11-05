/**
 * 渲染自测：用最小 DOM 桩执行浏览器侧 board.js。
 *   node test/render.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(HERE, '..');
const { demoModel } = await import(pathToFileURL(path.join(HERE, 'demo.mjs')).href);
const boardJs = fs.readFileSync(path.join(root, 'lib', 'assets', 'board.js'), 'utf8');

function renderWith(data, lang) {
  const store = new Map();
  const makeEl = () => ({
    textContent: '', innerHTML: '', title: '',
    style: { setProperty() {}, display: '', left: '', top: '', width: '' },
    classList: { add() {}, remove() {}, contains: () => false },
    appendChild() {}, addEventListener() {}, setAttribute() {},
    getAttribute: () => '', querySelector: () => null, querySelectorAll: () => [],
    scrollIntoView() {}, parentElement: null,
  });
  const getEl = (id) => {
    if (!store.has(id)) store.set(id, makeEl());
    return store.get(id);
  };

  const sandbox = {
    window: { __BOARD__: data, addEventListener() {}, innerWidth: 1680, innerHeight: 950 },
    document: {
      getElementById: getEl,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => makeEl(),
      body: { appendChild() {} },
      title: '',
    },
    navigator: { language: lang || 'zh-CN' },
    console,
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: () => 0,
    fetch: () => Promise.reject(new Error('offline')),
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(boardJs, sandbox, { filename: 'board.js' });
  return { get: getEl, sandbox };
}

let failed = 0;
function check(name, ok) {
  if (!ok) failed++;
  console.log((ok ? '  ok  ' : ' FAIL ') + name);
}

/* ---------------------------------------------------------- 场景 1：常规 */
{
  const { get, sandbox } = renderWith(demoModel());
  check('目标文本', get('goal-objective').textContent.length > 0);
  check('总进度环', get('ring-val').textContent.endsWith('%'));
  check('轮次 chip', get('head-chips').innerHTML.includes('轮'));
  check('Hero 当前阶段', get('hero').innerHTML.includes('当前阶段'));
  check('Hero 大标题', get('hero').innerHTML.includes('hero-title'));
  check('Hero 四个关键数字', (get('hero').innerHTML.match(/class="stat"/g) || []).length === 4);
  check('Hero 进度条', get('hero').innerHTML.includes('hero-bar'));
  check('分享按钮', get('hero').innerHTML.includes('hero-share') && get('hero').innerHTML.includes('data-share="P3"'));
  check('复制摘要按钮', get('hero').innerHTML.includes('hero-copy-summary'));
  const md = sandbox.window.__goalGantt.summary(demoModel());
  check('摘要含标题与总进度', md.startsWith('## ') && md.includes('60%'));
  check('摘要含状态图标', md.includes('✅') && md.includes('🔄'));
  check('摘要含剩余阶段', /剩余 2 个阶段/.test(md));
  check('甘特标签', get('glabels').innerHTML.includes('glab'));
  check('甘特条', get('gtracks').innerHTML.includes('gbar'));
  check('条形不溢出到左侧标签列', !/left:-/.test(get('gtracks').innerHTML));
  check('现在游标', get('gtracks').innerHTML.includes('nowline'));
  check('时间刻度', get('gaxis').innerHTML.includes('tick'));
  check('阶段清单', get('phases').innerHTML.includes('data-card'));
  check('阶段行可点击', get('phases').innerHTML.includes('class="prow"'));
  check('页脚', get('foot').innerHTML.includes('工具'));
  check('会话选择器', get('session-select').innerHTML.includes('option'));
}

/* ------------------------------------------- 场景 2：全部完成后看最近阶段 */
{
  const model = demoModel();
  model.phases = model.phases.map((p) => ({ ...p, status: 'done', progress: 100, endedAt: p.endedAt || Date.now() }));
  const { get } = renderWith(model);
  check('全部完成显示最近阶段', get('hero').innerHTML.includes('最近阶段'));
}

/* --------------------------------------------- 场景 3：无进行中 → 下一阶段 */
{
  const model = demoModel();
  model.phases = model.phases.map((p) =>
    p.status === 'active' ? { ...p, status: 'pending', progress: 0, startedAt: null, endedAt: null } : p);
  const { get } = renderWith(model);
  check('无进行中显示下一阶段', get('hero').innerHTML.includes('下一阶段'));
}

/* ------------------------------------------------------ 场景 4：长标题 */
{
  const model = demoModel();
  const long = '这是一个非常非常长的阶段标题用来验证截断与布局不会被撑破'.repeat(2);
  model.phases = model.phases.map((p, i) => (i === 1 ? { ...p, title: long } : p));
  const { get } = renderWith(model);
  check('长标题不报错且带 title 提示', get('glabels').innerHTML.includes('title="' + long.slice(0, 10)));
  check('长标题仍在清单里', get('phases').innerHTML.includes('data-card'));
}

/* --------------------------------------------------- 场景 4.5：缩放预设 */
{
  const { renderPage } = await import(pathToFileURL(path.join(root, 'lib', 'view.js')).href);
  const html = renderPage(demoModel());
  for (const mode of ['now', '6h', '24h', 'all']) {
    check('工具栏含 ' + mode + ' 预设', html.includes('data-mode="' + mode + '"'));
  }
  check('阶段筛选条存在', html.includes('id="phase-search"') && html.includes('id="phase-filter"'));
  for (const f of ['all', 'active', 'unfinished']) {
    check('筛选含 ' + f, html.includes('data-filter="' + f + '"'));
  }
}

/* ------------------------------------------------------ 场景 5：没有 goal */
{
  const model = demoModel();
  model.phases = [];
  model.overall = 0;
  model.empty = true;
  model.goal = null;
  const { get } = renderWith(model);
  check('空态提示', get('hero').innerHTML.includes('还没有 goal'));
  check('空态给配置示例', get('hero').innerHTML.includes('empty-example') && get('hero').innerHTML.includes('phases'));
  check('空态有复制按钮', get('hero').innerHTML.includes('empty-copy'));
  check('空态不渲染甘特条', !get('gtracks').innerHTML.includes('gbar'));
}

/* ------------------------------------------------------ 场景 6：英文 */
{
  const { get } = renderWith(demoModel(), 'en-US');
  check('英文：Hero 标题', get('hero').innerHTML.includes('Current phase'));
  check('英文：四个数字标签', get('hero').innerHTML.includes('Phase progress') && get('hero').innerHTML.includes('Phases left'));
  check('英文：阶段数量', get('phases-hint').textContent.includes('phases'));
  check('英文：aria-label 用英文', get('gtracks').innerHTML.includes('% done'));
  check('英文：页脚', get('foot').innerHTML.includes('Session'));
}

{
  const model = demoModel();
  model.phases = [];
  model.empty = true;
  model.goal = null;
  const { get } = renderWith(model, 'en-US');
  check('英文：空态', get('hero').innerHTML.includes('No goal in this session'));
}

if (failed) {
  console.error(failed + ' 项失败');
  process.exit(1);
}
console.log('\n全部通过');
