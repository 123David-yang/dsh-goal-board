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

function renderWith(data, lang, url) {
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
    window: {
      __BOARD__: data, addEventListener() {}, innerWidth: 1680, innerHeight: 950,
      location: {
        href: url || 'http://127.0.0.1:3080/goal-gantt',
        origin: 'http://127.0.0.1:3080',
        search: url && url.includes('?') ? url.slice(url.indexOf('?')) : '',
        hash: url && url.includes('#') ? url.slice(url.indexOf('#')) : '',
      },
    },
    document: {
      getElementById: getEl,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => makeEl(),
      body: { appendChild() {} },
      title: '',
    },
    navigator: { language: lang || 'zh-CN' },
    URL,
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
  const csv = sandbox.window.__goalGantt.csv(demoModel());
  check('CSV 表头', csv.split('\n')[0].startsWith('id,title,status,progress'));
  check('CSV 行数 = 阶段数 + 1', csv.split('\n').length === 7, String(csv.split('\n').length));
  const quoting = sandbox.window.__goalGantt.csv({
    ...demoModel(),
    phases: [{ id: 'Q1', title: 'a,b"c', status: 'done', progress: 100, segments: [], checks: [], summary: 'line\nbreak' }],
  });
  check('CSV 正确转义逗号/引号/换行', quoting.includes('"a,b""c"') && quoting.includes('"line\nbreak"'));
  check('甘特标签', get('glabels').innerHTML.includes('glab'));
  check('甘特条', get('gtracks').innerHTML.includes('gbar'));
  check('条形不溢出到左侧标签列', !/left:-/.test(get('gtracks').innerHTML));
  check('现在游标', get('gtracks').innerHTML.includes('nowline'));
  check('时间刻度', get('gaxis').innerHTML.includes('tick'));
  check('阶段清单', get('phases').innerHTML.includes('data-card'));
  check('阶段行可点击', get('phases').innerHTML.includes('class="prow"'));
  check('阶段行显示相对时间', get('phases').innerHTML.includes('class="pwhen"'));
  check('阶段按状态分组', get('phases').innerHTML.includes('class="group-head"'));
  check('已完成组默认折叠', !get('phases').innerHTML.includes('data-card="P0"'));
  check('进行中组默认展开', get('phases').innerHTML.includes('data-card="P3"'));
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

/* ------------------------------------------- 场景 4.7：URL 带筛选条件 */
{
  const { get, sandbox } = renderWith(demoModel(), 'zh-CN', 'http://127.0.0.1:3080/goal-gantt?q=P3&f=active');
  check('URL 搜索词生效', get('phases').innerHTML.includes('data-card="P3"') && !get('phases').innerHTML.includes('data-card="P4"'));
  check('URL 搜索词回填到输入框', get('phase-search').value === 'P3');
  check('URL 过滤器状态', sandbox.window.__goalGantt.filter().status === 'active');
  const link = sandbox.window.__goalGantt.shareUrl('P3');
  check('分享链接带筛选条件', link.includes('q=P3') && link.includes('f=active'), link);
}

/* ------------------------------------------------- 场景 4.6：超大列表 */
{
  const model = demoModel();
  model.phases = Array.from({ length: 60 }, (_, i) => ({
    id: 'X' + i, title: 'phase ' + i, status: 'pending', progress: 0,
    segments: [], checks: [], deliverables: [],
    startedAt: null, endedAt: null, durationMs: null,
  }));
  model.distance = { ...model.distance, totalPhases: 60, remainingPhases: 60 };
  const { get } = renderWith(model);
  const rows = (get('phases').innerHTML.match(/data-card=/g) || []).length;
  check('超大列表只渲染前 40 条', rows === 40, String(rows));
  check('超大列表有“显示更多”', get('phases').innerHTML.includes('group-more'));
}

/* ------------------------------------------------- 场景 4.8：项目模式 */
{
  const { projectModel } = await import(pathToFileURL(path.join(HERE, 'demo.mjs')).href);
  const { get } = renderWith(projectModel(), 'zh-CN', 'http://127.0.0.1:3080/goal-gantt');
  const hero = get('hero').innerHTML;
  check('项目模式：Hero 显示活动摘要', hero.includes('改代码 ×4') && hero.includes('跑命令 ×3'));
  check('项目模式：统计换成工具/阶段/跨度', hero.includes('工具调用') && hero.includes('总跨度'));
  check('项目模式：不显示进度条', !hero.includes('hero-bar'));
  check('项目模式：顶部有自动生成标记', get('head-chips').innerHTML.includes('自动生成'));
  check('项目模式：行尾显示时长而非百分比', get('phases').innerHTML.includes('30m') && !get('phases').innerHTML.includes('%'));
  check('项目模式：甘特默认看全貌', get('gantt-hint').textContent.includes('→'));
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
