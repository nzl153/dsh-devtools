window.__ModuleLoader__.load({
	id: "dsh-toolkit-ui",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/shared/types.ts
		const TOOLKIT_CATEGORY_LABEL = {
			observe: "OBSERVE",
			workspace: "WORKSPACE",
			experiment: "EXPERIMENT"
		};
		//#endregion
		//#region src/shared/registry.ts
		const GLOBAL_KEY = "__DSH_TOOLKIT__";
		function ensureGlobal() {
			const win = globalThis;
			if (!win[GLOBAL_KEY]) win[GLOBAL_KEY] = {
				entries: /* @__PURE__ */ new Map(),
				shellReady: false,
				openId: null,
				listeners: /* @__PURE__ */ new Set()
			};
			return win[GLOBAL_KEY];
		}
		function emit(state) {
			for (const fn of state.listeners) fn();
		}
		function getToolkitEntries() {
			return [...ensureGlobal().entries.values()].sort((a, b) => {
				const cat = a.category.localeCompare(b.category);
				if (cat !== 0) return cat;
				return a.order - b.order;
			});
		}
		function setToolkitShellReady(ready) {
			const state = ensureGlobal();
			if (state.shellReady === ready) return;
			state.shellReady = ready;
			emit(state);
		}
		function getToolkitOpenId() {
			return ensureGlobal().openId;
		}
		function setToolkitOpenId(id) {
			const state = ensureGlobal();
			if (state.openId === id) return;
			state.openId = id;
			emit(state);
		}
		function subscribeToolkit(fn) {
			const state = ensureGlobal();
			state.listeners.add(fn);
			return () => {
				state.listeners.delete(fn);
			};
		}
		//#endregion
		//#region src/shared/hooks.ts
		function useToolkitEntries() {
			const [entries, setEntries] = (0, react.useState)(() => getToolkitEntries());
			(0, react.useEffect)(() => subscribeToolkit(() => setEntries(getToolkitEntries())), []);
			return entries;
		}
		function useToolkitOpenId() {
			const [openId, setOpenId] = (0, react.useState)(() => getToolkitOpenId());
			(0, react.useEffect)(() => subscribeToolkit(() => setOpenId(getToolkitOpenId())), []);
			return openId;
		}
		//#endregion
		//#region src/shared/styles.ts
		const css = `
.dsh-tk {
  font-family: var(--dsw-font-family, system-ui, sans-serif);
  color: var(--dsw-alias-label-primary, inherit);
}
.dsh-tk *,
.dsh-tk *::before,
.dsh-tk *::after {
  box-sizing: border-box;
}
.dsh-tk-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--dsw-alias-border-l3);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}
.dsh-tk-button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh-tk-button:focus-visible {
  outline: 2px solid var(--dsw-alias-button-ghost-active-border);
  outline-offset: 1px;
}
.dsh-tk-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dsh-tk-toolbar-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  border-radius: 8px;
  padding: 3px 8px;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}
.dsh-tk-toolbar-item:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh-tk-toolbar-item.is-active {
  background: var(--dsw-alias-interactive-bg-active);
  color: var(--dsw-alias-label-primary);
}
.dsh-tk-toolbar-icon {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-tk-toolbar-label {
  white-space: nowrap;
}
.dsh-tk-toolbar-metric {
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.dsh-tk-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1190;
  background: transparent;
}
.dsh-tk-toolkit-button {
  position: relative;
}
.dsh-tk-toolkit-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary-foreground);
  background: var(--dsw-alias-state-business-primary);
}
.dsh-tk-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 280px;
  max-width: 340px;
  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-3));
  color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  box-shadow: var(--dsw-shadow-lv2);
  padding: 6px;
  z-index: 1200;
}
.dsh-tk-popover-group + .dsh-tk-popover-group {
  border-top: 1px solid var(--dsw-alias-border-l1);
  margin-top: 4px;
  padding-top: 4px;
}
.dsh-tk-popover-group-title {
  display: block;
  padding: 6px 10px 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-tk-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  text-align: left;
  border-radius: 8px;
  padding: 7px 10px;
  cursor: pointer;
  font: inherit;
  transition: background-color 140ms ease;
}
.dsh-tk-entry:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-tk-entry-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-interactive-bg-hover);
  flex: none;
}
.dsh-tk-entry-body {
  min-width: 0;
  flex: 1;
}
.dsh-tk-entry-title {
  display: block;
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-tk-entry-subtitle {
  display: block;
  margin-top: 1px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-tk-entry-metric {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  flex: none;
}
.dsh-tk-panel {
  position: fixed;
  top: 56px;
  right: 16px;
  width: min(400px, calc(100vw - 24px));
  max-height: calc(100vh - 72px);
  display: flex;
  flex-direction: column;
  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-3));
  color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 14px;
  box-shadow: var(--dsw-shadow-lv3);
  z-index: 1300;
  overflow: hidden;
}
.dsh-tk-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsh-tk-panel-header-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
  flex: none;
}
.dsh-tk-panel-header-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}
.dsh-tk-panel-header-status {
  margin-left: 2px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-tk-panel-header-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.dsh-tk-panel-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsh-tk-metric {
  min-width: 0;
}
.dsh-tk-metric-value {
  display: block;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.dsh-tk-metric-label {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.3;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-tk-panel-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px;
}
.dsh-tk-section + .dsh-tk-section {
  margin-top: 14px;
}
.dsh-tk-section-title {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-tk-panel-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dsh-tk-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  font-size: 12px;
  line-height: 1.4;
}
.dsh-tk-file-row:last-child {
  border-bottom: 0;
}
.dsh-tk-file-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary);
}
.dsh-tk-file-meta {
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
  flex: none;
}
.dsh-tk-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 12px;
  line-height: 1.4;
}
.dsh-tk-status-label {
  flex: 1;
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
}
.dsh-tk-status-value {
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.dsh-tk-meter {
  height: 4px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover);
  overflow: hidden;
}
.dsh-tk-meter > span {
  display: block;
  height: 100%;
  background: var(--dsw-alias-state-business-primary);
  border-radius: 999px;
}
.dsh-tk-divider {
  height: 1px;
  background: var(--dsw-alias-border-l1);
  border: 0;
  margin: 8px 0;
}
@media (max-width: 640px) {
  .dsh-tk-toolbar-label {
    display: none;
  }
  .dsh-tk-toolbar-metric {
    display: none;
  }
  .dsh-tk-panel {
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 100%;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-tk *,
  .dsh-tk *::before,
  .dsh-tk *::after {
    transition: none !important;
    animation: none !important;
  }
}
`;
		let adopted = false;
		function adoptToolkitStyles() {
			if (adopted || typeof document === "undefined") return;
			adopted = true;
			if (document.getElementById("dsh-toolkit-ui-style")) return;
			const tag = document.createElement("style");
			tag.id = "dsh-toolkit-ui-style";
			tag.setAttribute("data-plugin", "dsh-toolkit-ui");
			tag.textContent = css;
			document.head.append(tag);
		}
		//#endregion
		//#region src/client/locales.ts
		const NS = "dsh-toolkit-ui";
		const zh = {
			toolkit: "Toolkit",
			close: "关闭",
			observe: "观察",
			workspace: "工作区",
			experiment: "实验"
		};
		const en = {
			toolkit: "Toolkit",
			close: "Close",
			observe: "Observe",
			workspace: "Workspace",
			experiment: "Experiment"
		};
		//#endregion
		//#region src/client/Shell.tsx
		function ToolkitHeaderAction({ sessionId, t, useWorkspaces, inputActions }) {
			const entries = useToolkitEntries();
			const openId = useToolkitOpenId();
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (openId) setMenuOpen(false);
			}, [openId]);
			const quick = entries.filter((entry) => entry.quick).sort((a, b) => a.order - b.order).slice(0, 3);
			const attention = entries.filter((entry) => {
				const state = entry.getState?.(sessionId) ?? entry.state;
				return state === "warning" || state === "error" || state === "ongoing";
			}).length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-tk dsh-tk-toolbar",
				children: [
					quick.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-tk-toolbar-slot",
						children: entry.renderQuick(sessionId)
					}, entry.id)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-tk-toolbar-slot",
						style: { position: "relative" },
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutline16, {}),
							className: "dsh-tk-toolkit-button",
							onClick: () => setMenuOpen((v) => !v),
							children: [t("toolkit"), attention > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-tk-toolkit-count",
								children: attention
							}) : null]
						}), menuOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh-tk-backdrop",
							onClick: () => setMenuOpen(false)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh-tk-popover",
							children: [
								"observe",
								"workspace",
								"experiment"
							].map((category) => {
								const group = entries.filter((entry) => entry.category === category);
								if (group.length === 0) return null;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh-tk-popover-group",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-tk-popover-group-title",
										children: TOOLKIT_CATEGORY_LABEL[category]
									}), group.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh-tk-popover-entry",
										children: entry.renderRow(sessionId)
									}, entry.id))]
								}, category);
							})
						})] }) : null]
					}),
					(() => {
						const active = entries.find((entry) => entry.id === openId);
						if (!active) return null;
						return active.renderPanel(sessionId, () => setToolkitOpenId(null), {
							useWorkspaces,
							inputActions
						});
					})()
				]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		const inject = ["slots", "locale"];
		function apply(ctx) {
			adoptToolkitStyles();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-toolkit-ui: dictionaries");
			ctx.effect(() => {
				setToolkitShellReady(true);
				return () => setToolkitShellReady(false);
			}, "dsh-toolkit-ui: shell-ready");
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "dsh-toolkit-ui",
				order: -100,
				locale: NS,
				inject: () => ({})
			}, (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitHeaderAction, { ...props })));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
