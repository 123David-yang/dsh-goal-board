/**
 * dsh-goal-board · host 半侧
 *
 * 注册两条 HTTP 路由：
 *   GET /goal-board      看板页面
 *   GET /api/goal-board  看板数据（JSON）
 *
 * 两条路由都先经过 composition 的 connection 信任围栏（Host/Origin + 登录 cookie），
 * 避免在绑定到局域网时把会话内容暴露给未授权请求。
 */
import { buildBoard, resolveDataRoot } from './board-data.js';
import { renderPage } from './view.js';

export const name = 'goal-board';
export const inject = ['webServer'];

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
    kind: 'exact',
    path: '/goal-board',
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
        send(res, 500, 'text/plain; charset=utf-8', 'goal-board: ' + (error?.stack || error));
      }
    },
  }), 'goal-board: page');

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/goal-board',
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
  }), 'goal-board: api');
}
