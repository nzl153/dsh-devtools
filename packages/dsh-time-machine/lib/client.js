window.__ModuleLoader__.load({
	id: "dsh-time-machine",
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
		//#region src/client/api.ts
		const API = "/plugins/dsh-time-machine/api";
		async function call(method, body) {
			const res = await fetch(`${API}/${method}`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
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
		const tmApi = {
			timeline(sessionId) {
				return call("timeline", { sessionId });
			},
			preview(sessionId, target, includeContents = false) {
				return call("preview", {
					sessionId,
					...target,
					includeContents
				});
			},
			restore(sessionId, target, confirmed, force = false) {
				return call("restore", {
					sessionId,
					...target,
					confirmed,
					force
				});
			},
			saveAs(sessionId, relPath, confirmed, targetPath) {
				return call("save-as", {
					sessionId,
					relPath,
					confirmed,
					targetPath
				});
			},
			clear(sessionId) {
				return call("clear", { sessionId });
			}
		};
		/** Build per-turn view models from a record (client-side derivation). */
		function buildTurns(record) {
			if (!record) return [];
			return record.turns.map((t) => ({
				turn: t.turn,
				startedAt: t.startedAt,
				endedAt: t.endedAt,
				toolCalls: [...t.toolCalls],
				changes: [...t.changes]
			}));
		}
		//#endregion
		//#region src/client/filters.ts
		function passesFilter(c, state) {
			if (state.fileFilter && !c.relPath.includes(state.fileFilter)) return false;
			if (state.turn !== null && c.source !== null && c.source.turn !== state.turn) return false;
			if (state.mode === "agent" && c.source === null) return false;
			if (state.mode === "baseline" && c.status !== "modified" && c.status !== "deleted" && c.status !== "renamed") return false;
			if (state.mode === "conflict") return c.status === "modified" || c.status === "deleted" || c.status === "renamed";
			return true;
		}
		//#endregion
		//#region src/client/Panel.tsx
		/**
		* dsh-time-machine panel: session timeline + per-file/per-turn diffs +
		* restore preview with explicit confirmation.
		*
		* MVP: no fancy animation. Filters: by file, only agent edits, changed since
		* baseline, conflicts.
		*/
		function Panel({ sessionId, t, onClose }) {
			const [record, setRecord] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [fileFilter, setFileFilter] = (0, react.useState)("");
			const [filterMode, setFilterMode] = (0, react.useState)("all");
			const [turnFilter, setTurnFilter] = (0, react.useState)(null);
			const [previewOpen, setPreviewOpen] = (0, react.useState)(false);
			const [previewTarget, setPreviewTarget] = (0, react.useState)(null);
			const [previews, setPreviews] = (0, react.useState)([]);
			const [previewError, setPreviewError] = (0, react.useState)(null);
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setError(null);
				try {
					const res = await tmApi.timeline(sessionId);
					if (!res.ok) throw new Error(res.error.message);
					setRecord(res.value.record);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, [sessionId]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const turns = (0, react.useMemo)(() => buildTurns(record), [record]);
			const files = (0, react.useMemo)(() => {
				const set = /* @__PURE__ */ new Set();
				for (const turn of turns) for (const c of turn.changes) set.add(c.relPath);
				return Array.from(set).sort();
			}, [turns]);
			const allChanges = (0, react.useMemo)(() => turns.flatMap((t) => t.changes), [turns]);
			const hasConflicts = (0, react.useMemo)(() => previews.some((p) => p.problem !== "ok"), [previews]);
			const turnNumbers = (0, react.useMemo)(() => turns.map((t) => t.turn), [turns]);
			const filteredTurns = (0, react.useMemo)(() => {
				const state = {
					fileFilter,
					mode: filterMode,
					turn: turnFilter
				};
				return turns.map((turn) => ({
					...turn,
					changes: turn.changes.filter((c) => passesFilter(c, state))
				})).filter((turn) => turn.changes.length > 0);
			}, [
				turns,
				fileFilter,
				filterMode,
				turnFilter
			]);
			const runPreview = async (target) => {
				setPreviewError(null);
				const res = await tmApi.preview(sessionId, target, true);
				if (!res.ok) {
					setPreviewError(res.error.message);
					setPreviews([]);
					return;
				}
				setPreviews(res.value.previews);
				setPreviewTarget(target);
				setPreviewOpen(true);
			};
			const confirmRestore = async () => {
				if (!previewTarget) return;
				if (hasConflicts) {
					setPreviewError(t("restoreBlocked"));
					return;
				}
				const res = await tmApi.restore(sessionId, previewTarget, true);
				if (!res.ok) {
					setPreviewError(res.error.message);
					return;
				}
				setPreviews(res.value.results);
				setPreviewOpen(false);
				await load();
			};
			const changeCount = allChanges.length;
			const latestTurn = turnNumbers.at(-1) ?? 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ToolkitPanel, {
				title: t("title"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutline20, {}),
				status: record ? `${changeCount} changes · Turn ${latestTurn}` : void 0,
				onClose,
				summary: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
					value: changeCount,
					label: t("changes")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
					value: latestTurn,
					label: t("currentTurn")
				})] }),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					size: "sm",
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, {}),
					onClick: () => void load(),
					children: t("refresh")
				}), record && turns.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					size: "sm",
					className: "tm-danger",
					onClick: () => void runPreview({ kind: "baseline" }),
					children: t("restoreBaseline")
				}) : null] }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "tm-note",
						children: t("baselineDirtyNotice")
					}),
					record ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "tm-note",
						children: [
							t("baselineTitle"),
							": ",
							t("baselineAt"),
							" ",
							new Date(record.baselineAt).toLocaleString(),
							" ·",
							" ",
							record.baseline.filter((b) => b.dirtyBeforeSession).length,
							" 个 dirty-before-session 文件受保护"
						]
					}) : null,
					loading && !record ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("loading") }) : null,
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "tm-error",
						children: error
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "tm-filters",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("filterByFile"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								list: "tm-files",
								value: fileFilter,
								onChange: (e) => setFileFilter(e.target.value)
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
								id: "tm-files",
								children: files.map((f) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: f }, f))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("filterByTurn"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								value: turnFilter ?? "",
								onChange: (e) => setTurnFilter(e.target.value === "" ? null : Number(e.target.value)),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: t("allTurns")
								}), turnNumbers.map((n) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
									value: n,
									children: ["Turn #", n]
								}, n))]
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: filterMode === "agent",
								onChange: () => setFilterMode(filterMode === "agent" ? "all" : "agent")
							}), t("onlyAgentEdits")] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: filterMode === "baseline",
								onChange: () => setFilterMode(filterMode === "baseline" ? "all" : "baseline")
							}), t("changedSinceBaseline")] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: filterMode === "conflict",
								onChange: () => setFilterMode(filterMode === "conflict" ? "all" : "conflict")
							}), t("conflicts")] })
						]
					}),
					!record ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("notTracking") }) : turns.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("noData") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "tm-turns",
						children: filteredTurns.map((turn) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "tm-turn",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "tm-turn-head",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: ["Turn #", turn.turn] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "tm-muted",
										children: [
											turn.toolCalls.length,
											" tool call(s) ·",
											" ",
											turn.changes.length,
											" change(s)"
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void runPreview({
											kind: "turn",
											turn: turn.turn
										}),
										children: t("restoreTurn")
									})
								]
							}), turn.changes.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChangeRow, {
								change: c,
								t,
								onRestore: () => void runPreview({
									kind: "file",
									relPath: c.relPath,
									to: "baseline"
								})
							}, `${c.relPath}-${c.mtimeMs}`))]
						}, turn.turn))
					}),
					previewOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RestorePreview, {
						sessionId,
						t,
						previews,
						target: previewTarget,
						error: previewError,
						onCancel: () => {
							setPreviewOpen(false);
							setPreviews([]);
						},
						onConfirm: () => void confirmRestore(),
						confirmLabel: hasConflicts ? void 0 : t("confirmRestore"),
						onRestored: () => void load()
					}) : null
				]
			});
		}
		function problemLabel(problem, t) {
			switch (problem) {
				case "ok": return t("ok");
				case "conflict": return t("conflict");
				case "dirty-before-session": return t("dirtyBeforeSession");
				case "agent-did-not-create": return t("agentDidNotCreate");
				case "content-not-stored": return t("contentNotStored");
				case "already-at-target": return t("alreadyAtTarget");
				default: return problem;
			}
		}
		function ChangeRow({ change, t, onRestore }) {
			const statusLabel = change.status === "added" ? t("added") : change.status === "modified" ? t("modified") : change.status === "deleted" ? t("deleted") : change.status === "renamed" ? t("renamed") : t("unchanged");
			const displayPath = change.status === "renamed" && change.oldPath ? `${change.oldPath} → ${change.relPath}` : change.relPath;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "tm-change",
				"data-tm-status": change.status,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "tm-change-head",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "tm-file",
							children: displayPath
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `tm-badge tm-badge-${change.status}`,
							children: statusLabel
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "tm-muted",
							children: [
								change.kind,
								" · +",
								change.addedLines,
								"/-",
								change.removedLines,
								" ",
								t("lines")
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "tm-muted",
							children: change.source ? `#${change.source.turn} ${change.source.toolName ?? ""}` : t("source")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: onRestore,
							children: t("restoreFile")
						})
					]
				}), change.diff ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("diff") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					className: "tm-diff",
					children: change.diff
				})] }) : null]
			});
		}
		function RestorePreview({ sessionId, t, previews, target, error, onCancel, onConfirm, confirmLabel, onRestored }) {
			const [expanded, setExpanded] = (0, react.useState)(null);
			const [feedback, setFeedback] = (0, react.useState)(null);
			const hasConflict = previews.some((p) => p.problem !== "ok");
			previews.filter((p) => p.problem === "conflict");
			const fileTargetFor = (relPath) => {
				if (!target) return null;
				if (target.kind === "file") return target;
				if (target.kind === "baseline") return {
					kind: "file",
					relPath,
					to: "baseline"
				};
				return null;
			};
			const copyOldVersion = async (p) => {
				const text = p.contents?.target ?? "";
				try {
					await navigator.clipboard.writeText(text);
					setFeedback(`${t("copiedToClipboard")}: ${p.relPath}`);
				} catch {
					setFeedback(t("copyFailed"));
				}
			};
			const saveCurrentAs = async (p) => {
				const res = await tmApi.saveAs(sessionId, p.relPath, true);
				if (!res.ok) {
					setFeedback(res.error.message);
					return;
				}
				setFeedback(`${t("savedAs")}: ${res.value.savedPath}`);
			};
			const forceOverwrite = async (p) => {
				const fileTarget = fileTargetFor(p.relPath);
				if (!fileTarget) return;
				if (!window.confirm(t("forceConfirm"))) return;
				const res = await tmApi.restore(sessionId, fileTarget, true, true);
				if (!res.ok) {
					setFeedback(res.error.message);
					return;
				}
				setFeedback(t("forceDone"));
				onRestored();
			};
			const forceAll = async () => {
				if (!target) return;
				if (!window.confirm(t("forceAllConfirm"))) return;
				const res = await tmApi.restore(sessionId, target, true, true);
				if (!res.ok) {
					setFeedback(res.error.message);
					return;
				}
				setFeedback(t("forceDone"));
				onRestored();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "tm-preview",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("restorePreviewTitle") }),
					target?.kind === "file" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "tm-warn",
						children: t("confirmFileWarn")
					}) : null,
					target?.kind === "baseline" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "tm-warn",
						children: t("confirmBaselineWarn")
					}) : null,
					target?.kind === "turn" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "tm-warn",
						children: t("confirmTurnWarn")
					}) : null,
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "tm-error",
						children: error
					}) : null,
					feedback ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "tm-note",
						children: feedback
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: "tm-table",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("files") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("action") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("problem") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("reason") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("operations") })
						] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: previews.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: p.relPath }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: p.action }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: problemLabel(p.problem, t) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: p.reason }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: p.problem === "conflict" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "tm-conflict-actions",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setExpanded(expanded === p.relPath ? null : p.relPath),
										children: t("viewConflict")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void copyOldVersion(p),
										children: t("copyOldVersion")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void saveCurrentAs(p),
										children: t("saveCurrentAs")
									}),
									fileTargetFor(p.relPath) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "tm-danger",
										onClick: () => void forceOverwrite(p),
										children: t("forceOverwrite")
									}) : null
								]
							}) : null })
						] }), expanded === p.relPath ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
							colSpan: 5,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "tm-threeway",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("expected") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
										className: "tm-diff",
										children: p.contents?.expected ?? t("contentUnavailable")
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("current") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
										className: "tm-diff",
										children: p.contents?.current ?? t("contentUnavailable")
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("restoreTarget") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
										className: "tm-diff",
										children: p.contents?.target ?? t("contentUnavailable")
									})] })
								]
							})
						}) }) : null] }, p.relPath)) })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "tm-preview-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: onCancel,
							children: t("cancel")
						}), hasConflict ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "tm-error",
							children: t("restoreBlocked")
						}), target ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "tm-danger",
							onClick: () => void forceAll(),
							children: t("forceAll")
						}) : null] }) : confirmLabel ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "tm-danger",
							onClick: onConfirm,
							children: confirmLabel
						}) : null]
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const NS = "dsh-time-machine";
		const zh = {
			title: "时间机器",
			open: "时间机器",
			close: "关闭",
			changes: "修改",
			currentTurn: "当前 Turn",
			loading: "加载中…",
			error: "加载失败",
			refresh: "刷新",
			noData: "暂无文件修改记录",
			notTracking: "本 session 尚无 baseline，agent 首次修改文件后会自动建立",
			turns: "Turn 修改记录",
			baselineTitle: "Session Baseline",
			baselineAt: "建立于",
			files: "文件",
			status: "状态",
			type: "类型",
			added: "新增",
			modified: "修改",
			deleted: "删除",
			renamed: "重命名",
			unchanged: "未变",
			lines: "行",
			time: "时间",
			source: "来源",
			tool: "工具",
			diff: "Diff",
			filterByFile: "按文件筛选",
			filterByTurn: "按 Turn 筛选",
			allTurns: "全部 Turn",
			showAll: "全部",
			onlyAgentEdits: "仅 Agent 修改",
			changedSinceBaseline: "相对 Baseline 有变化",
			conflicts: "仅冲突",
			restoreFile: "恢复此文件",
			restoreTurn: "恢复此 Turn",
			restoreBaseline: "恢复到 Session Baseline",
			previewRestore: "预览恢复",
			confirmRestore: "确认写回",
			cancel: "取消",
			restorePreviewTitle: "恢复预览",
			action: "操作",
			write: "写回",
			delete: "删除",
			noop: "无操作",
			problem: "状态",
			ok: "安全",
			conflict: "冲突",
			dirtyBeforeSession: "会话前已脏",
			agentDidNotCreate: "Agent 未创建",
			contentNotStored: "内容未存储",
			alreadyAtTarget: "已是目标状态",
			reason: "原因",
			operations: "操作",
			viewConflict: "View conflict",
			copyOldVersion: "Copy old version",
			saveCurrentAs: "Restore to new file",
			forceOverwrite: "Force overwrite",
			forceAll: "Force overwrite all conflicts",
			forceConfirm: "确认强制覆盖？当前用户手动修改的内容将丢失。此操作需要第二次确认。",
			forceAllConfirm: "确认强制覆盖所有冲突文件？用户手动修改的内容将丢失。此操作需要第二次确认。",
			expected: "EXPECTED（记录态）",
			current: "CURRENT（当前磁盘）",
			restoreTarget: "RESTORE TARGET（恢复目标）",
			contentUnavailable: "（内容不可用：二进制/大文件或未存储）",
			copiedToClipboard: "已复制恢复目标版本到剪贴板",
			copyFailed: "复制失败：剪贴板不可用",
			savedAs: "已保存当前版本到",
			forceDone: "强制覆盖完成",
			restoreBlocked: "存在冲突，未写回",
			restoreDone: "已写回 {count} 个文件",
			baselineDirtyNotice: "注意：会话开始前已存在的未提交修改会被保护，绝不自动覆盖。",
			confirmBaselineWarn: "确认恢复到 Session Baseline？此操作会写回 agent 修改过的文件。",
			confirmFileWarn: "确认恢复此文件？恢复前会重新校验 hash，冲突时不会写回。",
			confirmTurnWarn: "确认恢复此 Turn 到其开始状态？"
		};
		const en = {
			title: "Time Machine",
			open: "Time Machine",
			close: "Close",
			changes: "Changes",
			currentTurn: "Current turn",
			loading: "Loading…",
			error: "Load failed",
			refresh: "Refresh",
			noData: "No file changes recorded yet",
			notTracking: "No baseline yet for this session; it is created automatically on the first agent edit",
			turns: "Turn changes",
			baselineTitle: "Session Baseline",
			baselineAt: "Established at",
			files: "File",
			status: "Status",
			type: "Type",
			added: "Added",
			modified: "Modified",
			deleted: "Deleted",
			renamed: "Renamed",
			unchanged: "Unchanged",
			lines: "lines",
			time: "Time",
			source: "Source",
			tool: "Tool",
			diff: "Diff",
			filterByFile: "Filter by file",
			filterByTurn: "Filter by turn",
			allTurns: "All turns",
			showAll: "All",
			onlyAgentEdits: "Only agent edits",
			changedSinceBaseline: "Changed since baseline",
			conflicts: "Conflicts only",
			restoreFile: "Restore this file",
			restoreTurn: "Restore this turn",
			restoreBaseline: "Restore to session baseline",
			previewRestore: "Preview restore",
			confirmRestore: "Confirm write-back",
			cancel: "Cancel",
			restorePreviewTitle: "Restore preview",
			action: "Action",
			write: "Write",
			delete: "Delete",
			noop: "No-op",
			problem: "Status",
			ok: "Safe",
			conflict: "Conflict",
			dirtyBeforeSession: "Dirty before session",
			agentDidNotCreate: "Not created by agent",
			contentNotStored: "Content not stored",
			alreadyAtTarget: "Already at target",
			reason: "Reason",
			operations: "Actions",
			viewConflict: "View conflict",
			copyOldVersion: "Copy old version",
			saveCurrentAs: "Restore to new file",
			forceOverwrite: "Force overwrite",
			forceAll: "Force overwrite all conflicts",
			forceConfirm: "Confirm force overwrite? Your manual changes will be lost. This requires a second confirmation.",
			forceAllConfirm: "Confirm force overwrite of all conflicted files? Manual changes will be lost. This requires a second confirmation.",
			expected: "EXPECTED (recorded)",
			current: "CURRENT (on disk)",
			restoreTarget: "RESTORE TARGET",
			contentUnavailable: "(unavailable: binary/large or not stored)",
			copiedToClipboard: "Copied restore target to clipboard",
			copyFailed: "Copy failed: clipboard unavailable",
			savedAs: "Saved current version to",
			forceDone: "Force overwrite complete",
			restoreBlocked: "Conflicts found; nothing written back",
			restoreDone: "Wrote back {count} file(s)",
			baselineDirtyNotice: "Note: uncommitted changes that existed before the session are protected and never auto-overwritten.",
			confirmBaselineWarn: "Confirm restore to session baseline? This will write back files modified by the agent.",
			confirmFileWarn: "Confirm restoring this file? Hash is re-verified before writing; conflicts are not written back.",
			confirmTurnWarn: "Confirm restoring this turn to its start state?"
		};
		//#endregion
		//#region src/client/styles.ts
		/**
		* Minimal styles for the dsh-time-machine panel. Plain CSS injected into a
		* <style> tag — no framework, no animation (MVP).
		*/
		let applied = false;
		function adoptStyles(doc = document) {
			if (applied) return;
			applied = true;
			const style = doc.createElement("style");
			style.textContent = `
[data-tm-root] { display: inline-block; }
.tm-trigger { cursor: pointer; }
.tm-panel {
  position: fixed; inset: auto 16px 16px auto; width: min(760px, 90vw);
  max-height: 80vh; overflow: auto; z-index: 9999;
  background: #fff; color: #1a1a1a; border: 1px solid #d0d0d0;
  border-radius: 8px; padding: 12px 14px; box-shadow: 0 8px 30px rgba(0,0,0,.18);
  font-size: 13px; font-family: system-ui, sans-serif;
}
.tm-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tm-toolbar h3 { flex: 1; }
.tm-note { color: #666; margin: 4px 0; }
.tm-error { color: #c00; }
.tm-filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 8px 0; }
.tm-turns { margin-top: 8px; }
.tm-turn { border: 1px solid #e2e2e2; border-radius: 6px; margin-bottom: 10px; padding: 8px; }
.tm-turn-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.tm-change { border-top: 1px dashed #eee; padding: 6px 0; }
.tm-change-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tm-file { font-family: ui-monospace, monospace; font-weight: 600; }
.tm-badge { padding: 1px 6px; border-radius: 4px; font-size: 11px; }
.tm-badge-added { background: #e6f7e6; color: #1a7f1a; }
.tm-badge-modified { background: #fff3d6; color: #9a6b00; }
.tm-badge-deleted { background: #fdecec; color: #b00020; }
.tm-badge-renamed { background: #e8f0fe; color: #1a56db; }
.tm-muted { color: #888; font-size: 12px; }
.tm-conflict-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.tm-threeway { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 8px 0; }
.tm-threeway > div { min-width: 0; }
.tm-table .tm-diff { max-height: 200px; overflow: auto; }
.tm-diff {
  background: #f7f7f7; border: 1px solid #eee; padding: 8px; overflow: auto;
  font-family: ui-monospace, monospace; font-size: 12px; white-space: pre;
}
.tm-actions { margin-top: 12px; }
.tm-danger { background: #d33; color: #fff; border: 0; border-radius: 4px; padding: 5px 10px; cursor: pointer; }
.tm-warn { color: #9a6b00; }
.tm-preview { border: 1px solid #d0d0d0; border-radius: 6px; padding: 10px; margin-top: 12px; }
.tm-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.tm-table th, .tm-table td { border: 1px solid #eee; padding: 4px 6px; text-align: left; }
.tm-preview-actions { display: flex; gap: 8px; align-items: center; }
`;
			doc.head.appendChild(style);
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* dsh-time-machine client half.
		* Registers a Toolkit entry and falls back to a compact header button when the
		* Toolkit shell is not installed.
		*/
		const inject = ["slots", "locale"];
		function TmQuick({ sessionId, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitQuickAction, {
				title: t("open"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutline20, {}),
				onClick: () => openToolkitPanel("dsh-time-machine")
			});
		}
		function TmRow({ sessionId, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitEntryRow, {
				title: t("title"),
				subtitle: "Workspace timeline · restore",
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutline20, {}),
				onClick: () => openToolkitPanel("dsh-time-machine")
			});
		}
		function HeaderAction({ sessionId, t }) {
			const shellReady = useToolkitShellReady();
			const [open, setOpen] = (0, react.useState)(false);
			if (shellReady) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-tm-root": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "tm-trigger",
					onClick: () => setOpen((v) => !v),
					children: ["⏱ ", t("open")]
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
			}), "dsh-time-machine: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => registerToolkitEntry({
				id: "dsh-time-machine",
				category: "workspace",
				order: 20,
				title: t("title"),
				quick: true,
				renderRow: (sessionId) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TmRow, {
					sessionId,
					t
				}),
				renderQuick: (sessionId) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TmQuick, {
					sessionId,
					t
				}),
				renderPanel: (sessionId, onClose) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Panel, {
					sessionId,
					t,
					onClose
				})
			}), "dsh-time-machine: toolkit entry");
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "dsh-time-machine",
				order: 20,
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
