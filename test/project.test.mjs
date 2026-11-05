/**
 * 普通对话 → 项目视图：按空闲间隔切段 + 活动统计。
 *   node test/project.test.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { buildBoard } = await import(pathToFileURL(path.join(HERE, '..', 'lib', 'board-data.js')).href);

const MIN = 60000;
const base = Date.now() - 90 * MIN;

function fixture(events, { goal = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-gantt-proj-'));
  const ws = path.join(root, 'ws');
  const projDir = path.join(root, 'storages', 'session_projcache', 'sessions');
  const logDirName = '--' + ws.replace(/[^a-zA-Z0-9]+/g, '-') + '--';
  const logDir = path.join(root, 'sessions', logDirName, 'session-proj');
  fs.mkdirSync(projDir, { recursive: true });
  fs.mkdirSync(ws, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  fs.writeFileSync(path.join(projDir, 'session-proj.json'), JSON.stringify({
    version: 7,
    record: {
      identity: { formatVersion: 4, createdAt: base, cwd: ws, isSeeded: false, delegationDepth: 0 },
      rows: {
        title: { val: '没有 goal 的会话' },
        ...(goal ? { goal: { val: { current: { goal, roundsStarted: 0, createdAt: base, updatedAt: base } } } } : {}),
        sessionListMetadata: { val: { lastPromptAt: base } },
        sessionStats: { val: { turns: 3, steps: 8 } },
        tokenUsage: { val: { totals: { uncachedInputTokens: 100, cacheReadTokens: 0, outputTokens: 50 } } },
        turnOutline: { val: { turns: [] } },
      },
    },
  }));

  const body = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(path.join(logDir, 'session.v4.jsonl.zstd'), zlib.zstdCompressSync(Buffer.from(body)));
  return root;
}

const user = (time, text) => ({ type: 'user/message', time, data: { content: [{ type: 'text', text }] } });
const tool = (time, name) => ({ type: 'tool/call', time, data: { name } });
const turn = (time, n) => ({ type: 'turn/start', time, data: { turn: n } });
const reply = (time, text) => ({ type: 'assistant/message', time, data: { message: { content: [{ type: 'text', text }] } } });

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log((ok ? '  ok  ' : ' FAIL ') + name + (detail ? '  (' + detail + ')' : ''));
};

/* ------------------------------------------------ 1. 三段对话 */
{
  const events = [
    /* 第一段：分析（读文件为主） */
    user(base + 0 * MIN, '帮我分析 C 盘可清理文件'),
    turn(base + 0.2 * MIN, 1),
    tool(base + 1 * MIN, 'read_file'),
    tool(base + 1.5 * MIN, 'grep'),
    /* 空闲 25 分钟 → 新段 */
    user(base + 26 * MIN, '重构支付结算模块，拆成独立服务'),
    turn(base + 26.2 * MIN, 2),
    tool(base + 27 * MIN, 'edit_file'),
    tool(base + 28 * MIN, 'edit_file'),
    tool(base + 29 * MIN, 'pwsh'),
    reply(base + 30 * MIN, '重构完成：支付模块拆成独立服务，**幂等**与灰度都已接上，对账误差压到 0.01%。'),
    /* 空闲 40 分钟 → 第三段 */
    user(base + 70 * MIN, '补一下文档'),
    turn(base + 70.3 * MIN, 3),
    tool(base + 71 * MIN, 'read_file'),
  ];
  const root = fixture(events);
  const model = buildBoard(root);

  check('模式为 project', model.mode === 'project', model.mode);
  check('切出三段', model.phases.length === 3, String(model.phases.length));
  check('标题取首个需求', model.phases[0].title.includes('C 盘'), model.phases[0].title);
  check('第二段标题正确', model.phases[1].title.includes('支付结算'), model.phases[1].title);
  check('第二段统计改代码 2 次', model.phases[1].activity.code === 2, String(model.phases[1].activity.code));
  check('第二段摘要取助手结论', model.phases[1].summary.includes('支付模块拆成独立服务'), model.phases[1].summary);
  check('摘要不是工具流水账', !model.phases[1].summary.includes('×'), model.phases[1].summary);
  check('第二段统计跑命令 1 次', model.phases[1].activity.run === 1, String(model.phases[1].activity.run));
  check('第一段统计读文件 2 次', model.phases[0].activity.read === 2, String(model.phases[0].activity.read));
  check('最后一段为进行中', model.phases[2].status === 'active', model.phases[2].status);
  check('前两段已完成', model.phases[0].status === 'done' && model.phases[1].status === 'done');
  check('没有 goal 也能出图', model.ok === true && model.timeline.to > model.timeline.from);
  fs.rmSync(root, { recursive: true, force: true });
}

/* ------------------------------------------------ 2. 全程连续（不切段） */
{
  const events = [];
  for (let i = 0; i < 10; i++) {
    events.push(tool(base + i * 2 * MIN, 'read_file'));
  }
  const root = fixture(events);
  const model = buildBoard(root);
  check('连续活动只切一段', model.phases.length === 1, String(model.phases.length));
  check('段标题回退到序号', model.phases[0].title === '#1', model.phases[0].title);
  fs.rmSync(root, { recursive: true, force: true });
}

/* ------------------------------------------------ 3. 完全没有事件 */
{
  const root = fixture([]);
  const model = buildBoard(root);
  check('没有事件时仍是空态', model.ok === true && model.empty === true);
  check('空态没有阶段', model.phases.length === 0);
  fs.rmSync(root, { recursive: true, force: true });
}

/* ------------------------------------------------ 4. 有 goal 时不走项目模式 */
{
  const root = fixture(
    [user(base, 'go'), turn(base + MIN, 1), tool(base + 2 * MIN, 'read_file')],
    { goal: { id: 'g1', objective: 'x', phase: 'active', maxGoalRounds: 3 } },
  );
  const model = buildBoard(root);
  check('有 goal 时不是项目模式', model.mode !== 'project', model.mode);
  fs.rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error('\n' + failed + ' 项未通过');
  process.exit(1);
}
console.log('\n全部通过');
