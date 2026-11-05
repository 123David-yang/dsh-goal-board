/**
 * 数据层与路由自测（不依赖 DSH 运行时）。
 *   node test/host.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { buildBoard, decompressAllFrames } = await import(pathToFileURL(path.join(HERE, '..', 'lib', 'board-data.js')).href);
const { apply } = await import(pathToFileURL(path.join(HERE, '..', 'lib', 'index.js')).href);

/* ------------------------------------------------ 1. 多帧 zstd 解码自测 */

{
  const zlib = await import('node:zlib');
  const frames = ['{"a":1}\n', '{"b":2}\n', '{"c":3}\n'].map((line) =>
    zlib.zstdCompressSync(Buffer.from(line, 'utf8')));
  const merged = Buffer.concat(frames);
  const text = decompressAllFrames(merged)?.toString('utf8');
  assert.equal(text, '{"a":1}\n{"b":2}\n{"c":3}\n', '多帧 zstd 应全部解出');
  console.log('  ok  多帧 zstd 解码');
}

/* ------------------------------------------------------ 2. 数据目录解析 */

{
  const { resolveDataRoot } = await import(pathToFileURL(path.join(HERE, '..', 'lib', 'board-data.js')).href);
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-board-'));
  fs.mkdirSync(path.join(fake, 'storages', 'session_projcache', 'sessions'), { recursive: true });
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = fake;
  assert.equal(resolveDataRoot(), fake, 'DSH_HOME 直接指向数据根时应命中');
  process.env.DSH_HOME = path.join(fake, 'nope');
  assert.equal(resolveDataRoot(fake), fake, '显式 dataRoot 优先');
  if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous;
  fs.rmSync(fake, { recursive: true, force: true });
  console.log('  ok  数据目录解析');
}

/* ---------------------------------------------------------- 3. 空数据处理 */

{
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-board-empty-'));
  const model = buildBoard(empty);
  assert.equal(model.ok, false, '没有会话时应返回 ok:false');
  assert.ok(model.error, '应带错误说明');
  fs.rmSync(empty, { recursive: true, force: true });
  console.log('  ok  空数据降级');
}

/* -------------------------------------------------------------- 4. 路由 */

