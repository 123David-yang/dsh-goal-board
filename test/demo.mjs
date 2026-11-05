/**
 * 演示数据：用于 README 截图与渲染自测，全部为虚构内容，不含任何真实会话信息。
 */
export function demoModel(now = Date.now()) {
  const hour = 3600_000;
  const base = now - 6 * hour;
  const at = (h) => base + h * hour;

  const withSegments = (phases) => phases.map((p) => ({
    ...p,
    segments: [{
      startedAt: p.startedAt, endedAt: p.endedAt,
      plannedStart: p.plannedStart, plannedEnd: p.plannedEnd,
      status: p.status, progress: p.progress, summary: p.summary, checks: p.checks,
    }],
  }));

  return {
    ok: true,
    generatedAt: now,
    mode: 'config',
    board: { title: 'GOAL 甘特看板', subtitle: 'DSH Goal Gantt Board' },
    goal: {
      id: 'goal-demo',
      objective: '重构支付结算模块：拆分为独立服务，补齐幂等与灰度发布能力，并把对账误差压到 0.01% 以内。',
      phase: 'active',
      roundsStarted: 3,
      maxGoalRounds: 12,
      createdAt: base,
      updatedAt: now,
    },
    session: {
      id: 'session-demo-0001',
      title: '重构支付结算模块',
      cwdName: 'payments',
      turns: 26,
      steps: 210,
      tokens: 4_120_000,
      toolCalls: 164,
      lastActivityAt: now,
    },
    sessions: [
      { id: 'session-demo-0001', title: '重构支付结算模块', hasGoal: true, lastActivityAt: now, cwdName: 'payments' },
      { id: 'session-demo-0002', title: '日志采集链路排查', hasGoal: true, lastActivityAt: now - 2 * hour, cwdName: 'observability' },
      { id: 'session-demo-0003', title: '文档站迁移', hasGoal: false, lastActivityAt: now - 26 * hour, cwdName: 'docs' },
    ],
    phases: withSegments([
      {
        id: 'P0', title: '现状梳理与拆分方案', desc: '理清结算链路边界，确定拆分粒度',
        status: 'done', startedAt: at(0), endedAt: at(0.6), durationMs: 0.6 * hour,
        plannedStart: at(0), plannedEnd: at(0.8), progress: 100,
        checks: [
          { label: '梳理 7 条核心链路', done: true },
          { label: '确定服务边界', done: true },
          { label: '评审拆分方案', done: true },
        ],
        summary: '确认按「下单-扣款-对账」三条链路拆分，先迁移扣款，避免一次性改动过大。',
        deliverables: [], activity: { toolCalls: 21, turns: 2 }, nextCheck: null,
      },
      {
        id: 'P1', title: '扣款服务抽取', desc: '把扣款逻辑从单体中抽出，保持接口兼容',
        status: 'done', startedAt: at(0.6), endedAt: at(2.2), durationMs: 1.6 * hour,
        plannedStart: at(0.8), plannedEnd: at(2.4), progress: 100,
        checks: [
          { label: '抽离领域模型', done: true },
          { label: '双写对账', done: true },
          { label: '回归用例通过', done: true },
          { label: '灰度 10% 流量', done: true },
        ],
        summary: '扣款服务独立部署，双写校验 48 小时零差异；灰度 10% 期间 P99 延迟 42ms。',
        deliverables: [{ label: 'design.md', path: 'docs/design.md' }],
        activity: { toolCalls: 63, turns: 4 }, nextCheck: null,
      },
      {
        id: 'P2', title: '幂等与重试', desc: '幂等键、去重表、补偿任务',
        status: 'done', startedAt: at(2.2), endedAt: at(3.4), durationMs: 1.2 * hour,
        plannedStart: at(2.4), plannedEnd: at(3.6), progress: 100,
        checks: [
          { label: '幂等键设计', done: true },
          { label: '去重表落地', done: true },
          { label: '补偿任务上线', done: true },
        ],
        summary: '以业务单号 + 渠道流水号做联合幂等键，重复请求命中率 100%，补偿任务覆盖 3 类超时场景。',
        deliverables: [], activity: { toolCalls: 38, turns: 3 }, nextCheck: null,
      },
      {
        id: 'P3', title: '对账误差压降', desc: '对账任务重构，误差从 0.07% 降到 0.01%',
        status: 'active', startedAt: at(3.4), endedAt: null, durationMs: 2.6 * hour,
        plannedStart: at(3.6), plannedEnd: at(5.2), progress: 60,
        checks: [
          { label: '误差归因分析', done: true },
          { label: '对账任务重构', done: true },
          { label: '误差压到 0.01%', done: false },
          { label: '连续 7 天观察', done: false },
        ],
        summary: '已定位到 3 类误差来源（跨天切分、退款冲正、渠道回调乱序），前两类修复后误差降到 0.02%，正在处理回调乱序。',
        deliverables: [], activity: { toolCalls: 31, turns: 3 }, nextCheck: '误差压到 0.01%',
      },
      {
        id: 'P4', title: '灰度与回滚预案', desc: '全量灰度的开关、监控、回滚演练',
        status: 'pending', startedAt: null, endedAt: null, durationMs: null,
        plannedStart: at(5.2), plannedEnd: at(6.4), progress: 0,
        checks: [{ label: '灰度开关', done: false }, { label: '监控看板', done: false }, { label: '回滚演练', done: false }],
        summary: '', deliverables: [], activity: { toolCalls: 0, turns: 0 }, nextCheck: '灰度开关',
      },
      {
        id: 'P5', title: '全量切换与复盘', desc: '切全量、下线旧逻辑、输出复盘',
        status: 'pending', startedAt: null, endedAt: null, durationMs: null,
        plannedStart: at(6.4), plannedEnd: at(7.6), progress: 0,
        checks: [{ label: '全量切换', done: false }, { label: '旧逻辑下线', done: false }, { label: '复盘文档', done: false }],
        summary: '', deliverables: [], activity: { toolCalls: 0, turns: 0 }, nextCheck: '全量切换',
      },
    ]),
    timeline: { from: base, to: at(7.6), now },
    overall: 60,
    distance: {
      remainingPhases: 2, totalPhases: 6, remainingRounds: 9, roundsStarted: 3,
      maxRounds: 12, remainingMs: 2.4 * hour,
    },
    recentTurns: [
      { turn: 24, prompt: '把退款冲正的误差也归一下因', time: at(4.6) },
      { turn: 25, prompt: '重构对账任务，按天分片跑', time: at(5.0) },
      { turn: 26, prompt: '看看现在误差还剩多少', time: at(5.4) },
    ],
  };
}

