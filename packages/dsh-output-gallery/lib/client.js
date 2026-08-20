window.__ModuleLoader__.load({
	id: "dsh-output-gallery",
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
		//#region src/core/classify.ts
		/** Human-readable byte size formatting (client display). */
		function formatBytes(size) {
			if (size < 0) return "0 B";
			if (size < 1024) return `${size} B`;
			const units = [
				"KB",
				"MB",
				"GB",
				"TB"
			];
			let value = size;
			let unit = "";
			for (const u of units) {
				value /= 1024;
				unit = u;
				if (value < 1024) break;
			}
			return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
		}
		//#endregion
		//#region src/client/api.ts
		const API = "/plugins/dsh-output-gallery/api";
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
		const galleryApi = {
			list(sessionId, signal) {
				return call("list", { sessionId }, signal);
			},
			refresh(sessionId, turn, signal) {
				return call("refresh", {
					sessionId,
					turn
				}, signal);
			},
			preview(sessionId, path, signal) {
				return call("preview", {
					sessionId,
					path
				}, signal);
			},
			pin(sessionId, path, pinned, signal) {
				return call("pin", {
					sessionId,
					path,
					pinned
				}, signal);
			},
			sessions(signal) {
				return call("sessions", {}, signal);
			},
			config(sessionId, signal) {
				return call("config", { sessionId }, signal);
			},
			clear(sessionId) {
				return call("clear", { sessionId }, void 0);
			}
		};
		//#endregion
		//#region src/client/GalleryPanel.tsx
		/**
		* Gallery panel: session filter + category tabs + file table + live preview.
		*/
		const CATEGORIES = [
			"images",
			"documents",
			"builds",
			"data"
		];
		function GalleryPanel({ sessionId, t, onClose }) {
			const [session, setSession] = (0, react.useState)(null);
			const [sessions, setSessions] = (0, react.useState)([]);
			const [selected, setSelected] = (0, react.useState)(sessionId);
			const [category, setCategory] = (0, react.useState)("all");
			const [deliverablesOnly, setDeliverablesOnly] = (0, react.useState)(false);
			const [previewing, setPreviewing] = (0, react.useState)(null);
			const [previewPayload, setPreviewPayload] = (0, react.useState)(null);
			const [previewLoading, setPreviewLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [tmAvailable, setTmAvailable] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let alive = true;
				fetch("/plugins/dsh-time-machine/api/timeline", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: "{}"
				}).then((res) => {
					if (alive) setTmAvailable(res.status !== 404);
				}).catch(() => {
					if (alive) setTmAvailable(false);
				});
				return () => {
					alive = false;
				};
			}, []);
			const load = (0, react.useCallback)(async (id) => {
				setLoading(true);
				setError(null);
				try {
					const res = await galleryApi.list(id);
					if (!res.ok) throw new Error(res.error.message);
					setSession(res.value.session);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				load(selected);
				galleryApi.sessions().then((res) => {
					if (res.ok) {
						setSessions(res.value.sessions);
						if (res.value.sessions.length > 0 && !res.value.sessions.some((s) => s.sessionId === sessionId)) setSelected(res.value.sessions[0].sessionId);
					}
				}).catch(() => {});
			}, [sessionId]);
			const refresh = (0, react.useCallback)(async () => {
				setLoading(true);
				setError(null);
				try {
					const res = await galleryApi.refresh(selected);
					if (!res.ok) throw new Error(res.error.message);
					const list = await galleryApi.list(selected);
					if (list.ok) setSession(list.value.session);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, [selected]);
			const clear = (0, react.useCallback)(async () => {
				if (!window.confirm(t("clearConfirm"))) return;
				await galleryApi.clear(selected);
				setSession(null);
				setPreviewPayload(null);
				setPreviewing(null);
			}, [selected, t]);
			const togglePin = (0, react.useCallback)(async (file) => {
				const nextPinned = !(session?.pins?.[file.path] === true || file.pinned === true);
				try {
					const res = await galleryApi.pin(selected, file.path, nextPinned);
					if (!res.ok) throw new Error(res.error.message);
					setSession(res.value.session);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			}, [selected, session]);
			const openPreview = (0, react.useCallback)(async (file) => {
				setPreviewing(file);
				setPreviewPayload(null);
				setPreviewLoading(true);
				try {
					const res = await galleryApi.preview(selected, file.path);
					if (!res.ok) throw new Error(res.error.message);
					setPreviewPayload(res.value);
				} catch (err) {
					setPreviewPayload({
						kind: "none",
						reason: err instanceof Error ? err.message : String(err)
					});
				} finally {
					setPreviewLoading(false);
				}
			}, [selected]);
			const changeSession = (0, react.useCallback)((id) => {
				setSelected(id);
				setPreviewing(null);
				setPreviewPayload(null);
				load(id);
			}, [load]);
			const files = (0, react.useMemo)(() => {
				if (!session) return [];
				const byCategory = category === "all" ? session.files : session.files.filter((f) => f.category === category);
				if (!deliverablesOnly) return byCategory;
				return byCategory.filter((f) => f.pinned === true || session.pins?.[f.path] === true);
			}, [
				session,
				category,
				deliverablesOnly
			]);
			const counts = (0, react.useMemo)(() => {
				const c = {
					images: 0,
					documents: 0,
					builds: 0,
					data: 0
				};
				for (const f of session?.files ?? []) c[f.category]++;
				return c;
			}, [session]);
			const versionTurns = (0, react.useCallback)((f) => {
				if (!session) return [];
				const rec = session.versions.find((v) => v.key === f.path.replace(/\\/g, "/"));
				return rec ? rec.turns : [];
			}, [session]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ToolkitPanel, {
				title: t("title"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, {}),
				onClose,
				summary: session ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
					value: session.files.length,
					label: t("categoryAll")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Metric, {
					value: counts.images ?? 0,
					label: t("images")
				})] }) : void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gallery-toolbar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								value: selected,
								onChange: (e) => changeSession(e.target.value),
								title: t("session"),
								children: [sessions.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: selected,
									children: sessionId
								}) : null, sessions.map((s) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: s.sessionId,
									children: s.sessionId
								}, s.sessionId))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void refresh(),
								title: t("refreshHint"),
								children: t("refresh")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "gallery-deliverable-mode",
								title: t("menuDeliverables"),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: deliverablesOnly,
										onChange: (e) => setDeliverablesOnly(e.target.checked)
									}),
									" ",
									t("deliverables")
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void clear(),
								children: t("clear")
							})
						]
					}),
					loading && !session ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gallery-note",
						children: t("loading")
					}) : null,
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gallery-note gallery-error",
						children: error
					}) : null,
					!session ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gallery-note",
						children: t("noFiles")
					}) : null,
					session ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gallery-tabs",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: category === "all" ? "active" : "",
								onClick: () => setCategory("all"),
								children: [
									t("categoryAll"),
									" ",
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gallery-count",
										children: session.files.length
									})
								]
							}), CATEGORIES.map((cat) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: category === cat ? "active" : "",
								onClick: () => setCategory(cat),
								children: [
									t(cat),
									" ",
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gallery-count",
										children: counts[cat]
									})
								]
							}, cat))]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
							className: "gallery-table",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("path") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("type") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("size") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("created") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("modified") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("turn") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("relatedCommand") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("preview") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {})
							] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: files.map((file) => {
								const vt = versionTurns(file);
								const pinned = file.pinned === true || session?.pins?.[file.path] === true;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
									className: `gallery-row${file.changed ? " changed" : ""}`,
									onClick: () => void openPreview(file),
									title: file.path,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
											className: "gallery-path",
											children: [pinned ? `${t("pinnedIndicator")} ` : "", file.path]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [
											file.category,
											" · ",
											file.previewKind,
											file.risk === "danger" ? " ⚠" : ""
										] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: formatBytes(file.size) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: fmtDate(file.created) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: fmtDate(file.modified) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
												t("generatedTurn"),
												" ",
												file.firstSeenTurn
											] }),
											file.modifiedTurn != null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
												t("modifiedTurn"),
												" ",
												file.modifiedTurn
											] }) : null,
											vt.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "gallery-versions",
												children: [
													t("versionHistory"),
													": ",
													vt.map((n) => `${t("turnLabel")} ${n}`).join(" / ")
												]
											}) : null,
											tmAvailable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "gallery-tm-link",
												onClick: (e) => {
													e.stopPropagation();
													[...document.querySelectorAll("button")].find((b) => ["时间机器", "Time Machine"].some((k) => (b.textContent ?? "").includes(k)))?.click();
												},
												children: t("openTimeMachine")
											}) : null
										] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: file.relatedCommand ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "gallery-related",
											children: file.relatedCommand.command
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gallery-note",
											children: t("unknownCommand")
										}) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: file.previewAvailable ? t("previewAvailable") : t("previewUnavailable") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: `gallery-pin${pinned ? " pinned" : ""}`,
											title: t("pinHint"),
											onClick: (e) => {
												e.stopPropagation();
												togglePin(file);
											},
											children: pinned ? t("unpin") : t("pin")
										}) })
									]
								}, file.path);
							}) })]
						}),
						files.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gallery-note",
							children: t("noFiles")
						}) : null
					] }) : null,
					previewing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gallery-preview-box",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: previewing.path }),
							previewing.risk === "danger" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gallery-note gallery-error",
								children: t("dangerFile")
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => void openPreview(previewing),
									children: t("refresh")
								}),
								" ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										setPreviewing(null);
										setPreviewPayload(null);
									},
									children: t("close")
								})
							] }),
							previewLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gallery-note",
								children: t("loading")
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewView, {
								payload: previewPayload,
								sessionId: selected,
								t
							})
						]
					}) : null
				]
			});
		}
		function PreviewView({ payload, sessionId, t }) {
			if (!payload) return null;
			switch (payload.kind) {
				case "image": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					src: payload.dataUrl,
					alt: ""
				});
				case "svg":
				case "html": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
					sandbox: "",
					srcDoc: payload.content,
					title: "sandbox-preview",
					style: {
						width: "100%",
						height: 320,
						border: 0,
						background: "#fff"
					}
				});
				case "json": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					className: "gallery-json",
					children: JSON.stringify(payload.tree, null, 2)
				});
				case "pdf": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
					href: payload.url,
					target: "_blank",
					rel: "noreferrer",
					children: t("openPdf")
				}) });
				case "zip": return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gallery-note",
					children: [payload.entries.length, " entries (listing only — never executed)"]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: payload.entries.map((e) => `${e.isDirectory ? "📁" : "📄"} ${e.name}${e.isDirectory ? "" : ` (${e.size} B)`}`).join("\n") })] });
				case "csv": return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
					className: "gallery-table",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", { children: payload.headers.map((h, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: h }, i)) }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: payload.rows.slice(0, 200).map((row, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", { children: row.map((c, j) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: c }, j)) }, i)) })]
				});
				case "text":
				case "markdown": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: payload.content });
				case "none": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gallery-note",
					children: payload.reason || t("noPreview")
				});
				default: return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gallery-note",
					children: t("noPreview")
				});
			}
		}
		function fmtDate(iso) {
			if (!iso) return "";
			const d = new Date(iso);
			if (Number.isNaN(d.getTime())) return iso;
			const p = (n) => String(n).padStart(2, "0");
			return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
		}
		//#endregion
		//#region src/client/locales.ts
		/** dsh-output-gallery locale namespace. */
		const NS = "dsh-output-gallery";
		const zh = {
			"open": "产物库",
			"title": "Session 产物中心",
			"refresh": "刷新",
			"close": "关闭",
			"loading": "加载中…",
			"error": "加载失败",
			"noFiles": "还没有可展示的产物。Agent 在 turn 结束时写入工作区的文件会出现在这里。",
			"session": "Session",
			"allSessions": "全部 Session",
			"images": "Images",
			"documents": "Documents",
			"builds": "Builds",
			"data": "Data",
			"path": "路径",
			"type": "类型",
			"size": "大小",
			"created": "创建时间",
			"modified": "修改时间",
			"turn": "关联 Turn",
			"preview": "预览",
			"previewAvailable": "可预览",
			"previewUnavailable": "不可预览",
			"versionHistory": "版本历史",
			"turnLabel": "Turn",
			"clear": "清空",
			"clearConfirm": "确定清空该 Session 的产物索引？不会删除工作区文件。",
			"refreshHint": "手动扫描工作区",
			"categoryAll": "全部",
			"noPreview": "该类型暂无预览",
			"dangerFile": "危险文件：仅显示元数据，不执行。",
			"openPdf": "打开 PDF",
			"download": "下载",
			"fileMissing": "文件已不在磁盘",
			"copyPath": "复制路径",
			"generatedTurn": "生成于",
			"modifiedTurn": "修改于",
			"relatedCommand": "相关命令",
			"unknownCommand": "unknown",
			"pin": "设为交付物",
			"unpin": "取消交付物",
			"deliverables": "只看交付物",
			"allFiles": "全部文件",
			"pinnedIndicator": "📌",
			"menuDeliverables": "交付物模式",
			"pinHint": "在顶部「只看交付物」中固定该文件",
			"openTimeMachine": "在时间机器中查看"
		};
		const en = {
			open: "Gallery",
			title: "Session Output Gallery",
			refresh: "Refresh",
			close: "Close",
			loading: "Loading…",
			error: "Failed to load",
			noFiles: "No deliverables yet. Files written by the agent to the workspace appear here at turn boundaries.",
			session: "Session",
			allSessions: "All Sessions",
			images: "Images",
			documents: "Documents",
			builds: "Builds",
			data: "Data",
			path: "Path",
			type: "Type",
			size: "Size",
			created: "Created",
			modified: "Modified",
			turn: "Turn",
			preview: "Preview",
			previewAvailable: "Previewable",
			previewUnavailable: "No preview",
			versionHistory: "Version History",
			turnLabel: "Turn",
			clear: "Clear",
			clearConfirm: "Clear this session's gallery index? Workspace files will not be deleted.",
			refreshHint: "Scan workspace now",
			categoryAll: "All",
			noPreview: "No preview available for this type",
			dangerFile: "Dangerous file: metadata only, never executed.",
			openPdf: "Open PDF",
			download: "Download",
			fileMissing: "File no longer exists on disk",
			copyPath: "Copy path",
			generatedTurn: "Generated in",
			modifiedTurn: "Modified in",
			relatedCommand: "Related command",
			unknownCommand: "unknown",
			pin: "Mark as deliverable",
			unpin: "Unmark deliverable",
			deliverables: "Deliverables only",
			allFiles: "All files",
			pinnedIndicator: "📌",
			menuDeliverables: "Deliverables mode",
			pinHint: "Pin this file to the top-level deliverables view",
			openTimeMachine: "Open in Time Machine"
		};
		//#endregion
		//#region src/client/styles.ts
		/** dsh-output-gallery client styles. Scoped under [data-gallery-root]. */
		function adoptStyles() {
			const id = "dsh-output-gallery-styles";
			if (document.getElementById(id)) return;
			const style = document.createElement("style");
			style.id = id;
			style.textContent = `
[data-gallery-root] .gallery-trigger {
  border: 1px solid rgba(128,128,128,.4);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}
[data-gallery-root] .gallery-panel {
  position: fixed;
  top: 72px;
  right: 16px;
  width: min(720px, 92vw);
  max-height: 80vh;
  overflow: auto;
  background: var(--bg, #ffffff);
  color: var(--fg, #1a1a1a);
  border: 1px solid rgba(128,128,128,.35);
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,.28);
  z-index: 9999;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.5;
}
[data-gallery-root] .gallery-panel h3 { margin: 0 0 8px; font-size: 15px; }
[data-gallery-root] .gallery-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
[data-gallery-root] .gallery-toolbar button {
  border: 1px solid rgba(128,128,128,.4);
  background: transparent; color: inherit; border-radius: 6px; padding: 2px 10px; cursor: pointer;
}
[data-gallery-root] .gallery-toolbar select {
  border: 1px solid rgba(128,128,128,.4);
  border-radius: 6px; background: transparent; color: inherit; padding: 2px 6px;
}
[data-gallery-root] .gallery-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
[data-gallery-root] .gallery-tabs button {
  border: 1px solid transparent; background: transparent; color: inherit;
  border-radius: 12px; padding: 2px 10px; cursor: pointer; opacity: .7;
}
[data-gallery-root] .gallery-tabs button.active { border-color: rgba(128,128,128,.5); opacity: 1; background: rgba(128,128,128,.12); }
[data-gallery-root] .gallery-count { color: rgba(128,128,128,.9); font-weight: normal; }
[data-gallery-root] .gallery-table { width: 100%; border-collapse: collapse; }
[data-gallery-root] .gallery-table th, [data-gallery-root] .gallery-table td {
  text-align: left; padding: 5px 8px; border-bottom: 1px solid rgba(128,128,128,.18); vertical-align: top;
  word-break: break-all;
}
[data-gallery-root] .gallery-table th { font-weight: 600; font-size: 12px; opacity: .7; }
[data-gallery-root] .gallery-row { cursor: pointer; }
[data-gallery-root] .gallery-row:hover { background: rgba(128,128,128,.08); }
[data-gallery-root] .gallery-row.changed td { background: rgba(255,200,0,.08); }
[data-gallery-root] .gallery-path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
[data-gallery-root] .gallery-preview-box {
  margin-top: 10px; border: 1px solid rgba(128,128,128,.3); border-radius: 8px; padding: 10px; background: rgba(128,128,128,.05);
  max-height: 320px; overflow: auto; font-size: 12px;
}
[data-gallery-root] .gallery-preview-box img { max-width: 100%; max-height: 260px; }
[data-gallery-root] .gallery-preview-box pre { white-space: pre-wrap; margin: 0; font-size: 12px; }
[data-gallery-root] .gallery-preview-box iframe { width: 100%; height: 260px; border: none; background: #fff; }
[data-gallery-root] .gallery-json { font-family: ui-monospace, monospace; white-space: pre-wrap; }
[data-gallery-root] .gallery-versions { font-size: 12px; color: #b8860b; }
[data-gallery-root] .gallery-related { font-size: 12px; color: rgba(0,0,0,.55); font-family: ui-monospace, monospace; }
[data-gallery-root] .gallery-pin { border: 1px solid rgba(128,128,128,.4); background: transparent; color: inherit; border-radius: 6px; padding: 1px 6px; cursor: pointer; font-size: 11px; }
[data-gallery-root] .gallery-pin.pinned { border-color: #b8860b; background: rgba(184,134,11,.12); }
[data-gallery-root] .gallery-deliverable-mode { display: inline-flex; align-items: center; gap: 4px; }
[data-gallery-root] .gallery-note { color: rgba(128,128,128,.9); margin: 4px 0; }
[data-gallery-root] .gallery-error { color: #c0392b; }
`;
			document.head.appendChild(style);
		}
		//#endregion
		//#region src/client/index.tsx
		/** dsh-output-gallery client half.
		* Registers a Toolkit entry; falls back to a header button when the Toolkit
		* shell is absent. */
		const inject = ["slots", "locale"];
		function GalleryRow({ sessionId, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolkitEntryRow, {
				title: t("title"),
				subtitle: "Artifacts · deliverables",
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, {}),
				onClick: () => openToolkitPanel("dsh-output-gallery")
			});
		}
		function apply(ctx) {
			adoptStyles();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-output-gallery: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => registerToolkitEntry({
				id: "dsh-output-gallery",
				category: "workspace",
				order: 40,
				title: t("title"),
				renderRow: (sessionId) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GalleryRow, {
					sessionId,
					t
				}),
				renderQuick: () => null,
				renderPanel: (sessionId, onClose) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GalleryPanel, {
					sessionId,
					t,
					onClose
				})
			}), "dsh-output-gallery: toolkit entry");
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "dsh-output-gallery",
				order: 20,
				locale: NS,
				inject: () => ({})
			}, (props) => {
				const shellReady = useToolkitShellReady();
				const [open, setOpen] = (0, react.useState)(false);
				if (shellReady) return null;
				const sessionId = props.sessionId;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					"data-gallery-root": true,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gallery-trigger",
						onClick: () => setOpen((v) => !v),
						children: t("open")
					}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GalleryPanel, {
						sessionId,
						t,
						onClose: () => setOpen(false)
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
