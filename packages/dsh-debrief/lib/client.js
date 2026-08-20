window.__ModuleLoader__.load({
	id: "dsh-debrief",
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
		function ToolkitPanel({ title, icon, status, onClose, summary, children, footer, className }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `dsh-tk dsh-tk-panel${className ? ` ${className}` : ""}`,
				role: "dialog",
				"aria-label": title,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-tk-panel-header",
						children: [
							icon ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-tk-panel-header-icon",
								children: icon
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-tk-panel-header-title",
								children: title
							}),
							status ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-tk-panel-header-status",
								children: status
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-tk-panel-header-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									size: "sm",
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, {}),
									onClick: onClose,
									"aria-label": "Close"
								})
							})
						]
					}),
					summary ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-tk-panel-summary",
						children: summary
					}) : null,
					children ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-tk-panel-content",
						children
					}) : null,
					footer ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-tk-panel-footer",
						children: footer
					}) : null
				]
			});
		}
		function Metric({ value, label }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-tk-metric",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsh-tk-metric-value",
					children: value
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsh-tk-metric-label",
					children: label
				})]
			});
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
		function ToolkitQuickAction({ title, icon, metric, state, onClick }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "dsh-tk-toolbar-item",
				onClick,
				title: typeof title === "string" ? title : void 0,
				children: [
					icon ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-tk-toolbar-icon",
						children: icon
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-tk-toolbar-label",
						children: title
					}),
					state ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
						state,
						size: 8
					}) : null,
					metric ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
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
		//#region src/client/locales.ts
		/** dsh-debrief client locale. */
		const NS = "dsh-debrief";
		const zh = {
			openPanel: "战报",
			close: "关闭",
			title: "Mission Debrief",
			turnTitle: "本轮战报",
			sessionTitle: "会话战报",
			duration: "耗时",
			turns: "轮数",
			steps: "Steps",
			assistantMessages: "模型消息",
			toolCalls: "工具调用",
			commands: "命令",
			failedCommands: "失败命令",
			changedFiles: "修改文件",
			filesRead: "读取文件",
			testsPassed: "测试通过",
			testsFailed: "测试失败",
			testsUnknown: "测试未知",
			errors: "错误",
			tokensIn: "Tokens in",
			tokensOut: "Tokens out",
			tokensCacheRead: "Cache read",
			tokensCacheWrite: "Cache write",
			tokensTotal: "总 tokens",
			contextWindow: "上下文窗口",
			slowestTool: "最长工具调用",
			rowsPerTool: "按工具",
			unresolved: "未解决",
			none: "无",
			unavailable: "不可用",
			viewChanges: "查看改动",
			viewFiles: "查看文件",
			viewFailed: "查看失败命令",
			collapseFiles: "收起文件",
			collapseFailed: "收起失败命令",
			copySummary: "复制摘要",
			continueWork: "继续未完成的工作",
			draftInserted: "已插入草稿",
			copied: "已复制",
			loading: "加载中…",
			error: "加载失败",
			refresh: "刷新",
			perTool: "按工具分类",
			unknown: "未知",
			sessionOnly: "仅会话结束",
			triggerOff: "关闭",
			everyN: "每 N 轮",
			onCompletion: "完成时",
			triggerLabel: "触发",
			lastTurn: "最后一轮",
			noEvents: "暂无事件",
			notes: "数据说明",
			openTimeMachine: "在时间机器中查看",
			openXray: "在 X-Ray 中查看"
		};
		const en = {
			openPanel: "Debrief",
			close: "Close",
			title: "Mission Debrief",
			turnTitle: "Turn Debrief",
			sessionTitle: "Session Debrief",
			duration: "Duration",
			turns: "Turns",
			steps: "Steps",
			assistantMessages: "Model messages",
			toolCalls: "Tool calls",
			commands: "Commands",
			failedCommands: "Failed commands",
			changedFiles: "Files changed",
			filesRead: "Files read",
			testsPassed: "Tests passed",
			testsFailed: "Tests failed",
			testsUnknown: "Tests unknown",
			errors: "Errors",
			tokensIn: "Tokens in",
			tokensOut: "Tokens out",
			tokensCacheRead: "Cache read",
			tokensCacheWrite: "Cache write",
			tokensTotal: "Tokens total",
			contextWindow: "Context window",
			slowestTool: "Slowest tool call",
			rowsPerTool: "By tool",
			unresolved: "Unresolved",
			none: "None",
			unavailable: "Unavailable",
			viewChanges: "View changes",
			viewFiles: "View files",
			viewFailed: "View failed commands",
			collapseFiles: "Collapse files",
			collapseFailed: "Collapse failed commands",
			copySummary: "Copy summary",
			continueWork: "Continue unfinished work",
			draftInserted: "Draft inserted",
			copied: "Copied",
			loading: "Loading…",
			error: "Failed to load",
			refresh: "Refresh",
			perTool: "Per-tool stats",
			unknown: "Unknown",
			sessionOnly: "Session only",
			triggerOff: "Off",
			everyN: "Every N turns",
			onCompletion: "On completion",
			triggerLabel: "Trigger",
			lastTurn: "Last turn",
			noEvents: "No events",
			notes: "Data notes",
			openTimeMachine: "Open in Time Machine",
			openXray: "Open in X-Ray"
		};
		//#endregion
		//#region src/client/styles.ts
		/** dsh-debrief client styles, injected once via ctx.effect. */
		function adoptStyles() {
			if (document.getElementById("dsh-debrief-styles")) return;
			const style = document.createElement("style");
			style.id = "dsh-debrief-styles";
			style.textContent = `
.dsh-debrief-root { font-size: 12px; line-height: 1.45; color: var(--text-1, #e6e6e6); }
.dsh-debrief-card { border: 1px solid var(--border, rgba(128,128,128,.25)); border-radius: 8px; padding: 6px 8px; margin: 4px 0 10px; background: var(--bg-2, rgba(255,255,255,.02)); }
.dsh-debrief-card-title { font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.dsh-debrief-card-toggle, .dsh-debrief-card-close { background: transparent; border: 0; color: var(--text-2, #9a9a9a); cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; }
.dsh-debrief-card-toggle:hover, .dsh-debrief-card-close:hover { color: var(--text-1, #e6e6e6); }
.dsh-debrief-card-close { margin-left: auto; font-size: 16px; }
.dsh-debrief-metric { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
.dsh-debrief-metric-label { color: var(--text-2, #9a9a9a); }
.dsh-debrief-metric-value { font-variant-numeric: tabular-nums; text-align: right; }
.dsh-debrief-section-title { margin-top: 8px; font-weight: 600; color: var(--text-1, #e6e6e6); }
.dsh-debrief-empty { color: var(--text-3, #777); }
.dsh-debrief-list { margin: 2px 0 0; padding-left: 16px; max-height: 140px; overflow: auto; }
.dsh-debrief-list-item { display: flex; gap: 6px; align-items: baseline; word-break: break-all; }
.dsh-debrief-tag { font-size: 10px; border-radius: 3px; padding: 0 3px; white-space: nowrap; }
.dsh-debrief-tag-exact { background: rgba(80,160,80,.18); color: #7bc47b; }
.dsh-debrief-tag-est { background: rgba(200,160,60,.18); color: #d9b04a; }
.dsh-debrief-exit { font-size: 10px; border-radius: 3px; padding: 0 3px; white-space: nowrap; }
.dsh-debrief-exit-ok { background: rgba(80,160,80,.15); color: #7bc47b; }
.dsh-debrief-exit-bad { background: rgba(200,80,80,.18); color: #e07a7a; }
.dsh-debrief-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.dsh-debrief-table th, .dsh-debrief-table td { text-align: left; padding: 1px 4px; border-bottom: 1px solid var(--border, rgba(128,128,128,.12)); }
.dsh-debrief-tests { font-weight: 600; }
.dsh-debrief-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.dsh-debrief-actions button { font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border, rgba(128,128,128,.3)); background: transparent; color: var(--text-1, #e6e6e6); cursor: pointer; }
.dsh-debrief-actions button:hover { background: rgba(128,128,128,.12); }
.dsh-debrief-trigger { border: 1px solid var(--border, rgba(128,128,128,.25)); border-radius: 8px; padding: 6px 8px; margin: 2px 0 10px; background: var(--bg-2, rgba(255,255,255,.02)); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.dsh-debrief-panel { border: 1px solid var(--border, rgba(128,128,128,.3)); border-radius: 10px; padding: 10px; min-width: 320px; max-width: 460px; background: var(--bg-1, #1b1b1b); }
.dsh-debrief-panel-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.dsh-debrief-panel-toolbar h3 { margin: 0; flex: 1; }
.dsh-debrief-note { color: var(--text-3, #999); font-size: 11px; margin-top: 6px; }
.dsh-debrief-scroll { max-height: 60vh; overflow: auto; padding-right: 4px; }
`;
			document.head.appendChild(style);
		}
		//#endregion
		//#region src/client/api.ts
		const API = "/plugins/dsh-debrief/api";
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
		const debriefApi = {
			turn(sessionId, turn, signal) {
				return call("turn", {
					sessionId,
					turn
				}, signal);
			},
			session(sessionId, signal) {
				return call("session", { sessionId }, signal);
			},
			turns(sessionId, signal) {
				return call("turns", { sessionId }, signal);
			},
			settings(signal) {
				return call("settings", {}, signal);
			}
		};
		//#endregion
		//#region src/core/format.ts
		/** Small pure formatting helpers shared by the client UI (and unit tests). */
		function formatDuration(ms) {
			if (!Number.isFinite(ms) || ms < 0) return "—";
			if (ms < 1e3) return `${Math.round(ms)}ms`;
			const seconds = ms / 1e3;
			if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`;
			const minutes = Math.floor(seconds / 60);
			const rest = Math.round(seconds % 60);
			return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
		}
		function formatTokens(n) {
			if (n === null || n === void 0 || !Number.isFinite(n)) return "—";
			if (n < 1e3) return String(n);
			if (n < 1e6) return `${Math.round(n / 100) / 10}k`;
			return `${Math.round(n / 1e5) / 10}M`;
		}
		//#endregion
		//#region src/core/actions.ts
		const DEFAULT_OPTIONS = {
			maxUnresolved: 8,
			maxFailedCommands: 6,
			maxChangedFiles: 6,
			maxChars: 1600
		};
		function truncate(text, maxChars) {
			if (text.length <= maxChars) return text;
			return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
		}
		function fileLine(file) {
			return `- ${file.path}${file.kind !== "unknown" ? ` (${file.kind})` : ""}`;
		}
		function unresolvedLine(item) {
			if (item.detail && item.detail !== item.label) return `- ${item.label}（${item.detail}）`;
			return `- ${item.label}`;
		}
		/**
		* Build a bounded "continue unresolved" prompt draft ready to insert into the
		* composer. It only lists evidence already computed by the debrief; it never
		* instructs the model to perform a destructive or automatic action on its own.
		*/
		function buildContinuePrompt(debrief, options = {}) {
			const opts = {
				...DEFAULT_OPTIONS,
				...options
			};
			const lines = [];
			if (debrief.kind === "session") lines.push(`会话战报（${debrief.turnCount} 轮）`);
			else lines.push(`第 ${debrief.turn} 轮战报`);
			lines.push(`耗时 ${formatDuration(debrief.durationMs)}，命令 ${debrief.commandCount} 条`);
			const failed = debrief.failedCommands.slice(0, opts.maxFailedCommands);
			if (failed.length > 0) {
				lines.push("");
				lines.push("失败命令：");
				for (const cmd of failed) {
					const code = cmd.exitCode === null ? "无 exit code" : `exit ${cmd.exitCode}`;
					lines.push(`- ${cmd.command} (${code})`);
				}
			}
			const unresolved = debrief.unresolved.slice(0, opts.maxUnresolved);
			if (unresolved.length > 0) {
				lines.push("");
				lines.push("未解决项：");
				for (const item of unresolved) lines.push(unresolvedLine(item));
			}
			const files = debrief.changedFiles.slice(0, opts.maxChangedFiles);
			if (files.length > 0) {
				lines.push("");
				lines.push("相关文件：");
				for (const file of files) lines.push(fileLine(file));
			}
			lines.push("");
			lines.push("请先检查以上各项的当前状态，再继续处理；不要重复执行已经成功的步骤，也不要擅自执行有风险的操作。");
			return truncate(lines.join("\n"), opts.maxChars);
		}
		/** Build a plain-text summary (used by the Copy action). */
		function summarizeDebrief(d) {
			const lines = [];
			lines.push(d.kind === "turn" ? `Turn ${d.turn} Debrief` : "Session Debrief");
			lines.push(`Duration: ${formatDuration(d.durationMs)}`);
			if (d.kind === "session") lines.push(`Turns: ${d.turnCount}`);
			lines.push(`Steps: ${d.stepCount}  Tool calls: ${d.toolCallCount}  Commands: ${d.commandCount}`);
			if (d.tokens.usageReports > 0) lines.push(`Tokens in: ${formatTokens(d.tokens.inputTokens)}  out: ${formatTokens(d.tokens.outputTokens)}`);
			if (d.changedFiles.length > 0) lines.push(`Changed files: ${d.changedFiles.map((f) => f.path).join(", ")}`);
			if (d.tests.length > 0) {
				const passed = d.tests.filter((t) => t.status === "passed").length;
				const failed = d.tests.filter((t) => t.status === "failed").length;
				const unknown = d.tests.filter((t) => t.status === "unknown").length;
				const bits = [`${passed} passed`, `${failed} failed`];
				if (unknown > 0) bits.push(`${unknown} unknown`);
				lines.push(`Tests: ${bits.join(", ")}`);
			}
			if (d.failedCommands.length > 0) lines.push(`Failed commands: ${d.failedCommands.map((c) => c.command).join("; ")}`);
			if (d.unresolved.length > 0) lines.push(`Unresolved: ${d.unresolved.map((u) => u.detail).join("; ")}`);
			return lines.join("\n");
		}
		//#endregion
		//#region src/client/components/shared.tsx
		function MetricRow({ label, value }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-debrief-metric",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsh-debrief-metric-label",
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsh-debrief-metric-value",
					children: value
				})]
			});
		}
		function SectionTitle({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsh-debrief-section-title",
				children
			});
		}
		function EmptyNote({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsh-debrief-empty",
				children
			});
		}
		/** Render changed files with a simple list. */
		function ChangedFilesList({ files, limit }) {
			const shown = limit !== void 0 ? files.slice(0, limit) : files;
			if (shown.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyNote, { children: "—" });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dsh-debrief-list",
				children: shown.map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
					className: "dsh-debrief-list-item",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `dsh-debrief-tag dsh-debrief-tag-${file.structured ? "exact" : "est"}`,
						children: file.kind
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: file.path })]
				}, file.path))
			});
		}
		function CommandList({ commands, limit }) {
			const shown = limit !== void 0 ? commands.slice(0, limit) : commands;
			if (shown.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyNote, { children: "—" });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dsh-debrief-list",
				children: shown.map((cmd) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
					className: "dsh-debrief-list-item",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `dsh-debrief-exit dsh-debrief-exit-${cmd.exitCode === 0 ? "ok" : "bad"}`,
						children: cmd.exitCode === null ? "?" : `exit ${cmd.exitCode}`
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: cmd.command })]
				}, cmd.callId))
			});
		}
		function ToolTable({ stats }) {
			if (stats.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyNote, { children: "—" });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
				className: "dsh-debrief-table",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "tool" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "calls" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "err" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "total" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "slowest" })
				] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: stats.map((stat) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: stat.name }) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: stat.callCount }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: stat.errorCount }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: formatDuration(stat.totalDurationMs) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: stat.slowestCallMs === null ? "—" : formatDuration(stat.slowestCallMs) })
				] }, stat.name)) })]
			});
		}
		function UnresolvedList({ items, limit }) {
			const shown = limit !== void 0 ? items.slice(0, limit) : items;
			if (shown.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyNote, { children: "—" });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dsh-debrief-list",
				children: shown.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
					className: "dsh-debrief-list-item dsh-debrief-unresolved",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: item.detail })
				}, `${item.label}-${index}`))
			});
		}
		function TestSummary({ tests }) {
			if (tests.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyNote, { children: "—" });
			const passed = tests.filter((t) => t.status === "passed").length;
			const failed = tests.filter((t) => t.status === "failed").length;
			const unknown = tests.filter((t) => t.status === "unknown").length;
			const parts = [];
			if (passed > 0) parts.push(`✅ ${passed}`);
			if (failed > 0) parts.push(`❌ ${failed}`);
			if (unknown > 0) parts.push(`? ${unknown}`);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsh-debrief-tests",
				children: parts.join("  ")
			});
		}
		//#endregion
		//#region src/client/components/DebriefBody.tsx
		/** Shared body for a turn or session debrief (used by card and panel). */
		function DebriefBody({ debrief, t, onContinue }) {
			const [copied, setCopied] = (0, react.useState)(false);
			const [showAllFiles, setShowAllFiles] = (0, react.useState)(false);
			const [showAllFailed, setShowAllFailed] = (0, react.useState)(false);
			const [draftInserted, setDraftInserted] = (0, react.useState)(false);
			const copy = async () => {
				try {
					await navigator.clipboard.writeText(summarizeDebrief(debrief));
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {}
			};
			const continueDraft = () => {
				if (!onContinue) return;
				onContinue(buildContinuePrompt(debrief));
				setDraftInserted(true);
				setTimeout(() => setDraftInserted(false), 1500);
			};
			const changedCount = debrief.changedFiles.length;
			const failedCount = debrief.failedCommands.length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-debrief-root",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
						label: t("duration"),
						value: formatDuration(debrief.durationMs)
					}),
					debrief.kind === "session" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
						label: t("turns"),
						value: debrief.turnCount
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
						label: t("steps"),
						value: debrief.stepCount
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
						label: t("toolCalls"),
						value: debrief.toolCallCount
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
						label: t("commands"),
						value: debrief.commandCount
					}),
					debrief.tokens.usageReports > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
							label: t("tokensIn"),
							value: formatTokens(debrief.tokens.inputTokens)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
							label: t("tokensOut"),
							value: formatTokens(debrief.tokens.outputTokens)
						}),
						debrief.tokens.cacheReadTokens > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
							label: t("tokensCacheRead"),
							value: formatTokens(debrief.tokens.cacheReadTokens)
						}) : null,
						debrief.tokens.cacheWriteTokens > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
							label: t("tokensCacheWrite"),
							value: formatTokens(debrief.tokens.cacheWriteTokens)
						}) : null,
						debrief.tokens.contextWindow !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
							label: t("contextWindow"),
							value: formatTokens(debrief.tokens.contextWindow)
						}) : null
					] }) : null,
					debrief.tests.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, { children: t("testsPassed") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TestSummary, { tests: debrief.tests })] }) : null,
					changedCount > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SectionTitle, { children: [
						t("changedFiles"),
						" (",
						changedCount,
						")"
					] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChangedFilesList, {
						files: debrief.changedFiles,
						limit: showAllFiles ? void 0 : 8
					})] }) : null,
					debrief.filesRead.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SectionTitle, { children: [
						t("filesRead"),
						" (",
						debrief.filesRead.length,
						")"
					] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: "dsh-debrief-list",
						children: debrief.filesRead.slice(0, showAllFiles ? void 0 : 8).map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: "dsh-debrief-list-item",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-debrief-tag dsh-debrief-tag-est",
								children: file.toolName
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: file.path })]
						}, `${file.toolName}:${file.path}`))
					})] }) : null,
					failedCount > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SectionTitle, { children: [
						t("failedCommands"),
						" (",
						failedCount,
						")"
					] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CommandList, {
						commands: debrief.failedCommands,
						limit: showAllFailed ? void 0 : 6
					})] }) : null,
					debrief.toolStats.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, { children: t("perTool") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolTable, { stats: debrief.toolStats })] }) : null,
					debrief.unresolved.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, { children: t("unresolved") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UnresolvedList, {
						items: debrief.unresolved,
						limit: showAllFailed ? void 0 : 6
					})] }) : null,
					debrief.notes.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-debrief-note",
						children: debrief.notes.map((note) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: ["• ", note] }, note))
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-debrief-actions",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void copy(),
								children: copied ? t("copied") : t("copySummary")
							}),
							changedCount > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setShowAllFiles((v) => !v),
								children: showAllFiles ? t("collapseFiles") : t("viewFiles")
							}) : null,
							failedCount > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setShowAllFailed((v) => !v),
								children: showAllFailed ? t("collapseFailed") : t("viewFailed")
							}) : null,
							debrief.unresolved.length > 0 && onContinue ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: continueDraft,
								children: draftInserted ? t("draftInserted") : t("continueWork")
							}) : null
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/components/CrossPluginButtons.tsx
		const PROBES = {
			"dsh-time-machine": {
				path: "/plugins/dsh-time-machine/api/timeline",
				body: {}
			},
			"dsh-context-xray": {
				path: "/plugins/dsh-context-xray/api/sessions",
				body: {}
			},
			"dsh-debrief": {
				path: "/plugins/dsh-debrief/api/settings",
				body: {}
			},
			"dsh-output-gallery": {
				path: "/plugins/dsh-output-gallery/api/sessions",
				body: {}
			},
			"dsh-dev-loop": {
				path: "/plugins/dsh-dev-loop/api/summary",
				body: {}
			},
			"dsh-run-lab": {
				path: "/plugins/dsh-run-lab/api/list",
				body: {}
			}
		};
		async function probe(id) {
			try {
				return (await fetch(PROBES[id].path, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(PROBES[id].body)
				})).status !== 404;
			} catch {
				return false;
			}
		}
		function clickByText(keywords) {
			const target = [...document.querySelectorAll("button")].find((b) => {
				const text = (b.textContent ?? "").trim();
				return keywords.some((k) => text.includes(k));
			});
			if (target) {
				target.click();
				return true;
			}
			return false;
		}
		function CrossPluginButtons({ t, showTimeMachine = false, showXray = false, showDebrief = false }) {
			const [available, setAvailable] = (0, react.useState)({});
			(0, react.useEffect)(() => {
				const run = async () => {
					const next = {};
					if (showTimeMachine) next["timeMachine"] = await probe("dsh-time-machine");
					if (showXray) next["xray"] = await probe("dsh-context-xray");
					if (showDebrief) next["debrief"] = await probe("dsh-debrief");
					setAvailable(next);
				};
				run();
			}, [
				showTimeMachine,
				showXray,
				showDebrief
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "dsh-debrief-cross",
				style: {
					display: "inline-flex",
					gap: 6,
					flexWrap: "wrap"
				},
				children: [available["timeMachine"] ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => void clickByText(["时间机器", "Time Machine"]),
					children: t("openTimeMachine")
				}) : null, available["xray"] ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => void clickByText(["上下文", "Context"]),
					children: t("openXray")
				}) : null]
			});
		}
		//#endregion
		//#region src/client/components/TurnCard.tsx
		/** Compact turn debrief card rendered in the `conversation.chat.turnTail` slot. */
		function TurnCard({ sessionId, turn, t, defaultCollapsed = false, onContinue }) {
			const [debrief, setDebrief] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [collapsed, setCollapsed] = (0, react.useState)(defaultCollapsed);
			const [dismissed, setDismissed] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let cancelled = false;
				const controller = new AbortController();
				debriefApi.turn(sessionId, turn, controller.signal).then((res) => {
					if (cancelled) return;
					if (res.ok) setDebrief(res.value);
					else setError(res.error.message);
				}).catch((err) => {
					if (!cancelled) setError(err instanceof Error ? err.message : String(err));
				});
				return () => {
					cancelled = true;
					controller.abort();
				};
			}, [sessionId, turn]);
			if (error) return null;
			if (!debrief) return null;
			if (dismissed) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-debrief-card",
				"data-debrief-turn": debrief.turn,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-debrief-card-title",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-debrief-card-toggle",
							onClick: () => setCollapsed((v) => !v),
							children: collapsed ? "▸" : "▾"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							t("title"),
							" · ",
							t("turnTitle"),
							" #",
							debrief.turn
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-debrief-card-close",
							title: t("close"),
							onClick: () => setDismissed(true),
							children: "×"
						})
					]
				}), !collapsed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DebriefBody, {
					debrief,
					t,
					onContinue
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CrossPluginButtons, {
					t,
					showTimeMachine: true,
					showXray: true
				})] }) : null]
			});
		}
		//#endregion
		//#region src/client/components/SessionPanel.tsx
		/** Session debrief panel opened from the session header action. */
		function SessionPanel({ sessionId, t, onClose, onContinue }) {
			const [debrief, setDebrief] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setError(null);
				try {
					const res = await debriefApi.session(sessionId);
					if (res.ok) setDebrief(res.value);
					else setError(res.error.message);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, [sessionId]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ToolkitPanel, {
				title: t("sessionTitle"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutline16, {}),
				onClose,
				summary: debrief ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
						value: debrief.turnCount,
						label: t("turns")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
						value: debrief.toolCallCount,
						label: t("toolCalls")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
						value: debrief.commandCount,
						label: t("commands")
					})
				] }) : void 0,
				children: [
					loading && !debrief ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("loading") }) : null,
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-debrief-note",
						style: { color: "var(--dsw-alias-state-error-primary)" },
						children: error
					}) : null,
					debrief ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-debrief-scroll",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DebriefBody, {
							debrief,
							t,
							onContinue
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CrossPluginButtons, {
							t,
							showTimeMachine: true,
							showXray: true
						})]
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* dsh-debrief client half.
		*
		* Registers:
		*  - `conversation.chat.turnTail` (chain): compact debrief card after closed turns.
		*  - `conversation.session.header.actions` (list): fallback header button; hidden
		*    when the Toolkit shell is present.
		*  - A Toolkit entry for the unified Developer Toolkit navigation.
		*/
		const inject = ["slots", "locale"];
		/** Whether a closed turn should surface a card under the user's trigger setting. */
		function shouldShowTurn(settings, turn) {
			switch (settings.triggerMode) {
				case "off": return false;
				case "session-only": return true;
				case "on-completion": return true;
				case "every-n-turns": return turn % (settings.turnInterval > 0 ? settings.turnInterval : 1) === 0;
				default: return false;
			}
		}
		/** Whether a card should render collapsed by default (low-interference modes). */
		function defaultCollapsedFor(settings) {
			return settings.triggerMode === "session-only" || settings.triggerMode === "on-completion";
		}
		/** A controlled settings holder so the turn-tail card can wait for settings. */
		function useDebriefSettings() {
			const [settings, setSettings] = (0, react.useState)(null);
			const FALLBACK = {
				triggerMode: "off",
				turnInterval: 1,
				testCommandPatterns: [],
				detectTodoMarkers: true
			};
			(0, react.useEffect)(() => {
				let cancelled = false;
				debriefApi.settings().then((res) => {
					if (cancelled) return;
					setSettings(res.ok ? res.value : FALLBACK);
				}).catch(() => {
					if (!cancelled) setSettings(FALLBACK);
				});
				return () => {
					cancelled = true;
				};
			}, []);
			return settings;
		}
		function DebriefQuick({ sessionId, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitQuickAction, {
				title: t("openPanel"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutline16, {}),
				onClick: () => openToolkitPanel("dsh-debrief")
			});
		}
		function DebriefRow({ sessionId, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitEntryRow, {
				title: t("title"),
				subtitle: "Mission debrief",
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutline16, {}),
				onClick: () => openToolkitPanel("dsh-debrief")
			});
		}
		function apply(ctx) {
			adoptStyles();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-debrief: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				priority: 100,
				locale: NS,
				select: (owner) => {
					if (owner.turn?.status !== "closed") return null;
					return { closed: true };
				}
			}, (props) => {
				const settings = useDebriefSettings();
				const sessionId = props.sessionId;
				const turn = props.turn?.turn ?? 0;
				if (!settings) return null;
				if (!shouldShowTurn(settings, turn)) return null;
				const onContinue = (draft) => props.inputActions.setDraft(draft);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TurnCard, {
					sessionId,
					turn,
					t: props.t,
					defaultCollapsed: defaultCollapsedFor(settings),
					onContinue
				});
			}));
			ctx.effect(() => registerToolkitEntry({
				id: "dsh-debrief",
				category: "observe",
				order: 20,
				title: t("title"),
				quick: true,
				renderRow: (sessionId) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DebriefRow, {
					sessionId,
					t
				}),
				renderQuick: (sessionId) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DebriefQuick, {
					sessionId,
					t
				}),
				renderPanel: (sessionId, onClose, context) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionPanel, {
					sessionId,
					t,
					onClose,
					onContinue: (draft) => context.inputActions?.setDraft?.(draft)
				})
			}), "dsh-debrief: toolkit entry");
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "dsh-debrief",
				order: 10,
				locale: NS,
				inject: () => ({})
			}, (props) => {
				const shellReady = useToolkitShellReady();
				const [open, setOpen] = (0, react.useState)(false);
				if (shellReady) return null;
				const sessionId = props.sessionId;
				const onContinue = (draft) => props.inputActions.setDraft(draft);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					"data-debrief-root": true,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setOpen((v) => !v),
						children: t("openPanel")
					}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionPanel, {
						sessionId,
						t,
						onClose: () => setOpen(false),
						onContinue
					}) : null]
				});
			}));
		}
		//#endregion
		exports.apply = apply;
		exports.defaultCollapsedFor = defaultCollapsedFor;
		exports.inject = inject;
		exports.shouldShowTurn = shouldShowTurn;
		return module.exports;
	}
});