/** 项目模式演示：没有 goal 的普通对话，按空闲间隔切成工作段。 */
export function projectModel(now = Date.now()) {
  const min = 60_000;
  const base = now - 150 * min;
  const at = (m) => base + m * min;
  const seg = (s, e, status) => [{
    startedAt: at(s), endedAt: status === 'active' ? null : at(e),
    plannedStart: null, plannedEnd: null, status, progress: 100, summary: '', checks: [],
  }];

  const phases = [
    {
      id: 'S1', title: '帮我分析 C 盘哪些文件可以清理', status: 'done', progress: 100,
      startedAt: at(0), endedAt: at(24), durationMs: 24 * min,
      segments: seg(0, 24, 'done'), checks: [], deliverables: [], summary: '',
      summary: '扫描出 C 盘约 38 GB 可清理空间，按「系统缓存 / 残留安装包 / 休眠文件」分了三类，并标出各自风险。',
      activity: { code: 0, run: 2, read: 14, other: 1, turns: 2, toolCalls: 17 },
    },
    {
      id: 'S2', title: '把分析脚本做成可复用的 CLI', status: 'done', progress: 100,
      startedAt: at(51), endedAt: at(88), durationMs: 37 * min,
      segments: seg(51, 88, 'done'), checks: [], deliverables: [], summary: '',
      summary: '封装成可复用 CLI：支持按类别筛选、--dry-run 预览，超大目录会自动跳过。',
      activity: { code: 9, run: 6, read: 4, other: 0, turns: 3, toolCalls: 19 },
    },
    {
      id: 'S3', title: '给脚本加一个 --json 输出并写文档', status: 'active', progress: 100,
      startedAt: at(120), endedAt: null, durationMs: 30 * min,
      segments: seg(120, null, 'active'), checks: [], deliverables: [], summary: '',
      summary: '正在给输出加 --json，README 写到一半。',
      activity: { code: 4, run: 3, read: 2, other: 0, turns: 2, toolCalls: 9 },
    },
  ];

  return {
    ok: true,
    generatedAt: now,
    mode: 'project',
    board: { title: 'GOAL 甘特看板', subtitle: 'DSH Goal Gantt Board' },
    goal: null,
    session: {
      id: 'session-demo-project',
      title: '磁盘清理小工具',
      cwdName: 'scripts',
      turns: 7,
      steps: 45,
      tokens: 860_000,
      toolCalls: 45,
      lastActivityAt: now,
    },
    phases,
    timeline: { from: at(0), to: now, now },
    overall: 100,
    distance: { totalPhases: phases.length, remainingPhases: 0, remainingMs: 0 },
    sessions: [{ id: 'session-demo-project', title: '磁盘清理小工具', hasGoal: false, cwdName: 'scripts' }],
  };
}
