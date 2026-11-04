/**
 * dsh-goal-board · 浏览器半侧
 *
 * 入口：
 *   1. 左侧栏图标（sidebar.panellist, id = goal-board）
 *   2. 主区（main, key = goal-board）—— 看板直接渲染在 DSH 页面内，
 *      用 Shadow DOM 隔离样式，复用插件自己的渲染器，不跳转、不 iframe
 *   3. 会话标题旁「新标签打开」按钮（可选入口）
 */
window.__ModuleLoader__.load({
  id: "dsh-goal-board",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require("react");
    const h = React.createElement;

    const NS = "goal-board";
    const PANEL_ID = "goal-board";
    const zh = { panel: "看板", open: "在新标签打开看板" };
    const en = { panel: "Board", open: "Open board in new tab" };

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
      <div class="obj-label">目标 OBJECTIVE</div>
      <div class="obj-text" id="goal-objective">—</div>
      <label class="session-pick">
        <span>会话</span>
        <select id="session-select" class="select"></select>
      </label>
    </div>
    <div class="head-right">
      <div class="ring" id="ring"><span id="ring-val">0%</span></div>
      <div class="chips" id="head-chips"></div>
    </div>
  </header>

  <main>
    <section class="panel rail-panel">
      <div class="panel-h"><span>阶段轨道</span><span class="hint" id="rail-count"></span></div>
      <div class="rail" id="rail"></div>
    </section>

    <section class="panel gantt-panel">
      <div class="panel-h"><span>开发进度甘特图</span><span class="hint" id="gantt-hint"></span></div>
      <div class="gantt">
        <div class="gaxis"><div class="spacer"></div><div class="ticks" id="gaxis"></div></div>
        <div class="gbody">
          <div class="gcol" id="glabels"></div>
          <div class="gtracks" id="gtracks"></div>
        </div>
      </div>
    </section>

    <section class="focus">
      <div class="panel chapter" id="chapter"></div>
      <div class="panel distance" id="distance"></div>
    </section>

    <section class="panel cards-panel">
      <div class="panel-h"><span>阶段总结汇报</span><span class="hint">每阶段做了什么 · 产出什么 · 距离目标还差什么</span></div>
      <div class="cards" id="cards"></div>
    </section>
  </main>

  <footer class="foot" id="foot"></footer>
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
.gb-shell .app { min-height: 100%; }
.gb-error { padding: 40px; color: #94a6c0; font-size: 14px; line-height: 1.8; }
.gb-error b { color: #e8effb; }
`;

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
      shadow.append(style, shell);

      const query = sessionId ? "?session=" + encodeURIComponent(sessionId) : "";

      try {
        const [css, js, model] = await Promise.all([
          fetch("/goal-board/asset/board.css").then((r) => { if (!r.ok) throw new Error("css " + r.status); return r.text(); }),
          fetch("/goal-board/asset/board.js").then((r) => { if (!r.ok) throw new Error("js " + r.status); return r.text(); }),
          fetch("/api/goal-board" + query).then((r) => r.json()),
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
        const win = {
          __BOARD__: model,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          addEventListener() {},
          location: {
            get href() { return window.location.origin + "/goal-board" + query; },
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
        /* 任何异常都退回 iframe，保证看板始终可用 */
        shell.innerHTML = "";
        const frame = document.createElement("iframe");
        frame.src = "/goal-board" + query;
        frame.style.cssText = "display:block;width:100%;height:100%;border:0;background:#070a10";
        shell.append(frame);
      }
    }

    function GoalBoardPanel() {
      const hostRef = React.useRef(null);

      React.useLayoutEffect(() => {
        const state = { disposed: false, timer: null };
        if (hostRef.current) mountInto(hostRef.current, null, state);
        return () => {
          state.disposed = true;
          if (state.timer) clearInterval(state.timer);
        };
      }, []);

      return h("div", {
        ref: hostRef,
        style: { height: "100%", minHeight: "100%", display: "block" },
      });
    }

    function BoardIcon(props) {
      const size = props && props.size ? props.size : 16;
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": "true" },
        h("rect", {
          x: 1.5, y: 2.5, width: 13, height: 11, rx: 2,
          fill: "none", stroke: "currentColor", strokeWidth: 1.2,
        }),
        h("path", {
          d: "M4 6h6M4 8.5h4.5M4 11h3",
          fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round",
        }),
      );
    }

    function HeaderButton(props) {
      const t = props.t || ((k) => k);
      const [hover, setHover] = React.useState(false);
      return h(
        "button",
        {
          type: "button",
          title: t("open"),
          style: {
            display: "inline-flex", alignItems: "center", gap: "5px",
            height: "26px", padding: "0 10px", borderRadius: "7px",
            border: "1px solid " + (hover ? "rgba(56,189,248,.45)" : "rgba(148,163,184,.32)"),
            background: hover ? "rgba(56,189,248,.14)" : "rgba(148,163,184,.06)",
            color: "inherit", fontSize: "12px", lineHeight: "1", cursor: "pointer",
            whiteSpace: "nowrap", transition: "background .15s ease, border-color .15s ease",
          },
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          onClick: () => window.open("/goal-board", "_blank", "noopener"),
        },
        h("span", { style: { fontSize: "13px", lineHeight: "1" } }, "\u25F1"),
        h("span", null, t("panel")),
      );
    }

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        "goal-board: dictionaries",
      );
      const t = ctx.locale.bind(NS);

      ctx.slots.inject("sidebar.panellist", () =>
        ctx.slots.register(
          { name: "sidebar.panellist", id: PANEL_ID, order: 90, locale: NS, label: () => t("panel") },
          BoardIcon,
        ),
      );

      ctx.slots.inject("main", () =>
        ctx.slots.register({ name: "main", key: PANEL_ID, locale: NS }, GoalBoardPanel),
      );

      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register(
          { name: "conversation.session.header.actions", id: PANEL_ID, order: 30, locale: NS },
          HeaderButton,
        ),
      );
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale"];
    exports.GoalBoardPanel = GoalBoardPanel;
    exports.mountInto = mountInto;
    return module.exports;
  },
});
