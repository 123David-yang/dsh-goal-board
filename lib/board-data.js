/**
 * goal-board · 数据层
 *
 * 从 DSH 会话存储（投影缓存 + zstd 会话日志）构建看板模型。
 * 只依赖 node 内置模块，无第三方依赖。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import os from 'node:os';

/* ------------------------------------------------------------ 数据根目录 */

/**
 * 解析 DSH 数据根目录。
 * 兼容三种布局：
 *   $DSH_HOME 就是数据根（含 storages/ sessions/）
 *   $DSH_HOME/data 是数据根
 *   ~/.dsh 或 ~/.dsh/data 是数据根
 * @param explicit 用户显式配置的路径，优先级最高
 * @returns 数据根目录，找不到时返回 null
 */
export function resolveDataRoot(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  const home = process.env.DSH_HOME;
  if (home) {
    candidates.push(home, path.join(home, 'data'));
  }
  if (process.env.DSH_DATA_DIR) candidates.push(process.env.DSH_DATA_DIR);
  candidates.push(
    path.join(os.homedir(), '.dsh'),
    path.join(os.homedir(), '.dsh', 'data'),
  );

  for (const dir of candidates) {
    if (!dir) continue;
    try {
      if (fs.existsSync(path.join(dir, 'storages', 'session_projcache'))) return dir;
    } catch { /* 忽略无权限路径 */ }
  }
  return null;
}

const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};

/* 投影缓存文件解析结果缓存：mtime + size 不变就复用 */
const recordCache = new Map();

function readRecord(file) {
  let stat = null;
  try { stat = fs.statSync(file); } catch { return null; }
  const hit = recordCache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.record;
  const record = readJson(file)?.record;
  if (record) recordCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, record });
  return record;
}

/* ------------------------------------------------------------------ 会话 */

export function listSessions(dataRoot) {
  const dir = path.join(dataRoot, 'storages', 'session_projcache', 'sessions');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const record = readRecord(path.join(dir, file));
    const identity = record?.identity;
    if (!identity?.cwd) continue;
    const rows = record.rows || {};
    out.push({
      id: file.replace(/\.json$/, ''),
      cwd: identity.cwd,
      depth: identity.delegationDepth ?? 0,
      record,
      title: rows.title?.val || '',
      last: rows.sessionListMetadata?.val?.lastPromptAt ?? identity.createdAt ?? 0,
      hasGoal: Boolean(rows.goal?.val?.current?.goal),
    });
  }
  return out.sort((a, b) => b.last - a.last);
}

/* -------------------------------------------------------------- 日志解码 */

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

/**
 * DSH 会话日志是「多帧拼接」的 zstd：每次持久化写入一帧。
 * Node 的 zstdDecompressSync 只解第一帧，这里按帧魔数逐帧解。
 * 帧内出现伪魔数时会解压失败，此时把切片扩展一帧重试。
 */
export function decompressAllFrames(buf) {
  if (typeof zlib.zstdDecompressSync !== 'function') return null;
  const parts = [];
  let pos = 0;
  const nextMagic = (from) => {
    const i = buf.indexOf(ZSTD_MAGIC, from + 1);
    return i === -1 ? -1 : i;
  };
  while (pos < buf.length) {
    let end = nextMagic(pos);
    let ok = false;
    while (!ok) {
      const sliceEnd = end === -1 ? buf.length : end;
      try {
        parts.push(zlib.zstdDecompressSync(buf.subarray(pos, sliceEnd)));
        pos = sliceEnd;
        ok = true;
      } catch {
        if (end === -1) { pos = buf.length; break; }  // 尾部可能是不完整的帧
        end = nextMagic(end);
      }
    }
    if (!ok) break;
  }
  return Buffer.concat(parts);
}

const LOG_FILE = /^session\.v(\d+)\.jsonl(\.zstd)?$/;

