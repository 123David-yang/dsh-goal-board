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
  var OPEN = {};
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

  function fmtTokens(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n || 0);
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
    try { document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en'; } catch (e) { /* shadow */ }
  }

  /* ------------------------------------------------------------ 顶部 */

  function renderHeader(d) {
    var g = d.goal || {};
    document.getElementById('goal-objective').textContent = g.objective || T.emptyTitle;
    var ring = document.getElementById('ring');
    ring.style.setProperty('--p', d.overall || 0);
    document.getElementById('ring-val').textContent = (d.overall || 0) + '%';

    var chips = [];
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
    var dist = d.distance || {};
    var done = (dist.totalPhases || 0) - (dist.remainingPhases || 0);

    host.innerHTML =
      '<div class="hero-head">' +
        '<span class="ckicker">' + (active ? T.cur : (next ? T.next : T.last)) + '</span>' +
        '<span class="badge ' + st.cls + '">' + st.text + '</span>' +
        '<button type="button" class="hero-share" data-share="' + esc(p.id) + '" title="' +
          esc(T.shareHint) + '">' + esc(T.share) + '</button>' +
      '</div>' +
      '<h2 class="hero-title"><span class="hero-id">' + esc(p.id) + '</span>' + esc(p.title) + '</h2>' +
      '<p class="hero-summary">' + esc(seg.summary || p.summary || p.desc || T.noSummary) + '</p>' +
      '<div class="hero-stats">' +
        '<div class="stat"><b>' + (p.progress || 0) + '<i>%</i></b><span>' + T.progressLabel + '</span></div>' +
        '<div class="stat"><b>' + (p.durationMs ? fmtShort(p.durationMs) : '—') + '</b><span>' + T.elapsed + '</span></div>' +
        '<div class="stat"><b>' + doneChecks + '<i>/' + checks.length + '</i></b><span>' + T.checks + '</span></div>' +
        '<div class="stat"><b>' + (dist.remainingPhases || 0) + '<i>' + (LANG === 'zh' ? '个' : '') + '</i></b><span>' + T.remainPhases + '</span></div>' +
      '</div>' +
      '<div class="hero-bar"><i style="width:' + (p.progress || 0) + '%"></i></div>' +
      '<div class="hero-foot">' +
        '<span>' + T.phasesDone(done, dist.totalPhases || 0) + '</span>' +
        (p.nextCheck ? '<span>' + T.nextStep + esc(p.nextCheck) + '</span>' : '') +
        (dist.remainingMs ? '<span>' + T.remainTime(fmtShort(dist.remainingMs)) + '</span>' : '') +
      '</div>';

    var share = host.querySelector('.hero-share');
    if (share) share.addEventListener('click', function () {
      copyLink(share.getAttribute('data-share'), share);
    });
  }

  /* 直达链接：/goal-gantt?session=…#P3 */
  function shareUrl(id) {
    var origin = '';
    try { origin = window.location.origin || ''; } catch (e) { /* ignore */ }
    var query = '';
    try {
      var sid = new URL(window.location.href).searchParams.get('session');
      query = sid ? '?session=' + encodeURIComponent(sid) : '';
    } catch (e) { /* ignore */ }
    return origin + '/goal-gantt' + query + '#' + id;
  }

  function copyLink(id, btn) {
    var url = shareUrl(id);
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    if (btn) {
      var old = btn.textContent;
      btn.textContent = T.copied;
      btn.classList.add('done');
      setTimeout(function () { btn.textContent = old; btn.classList.remove('done'); }, 1200);
    }
  }

  /* ------------------------------------------------------------ 甘特 */

  function tickPlan(from, to) {
    var H = 3600000, MIN = 60000, DAY = 86400000;
    var span = Math.max(to - from, MIN);
    var step = span <= 2 * H ? 15 * MIN : span <= 8 * H ? H : span <= 40 * H ? 6 * H : span <= 12 * DAY ? DAY : 7 * DAY;
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

    if (from < all.from) { from = all.from; to = Math.min(all.to, from + span); }
    if (to > all.to) { to = all.to; from = Math.max(all.from, to - span); }
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

  function renderPhases(d) {
    var host = document.getElementById('phases');
    if (!host) return;

    var html = d.phases.map(function (p) {
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
          '<p class="psummary">' + esc(seg.summary || p.summary || T.noSummaryShort) + '</p>' +
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
          '<span class="ppct">' + (p.progress || 0) + '%</span>' +
        '</div>' + detail + '</div>';
    }).join('');

    host.innerHTML = html;
    document.getElementById('phases-hint').textContent = T.phaseCount(d.phases.length);

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
        '<button type="button" class="empty-copy">' + T.copyExample + '</button></div>' +
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

  function render(d) {
    if (!d || !d.phases) return;
    DATA = d;
    window.__BOARD__ = d;
    applyStatic();
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

  if (DATA) render(DATA);
  setInterval(poll, 10000);
})();
