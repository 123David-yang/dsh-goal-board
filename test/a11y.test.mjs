/**
 * 无障碍检查：色彩对比度 + 关键 ARIA 属性。
 *   node test/a11y.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(HERE, '..');
const css = fs.readFileSync(path.join(root, 'lib', 'assets', 'board.css'), 'utf8');

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log((ok ? '  ok  ' : ' FAIL ') + name + (detail ? '  (' + detail + ')' : ''));
};

/* ------------------------------------------------------------ 对比度 */

const toRgb = (hex) => {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const l1 = luminance(toRgb(a));
  const l2 = luminance(toRgb(b));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

const block = (startMarker, endMarker) => {
  const start = css.indexOf(startMarker);
  const end = endMarker ? css.indexOf(endMarker, start) : css.length;
  return css.slice(start, end);
};

const vars = (text) => {
  const out = {};
  for (const m of text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[m[1]] = m[2];
  return out;
};

const dark = vars(block('.app, :root {', '}'));
const lightBlock = block('@media (prefers-color-scheme: light)', '\n}\n');
const light = { ...dark, ...vars(lightBlock) };

for (const [mode, palette] of [['深色', dark], ['浅色', light]]) {
  const bg = palette['panel'] || palette['bg'];
  for (const key of ['txt', 'sub', 'dim']) {
    const ratio = contrast(palette[key], bg);
    check(
      mode + ' 下 --' + key + ' 对比度 ≥ 4.5',
      ratio >= 4.5,
      ratio.toFixed(2) + ':1',
    );
  }
}

/* --------------------------------------------------------- ARIA 属性 */

const { demoModel } = await import(pathToFileURL(path.join(HERE, 'demo.mjs')).href);
const boardJs = fs.readFileSync(path.join(root, 'lib', 'assets', 'board.js'), 'utf8');

const store = new Map();
const makeEl = () => ({
  textContent: '', innerHTML: '', title: '',
  style: { setProperty() {}, display: '', left: '', top: '', width: '' },
  classList: { add() {}, remove() {}, contains: () => false },
  appendChild() {}, addEventListener() {}, setAttribute() {}, focus() {},
  getAttribute: () => '', querySelector: () => null, querySelectorAll: () => [],
  scrollIntoView() {}, parentElement: null,
});
const getEl = (id) => {
  if (!store.has(id)) store.set(id, makeEl());
  return store.get(id);
};
const sandbox = {
  window: { __BOARD__: demoModel(), addEventListener() {}, innerWidth: 1680, innerHeight: 950 },
  document: {
    getElementById: getEl, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => makeEl(), body: { appendChild() {} }, title: '',
  },
  navigator: {}, console,
  setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0,
  fetch: () => Promise.reject(new Error('offline')),
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(boardJs, sandbox, { filename: 'board.js' });

const tracks = getEl('gtracks').innerHTML;
const phases = getEl('phases').innerHTML;

check('甘特条可聚焦', /class="gbar[^"]*"[^>]*tabindex="0"/.test(tracks));
check('甘特条有 aria-label', /aria-label="P\d+ [^"]*进度 \d+%"/.test(tracks));
check('阶段行有 aria-controls', /aria-controls="pdetail-P\d+"/.test(phases));
check('阶段行有 aria-expanded', /aria-expanded="(true|false)"/.test(phases));
check('展开区带 id', /id="pdetail-P\d+"/.test(phases));

if (failed) {
  console.error('\n' + failed + ' 项未通过');
  process.exit(1);
}
console.log('\n全部通过');