function findLogFile(dataRoot, cwd, sessionId) {
  const dirName = '--' + cwd.replace(/[^a-zA-Z0-9]+/g, '-') + '--';
  const variants = [sessionId, 'session-' + sessionId, sessionId.replace(/^session-/, '')];
  for (const variant of variants) {
    const dir = path.join(dataRoot, 'sessions', dirName, variant);
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    /* 取版本号最高的日志（兼容未来的 v5/v6），同版本优先压缩格式 */
    const best = names
      .map((name) => ({ name, match: LOG_FILE.exec(name) }))
      .filter((x) => x.match)
      .sort((a, b) => {
        const va = Number(a.match[1]);
        const vb = Number(b.match[1]);
        if (va !== vb) return vb - va;
        return (b.match[2] ? 1 : 0) - (a.match[2] ? 1 : 0);
      })[0];
    if (best) return path.join(dir, best.name);
  }
  return null;
}

/* 解析结果缓存：key = 文件路径，命中条件 mtime + size 都不变 */
const eventCache = new Map();

function readEvents(dataRoot, cwd, sessionId) {
  const file = findLogFile(dataRoot, cwd, sessionId);
  if (!file) return [];

  let stat = null;
  try { stat = fs.statSync(file); } catch { return [] }
  const hit = eventCache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.events;

  let text = '';
  try {
    const decoded = decompressAllFrames(fs.readFileSync(file));
    text = decoded ? decoded.toString('utf8') : '';
  } catch {
    try { text = fs.readFileSync(file, 'utf8'); } catch { text = ''; }
  }

  const events = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try { events.push(JSON.parse(s)); } catch { /* 跳过被截断的尾行 */ }
  }
  eventCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, events });
  return events;
}

/* ------------------------------------------------------------ 阶段来源 */

