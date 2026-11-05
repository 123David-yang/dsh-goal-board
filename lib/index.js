/**
 * dsh-goal-gantt · host 半侧
 *
 * 注册两条 HTTP 路由：
 *   GET /goal-gantt      看板页面
 *   GET /api/goal-gantt  看板数据（JSON）
 *
 * 两条路由都先经过 composition 的 connection 信任围栏（Host/Origin + 登录 cookie），
 * 避免在绑定到局域网时把会话内容暴露给未授权请求。
 */
import { buildBoard, listSessions, resolveDataRoot } from './board-data.js';
import { renderPage } from './view.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'goal-gantt';
export const inject = ['webServer'];

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/* 同一会话 1 秒内重复请求复用结果，避免页面轮询时反复扫盘 */
const modelCache = new Map();

function getModel(dataRoot, sessionId) {
  const key = dataRoot + '|' + (sessionId || '');
  const hit = modelCache.get(key);
  if (hit && Date.now() - hit.at < 1000) return hit.model;
  const model = buildBoard(dataRoot, { sessionId });
  modelCache.set(key, { at: Date.now(), model });
  return model;
}

const TEMPLATE = {
  title: 'Goal 看板',
  phases: [
    { id: 'P0', title: '调研与方案', status: 'done', summary: '读完资料、定了方向。', checks: [{ label: '收集资料', done: true }, { label: '写方案', done: true }] },
    { id: 'P1', title: '实现', status: 'active', checks: [{ label: '核心逻辑', done: true }, { label: '边界处理', done: false }] },
    { id: 'P2', title: '验收与复盘', status: 'pending', checks: [{ label: '自测通过', done: false }] },
  ],
};

const readJsonBody = (req, limit = 64 * 1024) => new Promise((resolve) => {
  if (req && typeof req.body === 'string') {
    try { resolve(JSON.parse(req.body)); } catch { resolve(null); }
    return;
  }
  if (!req || typeof req.on !== 'function') { resolve(null); return; }
  let data = '';
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    try { resolve(data ? JSON.parse(data) : null); } catch { resolve(null); }
  };
  req.on('data', (chunk) => {
    data += chunk;
    if (data.length > limit) { data = ''; finish(); }
  });
  req.on('end', finish);
  req.on('error', finish);
});

function send(res, status, type, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(body);
}

export function apply(ctx, config) {
  const dataRoot = resolveDataRoot(config?.dataRoot);

  /** @returns 是否放行；被拒绝时已写好响应 */
  const allowed = (req, res) => {
    const connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined;
    if (connection && typeof connection.requestRejection === 'function') {
      const rejection = connection.requestRejection(req);
      if (rejection !== undefined) {
        res.statusCode = rejection;
        res.end();
        return false;
      }
    }
    return true;
  };

  const pick = (req) => {
    try {
      return new URL(req.url, 'http://127.0.0.1').searchParams.get('session') || undefined;
    } catch {
      return undefined;
    }
  };

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/goal-gantt/asset',
    handler: (req, res) => {
      if (!allowed(req, res)) return;
      try {
        const name = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname)
          .slice('/goal-gantt/asset'.length)
          .replace(/^\/+/, '');
        if (!name || name.includes('..') || name.includes('\\')) {
          send(res, 400, 'text/plain; charset=utf-8', 'bad asset name');
          return;
        }
        const file = path.join(ASSETS, name);
        if (!file.startsWith(ASSETS) || !fs.existsSync(file)) {
          send(res, 404, 'text/plain; charset=utf-8', 'not found');
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', MIME[path.extname(name)] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.end(fs.readFileSync(file));
      } catch (error) {
        send(res, 500, 'text/plain; charset=utf-8', String(error?.message || error));
      }
    },
  }), 'goal-gantt: assets');

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/goal-gantt',
    handler: (req, res) => {
      if (!allowed(req, res)) return;
      try {
        const model = getModel(dataRoot, pick(req));
        if (!model.ok) {
          send(res, 503, 'text/html; charset=utf-8',
            `<!doctype html><meta charset="utf-8">` +
            `<body style="margin:0;background:#070a10;color:#94a6c0;font-family:system-ui;padding:48px;line-height:1.7">` +
            `<h2 style="color:#e8effb;margin:0 0 12px">Goal 看板暂时没有数据</h2>` +
            `<p>${model.error || '未知原因'}</p>` +
            `<p style="color:#5c6c85">数据目录：${dataRoot || '未找到'}</p></body>`);
          return;
        }
        send(res, 200, 'text/html; charset=utf-8', renderPage(model));
      } catch (error) {
        send(res, 500, 'text/plain; charset=utf-8', 'goal-gantt: ' + (error?.stack || error));
      }
    },
  }), 'goal-gantt: page');

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/goal-gantt',
    handler: (req, res) => {
      if (!allowed(req, res)) return;
      try {
        const model = getModel(dataRoot, pick(req));
        send(res, model.ok ? 200 : 503, 'application/json; charset=utf-8', JSON.stringify(model));
      } catch (error) {
        send(res, 500, 'application/json; charset=utf-8',
          JSON.stringify({ ok: false, error: String(error?.message || error) }));
      }
    },
  }), 'goal-gantt: api');

  /* 唯一的写操作：把示例配置落成 goal-board/board.config.json，已存在则拒绝 */
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/goal-gantt/init',
    handler: async (req, res) => {
      if (!allowed(req, res)) return;
      if ((req.method || 'GET').toUpperCase() !== 'POST') {
        send(res, 405, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'method not allowed' }));
        return;
      }
      try {
        const body = await readJsonBody(req);
        const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : '';
        if (!sessionId) {
          send(res, 400, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'sessionId required' }));
          return;
        }
        const session = listSessions(dataRoot).find((s) => s.id === sessionId);
        if (!session || !session.cwd || !path.isAbsolute(session.cwd)) {
          send(res, 404, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'session not found' }));
          return;
        }
        if (!fs.existsSync(session.cwd)) {
          send(res, 404, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'workspace missing' }));
          return;
        }
        const dir = path.join(session.cwd, 'goal-board');
        const file = path.join(dir, 'board.config.json');
        fs.mkdirSync(dir, { recursive: true });
        try {
          fs.writeFileSync(file, JSON.stringify(TEMPLATE, null, 2) + '\n', { flag: 'wx' });
        } catch (error) {
          if (error && error.code === 'EEXIST') {
            send(res, 409, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'exists', path: file }));
            return;
          }
          throw error;
        }
        send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, path: file }));
      } catch (error) {
        send(res, 500, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: String(error?.message || error) }));
      }
    },
  }), 'goal-gantt: init config');
}

