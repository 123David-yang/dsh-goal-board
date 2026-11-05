/**
 * dsh-goal-gantt · 浏览器半侧
 *
 * 入口：会话视图环里的一个标签页（对话 / 轨迹 / 看板）。
 * 点开即在当前会话内渲染：Shadow DOM 隔离样式，复用插件自己的渲染器，
 * 不跳转、不 iframe、不占左侧栏；sessionId 用该 slot 的标准 prop（不额外 inject，避免命名冲突）。
 */
window.__ModuleLoader__.load({
  id: "dsh-goal-gantt",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require("react");
    const h = React.createElement;

    const NS = "goal-gantt";
    const PANEL_ID = "goal-gantt";
    const zh = { panel: "看板" };
    const en = { panel: "Board" };

    /* 与 lib/view.js 的 body 结构保持一致，渲染器按 id 找节点 */
    const SKELETON = `
<div class="app">
  <header class="topbar">
    <div class="brand">
      <div class="logo">◱</div>
      <div>
        <h1 id="board-title">GOAL 甘特看板</h1>
        <div class="sub" id="board-sub">DSH Goal Gantt Board</div>
      </div>
    </div>
    <div class="objective">
      <div class="obj-label" id="obj-label">目标 OBJECTIVE</div>
      <div class="obj-text" id="goal-objective">—</div>
      <label class="session-pick">
        <span id="session-label">会话</span>
        <select id="session-select" class="select"></select>
      </label>
    </div>
    <div class="head-right">
      <div class="ring" id="ring"><span id="ring-val">0%</span></div>
      <div class="chips" id="head-chips"></div>
    </div>
  </header>

  <main>
    <section class="panel hero" id="hero"></section>

    <section class="panel gantt-panel">
      <div class="panel-h"><span id="gantt-title">进度</span><div class="ph-right"><span class="hint" id="gantt-hint"></span><div class="gantt-tools" id="gantt-tools"><button type="button" data-mode="now" class="on">聚焦现在</button><button type="button" data-mode="all">全部范围</button></div></div></div>
      <div class="gantt">
        <div class="gaxis"><div class="spacer"></div><div class="ticks" id="gaxis"></div></div>
        <div class="gbody">
          <div class="gcol" id="glabels"></div>
          <div class="gtracks" id="gtracks"></div>
        </div>
      </div>
    </section>

    <section class="panel phases-panel">
      <div class="panel-h"><span id="phases-title">阶段</span><span class="hint" id="phases-hint"></span></div>
      <div class="phases" id="phases"></div>
    </section>
  </main>

  <footer class="foot" id="foot"></footer>
</div>`;

    const LOADING_HTML = `
<div class="gb-skel" aria-busy="true" aria-label="看板加载中">
  <div class="row"><div class="blk h1"></div></div>
  <div class="row"><div class="blk h2"></div></div>
  <div class="row"><div class="blk bar" style="height:20px"></div></div>
  <div class="row"><div class="blk bar"></div></div>
  <div class="row"><div class="blk bar" style="width:72%"></div></div>
  <div class="card"></div>
  <div class="card"></div>
</div>`;

    /* Shadow DOM 里没有 body，这里补背景与字体 */
    const SHELL_CSS = `
:host { display: block; height: 100%; }
.gb-shell {
  height: 100%; overflow: auto; box-sizing: border-box;
  background:
    radial-gradient(1100px 520px at 10% -12%, rgba(56,189,248,.10), transparent 62%),
    radial-gradient(900px 480px at 100% -6%, rgba(167,139,250,.10), transparent 58%),
    #070a10;
  color: #e8effb;
  font-family: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 14px;
}
.gb-shell .app { min-height: 100%; max-width: none; padding: 12px 14px 22px; }
.gb-shell { container-type: inline-size; }
.gb-error {
  height: 100%; box-sizing: border-box; padding: 40px 24px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; gap: 6px; color: #b6c4d6; font-size: 13.5px; line-height: 1.8;
}
.gb-error b { color: #e8effb; display: block; margin-bottom: 4px; font-size: 16px; }
.gb-error pre { white-space: pre-wrap; font-size: 12.5px; color: #fca5a5; margin: 0; font-family: inherit; }
.gb-retry {
  margin-top: 14px; padding: 6px 14px; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(56,189,248,.45); background: rgba(56,189,248,.12);
  color: #7dd3fc; font-size: 12.5px; font-family: inherit;
}
.gb-retry:hover { background: rgba(56,189,248,.2); }
.gb-link { margin-left: 12px; color: #7dd3fc; font-size: 12.5px; text-decoration: none; }
.gb-link:hover { text-decoration: underline; }

/* 骨架屏 */
.gb-skel { padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; }
.gb-skel .row { display: flex; gap: 12px; align-items: center; }
.gb-skel .blk {
  border-radius: 8px; background: rgba(148, 163, 184, .16);
  animation: gbPulse 1.5s ease-in-out infinite;
}
.gb-skel .h1 { height: 22px; width: 34%; }
.gb-skel .h2 { height: 14px; width: 62%; }
.gb-skel .bar { height: 12px; flex: 1; }
.gb-skel .card { height: 64px; border-radius: 12px; background: rgba(148, 163, 184, .1); animation: gbPulse 1.5s ease-in-out infinite; }
@keyframes gbPulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }

.net-banner {
  display: flex; align-items: center; gap: 8px; margin: 0 0 10px;
  padding: 7px 14px; border-radius: 10px; font-size: 12px;
  background: rgba(251, 191, 36, .12); border: 1px solid rgba(251, 191, 36, .35); color: #fbbf24;
}

@media (prefers-color-scheme: light) {
  .gb-shell { background: #f4f6fb; color: #0f172a; }
  .gb-skel .blk, .gb-skel .card { background: rgba(15, 23, 42, .09); }
  .gb-error { color: #475569; }
  .gb-error b { color: #0f172a; }
}
`;

    /* CSS / 渲染器只取一次，切换会话时复用 */
    const assetCache = { css: null, js: null };

    async function loadAsset(name, key) {
      if (assetCache[key]) return assetCache[key];
      const text = await fetch("/goal-gantt/asset/" + name).then((r) => {
        if (!r.ok) throw new Error(name + " " + r.status);
        return r.text();
      });
      assetCache[key] = text;
      return text;
    }

    /**
     * 把一个看板实例挂到 host 上：
     * 取 CSS / 渲染器 / 数据 → 建 Shadow DOM → 用「作用域内的 document」执行渲染器。
     */
    async function mountInto(host, sessionId, state) {
      const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
      shadow.innerHTML = "";

      const style = document.createElement("style");
      const shell = document.createElement("div");
      shell.className = "gb-shell";
      shell.innerHTML = LOADING_HTML;
      style.textContent = SHELL_CSS;
      shadow.append(style, shell);

      const query = sessionId ? "?session=" + encodeURIComponent(sessionId) : "";

      try {
        const [css, js, model] = await Promise.all([
          loadAsset("board.css", "css"),
          loadAsset("board.js", "js"),
          fetch("/api/goal-gantt" + query).then((r) => r.json()),
        ]);
        if (state.disposed) return;

        style.textContent = css + SHELL_CSS;
        shell.innerHTML = SKELETON;

        if (!model || model.ok === false) {
          shell.innerHTML = '<div class="gb-error"><b>看板暂时没有数据</b><br>' +
            ((model && model.error) || "未知原因") + "</div>";
          return;
        }

        /* 作用域 document：渲染器只看得见 Shadow DOM 内部 */
        const root = shell;
        const doc = {
          getElementById: (id) => root.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(id) : id)),
          querySelector: (sel) => root.querySelector(sel),
          querySelectorAll: (sel) => root.querySelectorAll(sel),
          createElement: (tag) => document.createElement(tag),
          body: root,
          title: "",
        };
        let pageLang = '';
        try { pageLang = new URL(window.location.href).searchParams.get('lang') || ''; } catch { /* ignore */ }
        const win = {
          __BOARD__: model,
          __LANG__: pageLang,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          addEventListener() {},
          location: {
            get href() { return window.location.origin + "/goal-gantt" + query; },
            set href(value) {
              try {
                const url = new URL(value, window.location.origin);
                const next = url.searchParams.get("session") || undefined;
                if (state.disposed) return;
                if (state.timer) { clearInterval(state.timer); state.timer = null; }
                mountInto(host, next, state);
              } catch { /* 忽略非法跳转 */ }
            },
          },
        };

        const setTimer = (fn, ms) => {
          if (state.timer) clearInterval(state.timer);
          state.timer = setInterval(fn, ms);
          return state.timer;
        };

        new Function("document", "window", "navigator", "setInterval", "clearInterval", "fetch", js)(
          doc, win, navigator, setTimer, clearInterval,
          (url, opts) => fetch(url, opts),
        );
      } catch (error) {
        if (state.disposed) return;
        /* ?debug=1 时直接把堆栈显示出来，方便排查 */
        if (String(window.location.search).indexOf("debug") >= 0) {
          shell.innerHTML = '<pre class="gb-error">' +
            String((error && error.stack) || error).replace(/</g, "&lt;") + "</pre>";
          return;
        }
        /* 加载失败：给出原因、重试和独立页面入口（不再静默塞 iframe） */
        style.textContent = SHELL_CSS;
        shell.innerHTML = '<div class="gb-error"><b>看板加载失败</b><pre>' +
          String((error && error.message) || error).replace(/</g, "&lt;") + '</pre></div>';
        const retry = document.createElement("button");
        retry.className = "gb-retry";
        retry.textContent = "重试";
        retry.addEventListener("click", () => mountInto(host, sessionId, state));
        const link = document.createElement("a");
        link.className = "gb-link";
        link.href = "/goal-gantt" + query;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "在独立页面打开";
        shell.querySelector(".gb-error").append(retry, link);
      }
    }

    /**
     * 会话视图环里的「看板」标签页。
     * sessionId 来自该 slot 的标准 props（不是我们自己 inject 的），
     * 切换会话时组件会带着新的 sessionId 重新挂载。
     */
    function GoalBoardView(props) {
      const hostRef = React.useRef(null);
      const sessionId = props && props.sessionId;

      React.useLayoutEffect(() => {
        const state = { disposed: false, timer: null };
        if (hostRef.current) {
          mountInto(hostRef.current, sessionId || null, state).catch(() => {});
        }
        return () => {
          state.disposed = true;
          if (state.timer) clearInterval(state.timer);
        };
      }, [sessionId]);

      return h("div", {
        ref: hostRef,
        style: { flex: "1 1 auto", minHeight: 0, height: "100%", display: "block" },
      });
    }

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        "goal-gantt: dictionaries",
      );
      const t = ctx.locale.bind(NS);

      /* 会话视图环：对话 / 轨迹 / 看板 */
      ctx.slots.inject("conversation.view", () =>
        ctx.slots.register(
          {
            name: "conversation.view",
            id: PANEL_ID,
            order: 20,
            locale: NS,
            label: () => t("panel"),
          },
          GoalBoardView,
        ),
      );
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale"];
    exports.GoalBoardView = GoalBoardView;
    exports.mountInto = mountInto;
    return module.exports;
  },
});