function readPhaseConfig(cwd) {
  const file = path.join(cwd, 'goal-board', 'board.config.json');
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const ts = (value) => (value ? Date.parse(value) : null);

/**
 * 阶段配置是否适用于这个会话：
 *   config.sessionId  指定会话（最高优先级）
 *   config.goalId     指定 goal
 *   goalId 都没有时，只对该工作区「有 goal 的会话」生效
 * 这样可以避免同一工作区的其它会话看到同一份看板。
 */
function configAppliesTo(config, session, goal) {
  if (!config || !Array.isArray(config.phases) || config.phases.length === 0) return false;
  if (config.sessionId) return config.sessionId === session.id;
  if (config.goalId) return Boolean(goal) && config.goalId === goal.id;
  return Boolean(goal);
}

function phaseFromConfig(raw) {
  const checks = raw.checks || [];
  const done = checks.filter((c) => c.done).length;
  const ratio = checks.length
    ? done / checks.length
    : raw.status === 'done' ? 1 : raw.status === 'active' ? 0.4 : 0;
  return {
    id: raw.id,
    title: raw.title,
    desc: raw.desc || '',
    status: raw.status || 'pending',
    checks,
    summary: raw.summary || '',
    deliverables: raw.deliverables || [],
    plannedStart: ts(raw.plannedStart),
    plannedEnd: ts(raw.plannedEnd),
    startedAt: ts(raw.startedAt),
    endedAt: ts(raw.endedAt),
    progress: Math.round(ratio * 100),
  };
}

/** 没有配置时按 goal 轮次切分；再退化为按对话轮次切分。 */
function autoPhases(events, goal, now) {
  const rounds = [];
  for (const event of events) {
    if (event.type !== 'user/message') continue;
    const text = (event.data?.content || []).map((c) => c.text || '').join('');
    const match = /<goal_round>[\s\S]*?Round:\s*(\d+)\/(\d+)/.exec(text);
    if (match) rounds.push({ n: Number(match[1]), time: event.time });
  }

  if (rounds.length) {
    return rounds.map((round, index) => {
      const next = rounds[index + 1];
      const ended = next ? next.time : (goal?.phase === 'active' ? null : now);
      const window = events.filter((e) => e.time >= round.time && e.time <= (ended ?? now));
      const last = [...window].reverse().find((e) => e.type === 'assistant/message');
      const text = (last?.data?.message?.content || []).find((c) => c.type === 'text')?.text || '';
      return {
        id: 'R' + round.n,
        title: '第 ' + round.n + ' 轮',
        desc: '',
        status: ended ? 'done' : 'active',
        checks: [],
        summary: text.replace(/\s+/g, ' ').slice(0, 90),
        deliverables: [],
        plannedStart: round.time,
        plannedEnd: ended,
        startedAt: round.time,
        endedAt: ended,
        progress: ended ? 100 : 50,
      };
    });
  }

  const turns = events.filter((e) => e.type === 'turn/start');
  if (turns.length) {
    return turns.map((turn, index) => {
      const next = turns[index + 1];
      const ended = next ? next.time : (goal?.phase === 'active' ? null : now);
      return {
        id: 'T' + turn.data.turn,
        title: '第 ' + turn.data.turn + ' 轮对话',
        desc: '',
        status: ended ? 'done' : 'active',
        checks: [],
        summary: '',
        deliverables: [],
        plannedStart: turn.time,
        plannedEnd: next ? next.time : null,
        startedAt: turn.time,
        endedAt: ended,
        progress: ended ? 100 : 40,
      };
    });
  }

  return [{
    id: 'P0',
    title: '当前工作',
    desc: '',
    status: 'active',
    checks: [],
    summary: '',
    deliverables: [],
    plannedStart: null,
    plannedEnd: null,
    startedAt: now,
    endedAt: null,
    progress: 0,
  }];
}

/* ------------------------------------------------------------ 内容指纹 */

/**
 * 看板内容的稳定指纹：只包含「会改变界面」的字段，
 * 不含 generatedAt / now，用于让前端判断是否需要整页重绘。
 */
function fingerprint(model) {
  const parts = [
    model.session.id,
    model.session.title,
    model.mode,
    model.goal ? [model.goal.phase, model.goal.objective, model.goal.roundsStarted, model.goal.maxGoalRounds].join('|') : '-',
    model.phases
      .map((p) => [p.id, p.status, p.progress, p.startedAt, p.endedAt, p.summary, p.desc,
        p.checks.map((c) => (c.done ? 1 : 0)).join(''),
        (p.deliverables || []).map((d) => d.label).join(',')].join('~'))
      .join('|'),
    model.sessions.map((s) => s.id + (s.hasGoal ? '*' : '')).join(','),
  ].join('#');

  let hash = 5381;
  for (let i = 0; i < parts.length; i++) {
    hash = ((hash * 33) ^ parts.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/* ---------------------------------------------------------------- 主函数 */

export function buildBoard(dataRoot, opts = {}) {
  const now = Date.now();
  if (!dataRoot) {
    return {
      ok: false,
      generatedAt: now,
      error: '找不到 DSH 数据目录。请确认 DSH_HOME 环境变量，或在插件配置里指定 dataRoot。',
    };
  }

  const all = listSessions(dataRoot);
  let pool = all.filter((s) => (s.depth ?? 0) === 0);
  if (!pool.length) pool = all;

  let session = null;
  if (opts.sessionId) {
    /* 明确指定了会话：只认这个，绝不回退到别的会话，
       否则会把「别的对话的看板」显示在当前对话里。 */
    session = pool.find((s) => s.id === opts.sessionId)
      ?? all.find((s) => s.id === opts.sessionId)
      ?? null;
    if (!session) {
      return { ok: false, generatedAt: now, error: '找不到这个会话（可能已被删除或存档）。' };
    }
  } else {
    const withGoal = pool.filter((s) => s.hasGoal);
    session = withGoal.length ? withGoal[0] : pool[0];
    if (!session) {
      return { ok: false, generatedAt: now, error: '还没有任何会话记录。' };
    }
  }

  const rows = session.record.rows || {};
  const goalRow = rows.goal?.val?.current || null;
  const goal = goalRow?.goal || null;
  const stats = rows.sessionStats?.val || {};
  const tokens = rows.tokenUsage?.val?.totals || {};

  const events = readEvents(dataRoot, session.cwd, session.id);

  const turnStarts = new Map();
  const toolCalls = [];
  let lastActivity = session.last;
  for (const event of events) {
    if (event.type === 'turn/start' && event.data?.turn != null) turnStarts.set(event.data.turn, event.time);
    if (event.type === 'tool/call') toolCalls.push({ time: event.time });
    if (event.time > lastActivity) lastActivity = event.time;
  }

  const rawConfig = readPhaseConfig(session.cwd);
  const config = configAppliesTo(rawConfig, session, goal) ? rawConfig : null;
  const mode = config ? 'config' : 'auto';
  /* 没有 goal 又没有生效的阶段配置时，不去按轮次编造阶段——直接给空态 */
  const empty = !goal && mode === 'auto';
  const rawPhases = empty
    ? []
    : (mode === 'config' ? config.phases.map(phaseFromConfig) : autoPhases(events, goal, now));

  const phases = rawPhases.map((phase, index) => {
    let ended = phase.endedAt;
    if (!ended && phase.status === 'done') {
      ended = rawPhases.slice(index + 1).map((p) => p.startedAt).find(Boolean) ?? now;
    }
    const openEnd = ended ?? (phase.startedAt ? now : null);
    const calls = phase.startedAt
      ? toolCalls.filter((t) => t.time >= phase.startedAt && t.time <= (openEnd ?? now)).length
      : 0;
    const turns = phase.startedAt
      ? [...turnStarts.values()].filter((t) => t >= phase.startedAt && t <= (openEnd ?? now)).length
      : 0;

    return {
      id: phase.id,
      title: phase.title,
      desc: phase.desc,
      status: phase.status,
      checks: phase.checks,
      summary: phase.summary,
      deliverables: phase.deliverables,
      plannedStart: phase.plannedStart,
      plannedEnd: phase.plannedEnd,
      startedAt: phase.startedAt,
      endedAt: ended,
      durationMs: phase.startedAt ? (openEnd ?? now) - phase.startedAt : null,
      progress: phase.progress ?? (phase.status === 'done' ? 100 : 0),
      activity: { toolCalls: calls, turns },
      nextCheck: phase.checks.find((c) => !c.done)?.label || null,
    };
  });

  const overall = phases.length
    ? Math.round(phases.reduce((sum, p) => sum + p.progress, 0) / phases.length)
    : 0;

  const starts = phases.map((p) => p.startedAt ?? p.plannedStart).filter(Boolean);
  const ends = phases.map((p) => p.endedAt ?? p.plannedEnd ?? now).filter(Boolean);
  const goalCreated = goalRow?.createdAt ?? session.record.identity.createdAt;
  const from = starts.length ? Math.min(...starts, goalCreated) : goalCreated;
  const to = ends.length ? Math.max(...ends, now) : now;
  const pending = phases.filter((p) => p.status !== 'done');
  const remainingMs = pending.reduce(
    (sum, p) => sum + (p.plannedEnd && p.plannedStart ? p.plannedEnd - p.plannedStart : 0), 0);

  const model = {
    ok: true,
    generatedAt: now,
    mode,
    empty,
    board: { title: config?.title || 'GOAL 甘特看板', subtitle: config?.subtitle || 'DSH Goal Gantt Board' },
    goal: goal ? {
      id: goal.id,
      objective: goal.objective,
      phase: goal.phase,
      roundsStarted: goalRow.roundsStarted ?? 0,
      maxGoalRounds: goal.maxGoalRounds ?? 0,
      createdAt: goalCreated,
      updatedAt: goalRow.updatedAt ?? goalCreated,
    } : null,
    session: {
      id: session.id,
      title: session.title,
      cwdName: path.basename(session.cwd),
      turns: stats.turns ?? turnStarts.size,
      steps: stats.steps ?? 0,
      tokens: (tokens.uncachedInputTokens ?? 0) + (tokens.cacheReadTokens ?? 0) + (tokens.outputTokens ?? 0),
      toolCalls: toolCalls.length,
      lastActivityAt: lastActivity,
    },
    /* 供页面上的会话选择器使用，最多 30 条 */
    sessions: pool.slice(0, 30).map((s) => ({
      id: s.id,
      title: s.title || s.id,
      hasGoal: s.hasGoal,
      lastActivityAt: s.last,
      cwdName: path.basename(s.cwd),
    })),
    phases,
    timeline: { from, to, now },
    overall,
    distance: {
      remainingPhases: pending.length,
      totalPhases: phases.length,
      remainingRounds: goal?.maxGoalRounds
        ? Math.max(0, goal.maxGoalRounds - (goalRow?.roundsStarted ?? 0))
        : null,
      roundsStarted: goalRow?.roundsStarted ?? 0,
      maxRounds: goal?.maxGoalRounds || null,
      remainingMs,
    },
    recentTurns: (rows.turnOutline?.val?.turns || []).slice(-4).map((turn) => ({
      turn: turn.turn,
      prompt: (turn.prompt || '').slice(0, 70),
      time: turnStarts.get(turn.turn) ?? null,
    })),
  };

  model.signature = fingerprint(model);
  return model;
}


