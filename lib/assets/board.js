/* Goal 甘特看板 — 浏览器渲染层（无依赖）
 *
 * 信息层级：
 *   1. 顶部：目标 + 会话 + 总进度
 *   2. Hero：当前在做什么（阶段名 / 状态 / 一句话 / 4 个关键数字 / 进度条）
 *   3. 进度：甘特时间轴
 *   4. 阶段：可展开的清单
 *
 * 国际化：按 navigator.language 自动中英切换，可用 ?lang=zh|en 强制。
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------ i18n */

  var MSG = {
    zh: {
      objective: '目标 OBJECTIVE',
      session: '会话',
      progress: '进度',
      phasesTitle: '阶段',
      focusNow: '聚焦现在',
      allRange: '全部范围',
      netTitle: '连接中断',
      netBody: '正在重试，数据可能不是最新的',
      statusDone: '已完成', statusActive: '进行中', statusPending: '未开始', statusBlocked: '阻塞',
      cur: '当前阶段', next: '下一阶段', last: '最近阶段',
      progressLabel: '阶段进度', elapsed: '已用时间', checks: '检查项', remainPhases: '剩余阶段',
      phasesDone: function (done, total) { return '阶段 ' + done + '/' + total + ' 已完成'; },
      nextStep: '下一步：',
      remainTime: function (d) { return '预计还需 ' + d; },
      noSummary: '这一阶段还没有写总结。',
      noSummaryShort: '（本阶段暂无总结）',
      actual: '实际 ', dur: '耗时 ', checksN: '检查 ',
      segs: function (n) { return n + ' 个时间段'; },
      copied: '已复制',
      tipDur: '耗时 ', tipProgress: '进度 ', tipTools: '工具 ',
      phaseCount: function (n) { return n + ' 个阶段'; },
      zeroPhases: '0 个阶段',
      noPhases: '无阶段',
      emptyTitle: '这个会话还没有 goal',
      emptyBody: '创建 goal 之后，这里会显示当前阶段、进度和阶段清单。',
      emptyConfig: '也可以在会话工作区放一份 goal-board/board.config.json 手动定义阶段',
      tools: '工具 ', updates: ' 更新 · 每 10 秒自动刷新',
      board: '看板', notStarted: '未排期', ongoing: '进行中', now: '现在',
      share: '复制链接', shareHint: '复制这一阶段的直达链接', all: '全部',
      exampleLabel: '阶段配置示例', copyExample: '复制示例',
      filterAll: '全部', filterActive: '进行中', filterOpen: '未完成',
      copySummary: '复制摘要', summaryHint: '把当前进度复制成 Markdown',
      groupActive: '进行中', groupPending: '未开始', groupBlocked: '阻塞', groupDone: '已完成',
      exportCsv: '导出 CSV', exportHint: '把阶段表导出为 CSV',
      autoBadge: '自动生成', statTools: '工具调用', statSpan: '总跨度',
      segUnit: function (n) { return n + ' 段'; },
      actCode: function (n) { return '改代码 ×' + n; }, actRun: function (n) { return '跑命令 ×' + n; },
      actRead: function (n) { return '读文件 ×' + n; }, actOther: function (n) { return '工具 ×' + n; },
      actTalk: function (n) { return '对话 ' + n + ' 轮'; },
      writeExample: '写入示例配置', writing: '写入中…', written: '已写入', writeFailed: '写入失败',
      existsAlready: '已存在同名配置',
      showMore: function (n) { return '显示更多（还有 ' + n + '）'; },
      justNow: '刚刚', minutesAgo: function (n) { return n + ' 分钟前'; },
      hoursAgo: function (n) { return n + ' 小时前'; }, daysAgo: function (n) { return n + ' 天前'; },
      running: function (d) { return '已 ' + d; },
      phasesLeft: function (n) { return '剩余 ' + n + ' 个阶段'; },
      searchPlaceholder: '搜索阶段…', noMatch: '没有匹配的阶段',
      phaseCountFrac: function (shown, total) { return shown + ' / ' + total + ' 个阶段'; },
      lessThanMin: '不到 1 分钟',
      min: '分钟', hour: '小时',
      ariaBar: function (id, title, status, pct) { return id + ' ' + title + '，' + status + '，进度 ' + pct + '%'; },
    },
    en: {
      objective: 'OBJECTIVE',
      session: 'Session',
      progress: 'Progress',
      phasesTitle: 'Phases',
      focusNow: 'Focus now',
      allRange: 'All time',
      netTitle: 'Connection lost',
      netBody: 'Retrying — data may be stale',
      statusDone: 'Done', statusActive: 'In progress', statusPending: 'Not started', statusBlocked: 'Blocked',
      cur: 'Current phase', next: 'Next phase', last: 'Last phase',
      progressLabel: 'Phase progress', elapsed: 'Elapsed', checks: 'Checks', remainPhases: 'Phases left',
      phasesDone: function (done, total) { return done + '/' + total + ' phases done'; },
      nextStep: 'Next: ',
      remainTime: function (d) { return '~' + d + ' left'; },
      noSummary: 'No summary for this phase yet.',
      noSummaryShort: '(no summary yet)',
      actual: 'Actual ', dur: 'Took ', checksN: 'Checks ',
      segs: function (n) { return n + ' segments'; },
      copied: 'Copied',
      tipDur: 'Took ', tipProgress: 'Progress ', tipTools: 'Tools ',
      phaseCount: function (n) { return n + ' phases'; },
      zeroPhases: '0 phases',
      noPhases: 'no phases',
      emptyTitle: 'No goal in this session',
      emptyBody: 'Once a goal exists, its current phase, progress and phase list show up here.',
      emptyConfig: 'You can also define phases by hand in goal-board/board.config.json',
      tools: 'tools ', updates: ' updated · refreshes every 10s',
      board: 'Board', notStarted: 'not scheduled', ongoing: 'in progress', now: 'NOW',
      share: 'Copy link', shareHint: 'Copy a direct link to this phase', all: 'All',
      exampleLabel: 'Example config', copyExample: 'Copy example',
      filterAll: 'All', filterActive: 'Active', filterOpen: 'Open',
      copySummary: 'Copy summary', summaryHint: 'Copy progress as Markdown',
      groupActive: 'In progress', groupPending: 'Not started', groupBlocked: 'Blocked', groupDone: 'Done',
      exportCsv: 'Export CSV', exportHint: 'Download the phase table as CSV',
      autoBadge: 'Auto', statTools: 'Tool calls', statSpan: 'Span',
      segUnit: function (n) { return n + ' segments'; },
      actCode: function (n) { return 'edited ×' + n; }, actRun: function (n) { return 'ran ×' + n; },
      actRead: function (n) { return 'read ×' + n; }, actOther: function (n) { return 'tools ×' + n; },
      actTalk: function (n) { return n + ' turns'; },
      writeExample: 'Create example config', writing: 'Writing…', written: 'Written', writeFailed: 'Write failed',
      existsAlready: 'Config already exists',
      showMore: function (n) { return 'Show ' + n + ' more'; },
      justNow: 'just now', minutesAgo: function (n) { return n + 'm ago'; },
      hoursAgo: function (n) { return n + 'h ago'; }, daysAgo: function (n) { return n + 'd ago'; },
      running: function (d) { return d + ' in'; },
      phasesLeft: function (n) { return n + ' phases left'; },
      searchPlaceholder: 'Filter phases…', noMatch: 'No matching phases',
      phaseCountFrac: function (shown, total) { return shown + ' / ' + total + ' phases'; },
      lessThanMin: 'under a minute',
      min: 'min', hour: 'h',
      ariaBar: function (id, title, status, pct) { return id + ' ' + title + ', ' + status + ', ' + pct + '% done'; },
    },
  };

  function detectLang() {
    /* 面板模式由宿主把 ?lang 透传进来 */
    try {
      var injected = window.__LANG__;
      if (injected === 'zh' || injected === 'en') return injected;
    } catch (e) { /* ignore */ }
    try {
      var q = new URL(window.location.href).searchParams.get('lang');
      if (q === 'zh' || q === 'en') return q;
    } catch (e) { /* ignore */ }
    var nav = (typeof navigator !== 'undefined' && (navigator.language || (navigator.languages && navigator.languages[0]))) || 'zh';
    return /^zh/i.test(nav) ? 'zh' : 'en';
  }

  var LANG = detectLang();
  var T = MSG[LANG] || MSG.zh;

  var DATA = window.__BOARD__ || null;
  var VIEW_MODE = 'now';
  var VIEW_TOUCHED = false;   /* 用户手动选过缩放档位后不再自动切换 */
  var FILTER = { status: 'all', q: '' };
  var OPEN = {};
  var GROUPS = { active: true, pending: true, blocked: true, done: false };
  var GROUP_LIMIT = 40;      /* 每组默认最多渲染多少条 */
  var GROUP_CAP = {};        /* 点过“显示更多”后累加 */
  var FOCUS_ID = null;

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var pad = function (n) { return n < 10 ? '0' + n : String(n); };

  function fmtClock(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fmtDate(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function fmtStamp(ts) {
    if (!ts) return '—';
    var sameDay = new Date(ts).toDateString() === new Date().toDateString();
    return (sameDay ? '' : fmtDate(ts) + ' ') + fmtClock(ts);
  }

  function fmtDur(ms) {
    if (ms == null || isNaN(ms)) return '—';
    var m = Math.round(ms / 60000);
    if (m < 1) return T.lessThanMin;
    if (m < 60) return m + ' ' + T.min;
    var h = Math.floor(m / 60);
    return h + T.hour + (m % 60 ? ' ' + (m % 60) + ' ' + T.min : '');
  }

  function fmtShort(ms) {
    if (ms == null || isNaN(ms)) return '—';
    var m = Math.round(ms / 60000);
    if (m < 60) return m + 'm';
    return Math.floor(m / 60) + 'h' + (m % 60 ? (m % 60) + 'm' : '');
  }

  function fmtRange(a, b) {
    if (!a && !b) return T.notStarted;
    if (!a) return '— ' + fmtDate(b) + ' ' + fmtClock(b);
    if (!b) return fmtDate(a) + ' ' + fmtClock(a) + ' → ' + T.ongoing;
    var sameDay = new Date(a).toDateString() === new Date(b).toDateString();
    return fmtDate(a) + ' ' + fmtClock(a) + ' → ' + (sameDay ? '' : fmtDate(b) + ' ') + fmtClock(b);
  }

  function fmtAgo(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    if (diff < 60000) return T.justNow;
    var m = Math.round(diff / 60000);
    if (m < 60) return T.minutesAgo(m);
    var h = Math.round(m / 60);
    if (h < 24) return T.hoursAgo(h);
    return T.daysAgo(Math.round(h / 24));
  }

  function fmtTokens(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n || 0);
  }

  function activityText(act) {
    if (!act) return '';
    var parts = [];
    if (act.code) parts.push(T.actCode(act.code));
    if (act.run) parts.push(T.actRun(act.run));
    if (act.read) parts.push(T.actRead(act.read));
    if (act.other) parts.push(T.actOther(act.other));
    return parts.join(' · ') || T.actTalk(act.turns || 0);
  }

  function statusOf(s) {
    return {
      done: { text: T.statusDone, cls: 'done' },
      active: { text: T.statusActive, cls: 'active' },
      pending: { text: T.statusPending, cls: 'pending' },
      blocked: { text: T.statusBlocked, cls: 'blocked' },
    }[s] || { text: T.statusPending, cls: 'pending' };
  }

  function currentSegment(p) {
    if (!p.segments || !p.segments.length) {
      return { startedAt: p.startedAt, endedAt: p.endedAt, summary: p.summary, checks: p.checks };
    }
    var active = p.segments.filter(function (s) { return s.status === 'active'; })[0];
    return active || p.segments[p.segments.length - 1];
  }

  /* ------------------------------------------------------- 静态文案 */

  function applyStatic() {
    var map = {
      'board-title': LANG === 'zh' ? 'GOAL 甘特看板' : 'GOAL BOARD',
      'obj-label': T.objective,
      'session-label': T.session,
      'gantt-title': T.progress,
      'phases-title': T.phasesTitle,
      'net-title': T.netTitle,
      'net-body': T.netBody,
      'phases-title': T.phasesTitle,
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = map[id];
    });
    var tools = document.getElementById('gantt-tools');
    if (tools && typeof tools.querySelectorAll === 'function') {
      var labels = { now: T.focusNow, '6h': '6h', '24h': '24h', all: T.all };
      Array.prototype.forEach.call(tools.querySelectorAll('button'), function (btn) {
        btn.textContent = labels[btn.getAttribute('data-mode')] || btn.getAttribute('data-mode');
      });
    }
    var seg = document.getElementById('phase-filter');
    if (seg && typeof seg.querySelectorAll === 'function') {
      var fl = { all: T.filterAll, active: T.filterActive, unfinished: T.filterOpen };
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (btn) {
        btn.textContent = fl[btn.getAttribute('data-filter')] || btn.getAttribute('data-filter');
        btn.classList.toggle('on', btn.getAttribute('data-filter') === FILTER.status);
      });
    }
    var search = document.getElementById('phase-search');
    if (search) {
      if (search.setAttribute) search.setAttribute('placeholder', T.searchPlaceholder);
      if (!search.__wired) search.value = FILTER.q;
    }

    try { document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en'; } catch (e) { /* shadow */ }
  }

  /* ------------------------------------------------------------ 顶部 */

  function renderHeader(d) {
    var g = d.goal || {};
    var isProject = d.mode === 'project';
    document.getElementById('goal-objective').textContent = isProject
      ? ((d.session && d.session.title) || T.board)
      : (g.objective || T.emptyTitle);
    var ring = document.getElementById('ring');
    var ringVal = document.getElementById('ring-val');
    if (isProject) {
      if (ring) ring.style.display = 'none';
      if (ringVal) ringVal.style.display = 'none';
    } else {
      if (ring) { ring.style.display = ''; ring.style.setProperty('--p', d.overall || 0); }
      if (ringVal) { ringVal.style.display = ''; ringVal.textContent = (d.overall || 0) + '%'; }
    }

    var chips = [];
    if (d.mode === 'project') chips.push('<span class="chip auto-chip">' + T.autoBadge + '</span>');
    if (g.maxGoalRounds) {
      chips.push('<span class="chip">' + (LANG === 'zh' ? '第 ' : 'Round ') +
        '<b>' + (g.roundsStarted || 0) + '</b> / ' + g.maxGoalRounds + (LANG === 'zh' ? ' 轮' : '') + '</span>');
    }
    document.getElementById('head-chips').innerHTML = chips.join('');
  }

  /* ------------------------------------------------------------- Hero */

  function renderHero(d) {
    var host = document.getElementById('hero');
    if (!host) return;

    var active = d.phases.filter(function (p) { return p.status === 'active'; })[0];
    var next = d.phases.filter(function (p) { return p.status === 'pending'; })[0];
    var p = active || next || d.phases[d.phases.length - 1];
    if (!p) { host.innerHTML = ''; return; }

    var seg = currentSegment(p);
    var st = statusOf(p.status);
    var checks = seg.checks || [];
    var doneChecks = checks.filter(function (c) { return c.done; }).length;
    var isProject = d.mode === 'project';
    var dist = d.distance || {};
    var done = (dist.totalPhases || 0) - (dist.remainingPhases || 0);

    host.innerHTML =
      '<div class="hero-head">' +
        '<span class="ckicker">' + (active ? T.cur : (next ? T.next : T.last)) + '</span>' +
        '<span class="badge ' + st.cls + '">' + st.text + '</span>' +
        '<span class="hero-actions">' +
          '<button type="button" class="hero-share" data-share="' + esc(p.id) + '" title="' +
            esc(T.shareHint) + '">' + esc(T.share) + '</button>' +
          '<button type="button" class="hero-share hero-copy-summary" title="' +
            esc(T.summaryHint) + '">' + esc(T.copySummary) + '</button>' +
          '<button type="button" class="hero-share hero-export" title="' +
            esc(T.exportHint) + '">' + esc(T.exportCsv) + '</button>' +
        '</span>' +
      '</div>' +
      '<h2 class="hero-title"><span class="hero-id">' + esc(p.id) + '</span>' + esc(p.title) + '</h2>' +
      '<p class="hero-summary">' + esc(isProject
        ? (activityText(p.activity) || T.noSummary)
        : (seg.summary || p.summary || p.desc || T.noSummary)) + '</p>' +
      '<div class="hero-stats">' +
        (isProject
          ? '<div class="stat"><b>' + ((p.activity && p.activity.toolCalls) || 0) + '</b><span>' + T.statTools + '</span></div>' +
            '<div class="stat"><b>' + (p.durationMs ? fmtShort(p.durationMs) : '—') + '</b><span>' + T.elapsed + '</span></div>' +
            '<div class="stat"><b>' + d.phases.length + '</b><span>' + T.phasesTitle + '</span></div>' +
            '<div class="stat"><b>' + fmtShort((d.timeline.to || 0) - (d.timeline.from || 0)) + '</b><span>' + T.statSpan + '</span></div>'
          : '<div class="stat"><b>' + (p.progress || 0) + '<i>%</i></b><span>' + T.progressLabel + '</span></div>' +
            '<div class="stat"><b>' + (p.durationMs ? fmtShort(p.durationMs) : '—') + '</b><span>' + T.elapsed + '</span></div>' +
            '<div class="stat"><b>' + doneChecks + '<i>/' + checks.length + '</i></b><span>' + T.checks + '</span></div>' +
            '<div class="stat"><b>' + (dist.remainingPhases || 0) + '<i>' + (LANG === 'zh' ? '个' : '') + '</i></b><span>' + T.remainPhases + '</span></div>') +
      '</div>' +
      (isProject ? '' : '<div class="hero-bar"><i style="width:' + (p.progress || 0) + '%"></i></div>') +
      '<div class="hero-foot">' +
        (isProject
          ? '<span>' + T.segUnit(d.phases.length) + '</span>' +
            '<span>' + esc(fmtRange(d.timeline.from, d.timeline.to)) + '</span>'
          : '<span>' + T.phasesDone(done, dist.totalPhases || 0) + '</span>' +
            (p.nextCheck ? '<span>' + T.nextStep + esc(p.nextCheck) + '</span>' : '') +
            (dist.remainingMs ? '<span>' + T.remainTime(fmtShort(dist.remainingMs)) + '</span>' : '')) +
      '</div>';

    var share = host.querySelector('.hero-share');
    if (share) share.addEventListener('click', function () {
      copyLink(share.getAttribute('data-share'), share);
    });
    var exportBtn = host.querySelector('.hero-export');
    if (exportBtn) exportBtn.addEventListener('click', function () { downloadCsv(d, exportBtn); });

    var summaryBtn = host.querySelector('.hero-copy-summary');
    if (summaryBtn) summaryBtn.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(buildSummary(d));
      flashButton(summaryBtn);
    });
  }

  function flashButton(btn) {
    var old = btn.textContent;
    btn.textContent = T.copied;
    btn.classList.add('done');
    setTimeout(function () { btn.textContent = old; btn.classList.remove('done'); }, 1200);
  }

  /* 进度摘要：可直接贴到 issue / IM 的 Markdown */
  function buildSummary(d) {
    var g = d.goal || {};
    var MARK = { done: '✅', active: '🔄', pending: '⬜', blocked: '⛔' };
    var lines = [d.mode === 'project'
      ? '## ' + ((d.session && d.session.title) || T.board) + ' · ' + T.segUnit(d.phases.length)
      : '## ' + (g.objective || T.board) + ' · ' + (d.overall || 0) + '%', ''];

    var shown = d.phases.slice(0, 20);
    shown.forEach(function (p) {
      var line = '- ' + (MARK[p.status] || '⬜') + ' ' + p.id + ' ' + p.title;
      if (d.mode === 'project') line += ' (~' + fmtShort(p.durationMs || 0) + ')';
      else if (p.status === 'active' && p.progress) line += ' (' + p.progress + '%)';
      var seg = currentSegment(p);
      if (p.status === 'active' && seg && seg.summary) {
        line += ' — ' + String(seg.summary).replace(/\s+/g, ' ').slice(0, 80);
      }
      lines.push(line);
    });
    if (d.phases.length > shown.length) {
      lines.push('- … ' + (d.phases.length - shown.length) + (LANG === 'zh' ? ' 个阶段省略' : ' more phases'));
    }

    var dist = d.distance || {};
    var foot = [T.phasesLeft(dist.remainingPhases || 0)];
    if (dist.remainingMs) foot.push(T.remainTime(fmtShort(dist.remainingMs)));
    if (g.maxGoalRounds) {
      foot.push((LANG === 'zh' ? '第 ' : 'Round ') + (g.roundsStarted || 0) + '/' + g.maxGoalRounds);
    }
    lines.push('', '_' + foot.join(' · ') + '_');
    return lines.join('\n');
  }

  function csvCell(value) {
    var s = value == null ? '' : String(value);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCsv(d) {
    var head = ['id', 'title', 'status', 'progress', 'planned_start', 'planned_end',
      'started_at', 'ended_at', 'duration_minutes', 'segments', 'checks_done', 'checks_total', 'summary'];
    var rows = [head.join(',')];
    (d.phases || []).forEach(function (p) {
      var seg = currentSegment(p);
      var checks = (seg && seg.checks) || [];
      rows.push([
        p.id, p.title, p.status, p.progress || 0,
        p.plannedStart ? new Date(p.plannedStart).toISOString() : '',
        p.plannedEnd ? new Date(p.plannedEnd).toISOString() : '',
        p.startedAt ? new Date(p.startedAt).toISOString() : '',
        p.endedAt ? new Date(p.endedAt).toISOString() : '',
        p.durationMs ? Math.round(p.durationMs / 60000) : '',
        (p.segments || []).length || 1,
        checks.filter(function (c) { return c.done; }).length,
        checks.length,
        seg && seg.summary ? seg.summary : (p.summary || ''),
      ].map(csvCell).join(','));
    });
    return rows.join('\n');
  }

  function downloadCsv(d, btn) {
    var csv = buildCsv(d);
    var name = 'goal-gantt-' + String((d.session && d.session.id) || 'board').slice(0, 18) + '.csv';
    try {
      if (typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
        var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          URL.revokeObjectURL(url);
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 0);
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(csv);
      }
    } catch (e) { /* ignore */ }
    if (btn) flashButton(btn);
  }

  /* 直达链接：/goal-gantt?session=…#P3 */
  function shareUrl(id) {
    var origin = '';
    try { origin = window.location.origin || ''; } catch (e) { /* ignore */ }
    var params = [];
    try {
      var sid = new URL(window.location.href).searchParams.get('session');
      if (sid) params.push('session=' + encodeURIComponent(sid));
    } catch (e) { /* ignore */ }
    if (FILTER.q) params.push('q=' + encodeURIComponent(FILTER.q));
    if (FILTER.status !== 'all') params.push('f=' + FILTER.status);
    var query = params.length ? '?' + params.join('&') : '';
    return origin + '/goal-gantt' + query + '#' + id;
  }

  function copyLink(id, btn) {
    var url = shareUrl(id);
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    if (btn) flashButton(btn);
  }

  /* ------------------------------------------------------------ 甘特 */

  function tickPlan(from, to) {
    var H = 3600000, MIN = 60000, DAY = 86400000;
    var span = Math.max(to - from, MIN);
    var step = span <= 2 * H ? 15 * MIN
      : span <= 5 * H ? 30 * MIN
        : span <= 12 * H ? H
          : span <= 40 * H ? 6 * H
            : span <= 12 * DAY ? DAY : 7 * DAY;
    var ticks = [];
    var t = Math.ceil(from / step) * step;
    while (t <= to && ticks.length < 32) { ticks.push(t); t += step; }
    return { ticks: ticks, step: step };
  }

  var FIXED_SPAN = { '6h': 6 * 3600000, '24h': 24 * 3600000 };

  function viewRange(d) {
    var all = { from: d.timeline.from, to: d.timeline.to };
    if (VIEW_MODE === 'all') return all;

    var now = d.timeline.now;
    var activeSeg = null;
    var lastEnd = all.from;
    (d.phases || []).forEach(function (p) {
      var segs = (p.segments && p.segments.length) ? p.segments : [p];
      segs.forEach(function (s) {
        if (s.startedAt && (!s.endedAt || s.endedAt > lastEnd)) lastEnd = s.endedAt || now;
        if (s.status === 'active' && s.startedAt) activeSeg = s;
      });
    });

    var anchor = activeSeg ? now : lastEnd;
    var span;
    if (FIXED_SPAN[VIEW_MODE]) {
      span = FIXED_SPAN[VIEW_MODE];
    } else {
      var base = activeSeg ? Math.max(now - activeSeg.startedAt, 20 * 60000) : 90 * 60000;
      span = Math.max(base * 2.4, 45 * 60000);
    }

    var from = anchor - span * 0.72;
    var to = anchor + span * 0.28;

    if (from < all.from) { from = all.from; to = from + span; }
    if (to > all.to) { to = all.to; from = Math.max(all.from, to - span); }
    /* 没有未来事件时向右留白，让“现在”游标不贴边 */
    if (Math.abs(to - all.to) < 1000) to += Math.max(span * 0.08, 5 * 60000);
    if (to - from < 60000) to = from + 60000;
    return { from: from, to: to };
  }

  function renderGantt(d) {
    var range = viewRange(d);
    var from = range.from, to = range.to;
    var span = Math.max(to - from, 60000);
    var xp = function (t) { return ((t - from) / span) * 100; };

    var plan = tickPlan(from, to);
    var multiDay = span > 86400000;

    document.getElementById('gaxis').innerHTML = plan.ticks.map(function (t) {
      var lab = (multiDay ? fmtDate(t) + ' ' : '') + fmtClock(t);
      return '<span class="tick" style="left:' + xp(t).toFixed(3) + '%">' + esc(lab) + '</span>';
    }).join('');

    var labels = [];
    var tracks = [];

    d.phases.forEach(function (p) {
      var grid = plan.ticks.map(function (t) {
        return '<i class="gl" style="left:' + xp(t).toFixed(3) + '%"></i>';
      }).join('');

      labels.push('<div class="glab"><span class="gid">' + esc(p.id) + '</span><span class="gname" title="' +
        esc(p.title) + '">' + esc(p.title) + '</span></div>');

      var segs = (p.segments && p.segments.length)
        ? p.segments
        : [{ startedAt: p.startedAt, endedAt: p.endedAt, plannedStart: p.plannedStart,
             plannedEnd: p.plannedEnd, status: p.status, progress: p.progress }];

      var bars = '';
      segs.forEach(function (sg, si) {
        if (sg.plannedStart && sg.plannedEnd) {
          var pl = Math.max(xp(sg.plannedStart), 0);
          var pr = Math.min(xp(sg.plannedEnd), 100);
          if (pr > pl) {
            bars += '<i class="gplan" style="left:' + pl.toFixed(3) + '%;width:' + (pr - pl).toFixed(3) + '%"></i>';
          }
        }
        if (!sg.startedAt) return;
        var a = Math.max(xp(sg.startedAt), 0);
        var b = Math.min(xp(sg.endedAt || d.timeline.now), 100);
        if (b <= a) return;
        var width = Math.max(b - a, 0.4);
        var st = statusOf(sg.status);
        var tip = [p.id, p.title, st.text, fmtRange(sg.startedAt, sg.endedAt),
          fmtDur(sg.startedAt ? (sg.endedAt || d.timeline.now) - sg.startedAt : null),
          (p.activity ? p.activity.toolCalls : 0), (sg.progress || 0)].join('|');
        var a11y = ' role="button" tabindex="0" aria-label="' +
          esc(T.ariaBar(p.id, p.title, st.text, sg.progress || 0)) + '"';
        bars += '<div class="gbar st-' + sg.status + '" data-tip="' + esc(tip) + '"' + a11y +
          ' style="left:' + a.toFixed(3) + '%;width:' + width.toFixed(3) + '%">' +
          '<i class="fill" style="width:' + Math.min(sg.progress || 0, 100) + '%"></i>' +
          (width > 8 ? '<span class="lbl">' + esc(p.id + ' ' + p.title) + (segs.length > 1 ? ' · ' + (si + 1) : '') + '</span>' : '') +
          '</div>';
      });
      tracks.push('<div class="gtrack"><div class="grid">' + grid + '</div>' + bars + '</div>');
    });

    var now = d.timeline.now;
    var nowHtml = (now >= from && now <= to)
      ? '<div class="nowline" style="left:' + xp(now).toFixed(3) + '%"></div>'
      : '';

    document.getElementById('glabels').innerHTML = labels.join('');
    document.getElementById('gtracks').innerHTML = nowHtml + tracks.join('');
    document.getElementById('gantt-hint').textContent =
      fmtDate(from) + ' ' + fmtClock(from) + ' → ' + fmtDate(to) + ' ' + fmtClock(to);

    var tools = document.getElementById('gantt-tools');
    if (tools && typeof tools.querySelectorAll === 'function') {
      Array.prototype.forEach.call(tools.querySelectorAll('button'), function (btn) {
        btn.classList.toggle('on', btn.getAttribute('data-mode') === VIEW_MODE);
        btn.onclick = function () {
          VIEW_MODE = btn.getAttribute('data-mode');
          VIEW_TOUCHED = true;
          renderGantt(DATA);
        };
      });
    }

    bindTips();
  }

  var tipEl = null;
  function bindTips() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tip';
      document.body.appendChild(tipEl);
    }
    Array.prototype.forEach.call(document.querySelectorAll('.gbar'), function (bar) {
      bar.addEventListener('mousemove', function (ev) {
        var p = bar.getAttribute('data-tip').split('|');
        tipEl.innerHTML = '<b>' + esc(p[0]) + ' · ' + esc(p[1]) + '</b><br>' +
          esc(p[2]) + ' · ' + esc(p[3]) + '<br>' +
          T.tipDur + esc(p[4]) + ' · ' + T.tipProgress + p[6] + '%<br>' + T.tipTools + esc(p[5]);
        tipEl.classList.add('on');
        tipEl.style.left = Math.min(ev.clientX + 16, window.innerWidth - 320) + 'px';
        tipEl.style.top = Math.min(ev.clientY + 16, window.innerHeight - 160) + 'px';
      });
      bar.addEventListener('mouseleave', function () { tipEl.classList.remove('on'); });
      bar.addEventListener('click', function () { togglePhase(bar.getAttribute('data-tip').split('|')[0], true); });
      bar.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          FOCUS_ID = bar.getAttribute('data-tip').split('|')[0];
          togglePhase(FOCUS_ID, true);
        }
      });
    });
  }

  /* ------------------------------------------------------------ 阶段 */

  function matchesFilter(p) {
    if (FILTER.status === 'active' && p.status !== 'active') return false;
    if (FILTER.status === 'unfinished' && p.status === 'done') return false;
    if (FILTER.q) {
      var q = FILTER.q.toLowerCase();
      var hay = (p.id + ' ' + p.title + ' ' + (p.summary || '') + ' ' + (p.desc || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function phaseHtml(p) {
    var st = statusOf(p.status);
    var seg = currentSegment(p);
    var checks = seg.checks || [];
    var doneChecks = checks.filter(function (c) { return c.done; }).length;
    var open = OPEN[p.id] || p.status === 'active';

    var detail = '';
    if (open) {
      detail = '<div class="pdetail" id="pdetail-' + esc(p.id) + '">' +
        '<div class="pmeta">' +
          (p.startedAt ? '<span>' + T.actual + esc(fmtRange(p.startedAt, p.endedAt)) + '</span>' : '') +
          (p.durationMs ? '<span>' + T.dur + esc(fmtDur(p.durationMs)) + '</span>' : '') +
          (checks.length ? '<span>' + T.checksN + doneChecks + '/' + checks.length + '</span>' : '') +
          (p.segments && p.segments.length > 1 ? '<span>' + T.segs(p.segments.length) + '</span>' : '') +
        '</div>' +
        '<p class="psummary">' + esc(DATA && DATA.mode === 'project'
          ? (activityText(p.activity) || T.noSummaryShort)
          : (seg.summary || p.summary || T.noSummaryShort)) + '</p>' +
        (checks.length ? '<div class="checks">' + checks.map(function (c) {
          return '<span class="check' + (c.done ? ' on' : '') + '"><i class="bx">' + (c.done ? '✓' : '') + '</i>' + esc(c.label) + '</span>';
        }).join('') + '</div>' : '') +
        ((p.deliverables || []).length ? '<div class="deliv">' + p.deliverables.map(function (x) {
          return '<a href="#" data-copy="' + esc(x.path) + '" title="' + esc(x.path) + '">' + esc(x.label) + '</a>';
        }).join('') + '</div>' : '') +
        '</div>';
    }

    return '<div class="phase' + (open ? ' open' : '') + '" data-card="' + esc(p.id) + '">' +
      '<div class="prow" role="button" tabindex="0" aria-expanded="' + open +
        '" aria-controls="pdetail-' + esc(p.id) + '">' +
        '<i class="dot ' + st.cls + '"></i>' +
        '<span class="gid">' + esc(p.id) + '</span>' +
        '<span class="ptitle">' + esc(p.title) + '</span>' +
        (DATA && DATA.mode === 'project' ? '' : '<span class="pwhen">' + esc(
          p.status === 'active' ? T.running(fmtShort(p.durationMs || 0)) : fmtAgo(p.endedAt || p.startedAt)
        ) + '</span>') +
        '<span class="ppct">' + (DATA && DATA.mode === 'project'
          ? esc(fmtShort(p.durationMs || 0))
          : (p.progress || 0) + '%') + '</span>' +
      '</div>' + detail + '</div>';
  }

  function renderPhases(d) {
    var host = document.getElementById('phases');
    if (!host) return;

    var list = d.phases.filter(matchesFilter);
    var buckets = { active: [], pending: [], blocked: [], done: [] };
    list.forEach(function (p) { (buckets[p.status] || buckets.pending).push(p); });

    var labels = { active: T.groupActive, pending: T.groupPending, blocked: T.groupBlocked, done: T.groupDone };
    var html = '';
    ['active', 'pending', 'blocked', 'done'].forEach(function (key) {
      var items = buckets[key];
      if (!items.length) return;
      var open = GROUPS[key] !== false;
      var cap = GROUP_LIMIT + (GROUP_CAP[key] || 0);
      var shown = items.slice(0, cap);
      var rest = items.length - shown.length;
      html += '<div class="group" data-group="' + key + '">' +
        '<button type="button" class="group-head" data-group="' + key + '" aria-expanded="' + open + '">' +
          '<span class="gchev">' + (open ? '▾' : '▸') + '</span>' +
          '<span class="gname">' + esc(labels[key]) + '</span>' +
          '<span class="gcount">' + items.length + '</span>' +
        '</button>' +
        (open ? shown.map(phaseHtml).join('') +
          (rest > 0
            ? '<button type="button" class="group-more" data-group="' + key + '">' + esc(T.showMore(rest)) + '</button>'
            : '')
          : '') +
        '</div>';
    });

    host.innerHTML = html || '<div class="empty-filter">' + esc(T.noMatch) + '</div>';
    document.getElementById('phases-hint').textContent =
      list.length === d.phases.length ? T.phaseCount(d.phases.length) : T.phaseCountFrac(list.length, d.phases.length);

    Array.prototype.forEach.call(host.querySelectorAll('.prow'), function (row) {
      var id = row.parentElement.getAttribute('data-card');
      row.addEventListener('click', function () { togglePhase(id); });
      row.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          FOCUS_ID = id;
          togglePhase(id);
        }
      });
    });

    Array.prototype.forEach.call(host.querySelectorAll('[data-copy]'), function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (navigator.clipboard) navigator.clipboard.writeText(a.getAttribute('data-copy'));
        var old = a.textContent;
        a.textContent = T.copied;
        setTimeout(function () { a.textContent = old; }, 1200);
      });
    });

    Array.prototype.forEach.call(host.querySelectorAll('.group-more'), function (more) {
      more.addEventListener('click', function () {
        var key = more.getAttribute('data-group');
        GROUP_CAP[key] = (GROUP_CAP[key] || 0) + GROUP_LIMIT;
        renderPhases(DATA);
      });
    });

    Array.prototype.forEach.call(host.querySelectorAll('.group-head'), function (head) {
      head.addEventListener('click', function () {
        var key = head.getAttribute('data-group');
        GROUPS[key] = GROUPS[key] === false;
        saveGroupState();
        renderPhases(DATA);
      });
    });
  }

  var OPEN_KEY = 'goal-gantt:open';
  var GROUP_KEY = 'goal-gantt:groups';

  function loadOpenState() {
    try {
      var raw = localStorage.getItem(OPEN_KEY);
      if (!raw) return;
      JSON.parse(raw).forEach(function (id) { if (id) OPEN[id] = true; });
    } catch (e) { /* 无 localStorage 或坏数据：忽略 */ }
  }

  function saveOpenState() {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(Object.keys(OPEN).filter(function (k) { return OPEN[k]; })));
    } catch (e) { /* ignore */ }
  }

  function loadGroupState() {
    try {
      var raw = localStorage.getItem(GROUP_KEY);
      if (raw) Object.assign(GROUPS, JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }

  function saveGroupState() {
    try { localStorage.setItem(GROUP_KEY, JSON.stringify(GROUPS)); } catch (e) { /* ignore */ }
  }

  function applyHash() {
    var id = '';
    try { id = (new URL(window.location.href).hash || '').replace('#', ''); } catch (e) { /* ignore */ }
    if (!id || !DATA || !DATA.phases) return;
    var exists = DATA.phases.some(function (p) { return p.id === id; });
    if (!exists) return;
    OPEN[id] = true;
    renderPhases(DATA);
    var row = document.querySelector('[data-card="' + id + '"]');
    if (row && row.scrollIntoView) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function syncHash(id, open) {
    try {
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', open ? '#' + id : window.location.pathname + window.location.search);
      }
    } catch (e) { /* ignore */ }
  }

  function togglePhase(id, scroll) {
    OPEN[id] = !OPEN[id];
    saveOpenState();
    syncHash(id, OPEN[id]);
    if (DATA) renderPhases(DATA);
    var restored = document.querySelector('[data-card="' + id + '"] .prow');
    if (restored && typeof restored.focus === 'function' && FOCUS_ID === id) restored.focus();
    if (scroll && OPEN[id]) {
      var row = document.querySelector('[data-card="' + id + '"]');
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ------------------------------------------------------------ 空态 */

  var EXAMPLE = '{\n  "phases": [\n    { "id": "P0", "title": "调研", "status": "done" },\n    { "id": "P1", "title": "实现", "status": "active" }\n  ]\n}';

  function renderEmpty(d) {
    var note = '<div class="empty-note"><b>' + T.emptyTitle + '</b><br>' +
      T.emptyBody + '<br><span>' + T.emptyConfig + '</span>' +
      '<div class="empty-example">' +
        '<div class="empty-example-head"><span>' + T.exampleLabel + '</span>' +
        '<span class="empty-actions">' +
          '<button type="button" class="empty-copy">' + T.copyExample + '</button>' +
          '<button type="button" class="empty-init">' + T.writeExample + '</button>' +
        '</span></div>' +
        '<pre>' + esc(EXAMPLE) + '</pre>' +
      '</div></div>';
    document.getElementById('hero').innerHTML = note;
    document.getElementById('glabels').innerHTML = '';
    document.getElementById('gtracks').innerHTML = '';
    document.getElementById('gaxis').innerHTML = '';
    document.getElementById('phases').innerHTML = '';
    document.getElementById('gantt-hint').textContent = T.noPhases;
    document.getElementById('phases-hint').textContent = T.zeroPhases;
    document.getElementById('head-chips').innerHTML = '<span class="chip">' + T.emptyTitle + '</span>';

    var init = document.querySelector('.empty-init');
    if (init) init.addEventListener('click', function () {
      var sid = currentSessionId() || (d.session && d.session.id) || '';
      init.disabled = true;
      init.textContent = T.writing;
      fetch('/api/goal-gantt/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (out) {
          if (out.ok && out.body && out.body.ok) { init.textContent = T.written; return; }
          var code = out.body && out.body.error;
          init.textContent = code === 'exists' ? T.existsAlready : T.writeFailed;
          init.disabled = false;
        })
        .catch(function () { init.textContent = T.writeFailed; init.disabled = false; });
    });

    var copy = document.querySelector('.empty-copy');
    if (copy) copy.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(EXAMPLE);
      var old = copy.textContent;
      copy.textContent = T.copied;
      setTimeout(function () { copy.textContent = old; }, 1200);
    });
  }

  /* ------------------------------------------------------------ 页脚 */

  function renderFoot(d) {
    var s = d.session || {};
    document.getElementById('foot').innerHTML =
      '<div>' + T.session + ' <code>' + esc((s.title || s.id || '—').slice(0, 40)) + '</code>' +
      ' · ' + T.tools + (s.toolCalls || 0) + ' · tokens ' + fmtTokens(s.tokens) + '</div>' +
      '<div>' + esc(fmtStamp(d.generatedAt)) + T.updates + '</div>';
  }

  /* ------------------------------------------------------------ 主流程 */

  function showNetBanner(show) {
    var el = document.getElementById('net-banner');
    if (el) el.style.display = show ? '' : 'none';
  }

  function currentSessionId() {
    try { return new URL(window.location.href).searchParams.get('session') || ''; }
    catch (e) { return ''; }
  }

  function renderSessions(d) {
    var sel = document.getElementById('session-select');
    if (!sel) return;
    var list = d.sessions || [];
    sel.innerHTML = list.map(function (s) {
      var label = (s.hasGoal ? '● ' : '○ ') + (s.title || s.id).slice(0, 26) +
        (s.cwdName ? ' · ' + s.cwdName : '');
      return '<option value="' + esc(s.id) + '"' + (s.id === d.session.id ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    sel.onchange = function () {
      var url = new URL(window.location.href);
      if (sel.value) url.searchParams.set('session', sel.value);
      else url.searchParams.delete('session');
      window.location.href = url.toString();
    };
  }

  function tickTemporal(next) {
    DATA = next;
    window.__BOARD__ = next;
    var range = viewRange(next);
    var line = document.querySelector('.nowline');
    var now = next.timeline.now;

    /* 跟随：现在线逼近窗口边缘时重新取窗口，否则只移动游标 */
    var ratio = (now - range.from) / Math.max(range.to - range.from, 60000);
    if (VIEW_MODE !== 'all' && (ratio > 0.85 || ratio < 0.05)) {
      renderGantt(next);
      return;
    }

    if (line) {
      if (now >= range.from && now <= range.to) {
        line.style.display = '';
        line.style.left = (((now - range.from) / Math.max(range.to - range.from, 60000)) * 100).toFixed(3) + '%';
      } else {
        line.style.display = 'none';
      }
    }
    renderFoot(next);
  }

  function readUrlFilter() {
    try {
      var u = new URL(window.location.href);
      var f = u.searchParams.get('f');
      if (f === 'active' || f === 'unfinished' || f === 'all') FILTER.status = f;
      var q = u.searchParams.get('q');
      if (q) FILTER.q = q;
    } catch (e) { /* ignore */ }
  }

  function syncUrlFilter() {
    try {
      if (!window.history || typeof window.history.replaceState !== 'function') return;
      var u = new URL(window.location.href);
      if (FILTER.q) u.searchParams.set('q', FILTER.q); else u.searchParams.delete('q');
      if (FILTER.status !== 'all') u.searchParams.set('f', FILTER.status); else u.searchParams.delete('f');
      window.history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) { /* ignore */ }
  }

  function wirePhaseTools() {
    var input = document.getElementById('phase-search');
    if (input && !input.__wired) {
      input.__wired = true;
      input.addEventListener('input', function () {
        FILTER.q = String(input.value || '').trim();
        syncUrlFilter();
        if (DATA) renderPhases(DATA);
      });
    }

    var seg = document.getElementById('phase-filter');
    if (seg && !seg.__wired && typeof seg.querySelectorAll === 'function') {
      seg.__wired = true;
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (btn) {
        btn.addEventListener('click', function () {
          FILTER.status = btn.getAttribute('data-filter') || 'all';
          syncUrlFilter();
          Array.prototype.forEach.call(seg.querySelectorAll('button'), function (other) {
            other.classList.toggle('on', other === btn);
          });
          if (DATA) renderPhases(DATA);
        });
      });
    }

    /* 按 / 聚焦搜索框 */
    if (!window.__phaseKeyWired && document && typeof document.addEventListener === 'function') {
      window.__phaseKeyWired = true;
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== '/' || ev.defaultPrevented) return;
        var active = document.activeElement;
        if (active && /^(input|textarea|select)$/i.test(active.tagName || '')) return;
        var el = document.getElementById('phase-search');
        if (!el) return;
        ev.preventDefault();
        el.focus();
      });
    }
  }

  function render(d) {
    if (!d || !d.phases) return;
    DATA = d;
    window.__BOARD__ = d;
    if (d.mode === 'project' && !VIEW_TOUCHED) VIEW_MODE = 'all';
    applyStatic();
    wirePhaseTools();
    var appEl = document.querySelector('.app');
    if (appEl && appEl.style && appEl.style.setProperty) appEl.style.setProperty('--now-label', '"' + T.now + '"');
    renderHeader(d);
    renderSessions(d);
    if (!d.phases.length) { renderEmpty(d); renderFoot(d); return; }
    renderHero(d);
    renderGantt(d);
    renderPhases(d);
    applyHash();
    renderFoot(d);
    document.title = T.board + ' · ' + (d.overall || 0) + '%';
  }

  function poll() {
    try { if (document.hidden || (document.visibilityState && document.visibilityState !== 'visible')) return; } catch (e) {}
    var sid = currentSessionId();
    var url = '/api/goal-gantt' + (sid ? '?session=' + encodeURIComponent(sid) : '');
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (next) {
        showNetBanner(false);
        if (!DATA || next.signature !== DATA.signature) render(next);
        else tickTemporal(next);
      })
      .catch(function () { showNetBanner(true); });
  }

  /* 暴露摘要生成，便于测试与外部脚本复用 */
  window.__goalGantt = {
    summary: buildSummary,
    render: render,
    filter: function () { return { status: FILTER.status, q: FILTER.q }; },
    shareUrl: shareUrl,
    csv: buildCsv,
  };

  readUrlFilter();
  loadOpenState();
  loadGroupState();

  if (DATA) render(DATA);
  setInterval(poll, 10000);
})();
