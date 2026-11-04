/**
 * dsh-goal-board · 浏览器半侧
 *
 * 入口：会话视图环里的一个标签页（对话 / 轨迹 / 看板）。
 * 点开即在当前会话内渲染：Shadow DOM 隔离样式，复用插件自己的渲染器，
 * 不跳转、不 iframe、不占左侧栏；sessionId 用该 slot 的标准 prop（不额外 inject，避免命名冲突）。
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
.gb-shell .app { min-height: 100%; max-width: none; padding: 12px 14px 22px; }
.gb-shell { container-type: inline-size; }
.gb-error { padding: 40px; color: #94a6c0; font-size: 14px; line-height: 1.8; }
.gb-error b { color: #e8effb; }
`;

    /* CSS / 渲染器只取一次，切换会话时复用 */
    const assetCache = { css: null, js: null };

    async function loadAsset(name, key) {
      if (assetCache[key]) return assetCache[key];
      const text = await fetch("/goal-board/asset/" + name).then((r) => {
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
      shadow.append(style, shell);

      const query = sessionId ? "?session=" + encodeURIComponent(sessionId) : "";

      try {
        const [css, js, model] = await Promise.all([
          loadAsset("board.css", "css"),
          loadAsset("board.js", "js"),
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
        "goal-board: dictionaries",
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
