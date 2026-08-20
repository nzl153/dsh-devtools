//#region src/core/classify.ts
/** Executable / dangerous-to-execute extensions: metadata only, never executed,
* and never opened as a sandbox preview. */
const DANGEROUS = /* @__PURE__ */ new Set([
	"exe",
	"msi",
	"bat",
	"cmd",
	"com",
	"scr",
	"ps1",
	"psm1",
	"dll",
	"so",
	"dylib",
	"sh",
	"bash",
	"zsh",
	"fish",
	"pyc",
	"pyo",
	"class",
	"jar",
	"app",
	"appimage",
	"deb",
	"rpm",
	"apk",
	"msix",
	"dmg",
	"pkg",
	"vb",
	"vbs",
	"js"
]);
const RULES = {
	png: {
		category: "images",
		preview: "image",
		mime: "image/png"
	},
	jpg: {
		category: "images",
		preview: "image",
		mime: "image/jpeg"
	},
	jpeg: {
		category: "images",
		preview: "image",
		mime: "image/jpeg"
	},
	gif: {
		category: "images",
		preview: "image",
		mime: "image/gif"
	},
	webp: {
		category: "images",
		preview: "image",
		mime: "image/webp"
	},
	bmp: {
		category: "images",
		preview: "image",
		mime: "image/bmp"
	},
	avif: {
		category: "images",
		preview: "image",
		mime: "image/avif"
	},
	ico: {
		category: "images",
		preview: "image",
		mime: "image/x-icon"
	},
	svg: {
		category: "images",
		preview: "svg",
		mime: "image/svg+xml"
	},
	html: {
		category: "documents",
		preview: "html",
		mime: "text/html",
		risk: "watch"
	},
	htm: {
		category: "documents",
		preview: "html",
		mime: "text/html",
		risk: "watch"
	},
	pdf: {
		category: "documents",
		preview: "pdf",
		mime: "application/pdf"
	},
	md: {
		category: "documents",
		preview: "markdown",
		mime: "text/markdown"
	},
	markdown: {
		category: "documents",
		preview: "markdown",
		mime: "text/markdown"
	},
	txt: {
		category: "documents",
		preview: "text",
		mime: "text/plain"
	},
	rtf: {
		category: "documents",
		preview: "text",
		mime: "application/rtf"
	},
	docx: {
		category: "documents",
		preview: "none",
		mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	},
	doc: {
		category: "documents",
		preview: "none",
		mime: "application/msword"
	},
	pptx: {
		category: "documents",
		preview: "none",
		mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	},
	xlsx: {
		category: "documents",
		preview: "none",
		mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	},
	zip: {
		category: "builds",
		preview: "zip",
		mime: "application/zip"
	},
	tar: {
		category: "builds",
		preview: "zip",
		mime: "application/x-tar"
	},
	gz: {
		category: "builds",
		preview: "zip",
		mime: "application/gzip"
	},
	"tar.gz": {
		category: "builds",
		preview: "zip",
		mime: "application/gzip"
	},
	"tgz": {
		category: "builds",
		preview: "zip",
		mime: "application/gzip"
	},
	"7z": {
		category: "builds",
		preview: "zip",
		mime: "application/x-7z-compressed"
	},
	rar: {
		category: "builds",
		preview: "zip",
		mime: "application/vnd.rar"
	},
	exe: {
		category: "builds",
		preview: "none",
		mime: "application/x-msdownload",
		risk: "danger"
	},
	msi: {
		category: "builds",
		preview: "none",
		mime: "application/x-msi",
		risk: "danger"
	},
	apk: {
		category: "builds",
		preview: "none",
		mime: "application/vnd.android.package-archive",
		risk: "danger"
	},
	dmg: {
		category: "builds",
		preview: "none",
		mime: "application/x-apple-diskimage",
		risk: "danger"
	},
	deb: {
		category: "builds",
		preview: "none",
		mime: "application/vnd.debian.binary-package",
		risk: "danger"
	},
	rpm: {
		category: "builds",
		preview: "none",
		mime: "application/x-rpm",
		risk: "danger"
	},
	jar: {
		category: "builds",
		preview: "none",
		mime: "application/java-archive",
		risk: "danger"
	},
	wasm: {
		category: "builds",
		preview: "none",
		mime: "application/wasm",
		risk: "watch"
	},
	json: {
		category: "data",
		preview: "json",
		mime: "application/json"
	},
	csv: {
		category: "data",
		preview: "csv",
		mime: "text/csv"
	},
	tsv: {
		category: "data",
		preview: "csv",
		mime: "text/tab-separated-values"
	},
	yaml: {
		category: "data",
		preview: "code",
		mime: "application/yaml"
	},
	yml: {
		category: "data",
		preview: "code",
		mime: "application/yaml"
	},
	xml: {
		category: "data",
		preview: "code",
		mime: "application/xml"
	},
	toml: {
		category: "data",
		preview: "code",
		mime: "application/toml"
	},
	ini: {
		category: "data",
		preview: "code",
		mime: "text/plain"
	},
	cfg: {
		category: "data",
		preview: "code",
		mime: "text/plain"
	},
	conf: {
		category: "data",
		preview: "code",
		mime: "text/plain"
	},
	log: {
		category: "data",
		preview: "text",
		mime: "text/plain"
	},
	ts: {
		category: "documents",
		preview: "code",
		mime: "text/typescript"
	},
	tsx: {
		category: "documents",
		preview: "code",
		mime: "text/typescript-jsx"
	},
	js: {
		category: "documents",
		preview: "code",
		mime: "text/javascript",
		risk: "watch"
	},
	jsx: {
		category: "documents",
		preview: "code",
		mime: "text/jsx",
		risk: "watch"
	},
	mjs: {
		category: "documents",
		preview: "code",
		mime: "text/javascript",
		risk: "watch"
	},
	cjs: {
		category: "documents",
		preview: "code",
		mime: "text/javascript",
		risk: "watch"
	},
	py: {
		category: "documents",
		preview: "code",
		mime: "text/x-python",
		risk: "watch"
	},
	rs: {
		category: "documents",
		preview: "code",
		mime: "text/rust"
	},
	go: {
		category: "documents",
		preview: "code",
		mime: "text/x-go"
	},
	java: {
		category: "documents",
		preview: "code",
		mime: "text/x-java"
	},
	c: {
		category: "documents",
		preview: "code",
		mime: "text/x-c"
	},
	h: {
		category: "documents",
		preview: "code",
		mime: "text/x-c-header"
	},
	cpp: {
		category: "documents",
		preview: "code",
		mime: "text/x-c++"
	},
	cs: {
		category: "documents",
		preview: "code",
		mime: "text/x-csharp"
	},
	css: {
		category: "documents",
		preview: "code",
		mime: "text/css"
	},
	scss: {
		category: "documents",
		preview: "code",
		mime: "text/x-scss"
	},
	sql: {
		category: "documents",
		preview: "code",
		mime: "text/x-sql"
	},
	graphql: {
		category: "documents",
		preview: "code",
		mime: "application/graphql"
	},
	dockerfile: {
		category: "documents",
		preview: "code",
		mime: "text/plain"
	},
	jsonc: {
		category: "data",
		preview: "json",
		mime: "application/json"
	}
};
/** Known printable text/code extensions for generic fallback. */
const TEXT_CODES = /* @__PURE__ */ new Set([
	"txt",
	"md",
	"markdown",
	"ts",
	"tsx",
	"js",
	"jsx",
	"mjs",
	"cjs",
	"py",
	"rs",
	"go",
	"java",
	"c",
	"h",
	"cpp",
	"cs",
	"css",
	"scss",
	"sql",
	"graphql",
	"yaml",
	"yml",
	"xml",
	"toml",
	"ini",
	"cfg",
	"conf",
	"log",
	"json",
	"jsonc",
	"csv",
	"tsv",
	"sh",
	"bash",
	"zsh",
	"fish",
	"ps1",
	"bat",
	"cmd",
	"html",
	"htm"
]);
/** Extract a normalized extension (lowercase, handles dotted like tar.gz). */
function extensionOf(filename) {
	const lower = (filename.split(/[\\/]/).pop() ?? filename).toLowerCase();
	for (const ext of ["tar.gz", "tar.xz"]) if (lower.endsWith(`.${ext}`)) return ext;
	const idx = lower.lastIndexOf(".");
	return idx > 0 ? lower.slice(idx + 1) : "";
}
/** Guess an overall MIME for files with no rule. */
function guessMime(ext) {
	if (ext === "ts" || ext === "tsx") return "text/typescript";
	if (TEXT_CODES.has(ext)) return "text/plain";
	if (/^[0-9a-z]{2,4}$/.test(ext)) return `application/octet-stream`;
	return "application/octet-stream";
}
/** Classify a filename into category/preview/mime/risk. */
function classifyPath(filename) {
	const ext = extensionOf(filename);
	const rule = RULES[ext];
	if (rule) return {
		category: rule.category,
		previewKind: rule.preview ?? "none",
		mime: rule.mime,
		risk: rule.risk ?? (DANGEROUS.has(ext) ? "danger" : "safe")
	};
	if (DANGEROUS.has(ext)) return {
		category: "builds",
		previewKind: "none",
		mime: guessMime(ext),
		risk: "danger"
	};
	if (TEXT_CODES.has(ext)) return {
		category: "documents",
		previewKind: "code",
		mime: guessMime(ext),
		risk: "safe"
	};
	return {
		category: "data",
		previewKind: "none",
		mime: guessMime(ext),
		risk: "safe"
	};
}
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
//#region src/core/filter.ts
/** Directories always skipped (cannot be overridden by `include`). */
const HARD_IGNORED_DIRS = /* @__PURE__ */ new Set([
	"node_modules",
	".git",
	".svn",
	".hg",
	"dist/.cache",
	".cache",
	"tmp",
	".tmp",
	".next/cache",
	"coverage/.nyc_output",
	"coverage"
]);
/** Temp/build fragment filename patterns skipped (unless explicitly included). */
const HARD_SKIP_PATTERNS = [
	/\.(tsbuildinfo|d\.map|map)$/i,
	/~$/,
	/^\.#/,
	/(^|\/)\.DS_Store$/,
	/(^|\/)Thumbs\.db$/i,
	/(^|\/)(\.[a-zA-Z0-9_-]+\.swp|.*\.swp)$/
];
/** Default sets used when no config overrides. */
const DEFAULT_CONFIG = {
	enabled: true,
	include: [],
	exclude: [],
	ignoreDirs: [
		"node_modules",
		".git",
		".svn",
		".hg",
		".cache",
		"tmp",
		".tmp",
		"coverage",
		".nyc_output",
		".next/cache"
	],
	avoid: [
		"**/*.tsbuildinfo",
		"**/*.map",
		"**/.DS_Store",
		"**/Thumbs.db",
		"**/*.tmp",
		"**/*.swp",
		"**/node_modules/**"
	],
	trackVersions: true,
	maxFiles: 5e3,
	htmlSandbox: true
};
/** basename of the per-workspace config file, read relative to workspace root. */
const CONFIG_FILE = ".dsh/output-gallery.yml";
/** Normalize a glob-ish pattern for matching later. */
function normalizePattern(pattern) {
	return pattern.trim().replace(/^\.\//, "").replace(/\\/g, "/").replace(/^\/+/, "");
}
function globToRegExp(pattern) {
	let out = "";
	for (let i = 0; i < pattern.length; i++) {
		const ch = pattern[i];
		if (ch === "*") {
			if (pattern[i + 1] === "*") {
				if (pattern[i + 2] === "/") {
					out += "(?:.*/)?";
					i += 2;
				} else {
					out += ".*";
					i += 1;
				}
				continue;
			}
			out += "[^/]*";
			continue;
		}
		if (ch === "?") {
			out += "[^/]";
			continue;
		}
		out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	}
	return new RegExp(`^${out}/?$`);
}
/** Match a relative posix path against one glob pattern. */
function matchesPattern(relPath, pattern) {
	const norm = normalizePattern(pattern);
	if (!norm) return false;
	if (norm.endsWith("/")) return relPath === norm.replace(/\/$/, "") || relPath.startsWith(norm);
	try {
		return globToRegExp(norm).test(relPath);
	} catch {
		return false;
	}
}
/** Return whether a path matches any of the patterns. */
function matchesAny(relPath, patterns) {
	return patterns.some((pattern) => matchesPattern(relPath, pattern));
}
/** Default conservative skip for build artifacts that pass extension rules. */
function isSkippableNoise(relPath) {
	const lower = relPath.toLowerCase();
	if (/\.[a-z0-9]+\.(map|tsbuildinfo|d\.map)$/i.test(lower)) return true;
	if (/(^|\/)\.DS_Store$|(^|\/)thumbs\.db$/i.test(lower)) return true;
	if (/\.tmp$|~$/.test(lower)) return true;
	return false;
}
/**
* Decide whether a relative path should be tracked given config.
* Exclusion wins over inclusion. Hard-ignored dirs always excluded unless
* explicitly included by an include pattern (documented conservative default).
*/
function shouldTrack(relPath, config) {
	if (!config.enabled) return false;
	const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
	const segments = normalized.split("/");
	const included = config.include.length > 0 && matchesAny(normalized, config.include);
	for (let i = 0; i < segments.length - 1; i++) {
		const seg = segments[i];
		if (HARD_IGNORED_DIRS.has(seg) || config.ignoreDirs.includes(seg)) {
			if (included) break;
			return false;
		}
	}
	for (const pat of HARD_SKIP_PATTERNS) if (pat.test(normalized) && !matchesAny(normalized, config.include)) return false;
	if (matchesAny(normalized, config.avoid) && !matchesAny(normalized, config.include)) return false;
	if (matchesAny(normalized, config.exclude)) return false;
	if (config.include.length > 0 && !matchesAny(normalized, config.include)) return false;
	return true;
}
/** Apply the rule set to a batch of relative paths, returning the kept ones. */
function filterPaths(paths, config) {
	return paths.filter((p) => shouldTrack(p, config));
}
/**
* Parse a small YAML subset used by `.dsh/output-gallery.yml`.
* Supports `key: scalar`, `key: [a, b]`, and `#` comments. Returns null on
* parse errors (caller falls back to defaults).
*/
function parseConfigYml(text) {
	const out = {};
	let ok = true;
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const idx = line.indexOf(":");
		if (idx <= 0) {
			ok = false;
			continue;
		}
		const key = line.slice(0, idx).trim();
		let value = line.slice(idx + 1).trim();
		const comment = value.indexOf(" #");
		if (comment >= 0) value = value.slice(0, comment).trim();
		if (value.startsWith("[") && value.endsWith("]")) applyYmlList(out, key, value.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean));
		else if (value === "true" || value === "false") {
			const bool = value === "true";
			switch (key) {
				case "enabled":
					out.enabled = bool;
					break;
				case "trackVersions":
					out.trackVersions = bool;
					break;
				case "htmlSandbox":
					out.htmlSandbox = bool;
					break;
			}
		} else if (/^\d+$/.test(value) && key === "maxFiles") out.maxFiles = Number(value);
		else if (value) applyYmlList(out, key, [value]);
	}
	return ok ? out : out;
}
function applyYmlList(out, key, items) {
	switch (key) {
		case "include":
			out.include = items;
			break;
		case "exclude":
			out.exclude = items;
			break;
		case "ignoreDirs":
			out.ignoreDirs = items;
			break;
		case "avoid":
			out.avoid = items;
			break;
	}
}
/** Merge a parsed config over defaults. */
function mergeConfig(base, parsed) {
	if (!parsed) return base;
	return {
		enabled: parsed.enabled ?? base.enabled,
		include: parsed.include ?? base.include,
		exclude: parsed.exclude ?? base.exclude,
		ignoreDirs: parsed.ignoreDirs ?? base.ignoreDirs,
		avoid: parsed.avoid ?? base.avoid,
		trackVersions: parsed.trackVersions ?? base.trackVersions,
		maxFiles: parsed.maxFiles ?? base.maxFiles,
		htmlSandbox: parsed.htmlSandbox ?? base.htmlSandbox
	};
}
/** Derive a plain filter view for tests/reporting. */
function toFilter(config) {
	return {
		include: config.include,
		exclude: config.exclude,
		ignoreDirs: config.ignoreDirs,
		skipPatterns: config.avoid
	};
}
//#endregion
//#region src/core/version.ts
/**
* Normalize an observation key (relative posix path, no leading slash).
*/
function normalizeKey(path) {
	return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}
