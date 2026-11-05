/**
 * 性能与超大会话基准：
 *   生成一个 ~20k 事件、多数是 tool/result 的会话，测量 buildBoard 冷/热耗时。
 *   node test/perf.test.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { buildBoard, resolveDataRoot } = await import(
  pathToFileURL(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'lib', 'board-data.js')).href
);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-gantt-perf-'));
const ws = path.join(root, 'ws');
const projDir = path.join(root, 'storages', 'session_projcache', 'sessions');
const logDirName = '--' + ws.replace(/[^a-zA-Z0-9]+/g, '-') + '--';
const logDir = path.join(root, 'sessions', logDirName, 'session-perf');
const sessionId = 'session-perf';
const started = Date.parse('2026-11-01T00:00:00Z');

fs.mkdirSync(projDir, { recursive: true });
fs.mkdirSync(path.join(ws, 'goal-board'), { recursive: true });
fs.mkdirSync(logDir, { recursive: true });

/* 阶段配置 */
fs.writeFileSync(path.join(ws, 'goal-board', 'board.config.json'), JSON.stringify({
  title: 'PERF',
  phases: [
    { id: 'P0', title: '阶段一', status: 'done', startedAt: '2026-11-01T00:00:00Z', endedAt: '2026-11-01T01:00:00Z', checks: [] },
    { id: 'P1', title: '阶段二', status: 'active', startedAt: '2026-11-01T01:00:00Z', checks: [] },
  ],
}));

/* 投影缓存 */
fs.writeFileSync(path.join(projDir, sessionId + '.json'), JSON.stringify({
  version: 7,
  record: {
    identity: { formatVersion: 4, createdAt: started, cwd: ws, isSeeded: false, delegationDepth: 0 },
    rows: {
      title: { val: 'perf session' },
      goal: {
        val: {
          current: {
            goal: { id: 'goal-perf', objective: 'benchmark', phase: 'active', maxGoalRounds: 10 },
            roundsStarted: 1,
            createdAt: started,
            updatedAt: started,
          },
        },
      },
      sessionListMetadata: { val: { lastPromptAt: started + 3600e3 } },
      sessionStats: { val: { turns: 20, steps: 200 } },
      tokenUsage: { val: { totals: { uncachedInputTokens: 1000, cacheReadTokens: 2000, outputTokens: 3000 } } },
      turnOutline: { val: { turns: [{ turn: 1, prompt: 'go', response: 'ok' }] } },
    },
  },
}));

/* 会话日志：20k 事件，其中 19.5k 是大体积 tool/result */
const lines = [];
const big = 'x'.repeat(400);
for (let i = 0; i < 20000; i++) {
  const time = started + i * 1000;
  if (i % 1000 === 0) {
    lines.push(JSON.stringify({ type: 'turn/start', time, data: { turn: Math.floor(i / 1000) + 1 } }));
  } else if (i % 50 === 0) {
    lines.push(JSON.stringify({ type: 'tool/call', time, data: { name: 'pwsh', turn: 1 } }));
  } else {
    lines.push(JSON.stringify({ type: 'tool/result', time, data: { callId: 'c' + i, output: big } }));
  }
}
const raw = Buffer.from(lines.join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(logDir, 'session.v4.jsonl.zstd'), zlib.zstdCompressSync(raw));

const before = resolveDataRoot(root);
assert.equal(before, root, '应能解析出数据根');

const t0 = process.hrtime.bigint();
const cold = buildBoard(root);
const coldMs = Number(process.hrtime.bigint() - t0) / 1e6;

const t1 = process.hrtime.bigint();
for (let i = 0; i < 10; i++) buildBoard(root);
const warmMs = Number(process.hrtime.bigint() - t1) / 1e6 / 10;

console.log('  日志大小: ' + (raw.length / 1e6).toFixed(1) + ' MB（压缩后 ' +
    (fs.statSync(path.join(logDir, 'session.v4.jsonl.zstd')).size / 1024).toFixed(0) + ' KB）');
console.log('  冷启动: ' + coldMs.toFixed(0) + ' ms   热调用: ' + warmMs.toFixed(1) + ' ms');
console.log('  phases=' + cold.phases.length + ' toolCalls=' + cold.session.toolCalls + ' turns=' + cold.session.turns);

assert.equal(cold.ok, true);
assert.equal(cold.phases.length, 2, '应读到配置里的两个阶段');
assert.equal(cold.session.toolCalls, 380, 'tool/call 计数应为 380（每 50 条一次，扣除整千处的 turn/start）');
assert.ok(coldMs < 1500, '冷启动应低于 1.5s，实际 ' + coldMs.toFixed(0) + 'ms');
assert.ok(warmMs < 80, '热调用应低于 80ms，实际 ' + warmMs.toFixed(1) + 'ms');

fs.rmSync(root, { recursive: true, force: true });
console.log('\n全部通过');
