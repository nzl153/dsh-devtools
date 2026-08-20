import { useEffect, useState } from "react";
import { Button, IconCloseOutline16, StateDot } from "@deepseek-ai/dsh-client-ui-primitives";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
function registerToolkitEntry(entry) {
	const state = ensureGlobal();
	state.entries.set(entry.id, entry);
	emit(state);
	return () => {
		if (state.entries.get(entry.id) === entry) {
			state.entries.delete(entry.id);
			emit(state);
		}
	};
}
function getToolkitEntries() {
	return [...ensureGlobal().entries.values()].sort((a, b) => {
		const cat = a.category.localeCompare(b.category);
		if (cat !== 0) return cat;
		return a.order - b.order;
	});
}
function getToolkitEntriesByCategory(category) {
	return getToolkitEntries().filter((entry) => entry.category === category);
}
function setToolkitShellReady(ready) {
	const state = ensureGlobal();
	if (state.shellReady === ready) return;
	state.shellReady = ready;
	emit(state);
}
function isToolkitShellReady() {
	return ensureGlobal().shellReady;
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
	const [entries, setEntries] = useState(() => getToolkitEntries());
	useEffect(() => subscribeToolkit(() => setEntries(getToolkitEntries())), []);
	return entries;
}
function useToolkitShellReady() {
	const [ready, setReady] = useState(() => isToolkitShellReady());
	useEffect(() => subscribeToolkit(() => setReady(isToolkitShellReady())), []);
	return ready;
}
function useToolkitOpenId() {
	const [openId, setOpenId] = useState(() => getToolkitOpenId());
	useEffect(() => subscribeToolkit(() => setOpenId(getToolkitOpenId())), []);
	return openId;
}
function useToolkitPanel(id) {
	return {
		open: useToolkitOpenId() === id,
		openPanel: () => setToolkitOpenId(id),
		closePanel: () => setToolkitOpenId(null)
	};
}
//#endregion
//#region src/shared/components.tsx
function ToolkitPanel({ title, icon, status, onClose, summary, children, footer, className }) {
	return /* @__PURE__ */ jsxs("div", {
		className: `dsh-tk dsh-tk-panel${className ? ` ${className}` : ""}`,
		role: "dialog",
		"aria-label": title,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "dsh-tk-panel-header",
				children: [
					icon ? /* @__PURE__ */ jsx("span", {
						className: "dsh-tk-panel-header-icon",
						children: icon
					}) : null,
					/* @__PURE__ */ jsx("span", {
						className: "dsh-tk-panel-header-title",
						children: title
					}),
					status ? /* @__PURE__ */ jsx("span", {
						className: "dsh-tk-panel-header-status",
						children: status
					}) : null,
					/* @__PURE__ */ jsx("span", {
						className: "dsh-tk-panel-header-actions",
						children: /* @__PURE__ */ jsx(Button, {
							variant: "ghost",
							size: "sm",
							icon: /* @__PURE__ */ jsx(IconCloseOutline16, {}),
							onClick: onClose,
							"aria-label": "Close"
						})
					})
				]
			}),
			summary ? /* @__PURE__ */ jsx("div", {
				className: "dsh-tk-panel-summary",
				children: summary
			}) : null,
			children ? /* @__PURE__ */ jsx("div", {
				className: "dsh-tk-panel-content",
				children
			}) : null,
			footer ? /* @__PURE__ */ jsx("div", {
				className: "dsh-tk-panel-footer",
				children: footer
			}) : null
		]
	});
}
function Metric({ value, label }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "dsh-tk-metric",
		children: [/* @__PURE__ */ jsx("span", {
			className: "dsh-tk-metric-value",
			children: value
		}), /* @__PURE__ */ jsx("span", {
			className: "dsh-tk-metric-label",
			children: label
		})]
	});
}
function SectionLabel({ children }) {
	return /* @__PURE__ */ jsx("span", {
		className: "dsh-tk-section-title",
		children
	});
}
function StatusRow({ label, value, state }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "dsh-tk-status-row",
		children: [
			state ? /* @__PURE__ */ jsx(StateDot, { state }) : null,
			/* @__PURE__ */ jsx("span", {
				className: "dsh-tk-status-label",
				children: label
			}),
			/* @__PURE__ */ jsx("span", {
				className: "dsh-tk-status-value",
				children: value
			})
		]
	});
}
function FileRow({ path, meta, state, onClick }) {
	const content = /* @__PURE__ */ jsxs(Fragment, { children: [
		state ? /* @__PURE__ */ jsx(StateDot, { state }) : null,
		/* @__PURE__ */ jsx("span", {
			className: "dsh-tk-file-path",
			children: path
		}),
		meta ? /* @__PURE__ */ jsx("span", {
			className: "dsh-tk-file-meta",
			children: meta
		}) : null
	] });
	if (onClick) return /* @__PURE__ */ jsx("button", {
		type: "button",
		className: "dsh-tk-file-row",
		onClick,
		children: content
	});
	return /* @__PURE__ */ jsx("div", {
		className: "dsh-tk-file-row",
		children: content
	});
}
function ToolkitEntryRow({ title, subtitle, icon, metric, state, onClick }) {
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		className: "dsh-tk-entry",
		onClick,
		children: [
			icon ? /* @__PURE__ */ jsx("span", {
				className: "dsh-tk-entry-icon",
				children: icon
			}) : null,
			/* @__PURE__ */ jsxs("span", {
				className: "dsh-tk-entry-body",
				children: [/* @__PURE__ */ jsx("span", {
					className: "dsh-tk-entry-title",
					children: title
				}), subtitle ? /* @__PURE__ */ jsx("span", {
					className: "dsh-tk-entry-subtitle",
					children: subtitle
				}) : null]
			}),
			state ? /* @__PURE__ */ jsx(StateDot, { state }) : null,
			metric ? /* @__PURE__ */ jsx("span", {
				className: "dsh-tk-entry-metric",
				children: metric
			}) : null
		]
	});
}
function ToolkitQuickAction({ title, icon, metric, state, onClick }) {
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		className: "dsh-tk-toolbar-item",
		onClick,
		title: typeof title === "string" ? title : void 0,
		children: [
			icon ? /* @__PURE__ */ jsx("span", {
				className: "dsh-tk-toolbar-icon",
				children: icon
			}) : null,
			/* @__PURE__ */ jsx("span", {
				className: "dsh-tk-toolbar-label",
				children: title
			}),
			state ? /* @__PURE__ */ jsx(StateDot, {
				state,
				size: 8
			}) : null,
			metric ? /* @__PURE__ */ jsx("span", {
				className: "dsh-tk-toolbar-metric",
				children: metric
			}) : null
		]
	});
}
function openToolkitPanel(id) {
	setToolkitOpenId(id);
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
export { FileRow, Metric, SectionLabel, StatusRow, TOOLKIT_CATEGORY_LABEL, ToolkitEntryRow, ToolkitPanel, ToolkitQuickAction, adoptToolkitStyles, getToolkitEntries, getToolkitEntriesByCategory, getToolkitOpenId, isToolkitShellReady, openToolkitPanel, registerToolkitEntry, setToolkitOpenId, setToolkitShellReady, subscribeToolkit, useToolkitEntries, useToolkitOpenId, useToolkitPanel, useToolkitShellReady };
