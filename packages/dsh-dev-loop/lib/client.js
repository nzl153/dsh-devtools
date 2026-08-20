window.__ModuleLoader__.load({
	id: "dsh-dev-loop",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../dsh-toolkit-ui/lib/shared.js
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
		function isToolkitShellReady() {
			return ensureGlobal().shellReady;
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
		function useToolkitShellReady() {
			const [ready, setReady] = (0, react.useState)(() => isToolkitShellReady());
			(0, react.useEffect)(() => subscribeToolkit(() => setReady(isToolkitShellReady())), []);
			return ready;
		}
		function ToolkitEntryRow({ title, subtitle, icon, metric, state, onClick }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "dsh-tk-entry",
				onClick,
				children: [
					icon ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-tk-entry-icon",
						children: icon
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsh-tk-entry-body",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh-tk-entry-title",
							children: title
						}), subtitle ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh-tk-entry-subtitle",
							children: subtitle
						}) : null]
					}),
					state ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state }) : null,
					metric ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-tk-entry-metric",
						children: metric
					}) : null
				]
			});
		}
		function openToolkitPanel(id) {
			setToolkitOpenId(id);
		}
		//#endregion
		//#region src/client/api.ts
		const API = "/plugins/dsh-dev-loop/api";
		async function call(method, body, signal) {
			const res = await fetch(`${API}/${method}`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				signal
			});
			const value = await res.json().catch(() => void 0);
			if (!res.ok) return {
				ok: false,
				error: {
					...typeof value === "object" && value !== null && "error" in value ? value.error : {
						code: "http-" + res.status,
						message: "HTTP " + res.status
					},
					details: {}
				}
			};
			return value;
		}
		const devLoopApi = {
			summary(root, signal) {
				return call("summary", { root: root ?? null }, signal);
			},
			run(root, action, confirmTrust = false) {
				return call("run", {
					root,
					action,
					confirmTrust
				});
			},
			cancel(id) {
				return call("cancel", { id });
			},
			confirmTrust(root, name) {
				return call("confirm-trust", {
					root,
					name
				});
			},
			sendError(sessionId, root, action) {
				return call("send-error", {
					sessionId,
					root,
					action
				});
			},
			watchStart(root) {
				return call("watch-start", { root });
			},
			watchStop(root) {
				return call("watch-stop", { root });
			},
			generatePreset(framework, name, root) {
				return call("generate-preset", {
					framework,
					name,
					root: root ?? ""
				});
			}
		};
		//#endregion
		//#region src/client/Panel.tsx
		function statusLabel(t, status) {
			switch (status) {
				case "running": return t("running");
				case "succeeded": return t("succeeded");
				case "failed": return t("failed");
				case "cancelled": return t("cancelled");
				default: return t("idle");
			}
		}
		function statusChipStyle(status) {
			switch (status) {
				case "succeeded": return {
					background: "var(--dsw-alias-state-success-tertiary)",
					color: "var(--dsw-alias-state-success-primary)"
				};
				case "failed": return {
					background: "var(--dsw-alias-state-error-secondary)",
					color: "var(--dsw-alias-state-error-primary)"
				};
				case "running": return {
					background: "var(--dsw-alias-state-warn-tertiary)",
					color: "var(--dsw-alias-state-warn-primary)"
				};
				case "cancelled": return {
					background: "var(--dsw-alias-interactive-bg-hover)",
					color: "var(--dsw-alias-label-tertiary)"
				};
				default: return {
					background: "var(--dsw-alias-interactive-bg-hover)",
					color: "var(--dsw-alias-label-secondary)"
				};
			}
		}
		function DevLoopPanel({ sessionId, t, useWorkspaces, onClose }) {
			const [root, setRoot] = (0, react.useState)("");
			const [rootInput, setRootInput] = (0, react.useState)("");
			const [manualRoot, setManualRoot] = (0, react.useState)(false);
			const [summary, setSummary] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [presetOpen, setPresetOpen] = (0, react.useState)(false);
			const [presetFramework, setPresetFramework] = (0, react.useState)("node");
			const [presetName, setPresetName] = (0, react.useState)("");
			const [presetText, setPresetText] = (0, react.useState)("");
			const workspaceItems = useWorkspaces((s) => s?.items) ?? [];
			const detectedRoot = (0, react.useMemo)(() => {
				if (manualRoot) return root;
				return workspaceItems.find((w) => (w.sessionIds ?? []).includes(sessionId))?.path ?? "";
			}, [
				workspaceItems,
				sessionId,
				manualRoot
			]);
			const activeRoot = manualRoot ? root : detectedRoot;
			const refresh = (0, react.useCallback)(async () => {
				setLoading(true);
				const res = await devLoopApi.summary(activeRoot || void 0);
				if (res.ok) {
					setSummary(res.value);
					if (!manualRoot && !res.value.project && res.value.actions.length === 0 && activeRoot) {}
					setError(null);
				} else setError(res.error.message);
				setLoading(false);
			}, [activeRoot, manualRoot]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const runAction = (0, react.useCallback)(async (action, confirmTrust = false) => {
				if (!activeRoot) return;
				setError(null);
				const res = await devLoopApi.run(activeRoot, action, confirmTrust);
				if (!res.ok) {
					setError(res.error.message);
					return;
				}
				const result = res.value;
				if (result.needsTrust) {
					setError(`TRUST:${activeRoot}`);
					return;
				}
				await refresh();
				const id = result.run.id;
				if (!id) return;
				const timer = setInterval(async () => {
					const s = await devLoopApi.summary(activeRoot);
					if (s.ok) {
						const r = s.value.runs[id];
						setSummary(s.value);
						if (r && r.status !== "running" && r.status !== "idle") clearInterval(timer);
					}
				}, 800);
			}, [activeRoot, refresh]);
			const cancelRun = (0, react.useCallback)(async (id) => {
				await devLoopApi.cancel(id);
				await refresh();
			}, [refresh]);
			const confirmTrust = (0, react.useCallback)(async () => {
				if (!activeRoot) return;
				const name = summary?.project?.name;
				await devLoopApi.confirmTrust(activeRoot, name);
				setError(null);
				const res = await devLoopApi.summary(activeRoot);
				if (res.ok) setSummary(res.value);
			}, [
				activeRoot,
				summary,
				refresh
			]);
			const sendError = (0, react.useCallback)(async () => {
				if (!activeRoot) return;
				const res = await devLoopApi.sendError(sessionId, activeRoot);
				if (res.ok) setError(res.value.ok ? res.value.message : res.value.message);
				else setError(res.error.message);
			}, [activeRoot, sessionId]);
			const toggleWatch = (0, react.useCallback)(async () => {
				if (!activeRoot) return;
				const res = summary?.watch?.started ?? false ? await devLoopApi.watchStop(activeRoot) : await devLoopApi.watchStart(activeRoot);
				if (res.ok) await refresh();
				else setError(res.error.message);
			}, [
				activeRoot,
				refresh,
				summary?.watch?.started
			]);
			const generatePreset = (0, react.useCallback)(async () => {
				const name = presetName.trim() || summary?.project?.name || "My Project";
				const res = await devLoopApi.generatePreset(presetFramework, name, activeRoot || void 0);
				if (res.ok) {
					setPresetText(res.value.text);
					setError(null);
				} else setError(res.error.message);
			}, [
				presetFramework,
				presetName,
				summary?.project?.name,
				activeRoot
			]);
			const running = (0, react.useMemo)(() => Object.values(summary?.runs ?? {}).some((r) => r.status === "running"), [summary]);
			const lastFail = summary?.lastFail;
			const trustPrompt = error !== null && error.startsWith("TRUST:");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-devloop-root",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: "dsh-devloop-head",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsh-devloop-head-title",
							children: [summary?.project?.name ?? t("title"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-devloop-status-chip",
								style: {
									...summary?.trusted ? {
										background: "var(--dsw-alias-state-success-tertiary)",
										color: "var(--dsw-alias-state-success-primary)"
									} : {
										background: "var(--dsw-alias-state-error-secondary)",
										color: "var(--dsw-alias-state-error-primary)"
									},
									marginLeft: 8
								},
								children: summary?.trusted ? t("trusted") : t("notTrusted")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 11,
								color: "#888"
							},
							children: activeRoot || t("noWorkspace")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-devloop-close",
							onClick: onClose,
							"aria-label": "close",
							children: "✕"
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-devloop-body",
					children: [
						!activeRoot ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh-devloop-notice",
							children: t("noWorkspace")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "dsh-devloop-root-input",
							value: rootInput,
							placeholder: "E:\\\\path\\\\to\\\\project",
							onChange: (e) => {
								setRootInput(e.target.value);
								setManualRoot(true);
								setRoot(e.target.value);
							}
						})] }) : null,
						loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh-devloop-notice",
							children: t("loading")
						}) : null,
						!loading && summary && !summary.project ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh-devloop-notice",
							children: t("noConfig")
						}) : null,
						trustPrompt ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-devloop-trust",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("trustWarning") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsh-devloop-action-btn",
								onClick: () => {
									confirmTrust();
								},
								children: t("confirmTrust")
							})]
						}) : null,
						error !== null && !trustPrompt ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh-devloop-notice",
							style: { color: "var(--dsw-alias-state-error-primary)" },
							children: error
						}) : null,
						summary?.project ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-devloop-actions",
								children: [Object.values(summary.project.actions).map((a) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-devloop-action-btn",
									disabled: running,
									onClick: () => {
										runAction(a.name);
									},
									children: a.name
								}, a.name)), running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-devloop-action-btn",
									onClick: () => {
										const r = Object.values(summary.runs).find((x) => x.status === "running");
										if (r) cancelRun(r.id);
									},
									children: t("stop")
								}) : null]
							}),
							summary.watch ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-devloop-watch",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("watch") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsh-devloop-watch-meta",
										children: [
											summary.watch.action,
											summary.watch.running ? ` · ${t("running")}` : "",
											summary.watch.pending ? ` · ${t("watchPending")}` : ""
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh-devloop-action-btn",
										onClick: () => {
											toggleWatch();
										},
										children: summary.watch.started ? t("watchStop") : t("watchStart")
									})
								]
							}) : null,
							summary.afterAgent ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-devloop-watch",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("afterAgent") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh-devloop-watch-meta",
									children: [
										summary.afterAgent.enabled ? t("afterAgentOn") : t("afterAgentOff"),
										" · ",
										summary.afterAgent.action,
										summary.afterAgent.lastStatus ? ` · ${statusLabel(t, summary.afterAgent.lastStatus)}` : ""
									]
								})]
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-devloop-preset",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-devloop-action-btn",
									onClick: () => setPresetOpen((v) => !v),
									children: t("generatePreset")
								}), presetOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh-devloop-preset-body",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
											className: "dsh-devloop-root-input",
											value: presetFramework,
											onChange: (e) => setPresetFramework(e.target.value),
											children: [
												"node",
												"python",
												"rust",
												"dotnet",
												"godot"
											].map((fw) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: fw,
												children: fw
											}, fw))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "dsh-devloop-root-input",
											value: presetName,
											placeholder: t("presetName"),
											onChange: (e) => setPresetName(e.target.value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-devloop-action-btn",
											onClick: () => {
												generatePreset();
											},
											children: t("generatePreset")
										}),
										presetText ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											className: "dsh-devloop-preset-text",
											readOnly: true,
											value: presetText,
											rows: 12
										}) : null
									]
								}) : null]
							}),
							lastFail ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-devloop-notice",
								style: { marginBottom: 8 },
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("lastFail"), ":"] }),
									" ",
									lastFail.action,
									" · ",
									formatAgo(lastFail.at),
									lastFail.snippet ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
										className: "dsh-devloop-output",
										style: { maxHeight: 90 },
										children: lastFail.snippet
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: { marginTop: 6 },
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-devloop-action-btn",
											onClick: () => {
												sendError();
											},
											children: t("sendError")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-devloop-action-btn",
											onClick: () => {
												[...document.querySelectorAll("button")].find((b) => ["战报", "Debrief"].some((k) => (b.textContent ?? "").includes(k)))?.click();
											},
											children: t("openDebrief")
										})]
									})
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh-devloop-notice",
								children: t("noLastFail")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh-devloop-records",
								style: { marginTop: 10 },
								children: Object.entries(summary.runs).sort((a, b) => (b[1].startedAt ?? 0) - (a[1].startedAt ?? 0)).map(([id, r]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordRow, {
									id,
									run: r,
									t
								}, id))
							})
						] }) : null
					]
				})]
			});
		}
		function RecordRow({ run, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-devloop-record",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-devloop-record-head",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: run.action }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh-devloop-status-chip",
							style: statusChipStyle(run.status),
							children: statusLabel(t, run.status)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsh-devloop-record-meta",
							children: [run.durationMs > 0 ? `${t("duration")} ${(run.durationMs / 1e3).toFixed(1)}s` : "", run.exitCode !== null ? ` · ${t("exit")} ${run.exitCode}` : ""]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					className: "dsh-devloop-output",
					children: run.output || t("emptyOutput")
				})]
			});
		}
		function formatAgo(ts) {
			const diff = Date.now() - ts;
			if (diff < 0) return "now";
			const secs = Math.floor(diff / 1e3);
			if (secs < 60) return `${secs}s ago`;
			const mins = Math.floor(secs / 60);
			if (mins < 60) return `${mins}m ago`;
			return `${Math.floor(mins / 60)}h ago`;
		}
		//#endregion
		//#region src/client/locales.ts
		const NS = "dsh-dev-loop";
		const zh = {
			open: "DevLoop",
			title: "开发循环",
			noConfig: "当前 workspace 没有 .dsh/devloop.yml",
			noWorkspace: "无法识别当前 workspace，请在面板中填写项目根路径",
			trustWarning: "命令完全来自当前 workspace 的 .dsh/devloop.yml。首次执行前请确认信任该项目的命令。",
			confirmTrust: "信任并执行",
			trusted: "已信任",
			notTrusted: "未信任",
			build: "Build",
			test: "Test",
			package: "Package",
			run: "Run",
			restart: "Run/Restart",
			stop: "Stop",
			openLogs: "Open logs",
			sendError: "Send last error to Agent",
			lastFail: "最近失败",
			noLastFail: "暂无失败记录",
			running: "运行中",
			succeeded: "通过",
			failed: "失败",
			cancelled: "已取消",
			idle: "未运行",
			duration: "耗时",
			exit: "退出码",
			output: "输出",
			emptyOutput: "（无输出）",
			copied: "已复制到剪贴板",
			loading: "加载中…",
			error: "错误",
			cancel: "取消",
			status: "状态",
			action: "动作",
			reset: "撤销信任",
			watch: "Watch",
			watchStart: "Start watch",
			watchStop: "Stop watch",
			watchPending: "pending",
			afterAgent: "After Agent",
			afterAgentOn: "on",
			afterAgentOff: "off",
			generatePreset: "Generate preset",
			presetName: "项目名（可选）",
			openDebrief: "打开战报"
		};
		const en = {
			open: "DevLoop",
			title: "Dev Loop",
			noConfig: "No .dsh/devloop.yml in the current workspace",
			noWorkspace: "Could not detect the current workspace; enter a project root below",
			trustWarning: "Commands come entirely from this workspace’s .dsh/devloop.yml. Confirm you trust this project before the first run.",
			confirmTrust: "Trust & run",
			trusted: "Trusted",
			notTrusted: "Not trusted",
			build: "Build",
			test: "Test",
			package: "Package",
			run: "Run",
			restart: "Run/Restart",
			stop: "Stop",
			openLogs: "Open logs",
			sendError: "Send last error to Agent",
			lastFail: "Last fail",
			noLastFail: "No failures yet",
			running: "running",
			succeeded: "PASS",
			failed: "FAIL",
			cancelled: "cancelled",
			idle: "idle",
			duration: "dur",
			exit: "exit",
			output: "Output",
			emptyOutput: "(no output)",
			copied: "copied to clipboard",
			loading: "Loading…",
			error: "Error",
			cancel: "Cancel",
			status: "Status",
			action: "Action",
			reset: "Revoke trust",
			watch: "Watch",
			watchStart: "Start watch",
			watchStop: "Stop watch",
			watchPending: "pending",
			afterAgent: "After Agent",
			afterAgentOn: "on",
			afterAgentOff: "off",
			generatePreset: "Generate preset",
			presetName: "Project name (optional)",
			openDebrief: "Open Debrief"
		};
		//#endregion
		//#region src/client/styles.ts
		function adoptStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("dsh-dev-loop-styles")) return;
			const style = document.createElement("style");
			style.id = "dsh-dev-loop-styles";
			style.textContent = `
.dsh-devloop-root { font: 13px/1.5 system-ui, sans-serif; }
.dsh-devloop-root * { box-sizing: border-box; }
.dsh-devloop-trigger {
  border: 1px solid var(--dv-border, rgba(128,128,128,.4));
  background: var(--dv-bg, transparent);
  color: var(--dv-fg, inherit);
  border-radius: 6px; padding: 4px 8px; cursor: pointer;
}
.dsh-devloop-trigger:hover { background: var(--dv-bg-hover, rgba(128,128,128,.12)); }
.dsh-devloop-panel {
  position: fixed; top: 64px; right: 24px; width: 460px; max-height: 80vh;
  background: var(--dv-panel, #fff); color: var(--dv-fg, #1a1a1a);
  border: 1px solid var(--dv-border, rgba(0,0,0,.15));
  border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.18);
  display: flex; flex-direction: column; z-index: 999;
  overflow: hidden;
}
.dsh-devloop-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--dv-border, rgba(0,0,0,.12));
}
.dsh-devloop-head-title { font-weight: 600; }
.dsh-devloop-close { border: none; background: none; cursor: pointer; font-size: 16px; opacity: .7; }
.dsh-devloop-body { padding: 12px 14px; overflow: auto; }
.dsh-devloop-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.dsh-devloop-action-btn {
  border: 1px solid var(--dv-border, rgba(0,0,0,.25));
  background: var(--dv-bg, #f5f5f5); color: var(--dv-fg, #1a1a1a);
  border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px;
}
.dsh-devloop-action-btn:hover:not(:disabled) { background: var(--dv-bg-hover, #e8e8e8); }
.dsh-devloop-action-btn:disabled { opacity: .5; cursor: default; }
.dsh-devloop-status-chip {
  display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px;
  margin-left: 6px; font-weight: 600;
}
.dsh-devloop-records { display: flex; flex-direction: column; gap: 8px; }
.dsh-devloop-record {
  border: 1px solid var(--dv-border, rgba(0,0,0,.12)); border-radius: 8px; padding: 8px 10px;
}
.dsh-devloop-record-head { display: flex; align-items: center; gap: 8px; }
.dsh-devloop-record-meta { font-size: 12px; color: var(--dv-muted, #777); }
.dsh-devloop-output {
  margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px; white-space: pre-wrap; word-break: break-word;
  background: var(--dv-code, #fafafa); border: 1px solid var(--dv-border, rgba(0,0,0,.1));
  border-radius: 6px; padding: 8px; max-height: 220px; overflow: auto;
}
.dsh-devloop-trust {
  border: 1px solid #c0392b55; background: #c0392b11; border-radius: 8px; padding: 10px; margin: 10px 0;
}
.dsh-devloop-notice { font-size: 12px; color: var(--dv-muted, #777); }
.dsh-devloop-watch {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  border: 1px solid var(--dv-border, rgba(0,0,0,.12)); border-radius: 8px;
  padding: 8px 10px; margin: 10px 0;
}
.dsh-devloop-watch-meta { font-size: 12px; color: var(--dv-muted, #777); }
.dsh-devloop-preset { margin: 10px 0; }
.dsh-devloop-preset-body {
  display: flex; flex-direction: column; gap: 8px; margin-top: 8px;
  border: 1px solid var(--dv-border, rgba(0,0,0,.12)); border-radius: 8px; padding: 10px;
}
.dsh-devloop-preset-text {
  width: 100%; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px;
  border: 1px solid var(--dv-border, rgba(0,0,0,.2)); border-radius: 6px; padding: 8px;
}
.dsh-devloop-root-input {
  width: 100%; margin-top: 8px; padding: 6px 8px; border: 1px solid var(--dv-border, rgba(0,0,0,.3));
  border-radius: 6px; font: inherit;
}
`;
		}
		//#endregion
		//#region src/client/index.tsx
		const inject = ["slots", "locale"];
		function DevLoopRow({ sessionId, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitEntryRow, {
				title: t("title"),
				subtitle: "Build · Test · Run",
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutline16, {}),
				onClick: () => openToolkitPanel("dsh-dev-loop")
			});
		}
		var PanelErrorBoundary = class extends react.Component {
			state = { error: null };
			static getDerivedStateFromError(error) {
				return { error };
			}
			render() {
				if (this.state.error) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						padding: 8,
						color: "#c0392b",
						fontSize: 12
					},
					children: ["DevLoop panel error: ", this.state.error.message]
				});
				return this.props.children;
			}
		};
		function apply(ctx) {
			adoptStyles();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-dev-loop: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => registerToolkitEntry({
				id: "dsh-dev-loop",
				category: "workspace",
				order: 30,
				title: t("title"),
				renderRow: (sessionId) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DevLoopRow, {
					sessionId,
					t
				}),
				renderQuick: () => null,
				renderPanel: (sessionId, onClose, context) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PanelErrorBoundary, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DevLoopPanel, {
					sessionId,
					t,
					useWorkspaces: context.useWorkspaces,
					onClose
				}) })
			}), "dsh-dev-loop: toolkit entry");
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "dsh-dev-loop",
				order: 20,
				locale: NS,
				inject: () => ({})
			}, (props) => {
				const shellReady = useToolkitShellReady();
				const [open, setOpen] = (0, react.useState)(false);
				if (shellReady) return null;
				const sessionId = props.sessionId ?? "";
				const useWorkspaces = props.useWorkspaces ?? ((_selector) => []);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					"data-dev-loop-root": true,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsh-devloop-trigger",
						onClick: () => setOpen((v) => !v),
						children: t("open")
					}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PanelErrorBoundary, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DevLoopPanel, {
						sessionId,
						t,
						useWorkspaces,
						onClose: () => setOpen(false)
					}) }) : null]
				});
			}));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
