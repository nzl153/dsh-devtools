import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { homedir } from "node:os";
import { zstdDecompressSync } from "node:zlib";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region src/host/sqlite.ts
/**
* Sidecar SQLite (FTS5) index for dsh-session-archaeologist.
*
* Uses Node's built-in node:sqlite DatabaseSync — no native npm dependency.
* FTS5 is available in the same SQLite build Node ships (verified on Node 24).
*/
const SCHEMA = `
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0,
  file_size INTEGER NOT NULL DEFAULT 0,
  mtime_ms INTEGER NOT NULL DEFAULT 0,
  doc_count INTEGER NOT NULL DEFAULT 0,
  last_indexed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS excluded_sessions (
  session_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS excluded_workspaces (
  workspace TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
  session_id UNINDEXED,
  seq UNINDEXED,
  time UNINDEXED,
  title UNINDEXED,
  role UNINDEXED,
  source UNINDEXED,
  content,
  meta UNINDEXED,
  tokenize = 'unicode61'
);
`;
function fmt(ms = Date.now()) {
	return new Date(ms).toISOString();
}
/** Escape user input into FTS5 AND-of-quoted-tokens query. */
function toFtsQuery(input) {
	const tokens = input.trim().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return "";
	return tokens.map((tok) => {
		return `"${tok.replaceAll("\"", "\"\"")}"`;
	}).join(" ");
}
/**
* Build a parameterized SQL filter suffix for search.
* Returns { where, params } where `where` is appended after MATCH.
*/
function buildFilters(filters, limit, offset) {
	const clauses = [];
	const params = [];
	if (filters?.sessions && filters.sessions.length > 0) {
		clauses.push(`s.session_id IN (${filters.sessions.map(() => "?").join(",")})`);
		params.push(...filters.sessions);
	}
	if (filters?.workspaces && filters.workspaces.length > 0) {
		clauses.push(`s.workspace IN (${filters.workspaces.map(() => "?").join(",")})`);
		params.push(...filters.workspaces);
	}
	if (typeof filters?.projectPath === "string" && filters.projectPath.length > 0) {
		clauses.push("(s.workspace = ? OR s.workspace LIKE ?)");
		const prefix = filters.projectPath.replace(/[\\/]+$/, "");
		params.push(filters.projectPath, `${prefix}%`);
	}
	if (filters?.source && filters.source.length > 0) {
		clauses.push(`d.source IN (${filters.source.map(() => "?").join(",")})`);
		params.push(...filters.source);
	}
	if (typeof filters?.after === "number") {
		clauses.push("d.time >= ?");
		params.push(filters.after);
	}
	if (typeof filters?.before === "number") {
		clauses.push("d.time < ?");
		params.push(filters.before);
	}
	return {
		where: clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "",
		params
	};
}
function formatContextDoc(doc) {
	return `[${doc.source}] ${doc.content.trim().replace(/\s+/g, " ").slice(0, 200)}`;
}
function contextAround(docs, seq, radius = 3) {
	const idx = docs.findIndex((d) => d.seq === seq);
	if (idx < 0) return {
		before: [],
		after: []
	};
	return {
		before: docs.slice(Math.max(0, idx - radius), idx).map(formatContextDoc),
		after: docs.slice(idx + 1, idx + 1 + radius).map(formatContextDoc)
	};
}
var SessionIndex = class {
	dbPath;
	db;
	constructor(dbPath) {
		this.dbPath = dbPath;
		mkdirSync(dirname(dbPath), { recursive: true });
		this.db = new DatabaseSync(dbPath);
		this.db.exec("PRAGMA journal_mode = WAL");
		this.db.exec("PRAGMA synchronous = NORMAL");
		this.db.exec(SCHEMA);
	}
	close() {
		this.db.close();
	}
	getStatus() {
		const sessions = this.db.prepare("SELECT COUNT(*) AS n FROM sessions").get();
		const docs = this.db.prepare("SELECT COUNT(*) AS n FROM docs").get();
		const exclS = this.db.prepare("SELECT session_id FROM excluded_sessions ORDER BY session_id").all();
		const exclW = this.db.prepare("SELECT workspace FROM excluded_workspaces ORDER BY workspace").all();
		return {
			indexedSessions: sessions.n,
			indexedDocs: docs.n,
			excludedSessions: exclS.map((r) => r.session_id),
			excludedWorkspaces: exclW.map((r) => r.workspace),
			dbPath: this.dbPath
		};
	}
	upsertSession(meta) {
		this.db.prepare(`
      INSERT INTO sessions (session_id, workspace, path, title, created_at, file_size, mtime_ms, doc_count, last_indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        workspace=excluded.workspace,
        path=excluded.path,
        title=excluded.title,
        created_at=excluded.created_at,
        file_size=excluded.file_size,
        mtime_ms=excluded.mtime_ms,
        doc_count=excluded.doc_count,
        last_indexed_at=excluded.last_indexed_at
    `).run(meta.sessionId, meta.workspace, meta.path, meta.title, meta.createdAt, meta.fileSize, meta.mtimeMs, meta.docCount, meta.lastIndexedAt);
	}
	deleteSession(sessionId) {
		this.db.prepare("DELETE FROM docs WHERE session_id = ?").run(sessionId);
		this.db.prepare("DELETE FROM sessions WHERE session_id = ?").run(sessionId);
	}
	insertDocs(sessionId, docs) {
		this.db.prepare("DELETE FROM docs WHERE session_id = ?").run(sessionId);
		const ins = this.db.prepare(`
      INSERT INTO docs (session_id, seq, time, title, role, source, content, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
		for (const d of docs) ins.run(d.sessionId, d.seq, d.time, d.title, d.role, d.source, d.content, d.meta ?? "");
	}
	getSessionMeta(sessionId) {
		const row = this.db.prepare("SELECT * FROM sessions WHERE session_id = ?").get(sessionId);
		if (!row) return null;
		return {
			sessionId: row.session_id,
			workspace: row.workspace,
			path: row.path,
			title: row.title,
			createdAt: row.created_at,
			fileSize: row.file_size,
			mtimeMs: row.mtime_ms,
			docCount: row.doc_count,
			lastIndexedAt: row.last_indexed_at,
			doc_count: row.doc_count
		};
	}
	/** All docs for a session, sorted by seq. */
	getDocsForSession(sessionId) {
		return this.db.prepare("SELECT rowid, session_id, seq, time, title, role, source, content, meta FROM docs WHERE session_id = ? ORDER BY seq ASC").all(sessionId);
	}
	/** Context slice around a seq within a session. */
	getContext(sessionId, seq, radius = 4) {
		return this.db.prepare(`SELECT rowid, session_id, seq, time, title, role, source, content, meta
       FROM docs WHERE session_id = ? AND seq >= ? AND seq <= ?
       ORDER BY seq ASC`).all(sessionId, seq - radius, seq + radius);
	}
	addExcludedSession(sessionId) {
		this.db.prepare("INSERT OR IGNORE INTO excluded_sessions (session_id, created_at) VALUES (?, ?)").run(sessionId, fmt());
	}
	removeExcludedSession(sessionId) {
		this.db.prepare("DELETE FROM excluded_sessions WHERE session_id = ?").run(sessionId);
	}
	addExcludedWorkspace(workspace) {
		this.db.prepare("INSERT OR IGNORE INTO excluded_workspaces (workspace, created_at) VALUES (?, ?)").run(workspace, fmt());
	}
	removeExcludedWorkspace(workspace) {
		this.db.prepare("DELETE FROM excluded_workspaces WHERE workspace = ?").run(workspace);
	}
	clear() {
		this.db.exec("DELETE FROM docs");
		this.db.exec("DELETE FROM sessions");
	}
	getSessionCount() {
		return this.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n;
	}
	search(query, options = {}) {
		const started = Date.now();
		const fts = toFtsQuery(query);
		if (!fts) return {
			query,
			total: 0,
			results: [],
			hits: [],
			tookMs: Date.now() - started
		};
		const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
		const offset = Math.max(options.offset ?? 0, 0);
		const { where, params } = buildFilters(options.filters, limit, offset);
		const countRow = this.db.prepare(`
      SELECT COUNT(*) AS n
      FROM docs d JOIN sessions s ON s.session_id = d.session_id
      WHERE docs MATCH ?
        AND s.session_id NOT IN (SELECT session_id FROM excluded_sessions)
        AND s.workspace NOT IN (SELECT workspace FROM excluded_workspaces)
        ${where}
    `).get(fts, ...params);
		const sql = `
      SELECT d.rowid, d.session_id, d.seq, d.time, d.title, d.role, d.source, d.content,
             s.workspace AS workspace,
             bm25(docs) AS bm
      FROM docs d JOIN sessions s ON s.session_id = d.session_id
      WHERE docs MATCH ?
        AND s.session_id NOT IN (SELECT session_id FROM excluded_sessions)
        AND s.workspace NOT IN (SELECT workspace FROM excluded_workspaces)
        ${where}
      ORDER BY bm25(docs), d.time DESC, d.seq DESC
      LIMIT ? OFFSET ?
    `;
		const rows = this.db.prepare(sql).all(fts, ...params, limit, offset);
		const scores = rows.map((r) => -r.bm);
		const maxScore = scores.length > 0 ? Math.max(...scores) : 1;
		const minScore = scores.length > 0 ? Math.min(...scores) : 0;
		const span = Math.max(maxScore - minScore, 1e-9);
		const sessionDocs = /* @__PURE__ */ new Map();
		const getDocs = (sessionId) => {
			let docs = sessionDocs.get(sessionId);
			if (!docs) {
				docs = this.getDocsForSession(sessionId);
				sessionDocs.set(sessionId, docs);
			}
			return docs;
		};
		const sessionMap = /* @__PURE__ */ new Map();
		const hits = [];
		for (let i = 0; i < rows.length; i++) {
			const r = rows[i];
			const score = scores[i] ?? 0;
			const relevance = Math.round((score - minScore) / span * 100);
			const snippet = this.db.prepare(`SELECT snippet(docs, 6, '[', ']', '…', 12) AS s FROM docs WHERE rowid = ?`).get(r.rowid)?.s ?? r.content.slice(0, 160);
			const ctx = contextAround(getDocs(r.session_id), r.seq);
			hits.push({
				sessionId: r.session_id,
				seq: r.seq,
				time: r.time,
				title: r.title,
				source: r.source,
				role: r.role,
				snippet,
				relevance,
				sessionHitCount: 0,
				workspace: r.workspace,
				contextBefore: ctx.before,
				contextAfter: ctx.after
			});
			const agg = sessionMap.get(r.session_id) ?? {
				score: 0,
				count: 0,
				first: r,
				fields: /* @__PURE__ */ new Set()
			};
			agg.count += 1;
			agg.score += score;
			agg.fields.add(r.source);
			sessionMap.set(r.session_id, agg);
		}
		for (const hit of hits) hit.sessionHitCount = sessionMap.get(hit.sessionId)?.count ?? 1;
		const results = [];
		for (const [sessionId, agg] of sessionMap) {
			const first = agg.first;
			const docsInSession = getDocs(sessionId);
			const filesSet = /* @__PURE__ */ new Set();
			const commandsSet = /* @__PURE__ */ new Set();
			let hasError = false;
			for (const doc of docsInSession) {
				if (doc.source === "tool" || doc.source === "tool-result") {
					for (const m of doc.content.matchAll(/(?:[A-Za-z]:[\\/]|\/)[^\s"']+\.(?:ts|tsx|js|jsx|json|py|md|c|cpp|rs|go|java|sh|ps1|yml|yaml|toml|css|html|sql|mjs|cjs)(?=[\s"')\]]|$)/g)) filesSet.add(m[0].trim());
					if (doc.source === "tool-result" && /error|failed|failure|exception|traceback|exit code/i.test(doc.content)) hasError = true;
				}
				if (doc.source === "tool") {
					const cmd = doc.meta;
					if (cmd && /^(?:bash|pwsh|powershell|cmd|sh|shell|zsh|git|node|npm|pnpm|python)/.test(cmd)) commandsSet.add(cmd);
				}
			}
			const outcome = [...docsInSession].sort((a, b) => b.seq - a.seq).find((d) => d.source === "outcome")?.content ?? null;
			results.push({
				sessionId,
				date: first.time ? new Date(first.time).toISOString() : "",
				title: first.title || "(untitled)",
				workspace: first.workspace,
				relevance: Math.min(100, Math.max(0, Math.round(agg.score / maxScore * 100))),
				hitCount: agg.count,
				snippet: agg.first.content.slice(0, 200),
				hitFields: [...agg.fields],
				files: [...filesSet].slice(0, 30),
				commands: [...commandsSet].slice(0, 20),
				hasError,
				outcome
			});
		}
		results.sort((a, b) => b.relevance - a.relevance || b.hitCount - a.hitCount);
		return {
			query,
			total: countRow.n,
			results,
			hits,
			tookMs: Date.now() - started
		};
	}
};
//#endregion
//#region src/core/token.ts
/**
* Token estimation utilities.
*
* DSH's own token meter uses a 4-char-per-token heuristic; we mirror that so
* UI estimates are consistent with the rest of the harness. This is an estimate,
* never a billing number.
*/
/** Rough token count: CJK chars count ~1 token, else 4 chars ≈ 1 token. */
function estimateTokens(text) {
	if (!text) return 0;
	let cjk = 0;
	let other = 0;
	for (const ch of text) {
		const code = ch.codePointAt(0) ?? 0;
		if (code >= 19968 && code <= 40959 || code >= 12352 && code <= 12543 || code >= 44032 && code <= 55215) cjk += 1;
		else other += 1;
	}
	return Math.ceil(cjk + other / 4);
}
//#endregion
//#region src/core/excerpt.ts
const DEFAULT_OPTIONS = {
	contextRadius: 4,
	maxChars: 8e3,
	maxTokens: 2e3
};
function formatDate(ms) {
	if (!ms) return "unknown";
	return new Date(ms).toISOString();
}
/** Extract the first N actual user/assistant text blocks from docs. */
function originalPrompt(docs) {
	for (const doc of docs) if (doc.source === "user" && doc.content.trim()) return doc.content.trim().slice(0, 1500);
	return "";
}
function hitDocs(docs, hitIds, radius) {
	const bySeq = /* @__PURE__ */ new Map();
	for (const d of docs) bySeq.set(d.seq, d);
	const selected = /* @__PURE__ */ new Set();
	for (const seq of hitIds) {
		const doc = bySeq.get(seq);
		if (!doc) continue;
		selected.add(doc.seq);
		const seqs = [...bySeq.keys()].sort((a, b) => a - b);
		const idx = seqs.indexOf(doc.seq);
		for (let i = Math.max(0, idx - radius); i <= Math.min(seqs.length - 1, idx + radius); i++) {
			const s = seqs[i];
			if (s !== void 0) selected.add(s);
		}
	}
	return [...selected].sort((a, b) => a - b).map((seq) => bySeq.get(seq)).filter(Boolean);
}
const SOURCE_LABEL = {
	user: "user",
	assistant: "assistant",
	reasoning: "reasoning",
	tool: "tool",
	"tool-result": "tool result",
	system: "system",
	file: "file",
	command: "command",
	error: "error",
	outcome: "outcome",
	title: "title"
};
function formatDoc(doc) {
	const label = SOURCE_LABEL[doc.source] ?? doc.role;
	const content = doc.content.trim().replace(/\n+/g, "\n").slice(0, 600);
	return `<${label}${doc.time ? ` [${formatDate(doc.time)}]` : ""}> ${content}`;
}
function extractCodePaths(docs, limit = 20) {
	return [...new Set(docs.filter((d) => d.source === "tool" || d.source === "tool-result").flatMap((d) => d.content.match(/(?:[A-Za-z]:[\\/]|\/)[^\s"']+\.(?:ts|tsx|js|jsx|json|py|md|c|cpp|rs|go|java|sh|ps1|yml|yaml|toml|css|html|sql|mjs|cjs)(?=[\s"')\]]|$)/g) ?? []))].slice(0, limit);
}
function findConclusion(docs) {
	return [...docs].sort((a, b) => b.seq - a.seq).find((d) => d.source === "outcome")?.content ?? null;
}
function buildSection(selection, index, options) {
	const { docs, hitIds } = selection;
	const selected = hitDocs(docs, hitIds, options.contextRadius);
	const prompt = originalPrompt(docs);
	const codePaths = extractCodePaths(docs);
	const conclusion = findConclusion(docs);
	const lines = [
		`## Source ${index}: ${selection.title || "(untitled)"}`,
		`sessionId: ${selection.sessionId}`,
		`date: ${formatDate(selection.createdAt)}`
	];
	if (selection.workspace) lines.push(`workspace: ${selection.workspace}`);
	lines.push("", "### Original user request", prompt || "(none)", "", "### Related messages");
	for (const doc of selected) lines.push(formatDoc(doc));
	if (codePaths.length > 0) {
		lines.push("", "### Related code paths");
		for (const p of codePaths) lines.push(`- ${p}`);
	}
	if (conclusion) lines.push("", "### Conclusion", conclusion);
	return {
		text: lines.join("\n"),
		hits: selected.map((doc) => ({
			sessionId: selection.sessionId,
			source: doc.source,
			role: doc.role,
			seq: doc.seq,
			time: doc.time,
			snippet: doc.content.trim().slice(0, 500)
		})),
		prompt,
		codePaths,
		conclusion,
		hitCount: hitIds.filter((seq) => docs.some((d) => d.seq === seq)).length
	};
}
/**
* Apply both character and token budgets to a text block.
* Returns the largest prefix that fits both budgets. The returned text is
* never longer than `maxChars` and its token estimate never exceeds
* `maxTokens`.
*/
function applyBudgets(text, maxChars, maxTokens) {
	const capChars = Math.max(1, Math.floor(maxChars));
	const capTokens = Math.max(1, Math.floor(maxTokens));
	if (text.length === 0) return "";
	const fits = (len) => {
		const part = text.slice(0, len);
		return part.length <= capChars && estimateTokens(part) <= capTokens;
	};
	const high = Math.min(text.length, capChars);
	if (fits(high)) return text.slice(0, high);
	let lo = 0;
	let hi = high;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if (fits(mid)) lo = mid;
		else hi = mid - 1;
	}
	return text.slice(0, lo);
}
/**
* Build a bounded excerpt from one or more session selections, applying a
* global char/token budget across the combined output.
*/
function buildMultiExcerpt(selections, options = {}) {
	const opts = {
		contextRadius: options.contextRadius ?? DEFAULT_OPTIONS.contextRadius,
		maxChars: options.maxChars ?? DEFAULT_OPTIONS.maxChars,
		maxTokens: options.maxTokens ?? DEFAULT_OPTIONS.maxTokens
	};
	const sections = selections.map((selection, i) => buildSection(selection, i + 1, opts));
	const header = [
		"# Session Excerpt",
		`sources: ${selections.length}`,
		`selected hits: ${sections.reduce((sum, s) => sum + s.hitCount, 0)}`,
		`budget: maxChars=${opts.maxChars}, maxTokens=${opts.maxTokens}`,
		""
	].join("\n");
	const raw = sections.length > 0 ? `${header}\n\n${sections.map((s) => s.text).join("\n\n")}` : `${header}\n\n(no selections)`;
	const text = applyBudgets(raw, opts.maxChars, opts.maxTokens);
	const truncated = text.length < raw.length;
	const allHits = sections.flatMap((s) => s.hits);
	const allCodePaths = [...new Set(sections.flatMap((s) => s.codePaths))].slice(0, 20);
	const firstPrompt = sections.find((s) => s.prompt)?.prompt ?? "";
	const conclusion = sections.find((s) => s.conclusion)?.conclusion ?? null;
	return {
		sessionId: selections[0]?.sessionId ?? "",
		date: selections[0] ? formatDate(selections[0].createdAt) : "",
		title: selections[0]?.title ?? "(untitled)",
		originalPrompt: firstPrompt,
		hits: allHits,
		codePaths: allCodePaths,
		conclusion,
		tokenEstimate: estimateTokens(text),
		text,
		charCount: text.length,
		maxChars: opts.maxChars,
		maxTokens: opts.maxTokens,
		truncated,
		sources: selections.map((selection) => ({
			sessionId: selection.sessionId,
			title: selection.title,
			date: formatDate(selection.createdAt),
			workspace: selection.workspace
		})),
		selectedHitCount: sections.reduce((sum, s) => sum + s.hitCount, 0)
	};
}
/**
* Build a bounded excerpt from a single session (legacy convenience wrapper).
* @param sessionId session id
* @param title session title
* @param createdAt session createdAt (ms)
* @param docs all indexed docs from the session
* @param hitIds selected seq set
*/
function buildExcerpt(sessionId, title, createdAt, docs, hitIds, options = {}) {
	return buildMultiExcerpt([{
		sessionId,
		title,
		createdAt,
		docs,
		hitIds
	}], options);
}
//#endregion
//#region src/host/api.ts
function trustedRequest(req) {
	const remote = req.socket.remoteAddress;
	if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") return false;
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	const host = req.headers.host;
	if (!host) return false;
	const origin = req.headers.origin;
	if (!origin) return true;
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
function str(body, key) {
	const v = body[key];
	return typeof v === "string" && v.length > 0 ? v : void 0;
}
function num(body, key) {
	const v = body[key];
	return typeof v === "number" && Number.isFinite(v) ? v : void 0;
}
function toIndexedDocs(rows) {
	return rows.map((r) => ({
		sessionId: r.session_id,
		seq: r.seq,
		time: r.time,
		title: r.title,
		role: r.role,
		source: r.source,
		content: r.content,
		meta: r.meta
	}));
}
function metaToSelection(index, meta, hitIds, workspace) {
	return {
		sessionId: meta.sessionId,
		title: meta.title,
		createdAt: meta.createdAt,
		workspace: meta.workspace ?? workspace,
		docs: toIndexedDocs(index.getDocsForSession(meta.sessionId)),
		hitIds
	};
}
function registerApi(ctx, deps) {
	ctx.effect(() => {
		const base = "/plugins/dsh-session-archaeologist/api";
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/status`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					json(res, 200, ok(deps.index.getStatus()));
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/search`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const query = str(body, "query");
						if (!query) return json(res, 400, fail("bad-request", "query is required"));
						const filters = body["filters"] ?? void 0;
						const limit = typeof body["limit"] === "number" ? body["limit"] : 50;
						json(res, 200, ok(deps.index.search(query, {
							filters,
							limit
						})));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/index`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const sessionId = str(await readJson(req), "sessionId");
						const { runIndex } = await Promise.resolve().then(() => indexer_exports);
						let result;
						if (sessionId) {
							const target = deps.listSessions().find((s) => s.sessionId === sessionId);
							if (!target) return json(res, 404, fail("not-found", `session ${sessionId} not found`));
							result = runIndex(deps.index, [target], { force: true });
						} else result = runIndex(deps.index, deps.listSessions(), {});
						json(res, 200, ok(result));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/reindex`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const { runIndex } = await Promise.resolve().then(() => indexer_exports);
						json(res, 200, ok(runIndex(deps.index, deps.listSessions(), { force: true })));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/delete-index`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					deps.index.clear();
					json(res, 200, ok({ cleared: true }));
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/exclude`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const sessionId = str(body, "sessionId");
						const workspace = str(body, "workspace");
						const unexclude = body["unexclude"] === true;
						if (!sessionId && !workspace) return json(res, 400, fail("bad-request", "sessionId or workspace required"));
						if (sessionId) if (unexclude) deps.index.removeExcludedSession(sessionId);
						else deps.index.addExcludedSession(sessionId);
						if (workspace) if (unexclude) deps.index.removeExcludedWorkspace(workspace);
						else deps.index.addExcludedWorkspace(workspace);
						json(res, 200, ok(deps.index.getStatus()));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/timeline`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const sessionId = str(await readJson(req), "sessionId");
						if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
						const meta = deps.index.getSessionMeta(sessionId);
						if (!meta) return json(res, 404, fail("not-found", `not indexed: ${sessionId}`));
						const docs = deps.index.getDocsForSession(sessionId);
						const { buildTimeline } = await Promise.resolve().then(() => timeline_exports);
						json(res, 200, ok(buildTimeline(sessionId, meta.title, meta.createdAt, docs, meta?.title ? [] : [], [])));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/excerpt`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const selections = [];
						if (Array.isArray(body["selections"])) for (const item of body["selections"]) {
							if (!item || typeof item !== "object") continue;
							const sel = item;
							const sessionId = str(sel, "sessionId");
							if (!sessionId) continue;
							const hitIds = Array.isArray(sel["hitIds"]) ? sel["hitIds"].filter((x) => typeof x === "number") : [];
							const meta = deps.index.getSessionMeta(sessionId);
							if (!meta) continue;
							selections.push(metaToSelection(deps.index, meta, hitIds));
						}
						else {
							const sessionId = str(body, "sessionId");
							if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
							const hitIds = Array.isArray(body["hitIds"]) ? body["hitIds"].filter((x) => typeof x === "number") : [];
							const meta = deps.index.getSessionMeta(sessionId);
							if (!meta) return json(res, 404, fail("not-found", `not indexed: ${sessionId}`));
							selections.push(metaToSelection(deps.index, meta, hitIds));
						}
						if (selections.length === 0) return json(res, 400, fail("bad-request", "no valid selections"));
						json(res, 200, ok(buildMultiExcerpt(selections, {
							maxChars: num(body, "maxChars"),
							maxTokens: num(body, "maxTokens"),
							contextRadius: num(body, "contextRadius")
						})));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/context`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const sessionId = str(body, "sessionId");
						const text = str(body, "text");
						if (!sessionId || !text) return json(res, 400, fail("bad-request", "sessionId and text are required"));
						const mode = body["mode"] === "steer" ? "steer" : "inject";
						const agent = (ctx.get?.("agents"))?.get(sessionId);
						if (!agent) {
							json(res, 200, ok({
								delivered: false,
								reason: "agent-not-found",
								mode
							}));
							return;
						}
						const message = createUserMessage({
							content: [{
								type: "text",
								text
							}],
							source: {
								kind: "plugin",
								plugin: "dsh-session-archaeologist",
								form: "recall"
							}
						});
						if (mode === "steer") agent.steer(message);
						else agent.inject(message);
						json(res, 200, ok({
							delivered: true,
							mode
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
	}, "dsh-session-archaeologist: web routes");
}
//#endregion
//#region src/host/scanner.ts
/**
* Session scanner: discover DSH session logs on disk and map workspaces.
*
* Layout (dsh-session-persistence-jsonl):
*   <root>/<--normalized-cwd-->/<encoded-id>/session.jsonl.zstd
*
* The workspace mapping lives in ~/.dsh/storages/workspace.json (workspaces →
* path/title). We use it to label workspaces and to support exclude-workspace.
*/
function dshHome(env = process.env.DSH_HOME) {
	return env && env.length > 0 ? env : join(homedir(), ".dsh");
}
function sessionsRoot(home) {
	return join(home, "sessions");
}
function indexRoot(home) {
	return join(home, "session-archaeologist");
}
function defaultIndexDbPath(home) {
	return join(indexRoot(home), "index.db");
}
/** Read workspace.json and return workspace list keyed by path. */
function readWorkspaceMap(home) {
	const map = /* @__PURE__ */ new Map();
	const file = join(home, "storages", "workspace.json");
	let raw;
	try {
		raw = readFileSync(file, "utf8");
	} catch {
		return map;
	}
	try {
		const workspaces = JSON.parse(raw).tables?.workspaces;
		if (workspaces) for (const [id, info] of Object.entries(workspaces)) {
			const path = info.path ?? "";
			const title = info.title ?? (basename(path) || id);
			if (path) map.set(path, {
				id,
				path,
				title
			});
		}
	} catch {}
	return map;
}
/**
* Discover all session files under the sessions root.
* Returns entries sorted by mtime descending (newest first).
*/
function scanSessions(root, workspaceMap = /* @__PURE__ */ new Map()) {
	const out = [];
	let entries;
	try {
		entries = readdirSync(root);
	} catch {
		return out;
	}
	for (const wsDir of entries) {
		const wsPath = join(root, wsDir);
		let st;
		try {
			st = statSync(wsPath);
		} catch {
			continue;
		}
		if (!st.isDirectory()) continue;
		const workspace = resolveWorkspaceLabel(wsDir, workspaceMap);
		let sids;
		try {
			sids = readdirSync(wsPath);
		} catch {
			continue;
		}
		for (const sid of sids) {
			const sessionDir = join(wsPath, sid);
			let dSt;
			try {
				dSt = statSync(sessionDir);
			} catch {
				continue;
			}
			if (!dSt.isDirectory()) continue;
			const file = join(sessionDir, "session.jsonl.zstd");
			let fSt;
			try {
				fSt = statSync(file);
			} catch {
				const alt = join(sessionDir, "session.jsonl");
				try {
					fSt = statSync(alt);
					out.push({
						sessionId: sid,
						workspace,
						path: alt,
						fileSize: fSt.size,
						mtimeMs: fSt.mtimeMs
					});
				} catch {
					continue;
				}
				continue;
			}
			out.push({
				sessionId: sid,
				workspace,
				path: file,
				fileSize: fSt.size,
				mtimeMs: fSt.mtimeMs
			});
		}
	}
	out.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return out;
}
/** Decode the normalized wsDir segment back to a workspace label. */
function resolveWorkspaceLabel(normalizedDir, workspaceMap) {
	for (const info of workspaceMap.values()) if (normalizeWorkspaceDir(info.path) === normalizedDir) return info.path;
	return normalizedDir;
}
/**
* Reproduce DSH's cwd-dir normalization loosely: backslashes → ~0020 etc.
* This is best-effort; when it does not match, the raw token is used as label.
*/
function normalizeWorkspaceDir(cwd) {
	return `--${cwd.replace(/\\/g, "/").replace(/\//g, "~0020")}--`;
}
//#endregion
//#region src/core/zstd.ts
/**
* Minimal Zstandard multi-frame reader for DSH session logs.
*
* DSH JSONL persistence writes a checksummed Zstandard frame per append batch.
* Node's zstdDecompressSync / createZstdDecompress only decode the first frame of
* a concatenated stream, so we must split frame boundaries first and decode each
* complete frame individually. This module is pure Node built-ins: node:zlib.
*
* Reference: DSH dsh-session-persistence-jsonl scanZstdFrames.
*/
const ZSTD_MAGIC = 4247762216;
function leakyBufferReadUIntLE(buf, offset, byteLength) {
	return buf.readUIntLE(offset, byteLength);
}
/**
* Locate complete frames without decompressing their blocks.
* Throws on structurally corrupt complete frames; returns tornStart when EOF
* cuts a frame short.
*/
function scanZstdFrames(buffer, maxFrames = Number.POSITIVE_INFINITY) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return {
			frames,
			tornStart: start
		};
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`corrupt zstd session log: invalid frame magic at byte ${offset}`);
		offset += 4;
		if (offset === buffer.length) return {
			frames,
			tornStart: start
		};
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) throw new Error(`corrupt zstd session log: reserved frame-header bit at byte ${offset - 1}`);
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) return {
			frames,
			tornStart: start
		};
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) return {
				frames,
				tornStart: start
			};
			const blockHeader = leakyBufferReadUIntLE(buffer, offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) throw new Error(`corrupt zstd session log: reserved block type at byte ${offset - 3}`);
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) return {
				frames,
				tornStart: start
			};
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) return {
				frames,
				tornStart: start
			};
			offset += 4;
		}
		frames.push({
			start,
			end: offset
		});
		if (frames.length >= maxFrames) break;
	}
	return { frames };
}
/**
* Decompress a concatenated Zstandard stream into one plain-text Buffer.
* Each complete frame is decoded with zstdDecompressSync (which validates the
* per-frame checksum) and the results are concatenated in order.
*/
function decompressAll(input) {
	const { frames, tornStart } = scanZstdFrames(input);
	if (tornStart !== void 0) throw new Error(`incomplete zstd frame at byte ${tornStart}`);
	const parts = [];
	for (const { start, end } of frames) parts.push(zstdDecompressSync(input.subarray(start, end)));
	return Buffer.concat(parts);
}
/** Convenience: read a session log file and return decoded UTF-8 lines. */
function decodeSessionLog(file) {
	return decompressAll(file instanceof Uint8Array && !Buffer.isBuffer(file) ? Buffer.from(file) : file).toString("utf8").split("\n").filter((line) => line.trim().length > 0);
}
//#endregion
//#region src/core/fields.ts
/**
* Field extraction: filenames, commands, errors, and outcome from DSH events.
* Pure functions, no DSH import.
*/
const WINDOWS_PATH_RE = /(?:[A-Za-z]:[\\/]|(?:\.{1,2}[\\/])+)[^"'\s<>]*[^"'\s<>\\/.]/g;
const POSIX_PATH_RE = /(?:\/[\w.-]+\/|(?:\.{1,2}\/)+)[^"'\s<>]*/g;
const EXT_RE = /\.(?:ts|tsx|js|jsx|json|py|md|c|h|cpp|rs|go|java|sh|ps1|yml|yaml|toml|css|html|sql|mjs|cjs|vue|svelte|zig|rb|php|kt|swift|dart|cs|xml)$/i;
/** Extract plausible file paths from a text blob. */
function extractFileMentions(text, limit = 40) {
	if (!text) return [];
	const out = /* @__PURE__ */ new Set();
	const push = (m) => {
		const clean = m.trim();
		if (!clean) return;
		const norm = clean.replace(/[),"'\]]+$/, "");
		if (norm.length > 1) out.add(norm);
	};
	for (const m of text.matchAll(WINDOWS_PATH_RE)) push(m[0]);
	for (const m of text.matchAll(POSIX_PATH_RE)) if (EXT_RE.test(m[0]) || m[0].includes("/") || m[0].includes("\\")) push(m[0]);
	return [...out].slice(0, limit);
}
/** Extract shell command strings from tool arguments (bash/pwsh/git/…). */
function extractCommands(toolName, argumentsText, limit = 20) {
	if (!toolName || typeof argumentsText !== "string") return [];
	const lower = toolName.toLowerCase();
	if (![
		"bash",
		"pwsh",
		"powershell",
		"cmd",
		"sh",
		"shell",
		"zsh",
		"git",
		"node",
		"npm",
		"pnpm",
		"python"
	].includes(lower)) return [];
	const out = [];
	try {
		const parsed = JSON.parse(argumentsText);
		const candidates = [
			parsed["command"],
			parsed["cmd"],
			parsed["script"],
			parsed["args"]
		];
		for (const c of candidates) if (typeof c === "string" && c.trim()) out.push(c.trim().slice(0, 400));
		else if (Array.isArray(c)) {
			const joined = c.map((x) => String(x)).join(" ");
			if (joined.trim()) out.push(joined.trim().slice(0, 400));
		}
	} catch {}
	if (out.length === 0) for (const m of argumentsText.matchAll(/["'](?:command|cmd|script)["']\s*:\s*["']([^"']{1,400})["']/g)) out.push(m[1]);
	return [...new Set(out.map((c) => c.trim()).filter(Boolean))].slice(0, limit);
}
const ERROR_HINTS = [
	"error",
	"failed",
	"failure",
	"exception",
	"traceback",
	"exit code",
	"non-zero",
	"rejected",
	"timeout",
	"cannot find",
	"not found",
	"ENOENT",
	"EACCES",
	"syntaxerror",
	"typeerror",
	"referenceerror",
	"uncaught"
];
/** Extract error-ish fragments ("summary") from a tool result or assistant text. */
function extractErrors(text, limit = 8) {
	if (!text) return [];
	const out = [];
	const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
	for (const line of lines) {
		const lower = line.toLowerCase();
		if (lower.length > 240) continue;
		if (ERROR_HINTS.some((h) => lower.includes(h))) {
			const sig = line.slice(0, 60);
			if (!out.some((o) => o.slice(0, 60) === sig)) out.push(line);
			if (out.length >= limit) break;
		}
	}
	return out;
}
/** Classify turn/end reason into a human outcome string. */
function outcomeText(reason) {
	if (reason && typeof reason === "object") {
		const r = reason;
		if (typeof r.kind === "string") return r.kind;
	}
	if (typeof reason === "string") return reason;
	return null;
}
//#endregion
//#region src/core/session-parse.ts
function textOfContent(content) {
	if (!Array.isArray(content)) return "";
	const parts = [];
	const walk = (items) => {
		for (const item of items) if (item && typeof item === "object") {
			const p = item;
			if (typeof p.text === "string" && p.text) parts.push(p.text);
			const nested = item.content;
			if (Array.isArray(nested)) walk(nested);
		}
	};
	walk(content);
	return parts.join("\n");
}
function isRealUser(data) {
	if (data && typeof data === "object") return data.source?.kind === "user";
	return false;
}
/** Normalize whitespace for FTS-friendly content. */
function normalize(text) {
	return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}
const DEFAULTS = {
	indexReasoning: true,
	indexToolCalls: true,
	indexSystem: false
};
/**
* Parse one decoded JSONL session into docs + metadata.
* @param lines decoded non-empty JSONL lines
* @param sessionId session id (used to stamp docs)
* @param createdAt fallback createdAt (ignored if header present)
*/
function parseSession(lines, sessionId, createdAt = 0, opts = {}) {
	const o = {
		...DEFAULTS,
		...opts
	};
	const docs = [];
	const files = /* @__PURE__ */ new Set();
	const commands = /* @__PURE__ */ new Set();
	const errors = /* @__PURE__ */ new Set();
	let title = "";
	let realCreatedAt = createdAt;
	let turns = 0;
	let outcome = null;
	const fileLimit = 200;
	const commandLimit = 120;
	const errorLimit = 60;
	for (const line of lines) {
		let ev;
		try {
			ev = JSON.parse(line);
		} catch {
			continue;
		}
		const type = ev.type;
		const seq = typeof ev.seq === "number" ? ev.seq : 0;
		const time = typeof ev.time === "number" ? ev.time : 0;
		const data = ev.data;
		if (type === "session" && data) {
			typeof data["id"] === "string" && data["id"];
			if (typeof data["createdAt"] === "number") realCreatedAt = data["createdAt"];
			continue;
		}
		if (type === "session/title" && data) {
			const t = data.title;
			if (typeof t === "string" && t && !title) title = t.slice(0, 200);
			continue;
		}
		if (type === "turn/start" && data) {
			turns += 1;
			continue;
		}
		if (type === "turn/end" && data) {
			const reason = data.reason;
			const out = outcomeText(reason);
			if (out) {
				outcome = out;
				docs.push({
					sessionId,
					seq,
					time,
					title,
					role: "meta",
					source: "outcome",
					content: `outcome: ${out}`,
					meta: ""
				});
			}
			continue;
		}
		if (type === "user/message" && data) {
			const text = normalize(textOfContent(data.content));
			if (!text) continue;
			const realUser = isRealUser(data);
			if (!realUser && !o.indexSystem) continue;
			const source = realUser ? "user" : "system";
			docs.push({
				sessionId,
				seq,
				time,
				title,
				role: realUser ? "user" : "system",
				source,
				content: text,
				meta: realUser ? "" : "injected"
			});
			if (realUser) for (const f of extractFileMentions(text, fileLimit)) files.add(f);
			continue;
		}
		if (type === "assistant/message" && data) {
			const text = normalize(textOfContent(data.message?.content ?? data["content"]));
			if (!text) continue;
			docs.push({
				sessionId,
				seq,
				time,
				title,
				role: "assistant",
				source: "assistant",
				content: text,
				meta: ""
			});
			for (const f of extractFileMentions(text, fileLimit)) files.add(f);
			continue;
		}
		if (type === "tool/call" && data && o.indexToolCalls) {
			const name = typeof data["name"] === "string" ? data["name"] : "tool";
			const argsRaw = data["arguments"];
			const argsText = typeof argsRaw === "string" ? argsRaw : "";
			const content = `tool: ${name}\n${argsText}`.trim();
			docs.push({
				sessionId,
				seq,
				time,
				title,
				role: "tool",
				source: "tool",
				content,
				meta: name
			});
			for (const c of extractCommands(name, argsText, commandLimit)) commands.add(c);
			for (const f of extractFileMentions(argsText, fileLimit)) files.add(f);
			continue;
		}
		if (type === "tool/result" && data) {
			const text = normalize(textOfContent(data.message?.content ?? data["content"]));
			if (text) {
				docs.push({
					sessionId,
					seq,
					time,
					title,
					role: "tool",
					source: "tool-result",
					content: text.slice(0, 4e3),
					meta: "result"
				});
				for (const e of extractErrors(text, errorLimit)) errors.add(e);
				for (const f of extractFileMentions(text, fileLimit)) files.add(f);
			}
			continue;
		}
		if (type === "text-chunks" && data && o.indexReasoning === false) continue;
		if (type === "reasoning-chunks" && data && o.indexReasoning) {
			const texts = data.texts;
			if (Array.isArray(texts)) {
				const joined = normalize(texts.filter((t) => typeof t === "string").join(""));
				if (joined) docs.push({
					sessionId,
					seq,
					time,
					title,
					role: "assistant",
					source: "reasoning",
					content: joined.slice(0, 3e3),
					meta: "thinking"
				});
			}
			continue;
		}
		if (type === "assistant/chunk" && data && o.indexReasoning) continue;
	}
	const lastTime = docs.reduce((max, d) => Math.max(max, d.time), realCreatedAt);
	const baseSeq = docs.reduce((max, d) => Math.max(max, d.seq), 0);
	const categoryEntries = [
		["command", [...commands].slice(0, commandLimit)],
		["error", [...errors].slice(0, errorLimit)],
		["file", [...files].slice(0, fileLimit)]
	];
	let syntheticIndex = 0;
	for (const [source, items] of categoryEntries) {
		if (items.length === 0) continue;
		syntheticIndex += 1;
		docs.push({
			sessionId,
			seq: baseSeq + syntheticIndex * .01,
			time: lastTime,
			title,
			role: "meta",
			source,
			content: items.join("\n").slice(0, 8e3),
			meta: ""
		});
	}
	return {
		sessionId,
		createdAt: realCreatedAt,
		title: title || "(untitled)",
		docs,
		files: [...files].slice(0, fileLimit),
		commands: [...commands].slice(0, commandLimit),
		errors: [...errors].slice(0, errorLimit),
		outcome,
		turns,
		sizeBytes: 0
	};
}
//#endregion
//#region src/host/indexer.ts
/**
* Incremental indexer: scan session files, decode (zstd), parse, and push into
* the sidecar FTS index. Skips excluded sessions/workspaces and unchanged files.
*/
var indexer_exports = /* @__PURE__ */ __exportAll({
	decodeSessionFile: () => decodeSessionFile,
	parseSessionFile: () => parseSessionFile,
	runIndex: () => runIndex
});
function decodeSessionFile(path) {
	return decodeSessionLog(readFileSync(path));
}
function parseSessionFile(path, sessionId, createdAt = 0) {
	return parseSession(decodeSessionFile(path), sessionId, createdAt);
}
/** Run an incremental index pass. Returns stats. */
function runIndex(index, sessions, options = {}) {
	const result = {
		scanned: 0,
		indexed: 0,
		skippedUnchanged: 0,
		skippedExcluded: 0,
		failed: 0,
		failedIds: [],
		docCount: 0
	};
	const excludedSessions = new Set(index.getStatus().excludedSessions);
	const excludedWorkspaces = new Set(index.getStatus().excludedWorkspaces);
	for (const session of sessions) {
		result.scanned += 1;
		if (excludedSessions.has(session.sessionId)) {
			result.skippedExcluded += 1;
			continue;
		}
		if (excludedWorkspaces.has(session.workspace)) {
			result.skippedExcluded += 1;
			continue;
		}
		const existing = index.getSessionMeta(session.sessionId);
		if (existing !== null && existing.mtimeMs === session.mtimeMs && existing.fileSize === session.fileSize && options.forceSessionId !== session.sessionId && !options.force) {
			result.skippedUnchanged += 1;
			continue;
		}
		try {
			const parsed = parseSessionFile(session.path, session.sessionId);
			const docs = parsed.docs;
			const meta = {
				sessionId: session.sessionId,
				workspace: session.workspace,
				path: session.path,
				title: parsed.title,
				createdAt: parsed.createdAt,
				fileSize: session.fileSize,
				mtimeMs: session.mtimeMs,
				docCount: docs.length,
				lastIndexedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			index.upsertSession(meta);
			index.insertDocs(session.sessionId, docs);
			result.indexed += 1;
			result.docCount += docs.length;
		} catch (error) {
			result.failed += 1;
			result.failedIds.push(session.sessionId);
		}
	}
	return result;
}
//#endregion
//#region src/core/timeline.ts
var timeline_exports = /* @__PURE__ */ __exportAll({ buildTimeline: () => buildTimeline });
function stage(label, detail, confidence) {
	return {
		label,
		detail,
		confidence
	};
}
/** Build a structured timeline from parsed docs (and optionally file/command metadata). */
function buildTimeline(sessionId, title, createdAt, docs, files, commands) {
	const userMsgs = docs.filter((d) => d.source === "user");
	const toolDocs = docs.filter((d) => d.source === "tool");
	docs.filter((d) => d.source === "tool-result");
	const outcomeDoc = [...docs].sort((a, b) => b.seq - a.seq).find((d) => d.source === "outcome");
	const readTools = toolDocs.filter((d) => /tool: (?:read|glob|grep|find|ls|cat|head|tail|list)/.test(d.content));
	const editTools = toolDocs.filter((d) => /tool: (?:write|edit|patch|str_replace_editor|apply|create|delete|move|copy|rename|modify)/.test(d.content));
	const testCommands = commands.filter((c) => /\b(test|check|verify|build|lint|typecheck|run|dev)\b/i.test(c));
	const stages = [];
	const problem = userMsgs[0]?.content.trim() ?? userMsgs.find((d) => d.source === "system")?.content.trim() ?? "";
	stages.push(stage("Problem", problem ? problem.slice(0, 1500) : "No user prompt captured.", problem ? "known" : "unknown"));
	const investLines = userMsgs.slice(1).map((d) => d.content.trim().slice(0, 300));
	if (readTools.length > 0 || investLines.length > 0) {
		const detail = [readTools.length > 0 ? `${readTools.length} inspection tool call(s)` : "", ...investLines.map((l) => `user follow-up: ${l}`)].filter(Boolean).join("\n");
		stages.push(stage("Investigation", detail, readTools.length > 0 ? "known" : "estimated"));
	} else stages.push(stage("Investigation", "No explicit inspection tool calls found.", "estimated"));
	const fileDetail = files.length > 0 ? files.slice(0, 30).join("\n") : "No file mentions detected.";
	stages.push(stage("Files inspected", fileDetail, files.length > 0 ? "known" : "estimated"));
	if (editTools.length > 0) stages.push(stage("Edits", `${editTools.length} edit/write tool call(s)`, "known"));
	else stages.push(stage("Edits", "No edit/write tool calls detected.", "unknown"));
	if (testCommands.length > 0) stages.push(stage("Test", testCommands.slice(0, 10).join("\n"), "known"));
	else stages.push(stage("Test", "No test/build command detected.", "estimated"));
	stages.push(stage("Result", outcomeDoc?.content ?? "No turn/end outcome captured.", outcomeDoc ? "known" : "estimated"));
	return {
		sessionId,
		title: title || "(untitled)",
		createdAt,
		stages,
		generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		local: true
	};
}
//#endregion
//#region src/host/index.ts
const name = "dsh-session-archaeologist";
const inject = ["webServer"];
function apply(ctx) {
	const home = dshHome();
	const index = new SessionIndex(defaultIndexDbPath(home));
	const workspaceMap = readWorkspaceMap(home);
	const root = sessionsRoot(home);
	let cache = null;
	const listSessions = () => {
		if (cache === null) cache = scanSessions(root, workspaceMap);
		return cache;
	};
	registerApi(ctx, {
		index,
		listSessions,
		sessionsRoot: root
	});
	Promise.resolve().then(() => indexer_exports).then(({ runIndex }) => {
		try {
			runIndex(index, listSessions());
		} catch (error) {
			ctx.logger.warn(`[dsh-session-archaeologist] initial index failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}).catch((error) => {
		ctx.logger.warn(`[dsh-session-archaeologist] initial index skipped: ${error instanceof Error ? error.message : String(error)}`);
	});
	ctx.effect(() => {
		return () => {
			try {
				index.close();
			} catch {}
		};
	}, "dsh-session-archaeologist: cleanup");
}
//#endregion
export { SessionIndex, apply, buildExcerpt, buildMultiExcerpt, buildTimeline, decodeSessionLog, defaultIndexDbPath, inject, name, parseSession, readWorkspaceMap, runIndex, scanSessions, sessionsRoot };
