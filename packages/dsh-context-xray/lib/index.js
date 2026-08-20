import { readFileSync } from "node:fs";
import { assembleContextFor } from "@deepseek-ai/dsh-agent";
import { deriveEventMessage } from "@deepseek-ai/dsh-session";
import z from "@deepseek-ai/schemastery";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
//#region src/host/api.ts
function trustedRequest(req) {
	const remote = req.socket.remoteAddress;
	if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") return false;
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	const host = req.headers.host;
	if (host === void 0) return false;
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === new URL(`http://${host}`).host;
	} catch {
		return false;
	}
}
async function readJson(req) {
	const chunks = [];
	for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	const text = Buffer.concat(chunks).toString("utf8").trim();
	if (text.length === 0) return {};
	const value = JSON.parse(text);
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
function json(res, status, value) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(value));
}
function ok(value) {
	return {
		ok: true,
		value
	};
}
function fail(code, message) {
	return {
		ok: false,
		error: {
			code,
			message,
			details: {}
		}
	};
}
function requireString(body, key) {
	const value = body[key];
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function registerApi(ctx, analyzer, versions) {
	ctx.effect(() => {
		const base = "/plugins/dsh-context-xray/api";
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/snapshot`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const sessionId = requireString(body, "sessionId");
						if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
						json(res, 200, ok(await analyzer.snapshot(sessionId, { includeBody: body["includeBody"] === true })));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/sessions`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						json(res, 200, ok({ sessions: (ctx.get("sessions")?.list?.() ?? []).map((s) => ({ id: s.id })) }));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/history`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const sessionId = requireString(await readJson(req), "sessionId");
						if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
						json(res, 200, ok({ history: await analyzer.history(sessionId) }));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/diagnostic`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const sessionId = requireString(await readJson(req), "sessionId");
						if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
						json(res, 200, ok(await analyzer.diagnostic(sessionId, versions.dshVersion, versions.pluginVersion)));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/clear`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const sessionId = requireString(await readJson(req), "sessionId");
						await analyzer.clear(sessionId);
						json(res, 200, ok({
							cleared: true,
							sessionId: sessionId ?? null
						}));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			})
		];
		return () => {
			for (const dispose of routes) dispose();
		};
	}, "dsh-context-xray: web routes");
}
//#endregion
//#region src/core/token-metrics/estimate.ts
/**
* Fixed-density heuristic token pricing, intentionally identical to the
* official @deepseek-ai/dsh-token-meter estimator:
*   4 characters ≈ 1 token, plus structural overhead.
* This keeps our per-section/per-tool numbers comparable with the official
* contextBreakdown projection. All values are ESTIMATED unless a provider
* reports exact usage.
*/
const CHARS_PER_TOKEN = 4;
const BLOCK_OVERHEAD = 4;
function estimateText(text) {
	return Math.ceil(text.length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD;
}
function estimateJson(value) {
	return Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD;
}
function estimateBlocks(blocks) {
	let tokens = 0;
	for (const block of blocks) switch (block?.type) {
		case "text":
		case "reasoning":
			tokens += Math.ceil((block.text ?? "").length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD;
			break;
		case "tool-call":
			tokens += Math.ceil((block.name ?? "").length / CHARS_PER_TOKEN) + Math.ceil((block.arguments ?? "").length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD;
			break;
		case "tool-result":
			tokens += estimateBlocks(block.content ?? []) + BLOCK_OVERHEAD;
			break;
		default: tokens += BLOCK_OVERHEAD + Math.ceil(JSON.stringify(block).length / CHARS_PER_TOKEN);
	}
	return tokens;
}
function estimateMessage(message) {
	if (!message) return 0;
	const content = message.content ?? [];
	if (!Array.isArray(content)) return estimateText(String(content)) + 4;
	return estimateBlocks(content) + 4;
}
//#endregion
//#region src/core/pressure/level.ts
const DEFAULT_PRESSURE_THRESHOLDS = {
	elevated: 50,
	high: 75,
	critical: 90
};
function pressureLevel(metrics, thresholds = DEFAULT_PRESSURE_THRESHOLDS) {
	if (metrics.contextWindow === null || metrics.contextWindow <= 0) return null;
	const numerator = metrics.projectedTokens ?? metrics.pressureTokens ?? null;
	if (numerator === null || numerator <= 0) return null;
	const ratio = numerator / metrics.contextWindow * 100;
	if (ratio >= thresholds.critical) return "critical";
	if (ratio >= thresholds.high) return "high";
	if (ratio >= thresholds.elevated) return "elevated";
	return "normal";
}
//#endregion
//#region src/core/analyzer/breakdown.ts
/**
* Pure context-breakdown analyzer.
*
* This module intentionally knows nothing about DSH/Cordis. The host adapter
* feeds it plain message/assembly data; it returns the wire snapshot. Keeping
* it pure makes the classification and token math unit-testable.
*/
const SECTION_SOURCE_RULES = [
	[/^harness:/, "harness"],
	[/^deployment:/, "deployment"],
	[/^tool:/, "tool"],
	[/^agent:/, "agent"],
	[/^workspace:/, "workspace"]
];
function sectionSourceOf(name) {
	for (const [re, source] of SECTION_SOURCE_RULES) if (re.test(name)) return source;
	return "plugin";
}
function isStableSection(section) {
	return !section.text.includes("{{");
}
function sourceKind(source) {
	if (typeof source !== "object" || source === null) return null;
	const kind = source.kind;
	return typeof kind === "string" ? kind : null;
}
function messageHasImage(message) {
	return message.content.some((block) => {
		const b = block;
		return b?.type === "image" || b?.type === "image-ref" || b?.type === "image-url";
	});
}
function classifyMessage(message) {
	if (messageHasImage(message)) return "attachments";
	switch (sourceKind(message.source)) {
		case "agent-instructions": return "workspace";
		case "skill-catalog":
		case "skill-invocation": return "skills";
		case "plugin":
		case "memory":
		case "recall":
		case "relay": return "memory";
		default: return "conversation";
	}
}
const CATEGORY_LABELS = {
	system: "System Prompt",
	conversation: "Conversation",
	tools: "Tool Schemas",
	skills: "Skills",
	memory: "Memory / Injections",
	workspace: "Workspace Instructions",
	attachments: "Attachments",
	other: "Reserved / Other"
};
const PRECISION = "estimated";
function analyze(input) {
	const pressureMetrics = {
		pressureTokens: input.pressureTokens ?? null,
		projectedTokens: input.projectedTokens ?? null,
		contextWindow: input.contextWindow ?? null
	};
	const level = pressureLevel(pressureMetrics, input.thresholds ?? DEFAULT_PRESSURE_THRESHOLDS);
	const categories = /* @__PURE__ */ new Map();
	const add = (key, tokens) => {
		categories.set(key, (categories.get(key) ?? 0) + tokens);
	};
	let systemTokens = 0;
	for (const section of input.assembly.sections) systemTokens += estimateText(section.text);
	for (const context of input.assembly.contexts) systemTokens += estimateText(context.text);
	add("system", systemTokens);
	for (const message of input.messages) {
		const tokens = estimateMessage({ content: message.content });
		add(classifyMessage(message), tokens);
	}
	let toolsTokens = 0;
	for (const tool of input.assembly.tools) toolsTokens += estimateJson({
		name: tool.name,
		description: tool.description ?? "",
		parameters: tool.parameters ?? {}
	});
	add("tools", toolsTokens);
	const categoryEntries = Array.from(categories.entries()).sort((a, b) => b[1] - a[1]).map(([key, tokens]) => ({
		key,
		label: CATEGORY_LABELS[key],
		tokens,
		precision: PRECISION
	}));
	const categoriesTotal = categoryEntries.reduce((sum, c) => sum + c.tokens, 0);
	const knownTotal = input.providerTotalTokens ?? categoriesTotal;
	const otherTokens = Math.max(0, knownTotal - categoriesTotal);
	if (otherTokens > 0 || categories.get("other")) categoryEntries.push({
		key: "other",
		label: CATEGORY_LABELS.other,
		tokens: otherTokens,
		precision: input.providerTotalTokens !== null ? "exact" : "estimated",
		note: input.providerTotalTokens !== null ? "residual of provider-reported total minus heuristic breakdown" : void 0
	});
	const sections = input.assembly.sections.slice().sort((a, b) => a.order - b.order).map((section) => ({
		id: section.name,
		source: sectionSourceOf(section.name),
		order: section.order,
		tokens: estimateText(section.text),
		stable: isStableSection(section),
		preview: section.text.slice(0, 160)
	}));
	const callStats = /* @__PURE__ */ new Map();
	for (const call of input.calls ?? []) {
		const stat = callStats.get(call.name) ?? {
			count: 0,
			lastTime: -1
		};
		stat.count += 1;
		if (call.time !== void 0 && call.time > stat.lastTime) stat.lastTime = call.time;
		callStats.set(call.name, stat);
	}
	const tools = input.assembly.tools.slice().sort((a, b) => a.name.localeCompare(b.name)).map((tool) => {
		const stat = callStats.get(tool.name);
		const callCount = stat?.count ?? (input.calledEver?.includes(tool.name) ? 1 : 0);
		return {
			name: tool.name,
			tokens: estimateJson({
				name: tool.name,
				description: tool.description ?? "",
				parameters: tool.parameters ?? {}
			}),
			schema: tool,
			source: toolSourceOf(tool.name),
			calledThisTurn: input.calledThisTurn.includes(tool.name),
			calledEver: input.calledEver?.includes(tool.name) ?? callCount > 0,
			callCount,
			lastCalledAt: stat && stat.lastTime >= 0 ? new Date(stat.lastTime).toISOString() : null
		};
	});
	const sourceNotes = [
		{
			metric: "tokens",
			note: "All per-section/per-tool/per-category token counts use the official DSH heuristic (4 chars ≈ 1 token + overhead). They are estimates, not provider billing numbers."
		},
		{
			metric: "providerTotalTokens",
			note: input.providerTotalTokens !== null ? "Provider-reported prompt-side pressure from @deepseek-ai/dsh-token-meter contextPressure." : "No provider usage reported yet."
		},
		{
			metric: "toolSource",
			note: "Tool source (builtin/plugin/MCP) is inferred from name prefixes. The runtime API does not expose the registering plugin id."
		}
	];
	return {
		sessionId: input.sessionId,
		turn: input.turn,
		generatedAt: input.generatedAt,
		totalTokens: input.providerTotalTokens,
		contextWindow: input.contextWindow,
		pressure: {
			pressureTokens: pressureMetrics.pressureTokens,
			projectedTokens: pressureMetrics.projectedTokens,
			contextWindow: pressureMetrics.contextWindow,
			level
		},
		categories: categoryEntries,
		sections,
		tools,
		source: sourceNotes
	};
}
function toolSourceOf(name) {
	const lower = name.toLowerCase();
	if (lower.startsWith("mcp__") || lower.startsWith("mcp_") || lower.startsWith("mcp-")) return "mcp";
	if ((/* @__PURE__ */ new Set([
		"bash",
		"read",
		"write",
		"edit",
		"glob",
		"grep",
		"todo",
		"task",
		"skill",
		"subagent",
		"web_search",
		"web_fetch",
		"pwsh",
		"fs",
		"goal",
		"jobs",
		"workflow",
		"ralph",
		"ask_user",
		"str_replace_editor"
	])).has(lower)) return "builtin";
	return "plugin";
}
//#endregion
//#region src/core/diagnostic/diagnostic.ts
function buildDiagnostic(input) {
	const snapshot = input.snapshot;
	return {
		schemaVersion: 1,
		generatedAt: input.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
		dshVersion: input.dshVersion || "unknown",
		pluginVersion: input.pluginVersion || "unknown",
		sessionId: snapshot.sessionId,
		turn: snapshot.turn,
		context: {
			totalTokens: snapshot.totalTokens,
			pressureTokens: snapshot.pressure.pressureTokens,
			projectedTokens: snapshot.pressure.projectedTokens,
			contextWindow: snapshot.contextWindow,
			pressureLevel: snapshot.pressure.level,
			pressureThresholds: input.pressureThresholds,
			categories: snapshot.categories
		},
		sections: snapshot.sections.map((section) => ({
			id: section.id,
			source: section.source,
			order: section.order,
			tokens: section.tokens,
			stable: section.stable
		})),
		tools: snapshot.tools.map((tool) => ({
			name: tool.name,
			tokens: tool.tokens,
			source: tool.source,
			calledThisTurn: tool.calledThisTurn,
			calledEver: tool.calledEver,
			callCount: tool.callCount,
			lastCalledAt: tool.lastCalledAt
		})),
		history: input.history
	};
}
//#endregion
//#region src/host/analyzer.ts
var ContextAnalyzer = class {
	ctx;
	store;
	pressureThresholds;
	constructor(ctx, store, pressureThresholds = DEFAULT_PRESSURE_THRESHOLDS) {
		this.ctx = ctx;
		this.store = store;
		this.pressureThresholds = pressureThresholds;
	}
	async snapshot(sessionId, options = {}) {
		const session = this.ctx.get("sessions")?.get(sessionId);
		if (!session) throw new Error(`session not found: ${sessionId}`);
		const agent = this.ctx.get("agents")?.get(sessionId);
		const systemPrompt = this.ctx.get("systemPrompt");
		const rawAssembly = systemPrompt ? await systemPrompt.assemble(agent ? assembleContextFor(agent) : {}) : {
			sections: [],
			contexts: [],
			tools: []
		};
		const assembly = {
			sections: (rawAssembly.sections ?? []).map((section, index) => ({
				name: section.name ?? `section-${index}`,
				order: index,
				text: section.text ?? ""
			})),
			contexts: (rawAssembly.contexts ?? []).map((context, index) => ({
				name: context.name ?? `context-${index}`,
				text: context.text ?? ""
			})),
			tools: (rawAssembly.tools ?? []).map((tool) => ({
				name: tool.name ?? "?",
				description: tool.description ?? "",
				parameters: tool.parameters ?? {}
			}))
		};
		const messages = this.collectMessages(session);
		const turn = this.latestTurn(session);
		const calledThisTurn = this.toolsCalledInTurn(session, turn);
		const calledEver = this.toolsCalledEver(session);
		const pressure = (this.ctx.get("sessionProjections")?.snapshot?.(session))?.values?.["contextPressure"];
		const toolCalls = this.extractToolCalls(session);
		const coreSnapshot = analyze({
			sessionId,
			turn,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			providerTotalTokens: pressure?.pressureTokens ?? pressure?.projectedTokens ?? null,
			contextWindow: pressure?.contextWindow ?? null,
			pressureTokens: pressure?.pressureTokens ?? null,
			projectedTokens: pressure?.projectedTokens ?? null,
			thresholds: this.pressureThresholds,
			assembly,
			messages,
			calledThisTurn,
			calledEver,
			calls: toolCalls
		});
		if (options.includeBody) {
			const byId = new Map(coreSnapshot.sections.map((s) => [s.id, s]));
			for (const section of rawAssembly.sections ?? []) {
				const metric = byId.get(section.name);
				if (metric) metric.body = section.text;
			}
		}
		await this.recordPoint(sessionId, turn, coreSnapshot);
		return coreSnapshot;
	}
	async history(sessionId) {
		return this.store.read(sessionId);
	}
	async diagnostic(sessionId, dshVersion, pluginVersion) {
		return buildDiagnostic({
			snapshot: await this.snapshot(sessionId),
			history: await this.history(sessionId),
			dshVersion,
			pluginVersion,
			pressureThresholds: this.pressureThresholds
		});
	}
	async recordTurnEnd(sessionId) {
		const session = this.ctx.get("sessions")?.get(sessionId);
		if (!session) return;
		const projection = this.ctx.get("sessionProjections")?.snapshot?.(session);
		const pressure = projection?.values?.["contextPressure"];
		const breakdown = projection?.values?.["contextBreakdown"];
		const turn = this.latestTurn(session);
		const categories = [
			{
				key: "system",
				label: "System Prompt",
				tokens: breakdown?.systemTokens ?? 0,
				precision: "estimated"
			},
			{
				key: "tools",
				label: "Tool Schemas",
				tokens: breakdown?.toolsTokens ?? 0,
				precision: "estimated"
			},
			{
				key: "conversation",
				label: "Conversation",
				tokens: breakdown?.messageTokens ?? 0,
				precision: "estimated"
			}
		];
		const totalTokens = pressure?.pressureTokens ?? pressure?.projectedTokens ?? null;
		const otherTokens = totalTokens === null ? 0 : Math.max(0, totalTokens - categories.reduce((s, c) => s + c.tokens, 0));
		if (otherTokens > 0) categories.push({
			key: "other",
			label: "Reserved / Other",
			tokens: otherTokens,
			precision: "exact"
		});
		const point = {
			turn,
			totalTokens,
			categories,
			toolCalls: this.toolsCalledInTurn(session, turn)
		};
		await this.store.append(sessionId, point);
	}
	async clear(sessionId) {
		await this.store.clear(sessionId);
	}
	collectMessages(session) {
		const out = [];
		for (const event of session.events ?? []) {
			const message = deriveEventMessage(event);
			if (!message) continue;
			const content = Array.isArray(message.content) ? message.content : [];
			const source = event.type === "user/message" ? event.data?.message?.source ?? event.data?.source : void 0;
			out.push({
				seq: event.seq,
				turn: event.data?.turn,
				role: event.type === "user/message" ? "user" : event.type === "assistant/message" ? "assistant" : event.type === "tool/result" ? "tool" : "unknown",
				source,
				content
			});
		}
		return out;
	}
	latestTurn(session) {
		let turn = 0;
		for (const event of session.events ?? []) if (event.type === "turn/start") turn = event.data?.turn ?? turn;
		return turn;
	}
	extractToolCalls(session) {
		const calls = [];
		for (const event of session.events ?? []) {
			if (event.type !== "assistant/message") continue;
			const content = event.data?.message?.content ?? [];
			for (const block of content) if (block?.type === "tool-call" && block.name) calls.push({
				turn: event.data?.turn,
				name: block.name,
				time: event.time
			});
		}
		return calls;
	}
	toolsCalledInTurn(session, turn) {
		return [...new Set(this.extractToolCalls(session).filter((c) => c.turn === turn).map((c) => c.name))];
	}
	toolsCalledEver(session) {
		return [...new Set(this.extractToolCalls(session).map((c) => c.name))];
	}
	async recordPoint(sessionId, turn, snapshot) {
		const point = {
			turn,
			totalTokens: snapshot.totalTokens,
			categories: snapshot.categories,
			toolCalls: snapshot.tools.filter((t) => t.calledThisTurn).map((t) => t.name)
		};
		await this.store.append(sessionId, point);
	}
};
//#endregion
//#region src/host/config.ts
/**
* Host plugin configuration schema.
*
* Thresholds are percentages (0-100) of the provider-reported pressure vs the
* context window. Defaults match the Phase 2 spec: elevated 50%, high 75%,
* critical 90%.
*/
const Config = z.object({ pressureThresholds: z.object({
	elevated: z.number().min(0).max(100).default(50),
	high: z.number().min(0).max(100).default(75),
	critical: z.number().min(0).max(100).default(90)
}) });
//#endregion
//#region src/host/store.ts
/**
* Sidecar history store: ~/.dsh/context-xray/<sessionId>.json
*
* Only metadata/token counts and tool names are persisted. Full prompt text,
* message bodies, and tool schemas are never written to this store.
*/
function historyDir(dshHome = process.env.DSH_HOME ?? join(homedir(), ".dsh")) {
	return join(dshHome, "context-xray");
}
function fileFor(dir, sessionId) {
	return join(dir, `${sessionId.replaceAll(/[^a-zA-Z0-9._-]/g, "_")}.json`);
}
async function createHistoryStore(dir = historyDir()) {
	await mkdir(dir, { recursive: true });
	return {
		async append(sessionId, point) {
			const file = fileFor(dir, sessionId);
			let history = {
				sessionId,
				entries: []
			};
			try {
				const raw = await readFile(file, "utf8");
				history = JSON.parse(raw);
				if (history.sessionId !== sessionId || !Array.isArray(history.entries)) history = {
					sessionId,
					entries: []
				};
			} catch {}
			const next = {
				sessionId,
				entries: [...history.entries.filter((e) => e.turn !== point.turn), point].sort((a, b) => a.turn - b.turn)
			};
			await writeFile(file, JSON.stringify(next, null, 2), "utf8");
		},
		async read(sessionId) {
			try {
				const raw = await readFile(fileFor(dir, sessionId), "utf8");
				return JSON.parse(raw);
			} catch {
				return null;
			}
		},
		async clear(sessionId) {
			if (sessionId === void 0) {
				await rm(dir, {
					recursive: true,
					force: true
				});
				await mkdir(dir, { recursive: true });
				return;
			}
			await rm(fileFor(dir, sessionId), { force: true });
		}
	};
}
//#endregion
//#region src/host/index.ts
/**
* dsh-context-xray host half.
*/
const name = "dsh-context-xray";
const inject = ["webServer"];
function pluginVersion() {
	try {
		const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
		const value = JSON.parse(raw);
		return typeof value.version === "string" ? value.version : "unknown";
	} catch {
		return "unknown";
	}
}
function dshVersionOf(ctx) {
	const safeGet = (key) => {
		try {
			const value = ctx.get?.(key);
			return typeof value === "object" && value !== null ? value : void 0;
		} catch {
			return;
		}
	};
	return [
		safeGet("app")?.version,
		safeGet("root")?.version,
		safeGet("brand")?.version,
		safeGet("version"),
		process.env.DSH_VERSION
	].find((candidate) => typeof candidate === "string" && candidate.length > 0) ?? "unknown";
}
function apply(ctx, config = {}) {
	const thresholds = config.pressureThresholds ?? {};
	const storePromise = createHistoryStore();
	const analyzerPromise = storePromise.then((store) => new ContextAnalyzer(ctx, store, {
		elevated: thresholds.elevated ?? 50,
		high: thresholds.high ?? 75,
		critical: thresholds.critical ?? 90
	}));
	analyzerPromise.then((analyzer) => registerApi(ctx, analyzer, {
		dshVersion: dshVersionOf(ctx),
		pluginVersion: pluginVersion()
	}));
	ctx.effect(() => {
		const consumed = /* @__PURE__ */ new Map();
		const onSessionEvent = (session) => {
			if (!session || session.id === void 0) return;
			const events = session.events ?? [];
			const last = events[events.length - 1];
			if (!last) return;
			const seen = consumed.get(session.id) ?? 0;
			if (last.seq < seen) return;
			consumed.set(session.id, last.seq);
			if (last.type !== "turn/end") return;
			analyzerPromise.then((analyzer) => analyzer.recordTurnEnd(session.id)).catch((error) => {
				ctx.logger.warn(`[dsh-context-xray] turn history record failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		};
		ctx.on("session/event", onSessionEvent);
		return () => {
			consumed.clear();
		};
	}, "dsh-context-xray: turn history");
	ctx.effect(() => {
		return () => {
			storePromise.then((store) => store.clear());
		};
	}, "dsh-context-xray: cleanup (registered async)");
}
//#endregion
export { Config, apply, inject, name };
