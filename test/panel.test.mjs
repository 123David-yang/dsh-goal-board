/**
 * 面板模式冒烟测试：验证看板能在「宿主页面的 Shadow DOM 子树」里渲染。
 * 不依赖 DSH 运行时。
 *
 * 技巧：页面里放一张 /ready.png，服务端等页面调用 /done 后才返回它，
 * 这样 Chrome 的 load 事件一定发生在看板渲染完成之后，截图才不会是空白。
 *
 *   node test/panel.test.mjs
 * 产物：docs/panel-preview.png
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(HERE, '..');

const { demoModel } = await import(pathToFileURL(path.join(HERE, 'demo.mjs')).href);
const css = fs.readFileSync(path.join(root, 'lib', 'assets', 'board.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'lib', 'assets', 'board.js'), 'utf8');
const data = JSON.stringify(demoModel());

const HARNESS = `<!doctype html>
<meta charset="utf-8">
<title>panel harness</title>
<style>html,body{margin:0;height:100%;background:#0b0f17}#host{height:100vh}</style>
<div id="host"></div>
<img src="/ready.png" alt="" width="1" height="1">
<script>
  window.setInterval = function () { return 0; };
  const CSS = ${JSON.stringify(css)};
  const JS = ${JSON.stringify(js)};
  const DATA = ${data};
  const realFetch = window.fetch.bind(window);
  const FAIL = ${JSON.stringify(process.env.PANEL_FAIL === "1")};
  window.fetch = function (url) {
    const u = String(url);
    if (FAIL && u.indexOf("/api/") >= 0) return Promise.reject(new Error("模拟网络失败"));
    if (u.indexOf('board.css') >= 0) return Promise.resolve(new Response(CSS, { headers: { 'content-type': 'text/css' } }));
    if (u.indexOf('board.js') >= 0) return Promise.resolve(new Response(JS, { headers: { 'content-type': 'text/javascript' } }));
    if (u.indexOf('/api/goal-gantt') >= 0) return Promise.resolve(new Response(JSON.stringify(DATA), { headers: { 'content-type': 'application/json' } }));
    if (u.indexOf('/done') >= 0) return realFetch(u);
    return Promise.reject(new Error('unexpected fetch: ' + u));
  };
  window.__ModuleLoader__ = { load(def) { window.__DEF = def; } };
</script>
<script src="/client.js"></script>
<script>
  const fakeReact = {
    createElement() { return {}; },
    useRef() { return { current: null }; },
    useLayoutEffect() {},
    useState(v) { return [v, () => {}]; },
  };
  const mod = window.__DEF.factory((name) => (name === 'react' ? fakeReact : {}));
  const state = { disposed: false, timer: null };
  mod.mountInto(document.getElementById('host'), null, state)
    .then(() => fetch('/done'))
    .catch((error) => {
      document.getElementById('host').textContent = 'FAILED: ' + error;
      fetch('/done');
    });
</script>`;

let releaseReady;
const readyGate = new Promise((resolve) => { releaseReady = resolve; });
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/panel.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(HARNESS);
    return;
  }
  if (url.pathname === '/client.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    res.end(fs.readFileSync(path.join(root, 'lib', 'client.js')));
    return;
  }
  if (url.pathname === '/done') {
    releaseReady();
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (url.pathname === '/ready.png') {
    await readyGate;
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(PNG_1PX);
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
console.log('harness on http://127.0.0.1:' + port + '/panel.html');

const chrome = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => fs.existsSync(p));

if (!chrome) {
  console.log('未找到 Chrome，跳过截图');
} else {
  const out = path.join(root, 'docs', process.env.PANEL_OUT || 'panel-preview.png');
  fs.rmSync(out, { force: true });
  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--timeout=15000', '--window-size=' + (process.env.PANEL_WIDTH || 1500) + ',1400',
    '--screenshot=' + out, `http://127.0.0.1:${port}/panel.html`,
  ], { stdio: 'ignore' });
  await new Promise((resolve) => child.on('exit', resolve));

  if (fs.existsSync(out)) {
    console.log('截图: ' + out + '（' + Math.round(fs.statSync(out).size / 1024) + ' KB）');
  } else {
    console.error('截图失败: ' + (result.stderr || '').slice(0, 300)); const lines=(result.stderr||'').split('\n').filter(l=>/CONSOLE|Uncaught|ERROR:CONSOLE/i.test(l)); console.error(lines.slice(0,10).join('\n'));
    process.exitCode = 1;
  }
}

server.close();
process.exit(process.exitCode || 0);












