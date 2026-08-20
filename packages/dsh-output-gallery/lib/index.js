import z from "@deepseek-ai/schemastery";
import { lstat, mkdir, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, posix, resolve, sep } from "node:path";
import { homedir } from "node:os";
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
//#endregion
//#region src/host/store.ts
/**
* Sidecar store: `~/.dsh/output-gallery/<sessionId>.json`.
*
* Only metadata is written — file paths, sizes, timestamps, categories,
* version-history turn numbers. File contents are never copied into the store;
* previews read files live from disk. No cross-session data is mixed.
*/
function galleryDir(dshHome = process.env.DSH_HOME ?? join(homedir(), ".dsh")) {
	return join(dshHome, "output-gallery");
}
function fileFor(dir, sessionId) {
	return join(dir, `${sessionId.replaceAll(/[^a-zA-Z0-9._-]/g, "_")}.json`);
}
async function createGalleryStore(dir = galleryDir()) {
	await mkdir(dir, { recursive: true });
	return {
		async read(sessionId) {
			try {
				const raw = await readFile(fileFor(dir, sessionId), "utf8");
				const parsed = JSON.parse(raw);
				if (parsed.sessionId !== sessionId || !Array.isArray(parsed.files)) return null;
				if (!parsed.pins || typeof parsed.pins !== "object" || Array.isArray(parsed.pins)) parsed.pins = {};
				return parsed;
			} catch {
				return null;
			}
		},
		async write(session) {
			await writeFile(fileFor(dir, session.sessionId), JSON.stringify(session, null, 2), "utf8");
		},
		async listSessions() {
			const { readdir } = await import("node:fs/promises");
			const out = [];
			try {
				const names = await readdir(dir);
				for (const name of names) {
					if (!name.endsWith(".json")) continue;
					try {
						const raw = await readFile(join(dir, name), "utf8");
						const parsed = JSON.parse(raw);
						out.push({
							sessionId: parsed.sessionId,
							workspace: parsed.workspace,
							lastScanAt: parsed.lastScanAt
						});
					} catch {}
				}
			} catch {}
			return out;
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
//#region src/host/scanner.ts
/**
* Host workspace scanner: walks the session workspace conservatively, applying
* include/exclude filtering and build-noise avoidance. Incremental by design —
* the caller passes the last observed state and a current turn; this module
* only reports current files + stats, and the indexer detects new/modified.
*
* No content is read here (stat only), which keeps scans cheap.
*/
/** Walk rule: `**` matches any number of dirs, `*` any within a segment. */
function segmentRegExp(segment) {
	if (segment === "**") return /.*/;
	if (!segment.includes("*") && !segment.includes("?")) return null;
	let out = "^";
	for (const ch of segment) if (ch === "*") out += "[^/]*";
	else if (ch === "?") out += "[^/]";
	else out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	out += "$";
	return new RegExp(out);
}
function dirMatchesInclude(relDir, include) {
	return include.some((pattern) => {
		const norm = pattern.replace(/\\/g, "/").replace(/\/$/, "");
		if (!(norm.includes("*") || norm.includes("?"))) return relDir === norm || relDir.startsWith(`${norm}/`);
		const parts = norm.split("/");
		const dirParts = relDir.split("/");
		let pi = 0;
		for (let di = 0; di < dirParts.length; di++) {
			if (pi >= parts.length) break;
			if (parts[pi] === "**") {
				pi++;
				di--;
				continue;
			}
			const re = segmentRegExp(parts[pi]);
			if (re && re.test(dirParts[di])) {
				pi++;
				continue;
			}
			if (!re && parts[pi] === dirParts[di]) {
				pi++;
				continue;
			}
			return false;
		}
		return pi === parts.length;
	});
}
/** Whether an include pattern targets a path under the given rel dir. */
function matchesIncludeDir(relDir, config) {
	return config.include.some((pattern) => {
		const norm = pattern.replace(/\\/g, "/").replace(/\.\//, "").replace(/\/$/, "");
		if (!(norm.includes("*") || norm.includes("?"))) return relDir === norm || relDir.startsWith(`${norm}/`);
		return dirMatchesInclude(relDir, [norm]);
	});
}
/**
* Recursively walk a workspace, applying filter rules, returning scan files.
* Only files (not dirs) are returned; directories are pruned when ignored.
*/
async function scanWorkspace(options) {
	const workspace = resolve(options.workspace);
	let config = options.config ?? DEFAULT_CONFIG;
	let configSource = "default";
	let configPath = null;
	if (!options.config) {
		const cfgFile = join(workspace, ...CONFIG_FILE.split("/"));
		try {
			const parsed = parseConfigYml(await readFile(cfgFile, "utf8"));
			if (parsed !== null) {
				config = mergeConfig(DEFAULT_CONFIG, parsed);
				configSource = "file";
				configPath = cfgFile;
			}
		} catch {}
	}
	const files = [];
	const max = config.maxFiles;
	const seen = /* @__PURE__ */ new Set();
	/** Whether a directory (relative posix path) may be descended into. */
	function dirAllowed(relPath, name) {
		if (config.include.length > 0 && matchesIncludeDir(relPath, config)) return true;
		if (config.ignoreDirs.includes(name)) return false;
		return shouldTrack(`${relPath}/__dir_probe__`, config) || config.include.length > 0;
	}
	async function walk(dir, relDir) {
		if (files.length >= max) return;
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		entries.sort((a, b) => a.name.localeCompare(b.name));
		for (const entry of entries) {
			if (files.length >= max) return;
			const name = entry.name;
			const relPath = relDir ? `${posix.join(relDir, name)}` : name;
			if (entry.isDirectory()) {
				if (!dirAllowed(relPath, name)) continue;
				await walk(join(dir, name), relPath);
				continue;
			}
			if (!entry.isFile() && !entry.isSymbolicLink()) continue;
			if (!shouldTrack(relPath, config)) continue;
			if (seen.has(relPath)) continue;
			seen.add(relPath);
			const abs = join(dir, name);
			try {
				const st = await lstat(abs);
				if (!st.isFile() && !st.isSymbolicLink()) continue;
				const realStat = st.isSymbolicLink() ? await stat(abs) : st;
				files.push({
					path: relPath.replace(/\\/g, "/"),
					absPath: abs,
					size: realStat.size,
					created: new Date(realStat.birthtime ?? realStat.ctime).toISOString(),
					modified: new Date(realStat.mtime).toISOString()
				});
			} catch {}
		}
	}
	await walk(workspace, "");
	return {
		files,
		config,
		configSource,
		configPath
	};
}
//#endregion
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
//#endregion
//#region src/core/safety.ts
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
//#endregion
//#region src/host/zip.ts
/**
* Minimal ZIP reader: lists central-directory entries from a ZIP archive.
* No extraction, no code execution. Reads the End of Central Directory (EOCD)
* and walks central directory entries.
*
* Only used for preview listing; supports the common local file header +
* central directory layout used by typical ZIP tools.
*/
/** Read bytes at an absolute offset. */
async function readAt(handle, offset, length) {
	const buf = Buffer.alloc(length);
	const { bytesRead } = await handle.read(buf, 0, length, offset);
	return buf.subarray(0, bytesRead);
}
async function findEocd(handle, fileSize) {
	const start = Math.max(0, fileSize - Math.min(fileSize, 65557));
	const tail = await readAt(handle, start, fileSize - start);
	const sig = Buffer.from([
		80,
		75,
		5,
		6
	]);
	const idx = tail.lastIndexOf(sig);
	if (idx < 0) return null;
	const eocdPos = start + idx;
	if (eocdPos + 22 > fileSize) return null;
	const buf = await readAt(handle, eocdPos, 22);
	return {
		offset: eocdPos,
		count: buf.readUInt16LE(10),
		centralSize: buf.readUInt32LE(12),
		centralOffset: buf.readUInt32LE(16)
	};
}
/** List ZIP central directory entries. Throws if the file is not a ZIP. */
async function looksLikeZip(absPath) {
	const handle = await open(absPath, "r");
	try {
		const st = await handle.stat();
		if (st.size < 22) throw new Error("not a zip archive");
		const eocd = await findEocd(handle, st.size);
		if (!eocd) throw new Error("zip end-of-central-directory not found");
		if (eocd.count > 1e5) throw new Error("zip entry count too large");
		const entries = [];
		const buf = await readAt(handle, eocd.centralOffset, Math.min(eocd.centralSize, 8 * 1024 * 1024));
		let pos = 0;
		for (let i = 0; i < eocd.count; i++) {
			if (buf.readUInt32LE(pos) !== 33639248) break;
			const method = buf.readUInt16LE(pos + 10);
			const compressedSize = buf.readUInt32LE(pos + 20);
			const uncompressedSize = buf.readUInt32LE(pos + 24);
			const nameLen = buf.readUInt16LE(pos + 28);
			const extraLen = buf.readUInt16LE(pos + 30);
			const commentLen = buf.readUInt16LE(pos + 32);
			const name = buf.toString("utf8", pos + 46, pos + 46 + nameLen);
			entries.push({
				name,
				size: method === 0 ? uncompressedSize : compressedSize,
				isDirectory: name.endsWith("/")
			});
			pos += 46 + nameLen + extraLen + commentLen;
			if (pos > buf.length) break;
		}
		return entries;
	} finally {
		await handle.close();
	}
}
//#endregion
//#region src/host/preview.ts
/**
* Host preview: reads a tracked file's content live from disk and returns a
* safe, bounded payload for the client. Executable artifacts and disallowed
* types return metadata-only `none`. HTML is served as text to be rendered in
* a sandboxed iframe by the client. ZIP is listed from its central directory —
* never extracted or executed.
*/
/** Max bytes read for text previews. */
const TEXT_LIMIT = 256 * 1024;
/** Strip UTF-8 BOM and control chars for safe inline rendering. */
function sanitizeText(buf) {
	let text = buf.toString("utf8");
	if (text.charCodeAt(0) === 65279) text = text.slice(1);
	text = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "�");
	return text;
}
/** Read first N bytes of a file (capped). */
async function readCapped(absPath, limit) {
	const { open } = await import("node:fs/promises");
	const handle = await open(absPath, "r");
	try {
		const buf = Buffer.alloc(limit + 1);
		const { bytesRead } = await handle.read(buf, 0, limit + 1, 0);
		return buf.subarray(0, bytesRead);
	} finally {
		await handle.close();
	}
}
/**
* Build a preview payload for a tracked file. `workspace` is the resolved
* session workspace root; the path must resolve inside it (path traversal
* guard).
*/
async function buildPreview(file, config, workspace) {
	const absPath = file.absPath ?? resolveWorkspacePath(workspace, file.path);
	const verdict = safetyForPath(file.path, config.htmlSandbox);
	if (!verdict.allowPreview || verdict.kind === "none") return {
		kind: "none",
		reason: verdict.reason ?? "not previewable"
	};
	try {
		await stat(absPath);
	} catch {
		return {
			kind: "none",
			reason: "file not found on disk"
		};
	}
	const kind = verdict.kind;
	try {
		if (kind === "image") {
			const buf = await readFile(absPath);
			return {
				kind: "image",
				dataUrl: `data:${file.mime};base64,${buf.toString("base64")}`,
				mime: file.mime
			};
		}
		if (kind === "svg") return {
			kind: "svg",
			content: sanitizeText(await readCapped(absPath, TEXT_LIMIT))
		};
		if (kind === "html") return {
			kind: "html",
			content: sanitizeText(await readCapped(absPath, TEXT_LIMIT)),
			sandbox: true
		};
		if (kind === "zip") return {
			kind: "zip",
			entries: await looksLikeZip(absPath)
		};
		if (kind === "json") {
			const text = sanitizeText(await readCapped(absPath, TEXT_LIMIT));
			let tree = null;
			try {
				tree = JSON.parse(text);
			} catch {
				return {
					kind: "text",
					content: text,
					text
				};
			}
			return {
				kind: "json",
				tree,
				content: text
			};
		}
		if (kind === "csv") {
			const rows = sanitizeText(await readCapped(absPath, TEXT_LIMIT)).split(/\r?\n/).filter((line, idx, arr) => line.length > 0 || idx < arr.length - 1).map((line) => splitCsvLine(line));
			return {
				kind: "csv",
				headers: rows[0] ?? [],
				rows: rows.slice(1)
			};
		}
		if (kind === "markdown") {
			const text = sanitizeText(await readCapped(absPath, TEXT_LIMIT));
			return {
				kind: "markdown",
				content: text,
				text
			};
		}
		if (kind === "pdf") return {
			kind: "pdf",
			url: `/plugins/dsh-output-gallery/file/${encodeURIComponent(file.path)}`,
			inline: true
		};
		const text = sanitizeText(await readCapped(absPath, TEXT_LIMIT));
		return {
			kind: "text",
			content: text,
			text
		};
	} catch (error) {
		return {
			kind: "none",
			reason: error instanceof Error ? error.message : "preview failed"
		};
	}
}
/** Resolve a relative gallery path under a workspace, guarding traversal. */
function resolveWorkspacePath(workspace, relPath) {
	const root = resolve(workspace);
	const candidate = resolve(root, relPath);
	const rootParts = root.split(sep);
	const candParts = candidate.split(sep);
	for (let i = 0; i < rootParts.length; i++) if (rootParts[i] !== candParts[i]) throw new Error("path escapes workspace");
	return candidate;
}
/** Simple CSV line splitter (handles quoted fields minimally). */
function splitCsvLine(line) {
	const out = [];
	let cur = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) if (ch === "\"") if (line[i + 1] === "\"") {
			cur += "\"";
			i++;
		} else inQuotes = false;
		else cur += ch;
		else if (ch === "\"") inQuotes = true;
		else if (ch === ",") {
			out.push(cur);
			cur = "";
		} else cur += ch;
	}
	out.push(cur);
	return out;
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
//#region src/host/runtime.ts
var GalleryRuntime = class {
	ctx;
	store;
	config;
	constructor(ctx, store, config) {
		this.ctx = ctx;
		this.store = store;
		this.config = config;
	}
	configOverride = null;
	setConfig(config) {
		this.configOverride = config;
	}
	currentConfig() {
		return this.configOverride ?? this.config;
	}
	async refresh(sessionId, turn) {
		const session = this.findSession(sessionId);
		if (!session) throw new Error(`session not found: ${sessionId}`);
		const workspace = this.workspaceFor(session);
		if (!workspace) throw new Error(`session has no workspace: ${sessionId}`);
		const prev = await this.store.read(sessionId);
		const resolvedTurn = turn ?? (prev?.lastScannedTurn ?? 0) + 1;
		const scanned = await scanWorkspace({
			workspace,
			turn: resolvedTurn,
			config: this.currentConfig()
		});
		const result = indexScan(prev ?? emptySession(sessionId, workspace, resolvedTurn), scanned.files, {
			config: scanned.config,
			turn: resolvedTurn,
			workspace
		});
		result.session.workspace = workspace;
		const sessionWithRelations = applyRelatedCommands(result.session, session.events ?? []);
		await this.store.write(sessionWithRelations);
		return {
			sessionId,
			scannedFiles: scanned.files.length,
			added: result.added,
			changed: result.changed,
			removed: result.removed,
			files: sessionWithRelations.files
		};
	}
	/** Set (or clear) the user's deliverable pin for a tracked file. */
	async setPinned(sessionId, path, pinned) {
		const session = await this.store.read(sessionId);
		if (!session) throw new Error(`session not found: ${sessionId}`);
		const key = normalizeKey(path);
		if (pinned && !session.files.some((f) => normalizeKey(f.path) === key)) throw new Error(`file not tracked: ${path}`);
		const pins = {
			...session.pins ?? {},
			[key]: pinned
		};
		const updated = {
			...session,
			pins,
			files: session.files.map((f) => ({
				...f,
				pinned: pins[normalizeKey(f.path)] === true
			}))
		};
		await this.store.write(updated);
		return updated;
	}
	async list(sessionId) {
		return this.store.read(sessionId);
	}
	async listSessions() {
		return this.store.listSessions();
	}
	async preview(sessionId, path) {
		const session = await this.store.read(sessionId);
		if (!session) throw new Error(`session not found: ${sessionId}`);
		const file = session.files.find((f) => f.path === path || f.path.replace(/\\/g, "/") === path.replace(/\\/g, "/"));
		if (!file) throw new Error(`file not tracked: ${path}`);
		return buildPreview(file, this.currentConfig(), session.workspace);
	}
	async getConfig(sessionId) {
		const session = this.findSession(sessionId);
		if (session) {
			const workspace = this.workspaceFor(session);
			if (workspace) {
				const scanned = await scanWorkspace({
					workspace,
					turn: 0
				});
				if (scanned.configSource === "file") return {
					config: this.currentConfig(),
					source: "file",
					configPath: scanned.configPath
				};
			}
		}
		return {
			config: this.currentConfig(),
			source: this.configOverride ? "runtime" : "default",
			configPath: null
		};
	}
	async clear(sessionId) {
		await this.store.clear(sessionId);
	}
	findSession(sessionId) {
		return this.ctx.get("sessions")?.get?.(sessionId) ?? null;
	}
	workspaceFor(session) {
		return session.header?.cwd ?? session.cwd ?? session.workspace;
	}
};
/** Convenience for tests/E2E: run a scan+index without DSH. */
async function runStandaloneIndex(store, workspace, sessionId, turn, config) {
	const base = await store.read(sessionId) ?? emptySession(sessionId, workspace, turn);
	const scanned = await scanWorkspace({
		workspace,
		turn,
		config
	});
	const result = indexScan(base, scanned.files, {
		config: scanned.config,
		turn,
		workspace
	});
	result.session.workspace = workspace;
	await store.write(result.session);
	return {
		sessionId,
		scannedFiles: scanned.files.length,
		added: result.added,
		changed: result.changed,
		removed: result.removed,
		files: result.session.files,
		config: scanned.config
	};
}
//#endregion
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
async function findTrackedFile(runtime, sessionId, path) {
	const session = await runtime.list(sessionId);
	if (!session) return null;
	const normalized = path.replace(/\\/g, "/");
	const file = session.files.find((f) => f.path.replace(/\\/g, "/") === normalized);
	return file ? {
		session,
		file
	} : null;
}
function registerApi(ctx, runtime) {
	ctx.effect(() => {
		const base = "/plugins/dsh-output-gallery/api";
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/list`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const sessionId = requireString(await readJson(req), "sessionId");
						if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
						json(res, 200, ok({ session: await runtime.list(sessionId) }));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/refresh`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const sessionId = requireString(body, "sessionId");
						if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
						const turn = typeof body["turn"] === "number" ? body["turn"] : void 0;
						json(res, 200, ok(await runtime.refresh(sessionId, turn)));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/preview`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const sessionId = requireString(body, "sessionId");
						const path = requireString(body, "path");
						if (!sessionId || !path) return json(res, 400, fail("bad-request", "sessionId and path are required"));
						json(res, 200, ok(await runtime.preview(sessionId, path)));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/pin`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const sessionId = requireString(body, "sessionId");
						const path = requireString(body, "path");
						const pinned = body["pinned"] === true || body["pinned"] === false ? body["pinned"] : void 0;
						if (!sessionId || !path || pinned === void 0) return json(res, 400, fail("bad-request", "sessionId, path and pinned are required"));
						json(res, 200, ok({ session: await runtime.setPinned(sessionId, path, pinned) }));
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
						json(res, 200, ok({ sessions: await runtime.listSessions() }));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/config`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const sessionId = requireString(await readJson(req), "sessionId");
						json(res, 200, ok(await runtime.getConfig(sessionId ?? "")));
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
						await runtime.clear(sessionId);
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
		routes.push(ctx.webServer.register({
			kind: "prefix",
			path: "/plugins/dsh-output-gallery/file/",
			handler: async (req, res) => {
				if (req.method !== "GET") return json(res, 405, fail("bad-request", "method not allowed"));
				if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
				try {
					const url = new URL(req.url ?? "", "http://localhost");
					const rel = decodeURIComponent(url.pathname.slice(33));
					const sessionId = req.headers["x-dsh-gallery-session"];
					if (!sessionId) return json(res, 400, fail("bad-request", "missing x-dsh-gallery-session header"));
					const found = await findTrackedFile(runtime, sessionId, rel);
					if (!found) return json(res, 404, fail("not-found", "file not tracked"));
					const verdict = safetyForPath(found.file.path, runtime.currentConfig().htmlSandbox);
					if (!verdict.allowDownload || verdict.kind === "none") return json(res, 403, fail("forbidden", "file download is not allowed"));
					const data = await readFile(found.file.absPath ?? "");
					const contentType = found.file.mime.startsWith("text/") ? `${found.file.mime}; charset=utf-8` : found.file.mime;
					res.writeHead(200, {
						"content-type": contentType,
						"content-disposition": `inline; filename="${encodeURIComponent(found.file.path.split("/").pop() ?? "file")}"`,
						"cache-control": "private, no-store",
						"x-content-type-options": "nosniff"
					});
					res.end(data);
				} catch (error) {
					json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
				}
			}
		}));
		return () => {
			for (const dispose of routes) dispose();
		};
	}, "dsh-output-gallery: web routes");
}
//#endregion
//#region src/host/index.ts
const name = "dsh-output-gallery";
const inject = ["webServer"];
const Config = z.object({
	enabled: z.boolean().default(true),
	include: z.array(z.string()).default([]),
	exclude: z.array(z.string()).default([]),
	ignoreDirs: z.array(z.string()).default([...DEFAULT_CONFIG.ignoreDirs]),
	avoid: z.array(z.string()).default([...DEFAULT_CONFIG.avoid]),
	trackVersions: z.boolean().default(true),
	maxFiles: z.natural().min(1).default(5e3),
	htmlSandbox: z.boolean().default(true)
});
function apply(ctx, config) {
	const resolved = Config(config ?? {});
	const storePromise = createGalleryStore();
	const runtimePromise = storePromise.then((store) => new GalleryRuntime(ctx, store, resolved));
	runtimePromise.then((runtime) => registerApi(ctx, runtime));
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
			runtimePromise.then((runtime) => runtime.refresh(session.id, latestTurn(events))).catch((error) => {
				ctx.logger.warn(`[dsh-output-gallery] turn scan failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		};
		ctx.on("session/event", onSessionEvent);
		return () => {
			consumed.clear();
		};
	}, "dsh-output-gallery: turn scan");
	ctx.effect(() => {
		return () => {
			storePromise.then((store) => store.clear());
		};
	}, "dsh-output-gallery: cleanup (async registered)");
}
function latestTurn(events) {
	let turn = 0;
	for (const event of events) if (event.type === "turn/start") turn = event.data?.turn ?? turn;
	return turn;
}
//#endregion
export { Config, GalleryRuntime, apply, buildPreview, createGalleryStore, galleryDir, inject, name, resolveWorkspacePath, runStandaloneIndex, scanWorkspace };
