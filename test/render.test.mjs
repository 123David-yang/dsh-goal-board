/**
 * 渲染自测：用最小 DOM 桩执行浏览器侧 board.js，检查各区块是否成功产出内容。
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

/** 在独立的 vm 沙箱里跑一遍渲染器，返回被写入的节点 */
function renderWith(data) {
  const store = new Map();
  const makeEl = () => ({
    textContent: '', innerHTML: '', title: '',
    style: { setProperty() {}, display: '', left: '', top: '', width: '' },
    classList: { add() {}, remove() {}, contains: () => false },
    appendChild() {}, addEventListener() {}, setAttribute() {},
    getAttribute: () => '', querySelector: () => null, scrollIntoView() {},
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
  check('进度环', get('ring-val').textContent.endsWith('%'));
  check('顶部指标', get('head-chips').innerHTML.includes('chip'));
  check('阶段轨道', get('rail').innerHTML.includes('rail-item'));
  check('甘特标签', get('glabels').innerHTML.includes('glab'));
  check('甘特条', get('gtracks').innerHTML.includes('gbar'));
  check('现在游标', get('gtracks').innerHTML.includes('nowline'));
  check('时间刻度', get('gaxis').innerHTML.includes('tick'));
  check('当前章节', get('chapter').innerHTML.includes('CURRENT CHAPTER'));
  check('距目标', get('distance').innerHTML.includes('DISTANCE TO GOAL'));
  check('阶段卡片', get('cards').innerHTML.includes('data-card'));
  check('页脚', get('foot').innerHTML.includes('/api/goal-board'));
  check('会话选择器', get('session-select').innerHTML.includes('option'));
  check('计划/实际分开显示', get('cards').innerHTML.includes('计划 ') && get('cards').innerHTML.includes('实际 '));
}

/* ------------------------------------------------- 场景 2：没有进行中阶段 */

{
  const model = demoModel();
  model.phases = model.phases.map((p) => ({ ...p, status: 'done', progress: 100, endedAt: p.endedAt || Date.now() }));
  const { get } = renderWith(model);
  check('全部完成时展示最近章节', get('chapter').innerHTML.includes('LAST CHAPTER'));
}

{
  const model = demoModel();
  model.phases = model.phases.map((p) =>
    p.status === 'active' ? { ...p, status: 'pending', progress: 0, startedAt: null, endedAt: null } : p);
  const { get } = renderWith(model);
  check('无进行中时展示下一章', get('chapter').innerHTML.includes('NEXT CHAPTER'));
}

/* ------------------------------------------------------ 场景 3：长标题 */

{
  const model = demoModel();
  const long = '这是一个非常非常长的阶段标题用来验证截断与布局不会被撑破'.repeat(2);
  model.phases = model.phases.map((p, i) => (i === 1 ? { ...p, title: long } : p));
  const { get } = renderWith(model);
  check('长标题不报错且带 title 提示', get('glabels').innerHTML.includes('title="' + long.slice(0, 10)));
  check('长标题卡片仍渲染', get('cards').innerHTML.includes('data-card'));
}

if (failed) {
  console.error(failed + ' 项失败');
  process.exit(1);
}
console.log('\n全部通过');
