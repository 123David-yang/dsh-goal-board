/* Goal 甘特看板 — 浏览器渲染层（无依赖） */
(function () {
  'use strict';

  var DATA = window.__BOARD__ || null;
  var timer = null;

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

  function fmtDur(ms) {
    if (ms == null || isNaN(ms)) return '—';
    var m = Math.round(ms / 60000);
    if (m < 1) return '<1 分钟';
    if (m < 60) return m + ' 分钟';
    var h = Math.floor(m / 60);
    return h + ' 小时 ' + (m % 60) + ' 分';
  }

  function fmtRange(a, b) {
    if (!a && !b) return '未排期';
    if (!a) return '— ' + fmtDate(b) + ' ' + fmtClock(b);
    if (!b) return fmtDate(a) + ' ' + fmtClock(a) + ' → 进行中';
    var sameDay = new Date(a).toDateString() === new Date(b).toDateString();
    return fmtDate(a) + ' ' + fmtClock(a) + ' → ' + (sameDay ? '' : fmtDate(b) + ' ') + fmtClock(b);
  }

  function fmtTokens(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n || 0);
  }

  var STATUS = {
    done: { text: '已完成', cls: 'done' },
    active: { text: '进行中', cls: 'active' },
    pending: { text: '未开始', cls: 'pending' },
    blocked: { text: '阻塞', cls: 'blocked' }
  };

  function statusOf(s) { return STATUS[s] || STATUS.pending; }

  /* ------------------------------------------------------------ header */

  function renderHeader(d) {
    var g = d.goal || {};
    document.getElementById('board-title').textContent = (d.board && d.board.title) || 'GOAL 甘特看板';
    document.getElementById('board-sub').textContent = (d.board && d.board.subtitle) || 'DSH Goal Gantt Board';
    document.getElementById('goal-objective').textContent = g.objective || '（当前会话没有活跃 goal）';

    var ring = document.getElementById('ring');
    ring.style.setProperty('--p', d.overall || 0);
    document.getElementById('ring-val').textContent = (d.overall || 0) + '%';

    var chips = [];
    if (g.phase) {
      chips.push('<span class="chip state-' + esc(g.phase) + '">goal <b>' + esc(g.phase) + '</b></span>');
    }
    if (g.maxGoalRounds) {
      chips.push('<span class="chip">轮次 <b>' + (g.roundsStarted || 0) + '</b> / ' + g.maxGoalRounds + '</span>');
    }
    chips.push('<span class="chip">已用时 <b>' + esc(fmtDur(Date.now() - (g.createdAt || Date.now()))) + '</b></span>');
    if (d.session) {
      chips.push('<span class="chip">工具调用 <b>' + (d.session.toolCalls || 0) + '</b> 次</span>');
      chips.push('<span class="chip">tokens <b>' + fmtTokens(d.session.tokens) + '</b></span>');
    }
    document.getElementById('head-chips').innerHTML = chips.join('');
  }

  /* -------------------------------------------------------------- rail */

  function renderRail(d) {
    var html = d.phases.map(function (p) {
      var st = statusOf(p.status);
      return '<div class="rail-item' + (p.status === 'active' ? ' on' : '') + '" data-goto="' + esc(p.id) + '">' +
        '<i class="dot ' + st.cls + '"></i>' +
        '<div class="rail-title"><small>' + esc(p.id) + '</small>' + esc(p.title) + '</div>' +
        '<div class="rail-pct">' + (p.progress || 0) + '%</div>' +
        '</div>';
    }).join('');
    document.getElementById('rail').innerHTML = html;
    document.getElementById('rail-count').textContent = d.phases.length + ' 个阶段';

    Array.prototype.forEach.call(document.querySelectorAll('.rail-item'), function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-goto');
        var card = document.querySelector('[data-card="' + id + '"]');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  /* ------------------------------------------------------------- gantt */

  function tickPlan(from, to) {
    var H = 3600000, MIN = 60000, DAY = 86400000;
    var span = Math.max(to - from, MIN);
    var step = span <= 2 * H ? 15 * MIN : span <= 8 * H ? H : span <= 40 * H ? 6 * H : span <= 12 * DAY ? DAY : 7 * DAY;
    var ticks = [];
    var t = Math.ceil(from / step) * step;
    while (t <= to && ticks.length < 32) { ticks.push(t); t += step; }
    return { ticks: ticks, step: step };
  }

  function renderGantt(d) {
    var from = d.timeline.from, to = d.timeline.to;
    var span = Math.max(to - from, 60000);
    var xp = function (t) { return ((t - from) / span) * 100; };

    var plan = tickPlan(from, to);
    var multiDay = span > 86400000;

    var axis = document.getElementById('gaxis');
    axis.innerHTML = plan.ticks.map(function (t) {
      var lab = (multiDay ? fmtDate(t) + ' ' : '') + fmtClock(t);
      return '<span class="tick" style="left:' + xp(t).toFixed(3) + '%">' + esc(lab) + '</span>';
    }).join('');

    var labels = [];
    var tracks = [];

    d.phases.forEach(function (p) {
      var st = statusOf(p.status);
      var grid = plan.ticks.map(function (t) {
        return '<i class="gl" style="left:' + xp(t).toFixed(3) + '%"></i>';
      }).join('');

      labels.push('<div class="glab"><span class="gid">' + esc(p.id) + '</span><span class="gname" title="' +
        esc(p.title) + '">' + esc(p.title) + '</span></div>');

      var bars = '';
      if (p.plannedStart && p.plannedEnd) {
        var pl = xp(p.plannedStart), pw = Math.max(xp(p.plannedEnd) - pl, 0.35);
        bars += '<i class="gplan" style="left:' + pl.toFixed(3) + '%;width:' + pw.toFixed(3) + '%"></i>';
      }
      if (p.startedAt) {
        var a = Math.max(xp(p.startedAt), 0);
        var b = Math.min(xp(p.endedAt || d.timeline.now), 100);
        var width = Math.max(b - a, 0.4);
        var tip = [p.id, p.title, st.text, fmtRange(p.startedAt, p.endedAt), fmtDur(p.durationMs),
          (p.activity ? p.activity.toolCalls : 0), (p.progress || 0)].join('|');
        bars += '<div class="gbar st-' + p.status + '" data-tip="' + esc(tip) + '"' +
          ' style="left:' + a.toFixed(3) + '%;width:' + width.toFixed(3) + '%">' +
          '<i class="fill" style="width:' + Math.min(p.progress || 0, 100) + '%"></i>' +
          (width > 8 ? '<span class="lbl">' + esc(p.id + ' ' + p.title) + '</span>' : '') +
          '</div>';
      }
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
          '状态：' + esc(p[2]) + '<br>实际：' + esc(p[3]) + '<br>' +
          '耗时：' + esc(p[4]) + ' · 进度 ' + p[6] + '%<br>工具调用：' + esc(p[5]) + ' 次';
        tipEl.classList.add('on');
        tipEl.style.left = Math.min(ev.clientX + 16, window.innerWidth - 320) + 'px';
        tipEl.style.top = Math.min(ev.clientY + 16, window.innerHeight - 160) + 'px';
      });
      bar.addEventListener('mouseleave', function () { tipEl.classList.remove('on'); });
    });
  }

  /* ----------------------------------------------------------- chapter */

  function renderChapter(d) {
    var active = d.phases.filter(function (p) { return p.status === 'active'; })[0];
    var last = d.phases.filter(function (p) { return p.startedAt; }).slice(-1)[0];
    var p = active || last;
    var host = document.getElementById('chapter');

    if (!p) {
      host.innerHTML = '<div class="ckicker">当前章节</div><h2>尚未开始</h2><p>还没有阶段被标记为进行中。</p>';
      return;
    }
    var st = statusOf(p.status);
    var doneChecks = p.checks.filter(function (c) { return c.done; }).length;

    var turns = (d.recentTurns || []).slice().reverse().map(function (t) {
      return '<div class="turn"><time>' + esc(fmtClock(t.time)) + '</time><span title="' + esc(t.prompt) + '">' +
        esc(t.prompt || '（无输入）') + '</span></div>';
    }).join('');

    var checks = p.checks.length ? '<div class="checks">' + p.checks.map(function (c) {
      return '<div class="check' + (c.done ? ' on' : '') + '"><i class="bx">' + (c.done ? '✓' : '') + '</i>' +
        esc(c.label) + '</div>';
    }).join('') + '</div>' : '';

    host.innerHTML =
      '<div class="ckicker">当前章节 · CURRENT CHAPTER</div>' +
      '<div class="chead"><h2>' + esc(p.id + ' · ' + p.title) + '</h2><span class="badge ' + st.cls + '">' + st.text + '</span></div>' +
      '<p>' + esc(p.summary || p.desc || '暂无阶段说明。') + '</p>' +
      '<div class="kmeter">' +
        '<div class="kv"><b>' + (p.durationMs ? fmtDur(p.durationMs) : '—') + '</b><span>本阶段耗时</span></div>' +
        '<div class="kv"><b>' + (p.activity ? p.activity.toolCalls : 0) + '</b><span>工具调用</span></div>' +
        '<div class="kv"><b>' + doneChecks + '/' + p.checks.length + '</b><span>检查项</span></div>' +
        '<div class="kv"><b>' + (p.nextCheck || '—') + '</b><span>下一步</span></div>' +
      '</div>' +
      '<div class="tinybar"><i style="width:' + (p.progress || 0) + '%"></i></div>' +
      checks +
      (turns ? '<div class="ckicker" style="margin-top:2px">最近轮次</div><div class="turns">' + turns + '</div>' : '');
  }

  /* ---------------------------------------------------------- distance */

  function renderDistance(d) {
    var g = d.goal || {};
    var dist = d.distance || {};
    var remainRounds = dist.remainingRounds;
    var avgMs = 0;
    var done = d.phases.filter(function (p) { return p.status === 'done' && p.durationMs; });
    if (done.length) avgMs = done.reduce(function (s, p) { return s + p.durationMs; }, 0) / done.length;
    var eta = avgMs * (dist.remainingPhases || 0);

    var rows = [
      ['总体进度', (d.overall || 0) + '%'],
      ['阶段', (dist.totalPhases - dist.remainingPhases) + ' / ' + dist.totalPhases + ' 完成'],
      ['剩余阶段', String(dist.remainingPhases || 0)],
      remainRounds != null ? ['剩余轮次', remainRounds + ' / ' + dist.maxRounds] : ['剩余轮次', '不限'],
      ['预计剩余', dist.remainingPhases ? fmtDur(dist.remainingMs || eta) : '目标已达成']
    ].map(function (r) {
      return '<div class="drow"><span class="k">' + esc(r[0]) + '</span><span class="v">' + esc(r[1]) + '</span></div>';
    }).join('<div class="dsep"></div>');

    document.getElementById('distance').innerHTML =
      '<h3>距目标 DISTANCE TO GOAL</h3>' +
      '<div class="tinybar"><i style="width:' + (d.overall || 0) + '%"></i></div>' +
      rows +
      '<div class="dsep"></div>' +
      '<div class="drow"><span class="k">最近活动</span><span class="v">' +
        esc(fmtClock(d.session && d.session.lastActivityAt)) + '</span></div>';
  }

  /* ------------------------------------------------------------- cards */

  function renderCards(d) {
    var html = d.phases.map(function (p) {
      var st = statusOf(p.status);
      var doneChecks = p.checks.filter(function (c) { return c.done; }).length;
      var checks = p.checks.length ? '<div class="checks">' + p.checks.map(function (c) {
        return '<div class="check' + (c.done ? ' on' : '') + '"><i class="bx">' + (c.done ? '✓' : '') + '</i>' + esc(c.label) + '</div>';
      }).join('') + '</div>' : '';

      var deliv = (p.deliverables || []).length ? '<div class="deliv">' + p.deliverables.map(function (x) {
        return '<a href="#" data-copy="' + esc(x.path) + '" title="点击复制路径：' + esc(x.path) + '">' + esc(x.label) + '</a>';
      }).join('') + '</div>' : '';

      return '<div class="card ' + st.cls + '" data-card="' + esc(p.id) + '">' +
        '<div class="ctop"><div class="ctitle"><span class="gid">' + esc(p.id) + '</span><span>' + esc(p.title) + '</span></div>' +
        '<span class="badge ' + st.cls + '">' + (p.progress || 0) + '%</span></div>' +
        '<div class="meta"><span>' + esc(fmtRange(p.startedAt || p.plannedStart, p.endedAt || p.endedAt)) + '</span>' +
        (p.durationMs ? '<span>耗时 ' + esc(fmtDur(p.durationMs)) + '</span>' : '') +
        '<span>检查 ' + doneChecks + '/' + p.checks.length + '</span>' +
        (p.activity ? '<span>工具 ' + p.activity.toolCalls + '</span>' : '') + '</div>' +
        '<div class="summary' + (p.summary ? '' : ' empty') + '">' + esc(p.summary || '（本阶段暂无总结）') + '</div>' +
        checks + deliv +
        '</div>';
    }).join('');
    document.getElementById('cards').innerHTML = html;

    Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var path = a.getAttribute('data-copy');
        if (navigator.clipboard) navigator.clipboard.writeText(path);
        var old = a.textContent;
        a.textContent = '已复制';
        setTimeout(function () { a.textContent = old; }, 1200);
      });
    });
  }

  /* -------------------------------------------------------------- foot */

  function renderFoot(d) {
    document.getElementById('foot').innerHTML =
      '<div>数据源：<code>' + esc(d.session ? d.session.id : '—') + '</code> · ' +
      '生成于 ' + esc(fmtDate(d.generatedAt) + ' ' + fmtClock(d.generatedAt)) +
      ' · 模式 ' + esc(d.mode || 'auto') + '</div>' +
      '<div>自动每 10 秒刷新 · <code>GET /api/goal-board</code></div>';
  }

  /* --------------------------------------------------------- 会话选择器 */

  function renderSessions(d) {
    var sel = document.getElementById('session-select');
    if (!sel) return;
    var list = d.sessions || [];
    sel.innerHTML = list.map(function (s) {
      var label = (s.hasGoal ? '● ' : '○ ') + (s.title || s.id).slice(0, 26) +
        (s.cwdName ? ' · ' + s.cwdName : '');
      return '<option value="' + esc(s.id) + '"' +
        (s.id === d.session.id ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    sel.onchange = function () {
      var url = new URL(window.location.href);
      if (sel.value) url.searchParams.set('session', sel.value);
      else url.searchParams.delete('session');
      window.location.href = url.toString();
    };
  }

  /* -------------------------------------------------------------- main */

  function currentSessionId() {
    try { return new URL(window.location.href).searchParams.get('session') || ''; }
    catch (e) { return ''; }
  }

  function render(d) {
    if (!d || !d.phases) return;
    DATA = d;
    window.__BOARD__ = d;
    renderHeader(d);
    renderSessions(d);
    renderRail(d);
    renderGantt(d);
    renderChapter(d);
    renderDistance(d);
    renderCards(d);
    renderFoot(d);
    document.title = ((d.board && d.board.title) || 'GOAL 看板') + ' · ' + (d.overall || 0) + '%';
  }

  function poll() {
    var sid = currentSessionId();
    var url = '/api/goal-board' + (sid ? '?session=' + encodeURIComponent(sid) : '');
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (next) {
        if (!DATA || next.generatedAt !== DATA.generatedAt) render(next);
      })
      .catch(function () { /* 静默：下次再试 */ });
  }

  if (DATA) render(DATA);
  timer = setInterval(poll, 10000);
  window.addEventListener('beforeunload', function () { clearInterval(timer); });
})();