/** Equality of a size+mtime observation (change detection). */
function sameVersion(a, b) {
	return a.size === b.size && a.modified === b.modified;
}
/** Build per-path version history from cumulative observations (ascending turns). */
function buildVersionHistory(observations) {
	const byKey = /* @__PURE__ */ new Map();
	for (const obs of observations) {
		const key = normalizeKey(obs.key);
		const list = byKey.get(key);
		if (list) list.push(obs);
		else byKey.set(key, [obs]);
	}
	const out = [];
	for (const [key, list] of byKey) {
		const sorted = [...list].sort((a, b) => a.turn - b.turn);
		const turns = [];
		let previous = null;
		for (const obs of sorted) {
			if (!previous || !sameVersion(previous, obs)) turns.push(obs.turn);
			previous = obs;
		}
		const last = sorted[sorted.length - 1];
		out.push({
			key,
			turns,
			size: last.size,
			modified: last.modified,
			created: sorted[0].created
		});
	}
	return out.sort((a, b) => a.key.localeCompare(b.key));
}
/**
* Append a scan observation set to an existing version history (incremental).
* Preserves the full existing turn lists: for each new observation, a turn is
* appended only when the observed size/mtime differs from the record's latest.
*/
function mergeVersionHistory(existing, newObservations) {
	const byKey = /* @__PURE__ */ new Map();
	for (const rec of existing) byKey.set(normalizeKey(rec.key), {
		...rec,
		turns: [...rec.turns]
	});
	for (const obs of newObservations) {
		const key = normalizeKey(obs.key);
		const rec = byKey.get(key);
		if (!rec) {
			byKey.set(key, {
				key,
				turns: [obs.turn],
				size: obs.size,
				modified: obs.modified,
				created: obs.created
			});
			continue;
		}
		if (!sameVersion({
			size: rec.size,
			modified: rec.modified
		}, {
			size: obs.size,
			modified: obs.modified
		})) {
			rec.turns.push(obs.turn);
			rec.size = obs.size;
			rec.modified = obs.modified;
			if (!rec.created) rec.created = obs.created;
		}
	}
	return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}