{
  const routes = [];
  const ctx = {
    effect: (fn) => { fn(); return () => {}; },
    get: () => undefined,                       // 没有 connection 服务时放行
    webServer: { register: (route) => { routes.push(route); return () => {}; } },
  };
  apply(ctx, {});
  assert.deepEqual(routes.map((r) => r.path).sort(), ['/api/goal-gantt', '/api/goal-gantt/init', '/goal-gantt', '/goal-gantt/asset']);

  const res = () => {
    const r = { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
    return r;
  };

  const page = res();
  await routes.find((r) => r.path === '/goal-gantt').handler({ url: '/goal-gantt' }, page);
  assert.ok([200, 503].includes(page.statusCode), '页面应返回 200 或 503');
  console.log('  ok  页面路由');

  const api = res();
  await routes.find((r) => r.path === '/api/goal-gantt').handler({ url: '/api/goal-gantt' }, api);
  JSON.parse(api.body);
  console.log('  ok  数据路由');

  const asset = res();
  await routes.find((r) => r.path === '/goal-gantt/asset').handler({ url: '/goal-gantt/asset/board.css' }, asset);
  assert.equal(asset.statusCode, 200);
  assert.ok(String(asset.body).length > 100, '资源路由应返回内容');

  const evil = res();
  await routes.find((r) => r.path === '/goal-gantt/asset').handler({ url: '/goal-gantt/asset/../../secret' }, evil);
  assert.equal(evil.statusCode, 400, '目录穿越应被拒绝');
  console.log('  ok  静态资源与穿越防护');
}

/* ------------------------------------------------------------ 5. 鉴权 */

{
  const routes = [];
  const ctx = {
    effect: (fn) => { fn(); return () => {}; },
    get: (name) => (name === 'connection' ? { requestRejection: () => 401 } : undefined),
    webServer: { register: (route) => { routes.push(route); return () => {}; } },
  };
  apply(ctx, {});
  const res = { statusCode: 0, headers: {}, body: '', setHeader() {}, end(b) { this.body = b; } };
  await routes.find((r) => r.path === '/api/goal-gantt').handler({ url: '/api/goal-gantt' }, res);
  assert.equal(res.statusCode, 401, '信任围栏拒绝时应短路');
  console.log('  ok  路由鉴权短路');
}

/* ------------------------------------------------ 6. 真实数据端到端 */

{
  const root = process.env.GOAL_BOARD_TEST_ROOT;
  if (root && fs.existsSync(root)) {
    const { apply: applyReal } = await import(pathToFileURL(path.join(HERE, '..', 'lib', 'index.js')).href);
    process.env.DSH_HOME = root;
    const routes = [];
    applyReal({
      effect: (fn) => { fn(); return () => {}; },
      get: () => undefined,
      webServer: { register: (r) => { routes.push(r); return () => {}; } },
    }, {});
    const res = { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
    await routes.find((r) => r.path === '/api/goal-gantt').handler({ url: '/api/goal-gantt' }, res);
    const model = JSON.parse(res.body);
    assert.equal(res.statusCode, 200, '真实数据应返回 200');
    assert.ok(model.phases.length > 0, '真实数据应有阶段');
    assert.ok(model.signature, '应带内容指纹');
    console.log('  ok  真实数据端到端（' + model.phases.length + ' 个阶段, ' + model.sessions.length + ' 个会话）');
  } else {
    console.log('  --  跳过真实数据测试（未设置 GOAL_BOARD_TEST_ROOT）');
  }
}

/* ---------------------------------------------- 7. 阶段复用（同 id 合并） */

{
  const { groupPhases } = await import(pathToFileURL(path.join(HERE, '..', 'lib', 'board-data.js')).href);
  const merged = groupPhases([
    { id: 'P1', title: '优化时间轴', status: 'done', startedAt: 1000, endedAt: 2000, checks: [], segments: [] },
    { id: 'P2', title: '其它', status: 'done', startedAt: 2500, endedAt: 3000, checks: [], segments: [] },
    { id: 'P1', title: '优化时间轴', status: 'active', startedAt: 4000, endedAt: null, checks: [], segments: [] },
  ]);
  assert.equal(merged.length, 2, '同 id 的阶段应合并成一条泳道');
  assert.equal(merged[0].segments.length, 2, 'P1 应有两个时间段');
  assert.equal(merged[0].status, 'active', '有进行中段时整体应为进行中');
  console.log('  ok  阶段复用合并');
}

/* ------------------------------------------- 8. 异常时间（倒挂）收敛 */

{
  const { groupPhases } = await import(pathToFileURL(path.join(HERE, '..', 'lib', 'board-data.js')).href);
  const g = groupPhases([
    { id: 'PX', title: '倒挂', status: 'done', startedAt: 5000, endedAt: 1000, checks: [], segments: [] },
  ]);
  assert.equal(g.length, 1);
  assert.ok(g[0].segments[0].endedAt >= g[0].segments[0].startedAt, '结束时间不应早于开始时间');
  console.log('  ok  时间倒挂收敛');
}

/* --------------------------------------------------- 9. 内容指纹稳定性 */

{
  const { buildBoard } = await import(pathToFileURL(path.join(HERE, '..', 'lib', 'board-data.js')).href);
  const root = process.env.GOAL_BOARD_TEST_ROOT;
  if (root && fs.existsSync(root)) {
    const a = buildBoard(root);
    const b = buildBoard(root);
    assert.equal(a.signature, b.signature, '同样的数据两次构建指纹应一致');
    console.log('  ok  内容指纹稳定');
  } else {
    console.log('  --  跳过指纹测试（未设置 GOAL_BOARD_TEST_ROOT）');
  }
}

/* ------------------------------------- 12. 一键写入示例配置（受控写） */

{
  const zlib = await import('node:zlib');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-gantt-init-'));
  const ws = path.join(root, 'ws');
  const projDir = path.join(root, 'storages', 'session_projcache', 'sessions');
  const started = Date.parse('2026-11-01T00:00:00Z');
  fs.mkdirSync(projDir, { recursive: true });
  fs.mkdirSync(ws, { recursive: true });

  fs.writeFileSync(path.join(projDir, 'session-init.json'), JSON.stringify({
    version: 7,
    record: {
      identity: { formatVersion: 4, createdAt: started, cwd: ws, isSeeded: false, delegationDepth: 0 },
      rows: {
        title: { val: 'init' },
        goal: { val: { current: { goal: { id: 'g', objective: 'x', phase: 'active', maxGoalRounds: 3 }, roundsStarted: 0, createdAt: started, updatedAt: started } } },
        sessionListMetadata: { val: { lastPromptAt: started } },
        sessionStats: { val: { turns: 1, steps: 1 } },
        tokenUsage: { val: { totals: {} } },
        turnOutline: { val: { turns: [] } },
      },
    },
  }));
  fs.writeFileSync(path.join(projDir, 'session-other.json'), JSON.stringify({
    version: 7,
    record: {
      identity: { formatVersion: 4, createdAt: started, cwd: '', isSeeded: false, delegationDepth: 0 },
      rows: { title: { val: 'no cwd' }, sessionListMetadata: { val: {} } },
    },
  }));
  const logDirName = '--' + ws.replace(/[^a-zA-Z0-9]+/g, '-') + '--';
  fs.mkdirSync(path.join(root, 'sessions', logDirName, 'session-init'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'sessions', logDirName, 'session-init', 'session.v4.jsonl.zstd'),
    zlib.zstdCompressSync(Buffer.from(JSON.stringify({ type: 'turn/start', time: started, data: { turn: 1 } }) + '\n')),
  );

  const routes = [];
  const ctx = {
    get: () => undefined,
    effect: (fn) => fn(),
    webServer: { register: (route) => { routes.push(route); return () => {}; } },
  };
  apply(ctx, { dataRoot: root });
  const initRoute = routes.find((r) => r.path === '/api/goal-gantt/init');
  assert.ok(initRoute, '应注册 init 路由');

  const call = async (req) => {
    const res = { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
    await initRoute.handler(req, res);
    return res;
  };

  const notPost = await call({ method: 'GET', url: '/api/goal-gantt/init' });
  assert.equal(notPost.statusCode, 405, '非 POST 应 405');

  const noId = await call({ method: 'POST', url: '/api/goal-gantt/init', body: '{}' });
  assert.equal(noId.statusCode, 400, '缺 sessionId 应 400');

  const unknown = await call({ method: 'POST', url: '/api/goal-gantt/init', body: JSON.stringify({ sessionId: 'nope' }) });
  assert.equal(unknown.statusCode, 404, '未知会话应 404');

  const noCwd = await call({ method: 'POST', url: '/api/goal-gantt/init', body: JSON.stringify({ sessionId: 'session-other' }) });
  assert.equal(noCwd.statusCode, 404, '无工作区应 404');

  const created = await call({ method: 'POST', url: '/api/goal-gantt/init', body: JSON.stringify({ sessionId: 'session-init' }) });
  assert.equal(created.statusCode, 200, '首次写入应 200');
  const written = path.join(ws, 'goal-board', 'board.config.json');
  assert.ok(fs.existsSync(written), '应生成 board.config.json');
  const parsed = JSON.parse(fs.readFileSync(written, 'utf8'));
  assert.ok(Array.isArray(parsed.phases) && parsed.phases.length >= 3, '模板应包含阶段');

  const again = await call({ method: 'POST', url: '/api/goal-gantt/init', body: JSON.stringify({ sessionId: 'session-init' }) });
  assert.equal(again.statusCode, 409, '已存在时应拒绝覆盖');
  assert.equal(JSON.parse(fs.readFileSync(written, 'utf8')).phases.length, parsed.phases.length, '原文件不应被改写');

  fs.rmSync(root, { recursive: true, force: true });
  console.log('  ok  受控写入示例配置');
}

console.log('\n全部通过');


