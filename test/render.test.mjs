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

function renderWith(data) {
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
    navigator: {},
    console,
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: () => 0,
    fetch: () => Promise.reject(new Error('offline')),
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(boardJs, sandbox, { filename: 'board.js' });
  return { get: getEl };
}

let failed = 0;
function check(name, ok) {
  if (!ok) failed++;
  console.log((ok ? '  ok  ' : ' FAIL ') + name);
}

/* ---------------------------------------------------------- 场景 1：常规 */
{
  const { get } = renderWith(demoModel());
  check('目标文本', get('goal-objective').textContent.length > 0);
  check('总进度环', get('ring-val').textContent.endsWith('%'));
  check('轮次 chip', get('head-chips').innerHTML.includes('轮'));
  check('Hero 当前阶段', get('hero').innerHTML.includes('当前阶段'));
  check('Hero 大标题', get('hero').innerHTML.includes('hero-title'));
  check('Hero 四个关键数字', (get('hero').innerHTML.match(/class="stat"/g) || []).length === 4);
  check('Hero 进度条', get('hero').innerHTML.includes('hero-bar'));
  check('甘特标签', get('glabels').innerHTML.includes('glab'));
  check('甘特条', get('gtracks').innerHTML.includes('gbar'));
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

/* ------------------------------------------------------ 场景 5：没有 goal */
{
  const model = demoModel();
  model.phases = [];
  model.overall = 0;
  model.empty = true;
  model.goal = null;
  const { get } = renderWith(model);
  check('空态提示', get('hero').innerHTML.includes('还没有 goal'));
  check('空态不渲染甘特条', !get('gtracks').innerHTML.includes('gbar'));
}

if (failed) {
  console.error(failed + ' 项失败');
  process.exit(1);
}
console.log('\n全部通过');
