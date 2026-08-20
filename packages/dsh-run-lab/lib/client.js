window.__ModuleLoader__.load({
	id: "dsh-run-lab",
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
		function openToolkitPanel(id) {
			setToolkitOpenId(id);
		}
		//#endregion
		//#region src/client/api.ts
		const API = "/plugins/dsh-run-lab/api";
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
		const runLabApi = {
			list(signal) {
				return call("list", {}, signal);
			},
			get(id, signal) {
				return call("get", { id }, signal);
			},
			create(input, signal) {
				return call("create", input, signal);
			},
			run(id, options, signal) {
				return call("run", {
					id,
					...options?.repeat ? { repeat: options.repeat } : {}
				}, signal);
			},
			delete(id, signal) {
				return call("delete", { id }, signal);
			},
			capabilities(signal) {
				return call("capabilities", {}, signal);
			}
		};
		//#endregion
		//#region src/client/Panel.tsx
		/**
		* Run Lab 面板：实验列表 / 新建 / 跑 A/B / 结果左右对照。
		*/
		const emptyDraft = {
			title: "",
			prompt: "",
			baseline: "",
			forceCopy: false,
			repeat: "1",
			aLabel: "Branch A",
			aAgentCommand: "",
			aEvaluatorCommand: "",
			bLabel: "Branch B",
			bAgentCommand: "",
			bEvaluatorCommand: ""
		};
		function Panel({ onClose, t }) {
			const [experiments, setExperiments] = (0, react.useState)([]);
			const [draft, setDraft] = (0, react.useState)(emptyDraft);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [expanded, setExpanded] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(async () => {
				const res = await runLabApi.list();
				if (res.ok) setExperiments(res.value);
			}, []);
			(0, react.useEffect)(() => {
				refresh().catch(() => setError("failed to load experiments"));
			}, [refresh]);
			const create = async () => {
				if (!draft.prompt.trim() || !draft.baseline.trim()) {
					setError("prompt and baseline are required");
					return;
				}
				setBusy(true);
				setError("");
				try {
					const repeat = Number(draft.repeat);
					const res = await runLabApi.create({
						title: draft.title || void 0,
						prompt: draft.prompt,
						baseline: draft.baseline,
						forceCopy: draft.forceCopy,
						repeat: Number.isInteger(repeat) && repeat > 0 ? repeat : void 0,
						branches: [{
							id: "a",
							label: draft.aLabel || "Branch A",
							agentCommand: draft.aAgentCommand || void 0,
							evaluator: draft.aEvaluatorCommand ? { command: draft.aEvaluatorCommand } : void 0
						}, {
							id: "b",
							label: draft.bLabel || "Branch B",
							agentCommand: draft.bAgentCommand || void 0,
							evaluator: draft.bEvaluatorCommand ? { command: draft.bEvaluatorCommand } : void 0
						}]
					});
					if (res.ok) {
						setDraft(emptyDraft);
						await refresh();
					} else setError(res.error.message);
				} finally {
					setBusy(false);
				}
			};
			const run = async (id) => {
				setBusy(true);
				setError("");
				try {
					const res = await runLabApi.run(id);
					if (res.ok) {
						setExpanded(id);
						await refresh();
					} else setError(res.error.message);
				} finally {
					setBusy(false);
				}
			};
			const remove = async (id) => {
				setBusy(true);
				setError("");
				try {
					const res = await runLabApi.delete(id);
					if (!res.ok) setError(res.error.message);
					await refresh();
				} finally {
					setBusy(false);
				}
			};
			experiments.find((e) => e.id === expanded);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ToolkitPanel, {
				title: t("title"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutline16, {}),
				status: t("subtitle"),
				onClose,
				summary: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
					value: experiments.length,
					label: t("list")
				}) }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "rl-grid",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "rl-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: t("prompt") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: draft.prompt,
								onChange: (e) => setDraft({
									...draft,
									prompt: e.target.value
								})
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "rl-field",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: t("baseline") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: draft.baseline,
									onChange: (e) => setDraft({
										...draft,
										baseline: e.target.value
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: draft.forceCopy,
									onChange: (e) => setDraft({
										...draft,
										forceCopy: e.target.checked
									})
								}), " force copy (non-git)"] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: t("repeat") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "number",
									min: "1",
									step: "1",
									value: draft.repeat,
									onChange: (e) => setDraft({
										...draft,
										repeat: e.target.value
									})
								})
							]
						})]
					}),
					["a", "b"].map((branch) => {
						const key = branch;
						const prefix = key.toUpperCase();
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "rl-grid",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "rl-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [
										t(branch === "a" ? "branchA" : "branchB"),
										" — ",
										t("label")
									] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										value: key === "a" ? draft.aLabel : draft.bLabel,
										onChange: (e) => setDraft({
											...draft,
											[key === "a" ? "aLabel" : "bLabel"]: e.target.value
										})
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "rl-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: t("agentCommand") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										value: key === "a" ? draft.aAgentCommand : draft.bAgentCommand,
										onChange: (e) => setDraft({
											...draft,
											[key === "a" ? "aAgentCommand" : "bAgentCommand"]: e.target.value
										})
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "rl-field",
									style: { gridColumn: "1 / -1" },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [
										t("evaluatorCommand"),
										" (",
										prefix,
										")"
									] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										value: key === "a" ? draft.aEvaluatorCommand : draft.bEvaluatorCommand,
										onChange: (e) => setDraft({
											...draft,
											[key === "a" ? "aEvaluatorCommand" : "bEvaluatorCommand"]: e.target.value
										})
									})]
								})
							]
						}, key);
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "rl-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "rl-btn",
							disabled: busy,
							onClick: () => void create(),
							children: t("create")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: draft.forceCopy,
							onChange: (e) => setDraft({
								...draft,
								forceCopy: e.target.checked
							})
						}), " force copy"] })]
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "rl-err",
						children: error
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: { marginTop: 16 },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "rl-sub",
								children: t("list")
							}),
							experiments.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("empty") }) : null,
							experiments.map((e) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "rl-card",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "rl-row",
									style: { justifyContent: "space-between" },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: e.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "rl-status",
										children: [
											e.id,
											" · ",
											t("status"),
											": ",
											e.status
										]
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "rl-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "rl-btn",
											disabled: busy,
											onClick: () => void run(e.id),
											children: t("run")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "rl-btn danger",
											disabled: busy,
											onClick: () => void remove(e.id),
											children: t("delete")
										})]
									})]
								}), expanded === e.id && e.result ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ResultView, { exp: e }) : null]
							}, e.id))
						]
					})
				]
			});
		}
		function ResultView({ exp }) {
			const result = exp.result;
			if (!result) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "rl-note",
				children: "not run yet"
			});
			const rows = Object.entries(result.comparison.metrics);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: { marginTop: 10 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "rl-row",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "rl-status",
							children: ["winner: ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: result.comparison.winner })]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "rl-grid",
						style: { marginTop: 8 },
						children: result.runs.map((run) => {
							const s = run.summary;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "rl-card",
								style: { margin: 0 },
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
										run.branch.toUpperCase(),
										" x",
										run.repeat
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "rl-status",
										children: [
											"success rate: ",
											Math.round(s.successRate * 100),
											"% (",
											s.successCount,
											"/",
											s.count,
											")"
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "rl-metrics",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "median wall" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: [s.medianWallTimeMs ?? "n/a", "ms"] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "median tools" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: s.medianToolCalls ?? "n/a" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "median tokens" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: s.medianTokens ?? "n/a" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "files" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: run.metrics.filesChanged ?? "n/a" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "diff" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: run.metrics.diffSize ?? "n/a" })
										]
									})
								]
							}, run.branch);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							marginTop: 8,
							fontSize: 12
						},
						children: rows.filter(([, v]) => v.a !== null || v.b !== null).map(([k, v]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "rl-status",
							children: [
								k,
								": A=",
								v.a ?? "n/a",
								" B=",
								v.b ?? "n/a",
								" (",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: v.better }),
								")"
							]
						}, k))
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** dsh-run-lab client 文案（en/zh）。 */
		const NS = "dsh-run-lab";
		const zh = {
			open: "实验比对",
			title: "Run Lab — Agent A/B 实验",
			subtitle: "同一任务，两个隔离工作区，客观对比。",
			list: "实验列表",
			new: "新建实验",
			prompt: "任务描述 (Prompt)",
			baseline: "基线工作区",
			repeat: "每分支重复次数",
			branchA: "分支 A",
			branchB: "分支 B",
			label: "名称",
			agentCommand: "Agent 命令（$WORKSPACE 占位）",
			evaluatorCommand: "Evaluator 命令",
			create: "创建",
			run: "跑 A/B",
			delete: "删除",
			loading: "加载中…",
			empty: "还没有实验。",
			status: "状态",
			winner: "胜者",
			success: "成功",
			wall: "耗时",
			files: "改动文件",
			diff: "Diff 大小",
			close: "关闭"
		};
		const en = {
			open: "Run Lab",
			title: "Run Lab — Agent A/B Experiments",
			subtitle: "Same task, two isolated workspaces, objective comparison.",
			list: "Experiments",
			new: "New experiment",
			prompt: "Prompt / task",
			baseline: "Baseline workspace",
			repeat: "Repeats per branch",
			branchA: "Branch A",
			branchB: "Branch B",
			label: "Label",
			agentCommand: "Agent command ($WORKSPACE placeholder)",
			evaluatorCommand: "Evaluator command",
			create: "Create",
			run: "Run A/B",
			delete: "Delete",
			loading: "Loading…",
			empty: "No experiments yet.",
			status: "Status",
			winner: "Winner",
			success: "Success",
			wall: "Wall time",
			files: "Files changed",
			diff: "Diff size",
			close: "Close"
		};
		//#endregion
		//#region src/client/styles.ts
		/** dsh-run-lab 面板样式（注入全局 DOM，前缀 rl- 防冲突）。 */
		let injected = false;
		function adoptStyles() {
			if (injected) return;
			injected = true;
			const style = document.createElement("style");
			style.textContent = `
.rl-footer-action{background:transparent;border:1px solid rgba(128,128,160,.35);border-radius:8px;
  color:inherit;padding:4px 10px;cursor:pointer;font-size:13px;white-space:nowrap}
.rl-footer-action:hover{border-color:#7aa2f7;color:#7aa2f7}
.rl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1200;
  display:flex;align-items:flex-start;justify-content:flex-end;padding:12px}
.rl-panel{background:#1b1e2b;color:#e6e6ee;border:1px solid #33385a;border-radius:12px;
  width:min(680px,92vw);max-height:88vh;overflow:auto;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.5)}
.rl-panel h3{margin:0 0 4px;font-size:16px}
.rl-panel .rl-sub{color:#9aa0b5;font-size:12px;margin-bottom:12px}
.rl-panel input,.rl-panel textarea{width:100%;box-sizing:border-box;background:#12141f;color:#e6e6ee;
  border:1px solid #33385a;border-radius:6px;padding:6px 8px;margin:4px 0 10px;font:inherit}
.rl-panel textarea{min-height:60px;resize:vertical}
.rl-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rl-field label{font-size:11px;color:#9aa0b5;display:block;margin-bottom:2px}
.rl-btn{background:#2a3c8f;color:#fff;border:none;border-radius:6px;padding:7px 12px;cursor:pointer;font-size:13px}
.rl-btn:hover{background:#3550b0}
.rl-btn.secondary{background:#33385a}
.rl-btn.danger{background:#7a2a2a}
.rl-row{display:flex;gap:8px;align-items:center}
.rl-card{background:#12141f;border:1px solid #2a2f4a;border-radius:8px;padding:10px;margin-bottom:8px}
.rl-card .rl-status{font-size:11px;color:#9aa0b5}
.rl-metrics{display:grid;grid-template-columns:repeat(2,auto);gap:2px 16px;font-size:12px;margin-top:6px}
.rl-metrics b{color:#9fd1ff}
.rl-err{color:#ff8080;font-size:12px;white-space:pre-wrap}
.rl-note{color:#c9a86a;font-size:11px}
`;
			document.head.appendChild(style);
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* dsh-run-lab client half.
		* Registers a Toolkit entry; falls back to the sidebar footer action when the
		* Toolkit shell is absent.
		*/
		const inject = ["slots", "locale"];
		function RunLabRow({ sessionId, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitEntryRow, {
				title: t("title"),
				subtitle: "Agent A/B experiments",
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutline16, {}),
				onClick: () => openToolkitPanel("dsh-run-lab")
			});
		}
		function apply(ctx) {
			adoptStyles();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-run-lab: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => registerToolkitEntry({
				id: "dsh-run-lab",
				category: "experiment",
				order: 10,
				title: t("title"),
				renderRow: (sessionId) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RunLabRow, {
					sessionId,
					t
				}),
				renderQuick: () => null,
				renderPanel: (_sessionId, onClose) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Panel, {
					onClose,
					t
				})
			}), "dsh-run-lab: toolkit entry");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-run-lab",
				order: 20,
				locale: NS,
				inject: () => ({})
			}, (props) => {
				const shellReady = useToolkitShellReady();
				const [open, setOpen] = (0, react.useState)(false);
				if (shellReady) return null;
				const { t: tt } = props;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					"data-runlab-root": true,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rl-footer-action",
						onClick: () => setOpen((v) => !v),
						children: props.wide ? tt("open") : "🧪"
					}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Panel, {
						onClose: () => setOpen(false),
						t: tt
					}) : null]
				});
			}));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
