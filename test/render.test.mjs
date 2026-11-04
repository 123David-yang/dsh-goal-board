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

const { renderPage } = await import(pathToFileURL(path.join(root, 'lib', 'view.js')).href);
const { demoModel } = await import(pathToFileURL(path.join(HERE, 'demo.mjs')).href);

const html = renderPage(demoModel());

const match = /window\.__BOARD__ = ([\s\S]*?);<\/script>/.exec(html);
if (!match) throw new Error('页面里没有内嵌数据');
const DATA = JSON.parse(match[1]);

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
  window: { __BOARD__: DATA, addEventListener() {}, innerWidth: 1680, innerHeight: 950 },
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
vm.runInContext(fs.readFileSync(path.join(root, 'lib', 'assets', 'board.js'), 'utf8'), sandbox, { filename: 'board.js' });

const checks = [
  ['目标文本', getEl('goal-objective').textContent.length > 0],
  ['进度环', getEl('ring-val').textContent.endsWith('%')],
  ['顶部指标', getEl('head-chips').innerHTML.includes('chip')],
  ['阶段轨道', getEl('rail').innerHTML.includes('rail-item')],
  ['甘特标签', getEl('glabels').innerHTML.includes('glab')],
  ['甘特条', getEl('gtracks').innerHTML.includes('gbar')],
  ['现在游标', getEl('gtracks').innerHTML.includes('nowline')],
  ['时间刻度', getEl('gaxis').innerHTML.includes('tick')],
  ['当前章节', getEl('chapter').innerHTML.includes('CURRENT CHAPTER')],
  ['距目标', getEl('distance').innerHTML.includes('DISTANCE TO GOAL')],
  ['阶段卡片', getEl('cards').innerHTML.includes('data-card')],
  ['页脚', getEl('foot').innerHTML.includes('/api/goal-board')],
  ['会话选择器', getEl('session-select').innerHTML.includes('option')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed++;
  console.log((ok ? '  ok  ' : ' FAIL ') + name);
}

const counts = {
  bars: (getEl('gtracks').innerHTML.match(/class="gbar/g) || []).length,
  cards: (getEl('cards').innerHTML.match(/class="card /g) || []).length,
  sessions: (getEl('session-select').innerHTML.match(/<option/g) || []).length,
};
console.log('counts:', JSON.stringify(counts));

if (failed) {
  console.error(failed + ' 项失败');
  process.exit(1);
}
console.log('\n全部通过');
