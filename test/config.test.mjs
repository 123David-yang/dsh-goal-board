/**
 * 异常配置健壮性：坏时间、坏结构、缺字段都不应该让看板崩或出现 NaN。
 *   node test/config.test.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const { buildBoard } = await import(pathToFileURL(path.join(HERE, '..', 'lib', 'board-data.js')).href);

function fixture(config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-gantt-cfg-'));
  const ws = path.join(root, 'ws');
  const projDir = path.join(root, 'storages', 'session_projcache', 'sessions');
  const logDirName = '--' + ws.replace(/[^a-zA-Z0-9]+/g, '-') + '--';
  const logDir = path.join(root, 'sessions', logDirName, 'session-cfg');
  const started = Date.parse('2026-11-01T00:00:00Z');

  fs.mkdirSync(projDir, { recursive: true });
  fs.mkdirSync(path.join(ws, 'goal-board'), { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  if (config !== undefined) {
    fs.writeFileSync(path.join(ws, 'goal-board', 'board.config.json'), JSON.stringify(config));
  }

  fs.writeFileSync(path.join(projDir, 'session-cfg.json'), JSON.stringify({
    version: 7,
    record: {
      identity: { formatVersion: 4, createdAt: started, cwd: ws, isSeeded: false, delegationDepth: 0 },
      rows: {
        title: { val: 'cfg' },
        goal: { val: { current: { goal: { id: 'g', objective: 'x', phase: 'active', maxGoalRounds: 5 }, roundsStarted: 0, createdAt: started, updatedAt: started } } },
        sessionListMetadata: { val: { lastPromptAt: started } },
        sessionStats: { val: { turns: 1, steps: 1 } },
        tokenUsage: { val: { totals: {} } },
        turnOutline: { val: { turns: [] } },
      },
    },
  }));

  const lines = [
    { type: 'turn/start', time: started, data: { turn: 1 } },
    { type: 'tool/call', time: started + 1000, data: { name: 'pwsh' } },
  ].map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(path.join(logDir, 'session.v4.jsonl.zstd'), zlib.zstdCompressSync(Buffer.from(lines)));

  return root;
}

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log((ok ? '  ok  ' : ' FAIL ') + name + (detail ? '  (' + detail + ')' : ''));
};

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/* ------------------------------------------------ 1. 非法时间字符串 */
{
  const root = fixture({
    phases: [
      { id: 'P0', title: '坏时间', status: 'done', startedAt: 'not-a-date', endedAt: '2026-13-45', checks: [] },
      { id: 'P1', title: '正常', status: 'active', startedAt: '2026-11-01T00:00:00Z', checks: [] },
    ],
  });
  const model = buildBoard(root);
  check('坏时间：不崩', model.ok === true);
  check('坏时间：两个阶段都在', model.phases.length === 2, String(model.phases.length));
  check('坏时间：时间轴是有限数', finite(model.timeline.from) && finite(model.timeline.to));
  check('坏时间：坏阶段没有开始时间', model.phases[0].startedAt === null);
  fs.rmSync(root, { recursive: true, force: true });
}

/* ------------------------------------------------ 2. 缺字段 / 非对象 */
{
  const root = fixture({
    phases: [
      { id: 'P0' },
      { title: '没有 id' },
      null,
      'oops',
      { id: 'P1', title: '有 id', status: 'active', checks: 'not-an-array' },
    ],
  });
  const model = buildBoard(root);
  check('缺字段：只保留合法阶段', model.phases.length === 2, String(model.phases.length));
  check('缺字段：标题回退到 id', model.phases[0].title === 'P0', model.phases[0].title);
  check('缺字段：checks 非数组不报错', Array.isArray(model.phases[1].checks));
  fs.rmSync(root, { recursive: true, force: true });
}

/* ------------------------------------------------ 3. phases 不是数组 */
{
  const root = fixture({ phases: { P0: { title: 'x' } } });
  const model = buildBoard(root);
  check('phases 非数组：不崩', model.ok === true);
  check('phases 非数组：退回自动模式', model.mode === 'auto', model.mode);
  fs.rmSync(root, { recursive: true, force: true });
}

/* ------------------------------------------------ 4. 进度越界收敛 */
{
  const root = fixture({
    phases: [
      { id: 'P0', title: 'x', status: 'done', progress: 999, checks: [] },
    ],
  });
  const model = buildBoard(root);
  check('进度不超过 100', model.overall <= 100, String(model.overall));
  fs.rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error('\n' + failed + ' 项未通过');
  process.exit(1);
}
console.log('\n全部通过');