/** Collect changed turn numbers across a version history (ascending, deduped). */
function changedTurns(versions) {
	const set = /* @__PURE__ */ new Set();
	for (const v of versions) for (const turn of v.turns) set.add(turn);
	return [...set].sort((a, b) => a - b);
}
//#endregion
//#region src/core/safety.ts
/** Preview kinds that require reading actual file content. */
const CONTENT_PREVIEWS = /* @__PURE__ */ new Set([
	"text",
	"code",
	"json",
	"html",
	"svg",
	"csv",
	"zip",
	"markdown"
]);
/** Whether a given preview kind reads file bytes (vs metadata-only). */
function readsContent(kind) {
	return CONTENT_PREVIEWS.has(kind);
}
/** Default max bytes read for a text/JSON/HTML preview. */
const TEXT_PREVIEW_LIMIT = 256 * 1024;
/** Default max bytes read for ZIP entry listing (header only). */
const ZIP_PREVIEW_LIMIT = 4 * 1024 * 1024;
/** Determine preview/download safety for a path. */
function safetyForPath(path, htmlSandbox) {
	const { previewKind, risk } = classifyPath(path);
	if (risk === "danger") return {
		kind: previewKind,
		risk,
		allowPreview: false,
		allowDownload: false,
		sandboxed: false,
		reason: "executable artifact — metadata only, not previewed or executed"
	};
	if (previewKind === "html") {
		if (!htmlSandbox) return {
			kind: previewKind,
			risk,
			allowPreview: false,
			allowDownload: false,
			sandboxed: false,
			reason: "HTML preview disabled by config (htmlSandbox=false)"
		};
		return {
			kind: previewKind,
			risk,
			allowPreview: true,
			allowDownload: true,
			sandboxed: true,
			reason: null
		};
	}
	return {
		kind: previewKind,
		risk,
		allowPreview: previewKind !== "none",
		allowDownload: true,
		sandboxed: previewKind === "svg",
		reason: previewKind === "none" ? "no preview available for this type" : null
	};
}
/** Largest allowed preview byte size for a kind (host reads capped). */
function previewByteLimit(kind) {
	if (kind === "zip") return ZIP_PREVIEW_LIMIT;
	return TEXT_PREVIEW_LIMIT;
}
/** Whether a path's MIME would be served as an image data URL (image kinds). */
function isImageKind(kind) {
	return kind === "image" || kind === "svg";
}
//#endregion
//#region src/core/indexer.ts
/**
* Core indexer: merges a scan result (files + stat metadata + turn) into a
* GallerySession state. Pure aside from the observation inputs; the host
* scanner produces `ScanFile`s and this module maintains stable gallery state
* including version history.
*/
/** Classify a scan file into derived display facts (no state). */
function deriveFile(file, config) {
	const classified = classifyPath(file.path);
	const verdict = safetyForPath(file.path, config.htmlSandbox);
	return {
		path: file.path,
		absPath: file.absPath,
		category: classified.category,
		previewKind: classified.previewKind,
		risk: classified.risk,
		mime: classified.mime,
		previewAvailable: verdict.allowPreview,
		size: file.size,
		created: file.created,
		modified: file.modified
	};
}
/** Empty gallery state for a session. */
function emptySession(sessionId, workspace, startedTurn) {
	return {
		sessionId,
		workspace,
		startedTurn,
		lastScannedTurn: startedTurn,
		lastScanAt: (/* @__PURE__ */ new Date()).toISOString(),
		files: [],
		versions: [],
		changedTurns: [],
		pins: {}
	};
}
/**
* Index a scan into existing session state. Returns the updated session plus
* change counters. Existing entries keep their identity; the "changed" flag and
* version history are updated when size/mtime shift.
*/
function indexScan(state, scan, options) {
	const incoming = /* @__PURE__ */ new Map();
	for (const file of scan) incoming.set(normalizeKey(file.path), file);
	const previous = /* @__PURE__ */ new Map();
	for (const f of state.files) previous.set(normalizeKey(f.path), f);
	const observations = [];
	for (const [key, file] of incoming) observations.push({
		key,
		turn: options.turn,
		size: file.size,
		modified: file.modified,
		created: file.created
	});
	let versions;
	if (options.config.trackVersions) versions = mergeVersionHistory(state.versions, observations);
	else versions = [];
	const files = [];
	let added = 0;
	let changed = 0;
	for (const [key, file] of incoming) {
		const prior = previous.get(key);
		const derived = deriveFile(file, options.config);
		const seen = prior !== void 0;
		const isChanged = !seen || prior.size !== file.size || prior.modified !== file.modified;
		if (isChanged && seen) changed++;
		if (!seen) added++;
		files.push({
			path: derived.path,
			absPath: derived.absPath,
			category: derived.category,
			previewKind: derived.previewKind,
			risk: derived.risk,
			mime: derived.mime,
			size: derived.size,
			created: derived.created,
			modified: derived.modified,
			firstSeenTurn: prior ? prior.firstSeenTurn : options.turn,
			modifiedTurn: isChanged ? options.turn : prior?.modifiedTurn ?? null,
			changed: isChanged,
			previewAvailable: derived.previewAvailable,
			associatedTurn: isChanged ? options.turn : prior?.associatedTurn ?? options.turn,
			versionKeys: versions.filter((v) => v.key === key).map((v) => v.key),
			relatedCommand: prior?.relatedCommand ?? null,
			pinned: state.pins?.[key] === true
		});
	}
	const removed = previous.size - files.filter((f) => previous.has(normalizeKey(f.path))).length;
	return {
		session: {
			...state,
			files,
			versions,
			changedTurns: changedTurns(versions),
			lastScannedTurn: options.turn,
			lastScanAt: (/* @__PURE__ */ new Date()).toISOString()
		},
		added,
		changed,
		removed
	};
}
/** Select files for one category bucket. */
function filesByCategory(session, category) {
	return session.files.filter((f) => f.category === category);
}
/** Turn labels for a file's version history (the "Turn 5/9/14" display). */
function versionTurnsFor(session, key) {
	const rec = session.versions.find((v) => v.key === normalizeKey(key));
	return rec ? rec.turns : [];
}
/** Files the user pinned as deliverables (the top-level "final" view). */
function pinnedFiles(session) {
	return session.files.filter((f) => session.pins?.[normalizeKey(f.path)] === true);
}
//#endregion
//#region src/core/relations.ts
/**
* Related-command recognition: pure logic that maps session tool-call events
* to a human-readable "related command" for a gallery file.
*
* The host hands us a minimal event-shaped array (or the real DSH SessionEvent
* array; we only read `type` / `seq` / `data`). This module stays DSH-free so
* it can be unit tested without the harness.
*/
/** Known file-writing tool names whose path argument is authoritative. */
const FILE_PATH_TOOLS = /* @__PURE__ */ new Set([
	"write",
	"edit",
	"write_text_file",
	"write_file",
	"read",
	"read_image",
	"str_replace_editor",
	"str-replace-editor"
]);
/** Shell-like tools whose free-text `command` is matched by path mention. */
const COMMAND_TOOLS = /* @__PURE__ */ new Set([
	"bash",
	"pwsh",
	"powershell",
	"shell",
	"sh"
]);
/** Path-like argument keys accepted by DSH tools. */
const PATH_KEYS = [
	"file_path",
	"filePath",
	"path",
	"file",
	"filename",
	"output",
	"outputPath",
	"target",
	"dest",
	"destination"
];
/** Max command text kept in the UI. */
const COMMAND_MAX = 160;
function normalizePath(value) {
	return normalizeKey(value);
}
function isPathLike(value) {
	return typeof value === "string" && value.trim().length > 0;
}
/** Check whether a shell command text mentions the target path or its basename. */
function commandMentionsPath(commandText, target) {
	const cmd = commandText.replace(/\\/g, "/").toLowerCase();
	const t = normalizeKey(target).toLowerCase();
	if (cmd.includes(t)) return true;
	const tBase = t.split("/").pop() ?? t;
	if (tBase.length <= 1) return false;
	return new RegExp(`(^|[\\s"'<>|&();$]*)${escapeRegExp(tBase)}($|[\\s"'<>|&();$])`).test(cmd);
}
function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function pathMatches(target, candidate) {
	const t = normalizePath(target);
	const c = normalizePath(candidate);
	if (c === t) return "exact";
	if (c.endsWith(`/${t}`)) return "suffix";
	if (t.endsWith(`/${c}`)) return "suffix";
	const tBase = t.split("/").pop() ?? t;
	const cBase = c.split("/").pop() ?? c;
	if (tBase === cBase && cBase.length > 1) return "basename";
	return null;
}
function parseArguments(raw) {
	if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
	if (typeof raw !== "string" || raw.trim().length === 0) return {};
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}
/** Collect path-like argument values for one tool call. */
function collectPathCandidates(args) {
	const out = [];
	for (const key of PATH_KEYS) {
		const value = args[key];
		if (isPathLike(value)) out.push(value);
	}
	return out;
}
/** Extract the raw command text from bash/pwsh-style arguments. */
function collectCommandText(args) {
	for (const key of [
		"command",
		"cmd",
		"script"
	]) {
		const value = args[key];
		if (isPathLike(value)) return value;
	}
	return null;
}
/** Render a related command string for the UI. */
function formatRelatedCommand(tool, args, path) {
	const commandText = collectCommandText(args);
	if (path) return `${tool} ${path}`;
	if (commandText) return `${tool}: ${commandText}`;
	const pathValue = collectPathCandidates(args)[0];
	if (pathValue) return `${tool} ${pathValue}`;
	return tool;
}
function truncate(text, max = COMMAND_MAX) {
	return text.length <= max ? text : `${text.slice(0, max)}…`;
}
/**
* Find the most relevant command related to `targetPath`.
*
* Strategy: newest high-confidence match (a file-writing tool whose path
* argument points at the file) wins; if none exists, the newest shell command
* that merely mentions the file path/basename is returned. Returns null when
* nothing can be reliably recognized (UI shows "unknown").
*/
function findRelatedCommand(events, targetPath) {
	const target = normalizeKey(targetPath);
	let bestHigh = null;
	let bestLow = null;
	for (const event of events) {
		if (!event || typeof event !== "object") continue;
		event.type;
		const data = event.data ?? {};
		const name = data.name ?? "";
		if (!name) continue;
		const seq = event.seq ?? 0;
		const args = parseArguments(data.arguments);
		const turn = typeof data.turn === "number" ? data.turn : void 0;
		if (FILE_PATH_TOOLS.has(name)) {
			const candidates = collectPathCandidates(args);
			for (const candidate of candidates) {
				const match = pathMatches(target, candidate);
				if (match === "exact" || match === "suffix") {
					const rc = {
						tool: name,
						command: formatRelatedCommand(name, args, candidate),
						confidence: "high",
						...turn !== void 0 ? { turn } : {}
					};
					if (!bestHigh || seq > bestHigh.seq) bestHigh = {
						...rc,
						seq
					};
					break;
				}
			}
			continue;
		}
		if (COMMAND_TOOLS.has(name)) {
			const commandText = collectCommandText(args);
			if (!commandText) continue;
			if (commandMentionsPath(commandText, target)) {
				const rc = {
					tool: name,
					command: truncate(formatRelatedCommand(name, args)),
					confidence: "low",
					...turn !== void 0 ? { turn } : {}
				};
				if (!bestLow || seq > bestLow.seq) bestLow = {
					...rc,
					seq
				};
			}
			continue;
		}
		const candidates = collectPathCandidates(args);
		for (const candidate of candidates) {
			const match = pathMatches(target, candidate);
			if (match === "exact" || match === "suffix") {
				const rc = {
					tool: name,
					command: formatRelatedCommand(name, args, candidate),
					confidence: "high",
					...turn !== void 0 ? { turn } : {}
				};
				if (!bestHigh || seq > bestHigh.seq) bestHigh = {
					...rc,
					seq
				};
				break;
			}
		}
	}
	return bestHigh ?? bestLow ?? null;
}
/** True when any related command was found for the path. */
function hasRelatedCommand(events, targetPath) {
	return findRelatedCommand(events, targetPath) !== null;
}
/**
* Attach `relatedCommand` to every file in a gallery session based on the
* session events. When no events are available (e.g. a store-only read), the
* session is returned unchanged so previously persisted relations survive.
*/
function applyRelatedCommands(session, events) {
	if (!events || events.length === 0) return session;
	const files = session.files.map((file) => ({
		...file,
		relatedCommand: findRelatedCommand(events, file.path)
	}));
	return {
		...session,
		files
	};
}
//#endregion
export { CONFIG_FILE, CONTENT_PREVIEWS, DEFAULT_CONFIG, HARD_IGNORED_DIRS, HARD_SKIP_PATTERNS, TEXT_PREVIEW_LIMIT, ZIP_PREVIEW_LIMIT, applyRelatedCommands, buildVersionHistory, changedTurns, classifyPath, deriveFile, emptySession, extensionOf, filesByCategory, filterPaths, findRelatedCommand, formatBytes, formatRelatedCommand, hasRelatedCommand, indexScan, isImageKind, isSkippableNoise, matchesAny, matchesPattern, mergeConfig, mergeVersionHistory, normalizeKey, normalizePattern, parseConfigYml, pinnedFiles, previewByteLimit, readsContent, safetyForPath, sameVersion, shouldTrack, toFilter, versionTurnsFor };
