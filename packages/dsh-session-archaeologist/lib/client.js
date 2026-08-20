window.__ModuleLoader__.load({
	id: "dsh-session-archaeologist",
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
		const API = "/plugins/dsh-session-archaeologist/api";
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
		const archApi = {
			status(signal) {
				return call("status", {}, signal);
			},
			search(query, filters, limit = 50, signal) {
				return call("search", {
					query,
					filters,
					limit
				}, signal);
			},
			index(sessionId) {
				return call("index", { sessionId }, void 0);
			},
			reindex() {
				return call("reindex", {}, void 0);
			},
			deleteIndex() {
				return call("delete-index", {}, void 0);
			},
			exclude(sessionId, workspace, unexclude = false) {
				return call("exclude", {
					sessionId,
					workspace,
					unexclude
				}, void 0);
			},
			timeline(sessionId) {
				return call("timeline", { sessionId }, void 0);
			},
			excerpt(request) {
				return call("excerpt", request, void 0);
			},
			context(sessionId, text, mode = "inject") {
				return call("context", {
					sessionId,
					text,
					mode
				}, void 0);
			}
		};
		//#endregion
		//#region src/client/SearchPanel.tsx
		const QUICK_QUERIES = [
			{
				key: "quickErrors",
				query: "error failed"
			},
			{
				key: "quickFiles",
				query: ".ts .tsx .json"
			},
			{
				key: "quickCommands",
				query: "pnpm npm git"
			},
			{
				key: "quickPrompts",
				query: "怎么做 实现 修复"
			}
		];
		function SearchPanel({ t, onClose, currentSessionId, currentWorkspace, sendFollowUp }) {
			const [query, setQuery] = (0, react.useState)("");
			const [filters, setFilters] = (0, react.useState)({});
			const [status, setStatus] = (0, react.useState)(null);
			const [response, setResponse] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)([]);
			const [expandedSession, setExpandedSession] = (0, react.useState)(null);
			const [timeline, setTimeline] = (0, react.useState)(null);
			const [timelineLoading, setTimelineLoading] = (0, react.useState)(false);
			const [selected, setSelected] = (0, react.useState)({});
			const [excerpt, setExcerpt] = (0, react.useState)(null);
			const [excerptLoading, setExcerptLoading] = (0, react.useState)(false);
			const [copied, setCopied] = (0, react.useState)(false);
			const [actionMsg, setActionMsg] = (0, react.useState)(null);
			const [scope, setScope] = (0, react.useState)("all");
			const [dateFrom, setDateFrom] = (0, react.useState)("");
			const [dateTo, setDateTo] = (0, react.useState)("");
			const [sourceToggles, setSourceToggles] = (0, react.useState)({
				user: false,
				assistant: false,
				error: false,
				command: false,
				file: false
			});
			const abortRef = (0, react.useRef)(null);
			const loadStatus = (0, react.useCallback)(async () => {
				const res = await archApi.status();
				if (res.ok) setStatus(res.value);
			}, []);
			(0, react.useEffect)(() => {
				loadStatus();
				const stored = localStorage.getItem("archaeologist-search-history");
				if (stored) try {
					setHistory(JSON.parse(stored));
				} catch {}
			}, [loadStatus]);
			const pushHistory = (0, react.useCallback)((q) => {
				const next = [q, ...history.filter((h) => h !== q)].slice(0, 8);
				setHistory(next);
				try {
					localStorage.setItem("archaeologist-search-history", JSON.stringify(next));
				} catch {}
			}, [history]);
			const buildFilters = (0, react.useCallback)(() => {
				const sources = [];
				if (sourceToggles.user) sources.push("user");
				if (sourceToggles.assistant) sources.push("assistant", "reasoning");
				if (sourceToggles.error) sources.push("error");
				if (sourceToggles.command) sources.push("command");
				if (sourceToggles.file) sources.push("file");
				let after;
				let before;
				if (dateFrom) {
					const d = /* @__PURE__ */ new Date(`${dateFrom}T00:00:00`);
					if (!Number.isNaN(d.getTime())) after = d.getTime();
				}
				if (dateTo) {
					const d = /* @__PURE__ */ new Date(`${dateTo}T23:59:59.999`);
					if (!Number.isNaN(d.getTime())) before = d.getTime() + 1;
				}
				const workspace = currentWorkspace?.();
				return {
					...scope === "workspace" && workspace ? { workspaces: [workspace] } : {},
					...scope === "project" && workspace ? { projectPath: workspace } : {},
					...after !== void 0 ? { after } : {},
					...before !== void 0 ? { before } : {},
					...sources.length > 0 ? { source: sources } : {}
				};
			}, [
				scope,
				dateFrom,
				dateTo,
				sourceToggles,
				currentWorkspace
			]);
			const runSearch = (0, react.useCallback)(async (q) => {
				const trimmed = q.trim();
				if (!trimmed) return;
				abortRef.current?.abort();
				const controller = new AbortController();
				abortRef.current = controller;
				setLoading(true);
				setError(null);
				setExcerpt(null);
				setCopied(false);
				setActionMsg(null);
				const nextFilters = buildFilters();
				setFilters(nextFilters);
				const res = await archApi.search(trimmed, nextFilters, 50, controller.signal);
				setLoading(false);
				if (controller.signal.aborted) return;
				if (!res.ok) {
					setError(res.error.message);
					return;
				}
				setResponse(res.value);
				pushHistory(trimmed);
			}, [buildFilters, pushHistory]);
			const onSearchClick = (0, react.useCallback)(() => {
				runSearch(query);
			}, [query, runSearch]);
			const onQuick = (0, react.useCallback)((q) => {
				setQuery(q);
				runSearch(q);
			}, [runSearch]);
			const onReindex = (0, react.useCallback)(async () => {
				if (!window.confirm(t("confirmReindex"))) return;
				setError(null);
				const res = await archApi.reindex();
				if (!res.ok) setError(res.error.message);
				await loadStatus();
			}, [t, loadStatus]);
			const onDeleteIndex = (0, react.useCallback)(async () => {
				if (!window.confirm(t("confirmDelete"))) return;
				setError(null);
				const res = await archApi.deleteIndex();
				if (!res.ok) setError(res.error.message);
				setResponse(null);
				await loadStatus();
			}, [t, loadStatus]);
			const onExcludeSession = (0, react.useCallback)(async (sessionId) => {
				const res = await archApi.exclude(sessionId);
				if (res.ok) {
					if (response) setResponse({
						...response,
						results: response.results.filter((r) => r.sessionId !== sessionId)
					});
					await loadStatus();
				} else setError(res.error.message);
			}, [response, loadStatus]);
			const onTimeline = (0, react.useCallback)(async (sessionId) => {
				setTimelineLoading(true);
				setTimeline(null);
				const res = await archApi.timeline(sessionId);
				setTimelineLoading(false);
				if (res.ok) {
					const stages = res.value.stages.map((s) => `[${s.confidence}] ${s.label}\n${s.detail}`).join("\n\n");
					setTimeline(stages);
				} else setError(res.error.message);
			}, []);
			const toggleHit = (0, react.useCallback)((sessionId, seq) => {
				setSelected((prev) => {
					const current = prev[sessionId] ?? [];
					const next = current.includes(seq) ? current.filter((s) => s !== seq) : [...current, seq].sort((a, b) => a - b);
					const copy = { ...prev };
					if (next.length > 0) copy[sessionId] = next;
					else delete copy[sessionId];
					return copy;
				});
				setExcerpt(null);
				setCopied(false);
				setActionMsg(null);
			}, []);
			const clearSelection = (0, react.useCallback)(() => {
				setSelected({});
				setExcerpt(null);
				setCopied(false);
				setActionMsg(null);
			}, []);
			const selectedCount = Object.values(selected).reduce((sum, seqs) => sum + seqs.length, 0);
			const buildSelectedExcerpt = (0, react.useCallback)(async () => {
				if (selectedCount === 0) {
					setError(t("noSelection"));
					return;
				}
				setExcerptLoading(true);
				setError(null);
				setCopied(false);
				setActionMsg(null);
				const selections = Object.entries(selected).map(([sessionId, hitIds]) => ({
					sessionId,
					hitIds
				}));
				const res = await archApi.excerpt({
					selections,
					maxChars: 8e3,
					maxTokens: 2e3,
					contextRadius: 3
				});
				setExcerptLoading(false);
				if (!res.ok) {
					setError(res.error.message);
					return;
				}
				setExcerpt(res.value);
			}, [
				selected,
				selectedCount,
				t
			]);
			const copyExcerpt = (0, react.useCallback)(async () => {
				if (!excerpt) return;
				try {
					await navigator.clipboard.writeText(excerpt.text);
					setCopied(true);
				} catch {
					setCopied(false);
				}
			}, [excerpt]);
			const addToContext = (0, react.useCallback)(async () => {
				if (!excerpt) return;
				const sessionId = currentSessionId?.();
				if (!sessionId) {
					setError(t("noCurrentSession"));
					return;
				}
				setActionMsg(null);
				const res = await archApi.context(sessionId, excerpt.text, "inject");
				if (res.ok && res.value.delivered) {
					setActionMsg(t("contextSent"));
					return;
				}
				if (sendFollowUp) {
					const err = await sendFollowUp(excerpt.text, "queue");
					if (err) {
						setError(err);
						return;
					}
					setActionMsg(t("contextFallback"));
					return;
				}
				setActionMsg(t("noCurrentSession"));
			}, [
				excerpt,
				currentSessionId,
				sendFollowUp,
				t
			]);
			const sendAsFollowUp = (0, react.useCallback)(async () => {
				if (!excerpt) return;
				if (!sendFollowUp) {
					setError(t("noCurrentSession"));
					return;
				}
				const err = await sendFollowUp(excerpt.text, "queue");
				if (err) setError(err);
				else setActionMsg(t("contextFallback"));
			}, [
				excerpt,
				sendFollowUp,
				t
			]);
			const toggleExpand = (0, react.useCallback)(async (sessionId) => {
				if (expandedSession === sessionId) {
					setExpandedSession(null);
					setTimeline(null);
					return;
				}
				setExpandedSession(sessionId);
				await onTimeline(sessionId);
			}, [expandedSession, onTimeline]);
			const toggleSource = (0, react.useCallback)((key) => {
				setSourceToggles((prev) => ({
					...prev,
					[key]: !prev[key]
				}));
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ToolkitPanel, {
				title: t("title"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, {}),
				onClose,
				summary: status ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
					value: status.indexedSessions,
					label: t("sessionsIndexed")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
					value: status.indexedDocs,
					label: t("docsIndexed")
				})] }) : void 0,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, {}),
						onClick: () => void loadStatus(),
						children: t("refresh")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						onClick: () => void onReindex(),
						children: t("reindex")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, {}),
						onClick: () => void onDeleteIndex(),
						children: t("deleteIndex")
					})
				] }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-search-row",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								value: query,
								placeholder: t("searchPlaceholder"),
								onChange: (e) => setQuery(e.target.value),
								onKeyDown: (e) => {
									if (e.key === "Enter") onSearchClick();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onSearchClick,
								children: t("searchBtn")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									setQuery("");
									setResponse(null);
									setSelected({});
									setExcerpt(null);
								},
								children: t("clearSearch")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-filters",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "archaeologist-meta",
								children: [
									t("scope"),
									":",
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										value: scope,
										onChange: (e) => setScope(e.target.value),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "all",
												children: t("scopeAll")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "workspace",
												children: t("scopeWorkspace")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "project",
												children: t("scopeProject")
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "archaeologist-meta",
								children: [
									t("dateFrom"),
									":",
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "date",
										value: dateFrom,
										onChange: (e) => setDateFrom(e.target.value)
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "archaeologist-meta",
								children: [
									t("dateTo"),
									":",
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "date",
										value: dateTo,
										onChange: (e) => setDateTo(e.target.value)
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "archaeologist-filters",
						children: [
							["user", t("filterUser")],
							["assistant", t("filterAssistant")],
							["error", t("filterErrors")],
							["command", t("filterCommands")],
							["file", t("filterFiles")]
						].map(([key, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "archaeologist-meta",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: sourceToggles[key],
								onChange: () => toggleSource(key)
							}), label]
						}, key))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "archaeologist-quick",
						children: QUICK_QUERIES.map((q) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onQuick(q.query),
							children: t(q.key)
						}, q.key))
					}),
					history.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-quick",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "archaeologist-note",
							children: [t("searchHistory"), ":"]
						}), history.map((h) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onQuick(h),
							children: h
						}, h))]
					}) : null,
					status ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-note",
						children: [
							t("sessionsIndexed"),
							": ",
							status.indexedSessions,
							" · ",
							t("docsIndexed"),
							": ",
							status.indexedDocs,
							status.excludedSessions.length > 0 ? ` · ${t("excluded")}: ${status.excludedSessions.length} sessions` : ""
						]
					}) : null,
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "archaeologist-note",
						children: t("loading")
					}) : null,
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "archaeologist-error",
						children: error
					}) : null,
					actionMsg ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "archaeologist-note",
						children: actionMsg
					}) : null,
					selectedCount > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-selectionbar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "archaeologist-meta",
								children: [
									t("selectedHits"),
									": ",
									selectedCount
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void buildSelectedExcerpt(),
								disabled: excerptLoading,
								children: excerptLoading ? t("loading") : t("excerpt")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: clearSelection,
								children: t("clearSelection")
							})
						]
					}) : null,
					excerpt ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-timeline",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "archaeologist-meta",
								children: [
									"[",
									t("excerptMeta"),
									"] ",
									t("chars"),
									": ",
									excerpt.charCount,
									"/",
									excerpt.maxChars,
									" · ",
									t("tokenEstimate"),
									": ",
									excerpt.tokenEstimate,
									"/",
									excerpt.maxTokens,
									excerpt.truncated ? ` ${t("truncated")}` : "",
									excerpt.sources.length > 1 ? ` · ${t("selectedHits")}: ${excerpt.selectedHitCount}` : ""
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "archaeologist-meta",
								children: excerpt.sources.map((s) => `${s.title} (${s.date})`).join("; ")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: excerpt.text }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "archaeologist-result-head",
								style: { marginTop: 6 },
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "archaeologist-copy",
										onClick: () => void copyExcerpt(),
										children: copied ? t("copied") : t("copy")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void addToContext(),
										children: t("addToContext")
									}),
									sendFollowUp ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void sendAsFollowUp(),
										children: t("sendFollowUp")
									}) : null
								]
							})
						]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-results",
						children: [response?.results.map((result) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ResultCard, {
							result,
							hits: response.hits.filter((h) => h.sessionId === result.sessionId),
							selectedSeqs: selected[result.sessionId] ?? [],
							t,
							expanded: expandedSession === result.sessionId,
							timeline,
							timelineLoading,
							onExpand: () => void toggleExpand(result.sessionId),
							onExclude: () => void onExcludeSession(result.sessionId),
							onToggleHit: (seq) => toggleHit(result.sessionId, seq)
						}, result.sessionId)), response && response.results.length === 0 && !loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "archaeologist-note",
							children: t("noResults")
						}) : null]
					})
				]
			});
		}
		function ResultCard({ result, hits, selectedSeqs, t, expanded, timeline, timelineLoading, onExpand, onExclude, onToggleHit }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "archaeologist-result",
				"data-session-id": result.sessionId,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-result-head",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "archaeologist-title",
								children: result.title
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "archaeologist-meta",
								children: [
									t("date"),
									": ",
									result.date || "—"
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "archaeologist-meta",
								children: [
									t("workspace"),
									": ",
									result.workspace || "—"
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "archaeologist-meta",
								children: [
									t("relevance"),
									": ",
									result.relevance,
									"%"
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "archaeologist-meta",
								children: ["hits: ", result.hitCount]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "archaeologist-meta",
								children: result.sessionId
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "archaeologist-snippet",
						children: result.snippet
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-badges",
						children: [
							result.hitFields.map((f) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "archaeologist-badge",
								title: t("hitFields"),
								children: f
							}, f)),
							result.files.slice(0, 4).map((f) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "archaeologist-badge",
								title: f,
								children: f
							}, f)),
							result.commands.slice(0, 4).map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "archaeologist-badge",
								title: c,
								children: ["💻 ", c]
							}, c)),
							result.hasError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "archaeologist-badge",
								children: "⚠ error"
							}) : null,
							result.outcome ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "archaeologist-badge",
								children: [
									t("outcome"),
									": ",
									result.outcome
								]
							}) : null
						]
					}),
					hits.slice(0, 10).map((h) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-snippet",
						style: { color: "var(--dsh-muted, #9aa0a6)" },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "archaeologist-meta",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: selectedSeqs.includes(h.seq),
										onChange: () => onToggleHit(h.seq)
									}),
									"[",
									h.source,
									"] ",
									t("date"),
									": ",
									h.time ? new Date(h.time).toISOString() : "—"
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: h.snippet }),
							h.contextBefore.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "archaeologist-context",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "archaeologist-meta",
										children: [t("before"), ":"]
									}),
									" ",
									h.contextBefore.join(" / ").slice(0, 300)
								]
							}) : null,
							h.contextAfter.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "archaeologist-context",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "archaeologist-meta",
										children: [t("after"), ":"]
									}),
									" ",
									h.contextAfter.join(" / ").slice(0, 300)
								]
							}) : null
						]
					}, h.seq)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-result-head",
						style: { marginTop: 6 },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onExpand,
								children: expanded ? t("close") : t("timeline")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onExclude,
								children: "exclude"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								title: "Open in Time Machine",
								onClick: () => {
									[...document.querySelectorAll("button")].find((b) => ["时间机器", "Time Machine"].some((k) => (b.textContent ?? "").includes(k)))?.click();
								},
								children: "⏱"
							})
						]
					}),
					expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "archaeologist-timeline",
						children: [timelineLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "archaeologist-note",
							children: t("loading")
						}) : null, timeline ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: timeline }) : null]
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const NS = "dsh-session-archaeologist";
		const zh = {
			open: "会话考古",
			title: "Session Archaeologist",
			searchPlaceholder: "搜索历史 session（全文 / 文件 / 命令 / 错误）…",
			searchBtn: "搜索",
			reindex: "重建索引",
			deleteIndex: "删除索引",
			refresh: "刷新",
			close: "关闭",
			status: "状态",
			sessionsIndexed: "已索引 session",
			docsIndexed: "已索引条目",
			excluded: "已排除",
			loading: "加载中…",
			results: "结果",
			noResults: "无匹配",
			relevance: "相关度",
			files: "涉及文件",
			commands: "命令",
			errors: "错误",
			outcome: "结果",
			date: "日期",
			context: "上下文",
			copy: "复制摘要",
			copied: "已复制",
			timeline: "时间线",
			excerpt: "摘要",
			tokenEstimate: "预计 token",
			chars: "字符",
			clearSearch: "清空",
			quickErrors: "错误",
			quickFiles: "文件",
			quickCommands: "命令",
			quickPrompts: "用户询问",
			searchHistory: "搜索历史",
			confirmDelete: "删除整个索引？这会清空所有已索引内容。",
			confirmReindex: "重建全部索引？需要重新解析所有 session 文件。",
			scope: "搜索范围",
			scopeAll: "全部 workspace",
			scopeWorkspace: "当前 workspace",
			scopeProject: "当前项目路径",
			dateFrom: "日期起",
			dateTo: "日期止",
			filters: "字段过滤",
			filterUser: "用户消息",
			filterAssistant: "Assistant 消息",
			filterErrors: "错误",
			filterCommands: "命令",
			filterFiles: "文件",
			workspace: "workspace",
			hitFields: "命中字段",
			before: "前文",
			after: "后文",
			selectedHits: "已选片段",
			clearSelection: "清空选择",
			addToContext: "Add to current context",
			sendFollowUp: "Send as follow-up",
			contextSent: "已注入当前 session",
			contextFallback: "未找到 live agent，已作为普通消息发送",
			noCurrentSession: "当前没有可用的 session",
			noSelection: "请先勾选至少一个片段",
			truncated: "（因预算截断）",
			excerptMeta: "excerpt"
		};
		const en = {
			open: "Session Archaeologist",
			title: "Session Archaeologist",
			searchPlaceholder: "Search past sessions (fulltext / files / commands / errors)…",
			searchBtn: "Search",
			reindex: "Reindex",
			deleteIndex: "Delete index",
			refresh: "Refresh",
			close: "Close",
			status: "Status",
			sessionsIndexed: "Indexed sessions",
			docsIndexed: "Indexed docs",
			excluded: "Excluded",
			loading: "Loading…",
			results: "Results",
			noResults: "No matches",
			relevance: "Relevance",
			files: "Files",
			commands: "Commands",
			errors: "Errors",
			outcome: "Outcome",
			date: "Date",
			context: "Context",
			copy: "Copy excerpt",
			copied: "Copied",
			timeline: "Timeline",
			excerpt: "Excerpt",
			tokenEstimate: "Est. tokens",
			chars: "chars",
			clearSearch: "Clear",
			quickErrors: "Errors",
			quickFiles: "Files",
			quickCommands: "Commands",
			quickPrompts: "User prompts",
			searchHistory: "Search history",
			confirmDelete: "Delete the whole index? This clears all indexed content.",
			confirmReindex: "Rebuild the whole index? This reparses every session file.",
			scope: "Search scope",
			scopeAll: "All workspaces",
			scopeWorkspace: "Current workspace",
			scopeProject: "Current project path",
			dateFrom: "From",
			dateTo: "To",
			filters: "Field filters",
			filterUser: "User messages",
			filterAssistant: "Assistant messages",
			filterErrors: "Errors",
			filterCommands: "Commands",
			filterFiles: "Files",
			workspace: "workspace",
			hitFields: "Hit fields",
			before: "before",
			after: "after",
			selectedHits: "Selected hits",
			clearSelection: "Clear selection",
			addToContext: "Add to current context",
			sendFollowUp: "Send as follow-up",
			contextSent: "Injected into current session",
			contextFallback: "No live agent found; sent as a normal message",
			noCurrentSession: "No current session available",
			noSelection: "Select at least one hit first",
			truncated: " (truncated by budget)",
			excerptMeta: "excerpt"
		};
		//#endregion
		//#region src/client/styles.ts
		/** Injected styles for the search panel. Scoped under .archaeologist-root. */
		function adoptStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("archaeologist-styles")) return;
			const style = document.createElement("style");
			style.id = "archaeologist-styles";
			style.textContent = `
.archaeologist-root button,
.archaeologist-root input {
  font: inherit;
}
.archaeologist-root {
  position: relative;
  min-width: 320px;
  max-width: 720px;
  background: var(--dsh-bg, #15171c);
  color: var(--dsh-fg, #e5e7eb);
  border: 1px solid var(--dsh-border, #333);
  border-radius: 8px;
  padding: 10px;
  z-index: 9999;
  box-shadow: 0 8px 30px rgba(0,0,0,.4);
}
.archaeologist-root .archaeologist-toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}
.archaeologist-root .archaeologist-toolbar h3 {
  margin: 0;
  font-size: 14px;
  flex: 1;
}
.archaeologist-root button {
  cursor: pointer;
  border: 1px solid var(--dsh-border, #444);
  background: var(--dsh-button-bg, #23262d);
  color: inherit;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
}
.archaeologist-root button:hover {
  background: var(--dsh-button-hover-bg, #2c313a);
}
.archaeologist-root .archaeologist-search-row {
  display: flex;
  gap: 6px;
}
.archaeologist-root input[type="text"] {
  flex: 1;
  background: var(--dsh-input-bg, #20242b);
  border: 1px solid var(--dsh-border, #444);
  color: inherit;
  border-radius: 4px;
  padding: 5px 8px;
}
.archaeologist-root select,
.archaeologist-root input[type="date"] {
  background: var(--dsh-input-bg, #20242b);
  border: 1px solid var(--dsh-border, #444);
  color: inherit;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
}
.archaeologist-root .archaeologist-filters {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin: 6px 0;
  font-size: 12px;
}
.archaeologist-root .archaeologist-filters label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.archaeologist-root .archaeologist-selectionbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 6px 0;
  padding: 4px 6px;
  border: 1px solid var(--dsh-border, #333);
  border-radius: 4px;
}
.archaeologist-root .archaeologist-context {
  font-size: 11px;
  color: var(--dsh-muted, #9aa0a6);
  word-break: break-word;
  white-space: normal;
}
.archaeologist-root .archaeologist-quick {
  display: flex;
  gap: 4px;
  margin: 6px 0;
  flex-wrap: wrap;
}
.archaeologist-root .archaeologist-note {
  font-size: 12px;
  color: var(--dsh-muted, #9aa0a6);
}
.archaeologist-root .archaeologist-error {
  color: #ff6b6b;
  font-size: 12px;
}
.archaeologist-root .archaeologist-results {
  max-height: 60vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.archaeologist-root .archaeologist-result {
  border: 1px solid var(--dsh-border, #333);
  border-radius: 6px;
  padding: 6px;
}
.archaeologist-root .archaeologist-result-head {
  display: flex;
  gap: 6px;
  align-items: baseline;
  flex-wrap: wrap;
}
.archaeologist-root .archaeologist-title {
  font-weight: 600;
  font-size: 13px;
}
.archaeologist-root .archaeologist-meta {
  font-size: 11px;
  color: var(--dsh-muted, #9aa0a6);
}
.archaeologist-root .archaeologist-snippet {
  font-size: 12px;
  margin: 4px 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.archaeologist-root .archaeologist-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 11px;
}
.archaeologist-root .archaeologist-badge {
  background: var(--dsh-badge-bg, #262b33);
  border-radius: 4px;
  padding: 1px 5px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.archaeologist-root .archaeologist-timeline {
  border-top: 1px dashed var(--dsh-border, #333);
  margin-top: 8px;
  padding-top: 6px;
  font-size: 12px;
}
.archaeologist-root .archaeologist-timeline pre {
  white-space: pre-wrap;
  font-size: 11px;
  background: var(--dsh-input-bg, #20242b);
  padding: 6px;
  border-radius: 4px;
}
.archaeologist-root .archaeologist-copy {
  margin-left: auto;
}
`;
			document.head.appendChild(style);
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* dsh-session-archaeologist client half.
		* Registers a Toolkit entry; falls back to the sidebar footer action when the
		* Toolkit shell is absent.
		*/
		const inject = ["slots", "locale"];
		function ArchRow({ sessionId, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitEntryRow, {
				title: t("title"),
				subtitle: "Session full-text search",
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, {}),
				onClick: () => openToolkitPanel("dsh-session-archaeologist")
			});
		}
		function apply(ctx) {
			adoptStyles();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-session-archaeologist: dictionaries");
			const t = ctx.locale.bind(NS);
			const currentSessionId = () => ctx.sessions?.list?.getSnapshot?.().current;
			const currentWorkspace = () => {
				const snap = ctx.sessions?.list?.getSnapshot?.();
				const id = snap?.current;
				return id ? snap?.byId?.[id]?.cwd : void 0;
			};
			const sendFollowUp = async (text, mode) => {
				const id = (ctx.sessions?.list?.getSnapshot?.())?.current;
				if (!id) return "no-current-session";
				const binding = ctx.sessions?.binding?.(id);
				if (!binding?.session?.prompt) return "no-current-session";
				const result = await binding.session.prompt([{
					type: "text",
					text
				}], mode);
				if (result && "error" in result && result.error) return result.error.message ?? "send-failed";
				return null;
			};
			ctx.effect(() => registerToolkitEntry({
				id: "dsh-session-archaeologist",
				category: "observe",
				order: 40,
				title: t("title"),
				renderRow: (sessionId) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArchRow, {
					sessionId,
					t
				}),
				renderQuick: () => null,
				renderPanel: (sessionId, onClose) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchPanel, {
					t,
					onClose,
					currentSessionId,
					currentWorkspace,
					sendFollowUp
				})
			}), "dsh-session-archaeologist: toolkit entry");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-session-archaeologist",
				order: 20,
				locale: NS,
				inject: () => ({})
			}, (props) => {
				const shellReady = useToolkitShellReady();
				const [open, setOpen] = (0, react.useState)(false);
				if (shellReady) return null;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					"data-archaeologist-foot": true,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "archaeologist-trigger",
						title: t("open"),
						onClick: () => setOpen((v) => !v),
						children: props.wide ? t("open") : "🔎"
					}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							position: "absolute",
							bottom: 40,
							right: 8
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchPanel, {
							t,
							onClose: () => setOpen(false),
							currentSessionId,
							currentWorkspace,
							sendFollowUp
						})
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
