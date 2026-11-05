/* Goal 甘特看板 — 浏览器渲染层（无依赖）
 *
 * 信息层级：
 *   1. 顶部：目标 + 会话 + 总进度
 *   2. Hero：当前在做什么（阶段名 / 状态 / 一句话 / 4 个关键数字 / 进度条）
 *   3. 进度：甘特时间轴
 *   4. 阶段：可展开的清单
 */
(function () {
  'use strict';

  var DATA = window.__BOARD__ || null;
  var VIEW_MODE = 'now';
  var OPEN = {};          /* 展开的阶段 */
  var FOCUS_ID = null;    /* 最近一次键盘操作的阶段，用于重渲染后恢复焦点 */

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
    if (m < 1) return '<1 分钟';
    if (m < 60) return m + ' 分钟';
    var h = Math.floor(m / 60);
    return h + ' 小时 ' + (m % 60) + ' 分';
  }

  function fmtShort(ms) {
    if (ms == null || isNaN(ms)) return '—';
    var m = Math.round(ms / 60000);
    if (m < 60) return m + 'm';
    return Math.floor(m / 60) + 'h' + (m % 60 ? (m % 60) + 'm' : '');
  }

  function fmtRange(a, b) {
    if (!a && !b) return '未排期';
    if (!a) return '— ' + fmtDate(b) + ' ' + fmtClock(b);
    if (!b) return fmtDate(a) + ' ' + fmtClock(a) + ' → 进行中';
    var sameDay = new Date(a).toDateString() === new Date(b).toDateString();
    return fmtDate(a) + ' ' + fmtClock(a) + ' → ' + (sameDay ? '' : fmtDate(b) + ' ') + fmtClock(b);
  }

  function fmtTokens(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
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

  function currentSegment(p) {
    if (!p.segments || !p.segments.length) {
      return { startedAt: p.startedAt, endedAt: p.endedAt, summary: p.summary, checks: p.checks };
    }
    var active = p.segments.filter(function (s) { return s.status === 'active'; })[0];
    return active || p.segments[p.segments.length - 1];
  }

  /* ------------------------------------------------------------ 顶部 */

  function renderHeader(d) {
    var g = d.goal || {};
    document.getElementById('goal-objective').textContent = g.objective || '当前会话还没有 goal';
    var ring = document.getElementById('ring');
    ring.style.setProperty('--p', d.overall || 0);
    document.getElementById('ring-val').textContent = (d.overall || 0) + '%';

    var chips = [];
    if (g.maxGoalRounds) {
      chips.push('<span class="chip">第 <b>' + (g.roundsStarted || 0) + '</b> / ' + g.maxGoalRounds + ' 轮</span>');
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
        '<span class="ckicker">' + (active ? '当前阶段' : (next ? '下一阶段' : '最近阶段')) + '</span>' +
        '<span class="badge ' + st.cls + '">' + st.text + '</span>' +
      '</div>' +
      '<h2 class="hero-title"><span class="hero-id">' + esc(p.id) + '</span>' + esc(p.title) + '</h2>' +
      '<p class="hero-summary">' + esc(seg.summary || p.summary || p.desc || '这一阶段还没有写总结。') + '</p>' +
      '<div class="hero-stats">' +
        '<div class="stat"><b>' + (p.progress || 0) + '<i>%</i></b><span>阶段进度</span></div>' +
        '<div class="stat"><b>' + (p.durationMs ? fmtShort(p.durationMs) : '—') + '</b><span>已用时间</span></div>' +
        '<div class="stat"><b>' + doneChecks + '<i>/' + checks.length + '</i></b><span>检查项</span></div>' +
        '<div class="stat"><b>' + (dist.remainingPhases || 0) + '<i>个</i></b><span>剩余阶段</span></div>' +
      '</div>' +
      '<div class="hero-bar"><i style="width:' + (p.progress || 0) + '%"></i></div>' +
      '<div class="hero-foot">' +
        '<span>阶段 ' + done + '/' + (dist.totalPhases || 0) + ' 已完成</span>' +
        (p.nextCheck ? '<span>下一步：' + esc(p.nextCheck) + '</span>' : '') +
        (dist.remainingMs ? '<span>预计还需 ' + fmtShort(dist.remainingMs) + '</span>' : '') +
      '</div>';
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
    var base = activeSeg ? Math.max(now - activeSeg.startedAt, 20 * 60000) : 90 * 60000;
    var span = Math.max(base * 2.4, 45 * 60000);
    var from = anchor - span * 0.72;
    var to = anchor + span * 0.28;

    if (from < all.from) { from = all.from; to = Math.min(all.to, from + span); }
    if (to > all.to) { to = all.to; from = Math.max(all.from, to - span); }
    return { from: from, to: Math.max(to, from + 60000) };
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
          /* 计划条也要夹在可视窗口内，否则会溢出到左侧标签列 */
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
        var tip = [p.id, p.title, statusOf(sg.status).text, fmtRange(sg.startedAt, sg.endedAt),
          fmtDur(sg.startedAt ? (sg.endedAt || d.timeline.now) - sg.startedAt : null),
          (p.activity ? p.activity.toolCalls : 0), (sg.progress || 0)].join('|');
        var a11y = ' role="button" tabindex="0" aria-label="' +
          esc(p.id + ' ' + p.title + '，' + statusOf(sg.status).text + '，进度 ' + (sg.progress || 0) + '%') + '"';
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
          '耗时 ' + esc(p[4]) + ' · 进度 ' + p[6] + '%<br>工具 ' + esc(p[5]) + ' 次';
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
            (p.startedAt ? '<span>实际 ' + esc(fmtRange(p.startedAt, p.endedAt)) + '</span>' : '') +
            (p.durationMs ? '<span>耗时 ' + esc(fmtDur(p.durationMs)) + '</span>' : '') +
            (checks.length ? '<span>检查 ' + doneChecks + '/' + checks.length + '</span>' : '') +
            (p.segments && p.segments.length > 1 ? '<span>' + p.segments.length + ' 个时间段</span>' : '') +
          '</div>' +
          '<p class="psummary">' + esc(seg.summary || p.summary || '（本阶段暂无总结）') + '</p>' +
          (checks.length ? '<div class="checks">' + checks.map(function (c) {
            return '<span class="check' + (c.done ? ' on' : '') + '"><i class="bx">' + (c.done ? '✓' : '') + '</i>' + esc(c.label) + '</span>';
          }).join('') + '</div>' : '') +
          ((p.deliverables || []).length ? '<div class="deliv">' + p.deliverables.map(function (x) {
            return '<a href="#" data-copy="' + esc(x.path) + '" title="点击复制路径">' + esc(x.label) + '</a>';
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
    document.getElementById('phases-hint').textContent = d.phases.length + ' 个阶段';

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
        a.textContent = '已复制';
        setTimeout(function () { a.textContent = old; }, 1200);
      });
    });
  }

  function togglePhase(id, scroll) {
    OPEN[id] = !OPEN[id];
    if (DATA) renderPhases(DATA);
    var restored = document.querySelector('[data-card="' + id + '"] .prow');
    if (restored && typeof restored.focus === 'function' && FOCUS_ID === id) restored.focus();
    if (scroll && OPEN[id]) {
      var row = document.querySelector('[data-card="' + id + '"]');
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ------------------------------------------------------------ 空态 */

  function renderEmpty(d) {
    var note = '<div class="empty-note"><b>这个会话还没有 goal</b><br>' +
      '创建 goal 之后，这里会显示当前阶段、进度和阶段清单。<br>' +
      '<span>也可以在会话工作区放一份 goal-board/board.config.json 手动定义阶段</span></div>';
    document.getElementById('hero').innerHTML = note;
    document.getElementById('glabels').innerHTML = '';
    document.getElementById('gtracks').innerHTML = '';
    document.getElementById('gaxis').innerHTML = '';
    document.getElementById('phases').innerHTML = '';
    document.getElementById('gantt-hint').textContent = '无阶段';
    document.getElementById('phases-hint').textContent = '0 个阶段';
    document.getElementById('head-chips').innerHTML = '<span class="chip">还没有 goal</span>';
  }

  /* ------------------------------------------------------------ 页脚 */

  function renderFoot(d) {
    var s = d.session || {};
    document.getElementById('foot').innerHTML =
      '<div>会话 <code>' + esc((s.title || s.id || '—').slice(0, 40)) + '</code>' +
      ' · 工具 ' + (s.toolCalls || 0) + ' 次 · tokens ' + fmtTokens(s.tokens) + '</div>' +
      '<div>' + esc(fmtStamp(d.generatedAt)) + ' 更新 · 每 10 秒自动刷新</div>';
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
    renderHeader(d);
    renderSessions(d);
    if (!d.phases.length) { renderEmpty(d); renderFoot(d); return; }
    renderHero(d);
    renderGantt(d);
    renderPhases(d);
    renderFoot(d);
    document.title = '看板 · ' + (d.overall || 0) + '%';
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
