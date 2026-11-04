/**
 * dsh-goal-board · 浏览器半侧
 *
 * 两个入口：
 *   1. 左侧栏图标（sidebar.panellist, id = goal-board）
 *   2. 对应主区（main, key = goal-board）：内嵌 /goal-board 全页看板
 * 另在会话头部放一个「看板」快捷按钮（新标签打开）。
 */
window.__ModuleLoader__.load({
  id: "dsh-goal-board",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require("react");
    const h = React.createElement;

    const NS = "goal-board";
    const zh = { panel: "看板", open: "打开 Goal 甘特看板" };
    const en = { panel: "Board", open: "Open Goal Gantt board" };
    const PANEL_ID = "goal-board";

    /** 主区页面：直接内嵌插件自己提供的 /goal-board。 */
    function BoardFrame() {
      return h("iframe", {
        src: "/goal-board",
        title: "Goal Gantt Board",
        style: {
          display: "block",
          width: "100%",
          height: "100%",
          minHeight: "100%",
          border: "0",
          background: "#070a10",
        },
      });
    }

    /** 左侧栏图标。 */
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

    /** 会话头部快捷按钮。 */
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

      /* 左侧栏入口 */
      ctx.slots.inject("sidebar.panellist", () =>
        ctx.slots.register(
          { name: "sidebar.panellist", id: PANEL_ID, order: 90, locale: NS, label: () => t("panel") },
          BoardIcon,
        ),
      );

      /* 对应主区页面 */
      ctx.slots.inject("main", () =>
        ctx.slots.register({ name: "main", key: PANEL_ID, locale: NS }, BoardFrame),
      );

      /* 会话标题旁的快捷入口 */
      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register(
          { name: "conversation.session.header.actions", id: PANEL_ID, order: 30, locale: NS },
          HeaderButton,
        ),
      );
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale"];
    return module.exports;
  },
});
