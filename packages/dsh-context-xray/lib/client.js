window.__ModuleLoader__.load({
	id: "dsh-context-xray",
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
		//#region src/core/turn-diff/diff.ts
		const CATEGORY_EXPLANATION_KEYS = {
			system: "delta.system",
			conversation: "delta.conversation",
			tools: "delta.tools",
			skills: "delta.skills",
			memory: "delta.memory",
			workspace: "delta.workspace",
			attachments: "delta.attachments",
			other: "delta.other"
		};
		function explanationKeyForCategory(key) {
			return CATEGORY_EXPLANATION_KEYS[key] ?? "delta.other";
		}
		function categoryMap(entries) {
			return new Map(entries.map((entry) => [entry.key, entry]));
		}
		function diffTurns(prev, next) {
			const prevMap = categoryMap(prev?.categories ?? []);
			const deltas = next.categories.map((entry) => {
				const prevTokens = prevMap.get(entry.key)?.tokens ?? 0;
				return {
					key: entry.key,
					label: entry.label,
					tokens: entry.tokens,
					delta: entry.tokens - prevTokens,
					explanationKey: explanationKeyForCategory(entry.key)
				};
			});
			return {
				deltas,
				totalDelta: deltas.reduce((sum, d) => sum + d.delta, 0),
				majorGain: deltas.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3).map((d) => `${d.delta >= 1e3 ? `${(d.delta / 1e3).toFixed(1)}k` : d.delta} ${d.label.toLowerCase()}`)
			};
		}
		function formatTokens(value) {
			if (value >= 1e3) {
				const scaled = value / 1e3;
				return `${Number.isInteger(scaled) ? Math.round(scaled) : scaled.toFixed(1)}k`;
			}
			return String(value);
		}
		function formatSignedTokens(value) {
			if (value === 0) return "±0";
			return `${value > 0 ? "+" : "-"}${formatTokens(Math.abs(value))}`;
		}
		//#endregion
		//#region src/client/api.ts
		const API = "/plugins/dsh-context-xray/api";
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
		const xrayApi = {
			snapshot(sessionId, includeBody = false, signal) {
				return call("snapshot", {
					sessionId,
					includeBody
				}, signal);
			},
			history(sessionId, signal) {
				return call("history", { sessionId }, signal);
			},
			clear(sessionId) {
				return call("clear", { sessionId }, void 0);
			},
			diagnostic(sessionId, signal) {
				return call("diagnostic", { sessionId }, signal);
			}
		};
		//#endregion
		//#region src/client/components/Breakdown.tsx
		function Breakdown({ snapshot, t }) {
			const total = snapshot.categories.reduce((sum, c) => sum + c.tokens, 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-xray-breakdown": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("categories") }),
					snapshot.categories.map((cat) => {
						const share = total > 0 ? Math.round(cat.tokens / total * 1e3) / 10 : 0;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "xray-category-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: cat.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								formatTokens(cat.tokens),
								" ",
								t("tokens"),
								" · ",
								share,
								"% · ",
								t(cat.precision === "exact" ? "exact" : cat.precision === "unavailable" ? "unavailable" : "estimated")
							] })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "xray-bar",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { width: `${Math.min(100, share)}%` } })
						})] }, cat.key);
					}),
					(snapshot.totalTokens !== null || snapshot.pressure.projectedTokens !== null) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "xray-meta",
						children: [
							snapshot.totalTokens !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("providerTotal"),
								": ",
								formatTokens(snapshot.totalTokens)
							] }),
							snapshot.pressure.pressureTokens !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("pressureTokens"),
								": ",
								formatTokens(snapshot.pressure.pressureTokens)
							] }),
							snapshot.pressure.projectedTokens !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("projectedTokens"),
								": ",
								formatTokens(snapshot.pressure.projectedTokens)
							] }),
							snapshot.contextWindow !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("contextWindow"),
								": ",
								formatTokens(snapshot.contextWindow)
							] })
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/components/PressureBadge.tsx
		function PressureBadge({ pressure, t }) {
			if (!pressure.level) return null;
			const labelKey = `pressure.${pressure.level}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `xray-pressure-badge xray-pressure-${pressure.level}`,
				"data-pressure": pressure.level,
				children: t(labelKey)
			});
		}
		//#endregion
		//#region src/client/components/ToolTable.tsx
		function ToolTable({ snapshot, t }) {
			const [query, setQuery] = (0, react.useState)("");
			const [onlyCalled, setOnlyCalled] = (0, react.useState)(false);
			const [onlyUnused, setOnlyUnused] = (0, react.useState)(false);
			const [sorted, setSorted] = (0, react.useState)(true);
			const [expanded, setExpanded] = (0, react.useState)(null);
			const tools = (0, react.useMemo)(() => {
				let list = [...snapshot.tools];
				if (query.trim()) {
					const q = query.trim().toLowerCase();
					list = list.filter((tool) => tool.name.toLowerCase().includes(q));
				}
				if (onlyCalled) list = list.filter((tool) => tool.calledThisTurn || tool.calledEver);
				if (onlyUnused) list = list.filter((tool) => !tool.calledEver);
				if (sorted) list = list.sort((a, b) => b.tokens - a.tokens);
				return list;
			}, [
				snapshot.tools,
				query,
				onlyCalled,
				onlyUnused,
				sorted
			]);
			const sourceLabel = (source) => {
				switch (source) {
					case "builtin": return t("builtin");
					case "mcp": return t("mcp");
					case "plugin": return t("plugin");
					default: return t("unknown");
				}
			};
			const copyText = async (text) => {
				try {
					await navigator.clipboard.writeText(text);
				} catch {
					const textarea = document.createElement("textarea");
					textarea.value = text;
					textarea.style.position = "fixed";
					textarea.style.opacity = "0";
					document.body.append(textarea);
					textarea.select();
					document.execCommand("copy");
					textarea.remove();
				}
			};
			const toggleExpand = (name) => {
				setExpanded((current) => current === name ? null : name);
			};
			const toolDiagnostic = (tool) => JSON.stringify({
				name: tool.name,
				tokens: tool.tokens,
				source: tool.source,
				calledThisTurn: tool.calledThisTurn,
				calledEver: tool.calledEver,
				callCount: tool.callCount,
				lastCalledAt: tool.lastCalledAt
			}, null, 2);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [
					t("tools"),
					" (",
					tools.length,
					")"
				] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "xray-toolbar",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "search",
							placeholder: "filter…",
							value: query,
							onChange: (e) => setQuery(e.target.value)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setOnlyCalled((v) => !v),
							children: [onlyCalled ? "✓ " : "", t("calledEver")]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setOnlyUnused((v) => !v),
							children: [onlyUnused ? "✓ " : "", t("neverUsed")]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSorted((v) => !v),
							children: sorted ? "↓" : "↑"
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
					className: "xray-table",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("source") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "name" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("tokens") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("calledThisTurn") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("callCount") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("lastCalledAt") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("actions") })
					] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: tools.map((tool) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
						tool,
						t,
						sourceLabel,
						expanded: expanded === tool.name,
						onToggle: toggleExpand,
						onCopy: copyText,
						diagnostic: toolDiagnostic(tool)
					}, tool.name)) })]
				})
			] });
		}
		function ToolRow({ tool, t, sourceLabel, expanded, onToggle, onCopy, diagnostic }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: sourceLabel(tool.source) }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "xray-tool-name",
					onClick: () => onToggle(tool.name),
					children: tool.name
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "xray-tool-actions",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => void onCopy(tool.name),
							children: t("copyName")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => void onCopy(JSON.stringify(tool.schema)),
							children: t("copySchema")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => void onCopy(diagnostic),
							children: t("copyDiagnostic")
						})
					]
				})] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: formatTokens(tool.tokens) }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: tool.calledThisTurn ? "✓" : "" }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: tool.callCount > 0 ? tool.callCount : "—" }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: tool.lastCalledAt ? formatDate(tool.lastCalledAt) : "—" }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onToggle(tool.name),
					children: [
						expanded ? "−" : "+",
						" ",
						t("schema")
					]
				}) })
			] }), expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
				className: "xray-schema-row",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
					colSpan: 7,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: JSON.stringify(tool.schema, null, 2) })
				})
			}) : null] });
		}
		function formatDate(value) {
			const date = new Date(value);
			if (Number.isNaN(date.getTime())) return value;
			return date.toLocaleString();
		}
		//#endregion
		//#region src/client/components/HistoryChart.tsx
		function HistoryChart({ history, t }) {
			const [selectedTurn, setSelectedTurn] = (0, react.useState)(null);
			const entries = (0, react.useMemo)(() => [...history?.entries ?? []].sort((a, b) => a.turn - b.turn), [history]);
			const max = (0, react.useMemo)(() => Math.max(1, ...entries.map((e) => e.totalTokens ?? 0)), [entries]);
			const selected = entries.find((e) => e.turn === selectedTurn) ?? null;
			const selectedIndex = selected ? entries.findIndex((e) => e.turn === selected.turn) : -1;
			const previous = selectedIndex > 0 ? entries[selectedIndex - 1] : void 0;
			const diff = selected ? diffTurns(previous, selected) : null;
			if (entries.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "xray-note",
				children: t("noData")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("history") }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "xray-history",
					children: entries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: `bar${selectedTurn === entry.turn ? " selected" : ""}`,
						style: { height: `${Math.max(4, (entry.totalTokens ?? 0) / max * 100)}%` },
						title: `Turn ${entry.turn}: ${formatTokens(entry.totalTokens ?? 0)}`,
						onClick: () => setSelectedTurn(entry.turn)
					}, entry.turn))
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "xray-history-list",
					children: entries.map((entry, index) => {
						const prev = index > 0 ? entries[index - 1] : void 0;
						const delta = prev ? (entry.totalTokens ?? 0) - (prev.totalTokens ?? 0) : 0;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `xray-history-item${selectedTurn === entry.turn ? " selected" : ""}`,
							onClick: () => setSelectedTurn(entry.turn),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Turn ", entry.turn] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatTokens(entry.totalTokens ?? 0) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "xray-history-delta",
									children: formatSignedTokens(delta)
								})
							]
						}, entry.turn);
					})
				}),
				selected && diff ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "xray-diff",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h4", { children: [
							"Turn ",
							selected.turn,
							" ",
							t("breakdown")
						] }),
						diff.deltas.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "xray-note",
							children: t("noData")
						}) : null,
						diff.deltas.map((delta) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "xray-delta-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "xray-delta-main",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: delta.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									formatTokens(delta.tokens),
									" · ",
									formatSignedTokens(delta.delta)
								] })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "xray-delta-note",
								children: t(delta.explanationKey)
							})]
						}, delta.key)),
						diff.majorGain.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "xray-note",
							children: [
								t("majorGain"),
								": ",
								diff.majorGain.join(", ")
							]
						}) : null
					]
				}) : null
			] });
		}
		//#endregion
		//#region src/client/Panel.tsx
		function Panel({ sessionId, t, onClose }) {
			const [snapshot, setSnapshot] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)(null);
			const [showSections, setShowSections] = (0, react.useState)(false);
			const [includeBody, setIncludeBody] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const load = (0, react.useCallback)(async (withBody = false) => {
				setLoading(true);
				setError(null);
				try {
					const snapRes = await xrayApi.snapshot(sessionId, withBody);
					if (!snapRes.ok) throw new Error(snapRes.error.message);
					setSnapshot(snapRes.value);
					const histRes = await xrayApi.history(sessionId);
					if (histRes.ok) setHistory(histRes.value.history);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, [sessionId]);
			(0, react.useEffect)(() => {
				load(false);
			}, [load]);
			const toggleBody = async () => {
				const next = !includeBody;
				setIncludeBody(next);
				await load(next);
			};
			const clear = async () => {
				if (!window.confirm(t("clearConfirm"))) return;
				await xrayApi.clear(sessionId);
				setHistory(null);
			};
			const loadDiagnostic = async () => {
				const res = await xrayApi.diagnostic(sessionId);
				if (!res.ok) throw new Error(res.error.message);
				return res.value;
			};
			const downloadDiagnostic = async () => {
				try {
					const diagnostic = await loadDiagnostic();
					const blob = new Blob([JSON.stringify(diagnostic, null, 2)], { type: "application/json" });
					const url = URL.createObjectURL(blob);
					const anchor = document.createElement("a");
					anchor.href = url;
					anchor.download = `dsh-context-xray-${diagnostic.sessionId}-turn${diagnostic.turn}.json`;
					anchor.click();
					URL.revokeObjectURL(url);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const copyDiagnostic = async () => {
				try {
					const diagnostic = await loadDiagnostic();
					await navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const pressure = snapshot?.pressure.pressureTokens ?? snapshot?.totalTokens ?? null;
			const entries = history?.entries ?? [];
			const latest = entries.at(-1);
			const prev = entries.at(-2);
			const delta = latest && prev && latest.totalTokens !== null && prev.totalTokens !== null ? latest.totalTokens - prev.totalTokens : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ToolkitPanel, {
				title: t("title"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutline16, {}),
				status: snapshot ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PressureBadge, {
					pressure: snapshot.pressure,
					t
				}) : void 0,
				onClose,
				summary: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
						value: pressure !== null ? formatTokens(pressure) : "—",
						label: t("providerTotal")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
						value: snapshot?.contextWindow !== null && snapshot?.contextWindow !== void 0 ? formatTokens(snapshot.contextWindow) : "—",
						label: t("contextWindow")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
						value: delta !== null ? `+${formatTokens(delta)}` : "—",
						label: t("delta")
					})
				] }),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, {}),
						onClick: () => void load(includeBody),
						children: t("refresh")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						onClick: () => void toggleBody(),
						children: includeBody ? t("expanded") : t("preview")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutline16, {}),
						onClick: () => void downloadDiagnostic(),
						children: t("downloadDiagnostic")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutline16, {}),
						onClick: () => void copyDiagnostic(),
						children: t("copyDiagnostic")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, {}),
						onClick: () => void clear(),
						children: t("clear")
					})
				] }),
				children: [
					loading && !snapshot ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("loading") }) : null,
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "xray-note",
						style: { color: "var(--dsw-alias-state-error-primary)" },
						children: error
					}) : null,
					snapshot ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Breakdown, {
							snapshot,
							t
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-tk-section",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh-tk-section-title",
									children: [
										t("sections"),
										" (",
										snapshot.sections.length,
										")"
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
									className: "xray-table",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "id" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("source") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("tokens") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("delta") })
									] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: snapshot.sections.map((section) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: section.id }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: section.source }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: section.tokens }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: section.stable ? t("stable") : t("dynamic") })
									] }, section.id)) })]
								}),
								snapshot.sections.map((section) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: section.id }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: section.body ?? section.preview })] }, section.id))
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolTable, {
							snapshot,
							t
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HistoryChart, {
							history,
							t
						})
					] }) : null,
					snapshot?.source.map((s) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "xray-note",
						children: [
							s.metric,
							": ",
							s.note
						]
					}, s.metric))
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const NS = "dsh-context-xray";
		const zh = {
			title: "上下文 X-Ray",
			open: "上下文",
			close: "关闭",
			loading: "分析中…",
			error: "加载失败",
			providerTotal: "Provider 报告压力",
			pressureTokens: "pressureTokens",
			projectedTokens: "projectedTokens",
			contextWindow: "上下文窗口",
			tokens: "tokens",
			ratio: "占比",
			delta: "变化",
			refresh: "刷新",
			clear: "清除本地统计",
			clearConfirm: "确定清除该 session 的本地历史统计？",
			categories: "构成",
			sections: "Prompt Sections",
			tools: "Tool Schemas",
			history: "历史",
			noData: "暂无数据",
			calledThisTurn: "本轮已调用",
			calledEver: "曾调用",
			source: "来源",
			preview: "预览",
			expanded: "已展开",
			builtin: "内置",
			plugin: "插件",
			mcp: "MCP",
			unknown: "未知",
			stable: "稳定",
			dynamic: "动态",
			estimated: "估算",
			exact: "精确",
			unavailable: "不可用",
			neverUsed: "从未使用",
			breakdown: "构成",
			majorGain: "主要增长",
			callCount: "调用次数",
			lastCalledAt: "最近调用",
			actions: "操作",
			schema: "Schema",
			copyName: "复制名称",
			copySchema: "复制 Schema",
			copyDiagnostic: "复制诊断",
			downloadDiagnostic: "下载诊断",
			"pressure.normal": "正常",
			"pressure.elevated": "偏高",
			"pressure.high": "高",
			"pressure.critical": "危险",
			"delta.system": "System Prompt 分节与运行上下文 token 变化。",
			"delta.conversation": "对话消息 token 变化（含本轮新增/压缩替换）。",
			"delta.tools": "Tool schema JSON 的 token 变化（新增/移除/修改工具）。",
			"delta.skills": "Skill catalog/invocation 注入的 token 变化。",
			"delta.memory": "Memory/recall 注入的 token 变化。",
			"delta.workspace": "Workspace/AGENTS 指令的 token 变化。",
			"delta.attachments": "图片/附件 token 变化。",
			"delta.other": "Provider 总量与启发式分类差值的变化。"
		};
		const en = {
			title: "Context X-Ray",
			open: "Context",
			close: "Close",
			loading: "Analyzing…",
			error: "Load failed",
			providerTotal: "Provider pressure",
			pressureTokens: "pressureTokens",
			projectedTokens: "projectedTokens",
			contextWindow: "Context window",
			tokens: "tokens",
			ratio: "share",
			delta: "delta",
			refresh: "Refresh",
			clear: "Clear local metrics",
			clearConfirm: "Clear local history for this session?",
			categories: "Composition",
			sections: "Prompt Sections",
			tools: "Tool Schemas",
			history: "History",
			noData: "No data",
			calledThisTurn: "Called this turn",
			calledEver: "Called before",
			source: "Source",
			preview: "Preview",
			expanded: "Expanded",
			builtin: "Built-in",
			plugin: "Plugin",
			mcp: "MCP",
			unknown: "Unknown",
			stable: "Stable",
			dynamic: "Dynamic",
			estimated: "Estimated",
			exact: "Exact",
			unavailable: "Unavailable",
			neverUsed: "Never used",
			breakdown: "Breakdown",
			majorGain: "Major gain",
			callCount: "Calls",
			lastCalledAt: "Last call",
			actions: "Actions",
			schema: "Schema",
			copyName: "Copy name",
			copySchema: "Copy schema",
			copyDiagnostic: "Copy diagnostic",
			downloadDiagnostic: "Download diagnostic",
			"pressure.normal": "Normal",
			"pressure.elevated": "Elevated",
			"pressure.high": "High",
			"pressure.critical": "Critical",
			"delta.system": "Change in system-prompt sections/runtime contexts.",
			"delta.conversation": "Change in conversation message tokens (new turns/compaction).",
			"delta.tools": "Change in tool schema JSON tokens (added/removed/changed tools).",
			"delta.skills": "Change in skill catalog/invocation injections.",
			"delta.memory": "Change in memory/recall injections.",
			"delta.workspace": "Change in workspace/AGENTS instructions.",
			"delta.attachments": "Change in attachment/image tokens.",
			"delta.other": "Change in the residual between provider total and heuristic categories."
		};
		//#endregion
		//#region src/client/styles.ts
		/** Minimal component styles, injected once through a data-plugin style tag. */
		const css = `
[dsh-context-xray-root] {
  position: relative;
  font-size: 12px;
  line-height: 1.5;
}
[dsh-context-xray-root] .xray-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4));
  background: transparent;
  border-radius: 8px;
  padding: 2px 8px;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary, inherit);
}
[dsh-context-xray-root] .xray-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 1000;
  width: min(720px, calc(100vw - 32px));
  max-height: 70vh;
  overflow: auto;
  background: var(--dsw-specific-menu, #fff);
  color: var(--dsw-alias-label-primary, inherit);
  border: 1px solid var(--dsw-alias-border-inverted, rgba(0,0,0,.2));
  border-radius: 12px;
  box-shadow: var(--dsw-shadow-lv3, 0 8px 30px rgba(0,0,0,.2));
  padding: 12px;
}
.xray-panel h3 {
  margin: 0 0 8px;
  font-size: 13px;
}
.xray-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 8px;
  color: var(--dsw-alias-label-secondary, inherit);
}
.xray-category-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
}
.xray-bar {
  height: 4px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover, #eee);
  overflow: hidden;
  margin: 2px 0 4px;
}
.xray-bar > span {
  display: block;
  height: 100%;
  background: #4D6BFE;
}
.xray-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.xray-table th, .xray-table td {
  text-align: left;
  padding: 2px 6px;
  border-bottom: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.2));
}
.xray-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.xray-toolbar button {
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4));
  background: transparent;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
}
.xray-history {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 60px;
  padding: 4px 0;
}
.xray-history .bar {
  flex: 1;
  min-width: 6px;
  border-radius: 2px 2px 0 0;
  background: #4D6BFE;
}
.xray-note {
  color: var(--dsw-alias-label-tertiary, #999);
  font-size: 11px;
  margin-top: 8px;
}
.xray-section-row {
  padding: 2px 0;
}
.xray-section-row summary {
  cursor: pointer;
}
.xray-pressure-badge {
  display: inline-block;
  border-radius: 999px;
  padding: 1px 10px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
}
.xray-pressure-normal {
  color: var(--dsw-alias-label-secondary, #555);
  background: var(--dsw-alias-interactive-bg-hover, #eee);
}
.xray-pressure-elevated {
  color: #8a6d1a;
  background: rgba(230, 180, 40, .18);
  border-color: rgba(230, 180, 40, .5);
}
.xray-pressure-high {
  color: #8a4b00;
  background: rgba(240, 120, 20, .18);
  border-color: rgba(240, 120, 20, .5);
}
.xray-pressure-critical {
  color: #a00;
  background: rgba(220, 40, 40, .16);
  border-color: rgba(220, 40, 40, .6);
}
.xray-history .bar {
  flex: 1;
  border: 0;
  padding: 0;
  background: #4D6BFE;
  cursor: pointer;
  min-width: 6px;
}
.xray-history .bar.selected {
  outline: 2px solid var(--dsw-alias-border-inverted, rgba(0,0,0,.5));
}
.xray-history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0;
}
.xray-history-item {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4));
  background: transparent;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.xray-history-item.selected {
  background: var(--dsw-alias-interactive-bg-hover, #eee);
}
.xray-history-delta {
  color: var(--dsw-alias-label-tertiary, #888);
}
.xray-diff {
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4));
  border-radius: 8px;
  padding: 6px 8px;
  margin-top: 6px;
}
.xray-diff h4 {
  margin: 0 0 4px;
}
.xray-delta-row {
  padding: 2px 0;
}
.xray-delta-main {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.xray-delta-note {
  color: var(--dsw-alias-label-tertiary, #888);
  font-size: 11px;
}
.xray-tool-name {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
}
.xray-tool-actions {
  display: inline-flex;
  gap: 4px;
  margin-left: 8px;
}
.xray-tool-actions button,
.xray-toolbar button {
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4));
  background: transparent;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
}
.xray-schema-row pre {
  max-height: 240px;
  overflow: auto;
  background: var(--dsw-alias-interactive-bg-hover, #f6f6f6);
  border-radius: 6px;
  padding: 6px;
  margin: 2px 0;
}
`;
		let adopted = false;
		function adoptStyles() {
			if (adopted || typeof document === "undefined") return;
			adopted = true;
			const tag = document.createElement("style");
			tag.setAttribute("data-plugin", "dsh-context-xray");
			tag.id = "dsh-context-xray-style";
			tag.textContent = css;
			document.head.append(tag);
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* dsh-context-xray client half.
		* Registers a Toolkit entry and, when the Toolkit shell is absent, falls back
		* to a compact header action that opens the same panel.
		*/
		const inject = ["slots", "locale"];
		function ContextQuick({ sessionId, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitQuickAction, {
				title: t("open"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutline16, {}),
				onClick: () => openToolkitPanel("dsh-context-xray")
			});
		}
		function ContextRow({ sessionId, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitEntryRow, {
				title: t("title"),
				subtitle: "Context · token inspector",
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutline16, {}),
				onClick: () => openToolkitPanel("dsh-context-xray")
			});
		}
		function HeaderAction({ sessionId, t }) {
			const shellReady = useToolkitShellReady();
			const [open, setOpen] = (0, react.useState)(false);
			if (shellReady) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-xray-root": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "xray-trigger",
					onClick: () => setOpen((v) => !v),
					children: t("open")
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Panel, {
					sessionId,
					t,
					onClose: () => setOpen(false)
				}) : null]
			});
		}
		function apply(ctx) {
			adoptStyles();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-context-xray: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => registerToolkitEntry({
				id: "dsh-context-xray",
				category: "observe",
				order: 10,
				title: t("title"),
				quick: true,
				renderRow: (sessionId) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextRow, {
					sessionId,
					t
				}),
				renderQuick: (sessionId) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextQuick, {
					sessionId,
					t
				}),
				renderPanel: (sessionId, onClose) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Panel, {
					sessionId,
					t,
					onClose
				})
			}), "dsh-context-xray: toolkit entry");
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "dsh-context-xray",
				order: 10,
				locale: NS,
				inject: () => ({})
			}, (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HeaderAction, { ...props })));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
