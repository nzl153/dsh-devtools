import path, { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises, watch } from "node:fs";
import { homedir } from "node:os";
//#region src/core/diff.ts
const MAX_MATRIX = 4e3 * 4e3;
/**
* Content similarity in [0,1]. 1 means identical after line diff.
* Uses the same diff engine as the rest of the plugin.
*/
function lineSimilarity(oldText, newText) {
	const a = oldText.split(/\r?\n/);
	const b = newText.split(/\r?\n/);
	const d = diffLines(oldText, newText);
	const total = a.length + b.length;
	if (total === 0) return 1;
	return Math.max(0, 1 - (d.addedLines + d.removedLines) / total);
}
async function findRenames(previous, current, readText, threshold = .6) {
	const deleted = [...previous.keys()].filter((k) => !current.has(k));
	const added = [...current.keys()].filter((k) => !previous.has(k));
	if (deleted.length === 0 || added.length === 0) return [];
	const candidates = [];
	for (const oldPath of deleted) {
		const prev = previous.get(oldPath);
		if (!prev) continue;
		for (const newPath of added) {
			const next = current.get(newPath);
			if (!next) continue;
			if (prev.size !== next.size) continue;
			if (prev.hash !== null && prev.hash === next.hash) {
				candidates.push({
					oldPath,
					newPath,
					exact: true,
					similarity: 1
				});
				continue;
			}
			if (prev.kind !== "text" || next.kind !== "text") continue;
			const oldText = await readText(oldPath, "old");
			const newText = await readText(newPath, "new");
			if (oldText === null || newText === null) continue;
			const similarity = lineSimilarity(oldText, newText);
			if (similarity >= threshold) candidates.push({
				oldPath,
				newPath,
				exact: false,
				similarity
			});
		}
	}
	candidates.sort((a, b) => b.exact === a.exact ? b.similarity - a.similarity : (b.exact ? 1 : 0) - (a.exact ? 1 : 0));
	const usedOld = /* @__PURE__ */ new Set();
	const usedNew = /* @__PURE__ */ new Set();
	const out = [];
	for (const c of candidates) {
		if (usedOld.has(c.oldPath) || usedNew.has(c.newPath)) continue;
		usedOld.add(c.oldPath);
		usedNew.add(c.newPath);
		out.push(c);
	}
	return out;
}
/**
* Compute a line diff between two texts.
* `oldLabel` / `newLabel` are used in the unified header (defaults are fine).
*/
function diffLines(oldText, newText, oldLabel = "a", newLabel = "b") {
	const a = oldText.split(/\r?\n/);
	const b = newText.split(/\r?\n/);
	const n = a.length;
	const m = b.length;
	let added = 0;
	let removed = 0;
	let unified;
	if (n * m > MAX_MATRIX) {
		removed = n;
		added = m;
		unified = renderUnified([], a, b, oldLabel, newLabel);
		return {
			addedLines: added,
			removedLines: removed,
			unified
		};
	}
	const lcs = new Int32Array((n + 1) * (m + 1));
	for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
		const idx = (i + 1) * (m + 1) + (j + 1);
		if (a[i] === b[j]) lcs[i * (m + 1) + j] = lcs[idx] + 1;
		else {
			const right = lcs[i * (m + 1) + (j + 1)];
			const down = lcs[(i + 1) * (m + 1) + j];
			lcs[i * (m + 1) + j] = right > down ? right : down;
		}
	}
	const ops = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) if (a[i] === b[j]) {
		ops.push({
			kind: "eq",
			line: a[i]
		});
		i++;
		j++;
	} else if (lcs[(i + 1) * (m + 1) + j] >= lcs[i * (m + 1) + (j + 1)]) {
		ops.push({
			kind: "del",
			line: a[i]
		});
		removed++;
		i++;
	} else {
		ops.push({
			kind: "add",
			line: b[j]
		});
		added++;
		j++;
	}
	while (i < n) {
		ops.push({
			kind: "del",
			line: a[i++]
		});
		removed++;
	}
	while (j < m) {
		ops.push({
			kind: "add",
			line: b[j++]
		});
		added++;
	}
	unified = renderOps(ops, oldLabel, newLabel);
	return {
		addedLines: added,
		removedLines: removed,
		unified
	};
}
function renderOps(ops, oldLabel, newLabel) {
	const lines = [`--- ${oldLabel}`, `+++ ${newLabel}`];
	let hunkStart = -1;
	let bStart = 1;
	let aStart = 1;
	let aPos = 1;
	let bPos = 1;
	for (const op of ops) {
		if (op.kind !== "eq" && hunkStart < 0) {
			hunkStart = aPos;
			aStart = aPos;
			bStart = bPos;
		}
		if (op.kind === "eq") {
			aPos++;
			bPos++;
		} else if (op.kind === "del") aPos++;
		else bPos++;
	}
	if (hunkStart < 0) return lines.join("\n");
	lines.push(`@@ -${aStart},${removedOr(aPos, aStart)} +${bStart},${removedOr(bPos, bStart)} @@`);
	for (const op of ops) if (op.kind === "eq") lines.push(" " + op.line);
	else if (op.kind === "del") lines.push("-" + op.line);
	else lines.push("+" + op.line);
	return lines.join("\n");
}
function removedOr(end, start) {
	const count = end - start;
	return count === 0 ? 1 : count;
}
function renderUnified(_ops, a, b, oldLabel, newLabel) {
	const lines = [`--- ${oldLabel}`, `+++ ${newLabel}`];
	lines.push(`@@ -1,${a.length} +1,${b.length} @@`);
	for (const line of a) lines.push("-" + line);
	for (const line of b) lines.push("+" + line);
	return lines.join("\n");
}
//#endregion
//#region src/core/fsh.ts
/** Default kind detection by extension / content sniffing. */
function kindFromBuffer(buf) {
	if (buf.length === 0) return "text";
	if (buf.includes(0)) return "binary";
	return "text";
}
/** sha256 hex of a buffer. */
async function sha256(buf) {
	const { createHash } = await import("node:crypto");
	return createHash("sha256").update(buf).digest("hex");
}
//#endregion
//#region src/core/git.ts
/**
* Read-only git helpers.
*
* SAFETY: this module only ever runs *read-only* git commands
* (`rev-parse`, `status --porcelain`, `ls-files`). It never runs
* `reset --hard`, `clean -fd`, `checkout .`, or anything that mutates the
* working tree or index. Non-git directories are handled gracefully (the
* helpers report `inRepo: false`).
*/
const execFileP = promisify(execFile);
function runGit(cwd, args, timeoutMs = 4e3) {
	return new Promise((resolve, reject) => {
		execFileP("git", args, {
			cwd,
			encoding: "utf8",
			timeout: timeoutMs,
			windowsHide: true
		}).then((r) => resolve(r.stdout)).catch((error) => reject(error));
	});
}
/** True when `cwd` is inside a git working tree. */
async function isGitRepo(cwd) {
	try {
		await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
		return true;
	} catch {
		return false;
	}
}
/**
* Compute a GitFileState for one relative path.
* `dirty`/`staged` are derived from `git status --porcelain`; `tracked` from
* `git ls-files`. All read-only.
*/
async function gitFileState(cwd, relPath) {
	let inRepo;
	try {
		inRepo = await isGitRepo(cwd);
	} catch {
		inRepo = false;
	}
	if (!inRepo) return null;
	let status = "";
	try {
		status = await runGit(cwd, [
			"status",
			"--porcelain",
			"-z",
			"--",
			relPath
		]);
	} catch {
		status = "";
	}
	let tracked = false;
	try {
		tracked = (await runGit(cwd, [
			"ls-files",
			"-z",
			"--",
			relPath
		])).length > 0;
	} catch {
		tracked = false;
	}
	let dirty = false;
	let staged = false;
	for (const line of status.split("\0")) {
		if (line.length < 3) continue;
		const code = line.slice(0, 2);
		if (code.includes("?") || code.includes("!")) {} else if (code[0] !== " " && code[0] !== "?") staged = true;
		if (code[1] !== " " && code[1] !== "?") dirty = true;
	}
	return {
		inRepo: true,
		tracked,
		staged,
		dirty
	};
}
//#endregion
//#region src/core/restore.ts
var RestorePlanner = class {
	diskHash;
	readContent;
	/**
	* Current on-disk hash provider + content provider. Injected so the planner
	* stays pure: hash `null` means the file is missing on disk; content provider
	* returns the bytes for a stored object (or null) and is used to build the
	* three-way contents payload.
	*/
	constructor(diskHash, readContent) {
		this.diskHash = diskHash;
		this.readContent = readContent ?? (async () => null);
	}
	/** Last recorded change for a path (or null). */
	lastChange(record, relPath) {
		for (let i = record.turns.length - 1; i >= 0; i--) {
			const turn = record.turns[i];
			for (let j = turn.changes.length - 1; j >= 0; j--) {
				const c = turn.changes[j];
				if (c.relPath === relPath) return c;
			}
		}
		return null;
	}
	/**
	* Baseline entry hash for a path. `undefined` when the path was not present
	* at baseline.
	*/
	baselineEntry(record, relPath) {
		return record.baseline.find((e) => e.relPath === relPath);
	}
	/**
	* The plugin's latest recorded state for a path:
	* `{ hash: null, existed: false }` means absent. A rename source counts as
	* absent because the file moved away, even if an earlier turn created it.
	*/
	latestExpectedState(record, relPath) {
		for (let i = record.turns.length - 1; i >= 0; i--) for (let j = record.turns[i].changes.length - 1; j >= 0; j--) {
			const c = record.turns[i].changes[j];
			if (c.status === "renamed" && c.oldPath === relPath) return {
				hash: null,
				existed: false
			};
			if (c.relPath === relPath) return {
				hash: c.toHash,
				existed: c.toHash !== null
			};
		}
		const baseline = this.baselineEntry(record, relPath);
		return {
			hash: baseline?.hash ?? null,
			existed: baseline?.existed ?? false
		};
	}
	mk(relPath, action, targetHash, diskHash, expectedHash, problem, reason) {
		return {
			relPath,
			action,
			targetHash,
			diskHash,
			expectedHash,
			problem,
			reason
		};
	}
	/**
	* Decorate previews with three-way contents (EXPECTED / CURRENT / TARGET).
	* Never writes; safe to call after planning. Only textual content is returned;
	* binary/large content comes back null with a note left to the UI.
	*/
	async decorateContents(preview) {
		const [expectedBuf, currentBuf, targetBuf] = await Promise.all([
			this.readContent(preview.relPath, preview.expectedHash),
			preview.diskHash === null ? Promise.resolve(null) : this.readContent(preview.relPath, preview.diskHash),
			preview.targetHash === null ? Promise.resolve(null) : this.readContent(preview.relPath, preview.targetHash)
		]);
		const toStr = (b) => b ? b.toString("utf8") : null;
		return {
			...preview,
			contents: {
				expected: toStr(expectedBuf),
				current: toStr(currentBuf),
				target: toStr(targetBuf)
			}
		};
	}
	/** Plan restoring the whole session back to its baseline snapshot. */
	async planBaseline(record) {
		const out = [];
		const touched = /* @__PURE__ */ new Set();
		for (const turn of record.turns) for (const c of turn.changes) {
			touched.add(c.relPath);
			if (c.status === "renamed" && c.oldPath) touched.add(c.oldPath);
		}
		for (const relPath of touched) out.push(await this.planFileToBaseline(record, relPath));
		return out;
	}
	/** Plan restoring a whole turn (snapshot at turn start). */
	async planTurnStart(record, turn) {
		const turnRec = record.turns.find((t) => t.turn === turn);
		if (!turnRec) throw new Error(`turn ${turn} not found`);
		const out = [];
		for (const c of turnRec.changes) {
			if (c.status === "renamed" && c.oldPath) {
				const oldBaseline = this.baselineEntry(record, c.oldPath);
				const earlierOld = this.earlierLastChange(record, c.oldPath, turn);
				const oldTargetHash = earlierOld ? earlierOld.toHash : oldBaseline?.hash ?? null;
				const oldAction = oldTargetHash === null && oldBaseline?.existed === false ? "delete" : "write";
				out.push(await this.planToHash(record, c.oldPath, oldTargetHash, oldAction, null));
				const newBaseline = this.baselineEntry(record, c.relPath);
				const earlierNew = this.earlierLastChange(record, c.relPath, turn);
				const newTargetHash = earlierNew ? earlierNew.toHash : newBaseline?.hash ?? null;
				const newAction = newTargetHash === null && newBaseline?.existed === false ? "delete" : "write";
				out.push(await this.planToHash(record, c.relPath, newTargetHash, newAction, c.toHash));
				continue;
			}
			const baseline = this.baselineEntry(record, c.relPath);
			const earlier = this.earlierLastChange(record, c.relPath, turn);
			const targetHash = earlier ? earlier.toHash : baseline?.hash ?? null;
			const targetAction = targetHash === null && baseline?.existed === false ? "delete" : "write";
			out.push(await this.planToHash(record, c.relPath, targetHash, targetAction, expectedHashFor(c)));
		}
		return out;
	}
	/** Plan restoring a single file to baseline. */
	async planFileToBaseline(record, relPath) {
		const baseline = this.baselineEntry(record, relPath);
		if (!baseline) return this.planFile(record, relPath, null);
		if (baseline.dirtyBeforeSession) return this.mk(relPath, "noop", baseline.hash, null, null, "dirty-before-session", "file was already dirty before the session started; refusing to touch it");
		return this.planFile(record, relPath, baseline.hash);
	}
	/** Plan restoring a single file to a specific target hash (or delete). */
	async planFile(record, relPath, targetHash) {
		const latest = this.latestExpectedState(record, relPath);
		const baseline = this.baselineEntry(record, relPath);
		const expectedHash = latest.hash;
		if (targetHash !== null && targetHash !== expectedHash) {
			const sourceChange = record.turns.flatMap((t) => t.changes).find((c) => c.relPath === relPath && c.toHash === targetHash);
			if (sourceChange && sourceChange.kind === "binary") return this.mk(relPath, "noop", targetHash, null, expectedHash, "content-not-stored", "binary content is only hashed, not stored; cannot restore by content");
		}
		const diskHash = await this.diskHash(relPath);
		const action = targetHash === null ? "delete" : targetHash === diskHash ? "noop" : "write";
		if (action === "delete" && baseline?.existed === true) return this.mk(relPath, "delete", null, diskHash, expectedHash, "agent-did-not-create", "file existed at baseline; refusing to delete it (only restore content)");
		if (baseline?.dirtyBeforeSession) return this.mk(relPath, "noop", targetHash, diskHash, expectedHash, "dirty-before-session", "file was already dirty before the session started; refusing to touch it");
		if (expectedHash !== null && diskHash !== null && diskHash !== expectedHash) return this.mk(relPath, "noop", targetHash, diskHash, expectedHash, "conflict", "on-disk content differs from the recorded state (external edit detected); refusing to overwrite");
		if (expectedHash !== null && diskHash === null) return this.mk(relPath, "noop", targetHash, diskHash, expectedHash, "conflict", "file is missing on disk (was deleted outside the plugin); refusing to recreate blindly");
		if (expectedHash === null && diskHash !== null) return this.mk(relPath, "noop", targetHash, diskHash, expectedHash, "conflict", "file exists on disk but was recorded as absent/deleted (external edit detected); refusing to remove it");
		if (action === "noop") return this.mk(relPath, "noop", targetHash, diskHash, expectedHash, "already-at-target", "file already at target state");
		return this.mk(relPath, action, targetHash, diskHash, expectedHash, "ok", "");
	}
	planToHash(record, relPath, targetHash, action, expectedHash) {
		return (async () => {
			const diskHash = await this.diskHash(relPath);
			const baseline = this.baselineEntry(record, relPath);
			if (baseline?.dirtyBeforeSession) return this.mk(relPath, "noop", targetHash, diskHash, expectedHash, "dirty-before-session", "file was already dirty before the session started; refusing to touch it");
			if (action === "delete" && baseline?.existed === true) return this.mk(relPath, "delete", null, diskHash, expectedHash, "agent-did-not-create", "file existed at baseline; refusing to delete it");
			if (expectedHash !== null && diskHash !== null && diskHash !== expectedHash) return this.mk(relPath, "noop", targetHash, diskHash, expectedHash, "conflict", "on-disk content differs from the recorded state; refusing to overwrite");
			if (expectedHash !== null && diskHash === null) return this.mk(relPath, "noop", targetHash, diskHash, expectedHash, "conflict", "file is missing on disk; refusing to recreate blindly");
			if (expectedHash === null && diskHash !== null) return this.mk(relPath, "noop", targetHash, diskHash, expectedHash, "conflict", "file exists on disk but was recorded as absent/deleted; refusing to remove it");
			if (action === "noop") return this.mk(relPath, "noop", targetHash, diskHash, expectedHash, targetHash === diskHash ? "already-at-target" : "content-not-stored", "");
			return this.mk(relPath, action, targetHash, diskHash, expectedHash, "ok", "");
		})();
	}
	/** Last change to a path strictly before the given turn, or null. */
	earlierLastChange(record, relPath, turn) {
		let found = null;
		for (const t of record.turns) {
			if (t.turn >= turn) break;
			for (const c of t.changes) if (c.relPath === relPath) found = c;
		}
		return found;
	}
};
function expectedHashFor(c) {
	return c.toHash;
}
//#endregion
//#region src/core/scanner.ts
/**
* Workspace scanner: walks a directory tree, applies ignore rules, and computes
* per-file scan entries (kind / hash / size / mtime). Pure logic over HostFs —
* never touches DSH, so it is unit-testable in isolation.
*/
var WorkspaceScanner = class {
	fs;
	config;
	constructor(fs, config) {
		this.fs = fs;
		this.config = config;
	}
	normalize(parts) {
		return parts.join("/");
	}
	isIgnored(rel, isDir) {
		const base = path.basename(rel);
		if (isDir) return this.config.ignoreDirs.some((d) => d === base || d === rel);
		return this.config.ignoreFiles.some((f) => f === base || f === rel);
	}
	/**
	* Scan the workspace tree. Returns entries keyed by relative path (forward
	* slashes). Stops early once `maxScannedFiles` is exceeded.
	*/
	async scan(workspace) {
		const out = /* @__PURE__ */ new Map();
		let budget = this.config.maxScannedFiles;
		const walk = async (dir, parts) => {
			if (budget <= 0) return;
			let names;
			try {
				names = await this.fs.readdir(dir);
			} catch {
				return;
			}
			names.sort();
			for (const name of names) {
				if (budget <= 0) return;
				const abs = path.join(dir, name);
				let info;
				try {
					info = await this.fs.stat(abs);
				} catch {
					continue;
				}
				const nextParts = [...parts, name];
				const rel = this.normalize(nextParts);
				if (info.isDirectory) {
					if (this.isIgnored(rel, true)) continue;
					await walk(abs, nextParts);
					continue;
				}
				if (!info.isFile) continue;
				if (this.isIgnored(rel, false)) continue;
				budget--;
				let content = null;
				try {
					content = await this.fs.readFile(abs);
				} catch {
					continue;
				}
				const kind = kindFromBuffer(content);
				const hash = await sha256(content);
				out.set(rel, {
					relPath: rel,
					kind,
					hash,
					size: info.size,
					mtimeMs: info.mtimeMs
				});
			}
		};
		try {
			if (!(await this.fs.stat(workspace)).isDirectory) throw new Error(`workspace is not a directory: ${workspace}`);
		} catch (error) {
			throw new Error(`cannot scan workspace ${workspace}: ${error instanceof Error ? error.message : String(error)}`);
		}
		await walk(workspace, []);
		return out;
	}
	async readBytes(absPath) {
		return this.fs.readFile(absPath);
	}
};
//#endregion
//#region src/core/engine.ts
/**
* TimeMachineEngine: the core snapshot engine.
*
* Pure logic over HostFs + SidecarStore + a git state provider. It has no DSH
* imports, so it can be unit-tested in isolation and reused by the host adapter.
*
* Turn recording follows the safety model from the README:
*  - `recordPreTool` scans the workspace BEFORE a relevant tool runs and stores
*    content objects for small text files (so the "before" state of a file the
*    agent is about to change is recoverable). Content-addressed + deduped.
*  - `recordPostTool` scans AFTER the tool, diffs against the pre-snapshot (or
*    the last recorded snapshot), attributes changes to the turn/tool call and
*    persists only the change records + new content objects to the sidecar store.
*
* Everything is keyed per session and serialized per session so concurrent DSH
* sessions do not corrupt each other's snapshots. Nothing is written to the DSH
* session log.
*/
const DEFAULT_CONFIG = {
	largeFileThresholdBytes: 1024 * 1024,
	ignoreDirs: [
		"node_modules",
		".git",
		"build",
		"dist",
		".dsh",
		".venv",
		"venv"
	],
	ignoreFiles: [],
	maxScannedFiles: 2e4
};
var TimeMachineEngine = class {
	scanner;
	planner;
	fs;
	store;
	config;
	/** Per-session latest post-scan snapshot. */
	lastPostBySession = /* @__PURE__ */ new Map();
	/** Per-session pre-tool content buffers, used to recover overwritten text. */
	preContentsBySession = /* @__PURE__ */ new Map();
	/** Per-session in-memory latest record (for the restore planner's disk lookup). */
	activeRecords = /* @__PURE__ */ new Map();
	/** Per-session promise chain serializing engine mutations. */
	locks = /* @__PURE__ */ new Map();
	gitProvider;
	constructor(fs, store, config = DEFAULT_CONFIG, gitProvider) {
		this.fs = fs;
		this.store = store;
		this.config = config;
		this.scanner = new WorkspaceScanner(fs, config);
		this.planner = new RestorePlanner((rel) => this.diskHashOf(rel), (rel, hash) => this.contentForPreview(rel, hash));
		this.gitProvider = gitProvider ?? ((workspace, rel, entry) => this.gitStateFor(workspace, rel, entry));
	}
	/** Serialize all engine operations for one session. */
	withSessionLock(sessionId, fn) {
		const run = (this.locks.get(sessionId) ?? Promise.resolve()).then(fn);
		this.locks.set(sessionId, run.then(() => void 0, () => void 0));
		return run;
	}
	/** Establish the session baseline from the current workspace state. */
	establishBaseline(sessionId, workspace) {
		return this.withSessionLock(sessionId, () => this.establishBaselineLocked(sessionId, workspace));
	}
	async establishBaselineLocked(sessionId, workspace) {
		const scan = await this.scanner.scan(workspace);
		const baseline = [];
		for (const [rel, entry] of scan) {
			const git = await this.gitProvider(workspace, rel, entry);
			baseline.push({
				relPath: rel,
				existed: true,
				kind: entry.kind,
				hash: entry.hash,
				size: entry.size,
				dirtyBeforeSession: git?.dirty === true || git?.staged === true,
				git
			});
		}
		const record = {
			sessionId,
			workspace,
			baselineAt: Date.now(),
			baseline,
			turns: []
		};
		await this.store.writeSession(record);
		this.lastPostBySession.set(sessionId, scan);
		this.activeRecords.set(sessionId, record);
		return record;
	}
	/**
	* Pre-tool scan: capture the workspace state before a relevant tool runs.
	* Stores content objects for small text files so the pre-change state is
	* recoverable for diffing and baseline restore.
	*/
	recordPreTool(sessionId, workspace, event) {
		return this.withSessionLock(sessionId, () => this.recordPreToolLocked(sessionId, workspace, event));
	}
	async recordPreToolLocked(sessionId, workspace, event) {
		const record = await this.store.readSession(sessionId) ?? await this.establishBaselineLocked(sessionId, workspace);
		this.activeRecords.set(sessionId, record);
		let scan;
		try {
			scan = await this.scanner.scan(workspace);
		} catch {
			return record;
		}
		const preContents = this.preContentsBySession.get(sessionId) ?? /* @__PURE__ */ new Map();
		this.preContentsBySession.set(sessionId, preContents);
		for (const [rel, entry] of scan) {
			if (entry.kind !== "text" || entry.size > this.config.largeFileThresholdBytes) continue;
			if (!entry.hash) continue;
			if (await this.store.hasObject(entry.hash)) continue;
			try {
				const buf = await this.fs.readFile(path.join(workspace, rel));
				await this.store.putObject(entry.hash, buf);
				preContents.set(rel, buf);
			} catch {}
		}
		return record;
	}
	/**
	* Post-tool scan: diff against the last known snapshot, attribute changes to
	* the given turn/tool call, persist change records + new content objects.
	*/
	recordPostTool(sessionId, workspace, event) {
		return this.withSessionLock(sessionId, () => this.recordPostToolLocked(sessionId, workspace, event));
	}
	async recordPostToolLocked(sessionId, workspace, event) {
		const record = await this.store.readSession(sessionId) ?? await this.establishBaselineLocked(sessionId, workspace);
		this.activeRecords.set(sessionId, record);
		let scan;
		try {
			scan = await this.scanner.scan(workspace);
		} catch {
			return {
				record,
				changes: []
			};
		}
		const previous = this.lastPostBySession.get(sessionId) ?? null;
		const changes = await this.diffSnapshots(record, workspace, previous, scan, event, sessionId);
		this.lastPostBySession.set(sessionId, scan);
		if (changes.length === 0) return {
			record,
			changes
		};
		const next = {
			...record,
			turns: this.appendTurn(record.turns, changes, event.turn)
		};
		await this.store.writeSession(next);
		this.activeRecords.set(sessionId, next);
		return {
			record: next,
			changes
		};
	}
	/** End the current turn (timestamps the last turn if still open). */
	endTurn(sessionId) {
		return this.withSessionLock(sessionId, () => this.endTurnLocked(sessionId));
	}
	/**
	* Ambient scan: called by the watcher / periodic reconciliation. Records
	* changes not attributable to a particular tool call (source = null).
	*/
	recordAmbient(sessionId, workspace) {
		return this.withSessionLock(sessionId, () => this.recordAmbientLocked(sessionId, workspace));
	}
	async recordAmbientLocked(sessionId, workspace) {
		const record = await this.store.readSession(sessionId) ?? await this.establishBaselineLocked(sessionId, workspace);
		this.activeRecords.set(sessionId, record);
		let scan;
		try {
			scan = await this.scanner.scan(workspace);
		} catch {
			return {
				record,
				changes: []
			};
		}
		const previous = this.lastPostBySession.get(sessionId) ?? null;
		const changes = await this.diffSnapshots(record, workspace, previous, scan, null, sessionId);
		this.lastPostBySession.set(sessionId, scan);
		if (changes.length === 0) return {
			record,
			changes
		};
		const turn = record.turns.length > 0 ? record.turns[record.turns.length - 1].turn : 0;
		const next = {
			...record,
			turns: this.appendTurn(record.turns, changes, turn)
		};
		await this.store.writeSession(next);
		this.activeRecords.set(sessionId, next);
		return {
			record: next,
			changes
		};
	}
	async endTurnLocked(sessionId) {
		const record = await this.store.readSession(sessionId);
		if (!record) return null;
		if (record.turns.length === 0) return record;
		const last = record.turns[record.turns.length - 1];
		if (last.endedAt !== null) return record;
		const updated = {
			...last,
			endedAt: Date.now()
		};
		const next = {
			...record,
			turns: [...record.turns.slice(0, -1), updated]
		};
		await this.store.writeSession(next);
		this.activeRecords.set(sessionId, next);
		return next;
	}
	readSession(sessionId) {
		return this.store.readSession(sessionId);
	}
	appendTurn(turns, changes, turn) {
		const existing = turns.find((t) => t.turn === turn);
		const toolCalls = Array.from(/* @__PURE__ */ new Set([...existing?.toolCalls ?? [], ...changes.flatMap((c) => c.source?.callId ? [c.source.callId] : [])]));
		if (existing) return turns.map((t) => t.turn === turn ? {
			...t,
			toolCalls,
			changes: [...t.changes, ...changes]
		} : t);
		const now = Date.now();
		return [...turns.map((t) => t.endedAt === null ? {
			...t,
			endedAt: now
		} : t), {
			turn,
			startedAt: now,
			endedAt: null,
			toolCalls,
			changes
		}];
	}
	async diffSnapshots(record, workspace, previous, current, event, sessionId) {
		const out = [];
		const source = event ? {
			turn: event.turn,
			toolName: event.toolName,
			callId: event.callId
		} : null;
		if (!previous) {
			const baselineByPath = new Map(record.baseline.map((b) => [b.relPath, b]));
			for (const [rel, entry] of current) {
				const bl = baselineByPath.get(rel);
				if (bl && bl.hash === entry.hash && bl.kind === entry.kind) continue;
				if (bl) out.push(await this.makeChange(workspace, rel, entry, bl.hash, source, sessionId));
				else out.push(await this.makeChange(workspace, rel, entry, null, source, sessionId));
			}
			for (const [rel, blob] of baselineByPath) if (!current.has(rel) && blob.existed) out.push(this.makeDeletedChange(rel, blob, source));
			return out;
		}
		const renames = await findRenames(previous, current, async (rel, side) => {
			try {
				if (side === "old") {
					const prev = previous.get(rel);
					if (prev?.hash) {
						const buf = await this.store.getObject(prev.hash);
						if (buf) return buf.toString("utf8");
					}
					return null;
				}
				return (await this.fs.readFile(path.join(workspace, rel))).toString("utf8");
			} catch {
				return null;
			}
		});
		const renamedOld = new Set(renames.map((r) => r.oldPath));
		const renamedNew = new Set(renames.map((r) => r.newPath));
		new Map(renames.map((r) => [r.oldPath, r]));
		new Map(renames.map((r) => [r.newPath, r]));
		const prevByPath = /* @__PURE__ */ new Map();
		for (const [rel, entry] of previous) prevByPath.set(rel, entry);
		for (const [rel, prev] of prevByPath) {
			if (renamedOld.has(rel)) continue;
			if (!current.has(rel)) {
				const blob = record.baseline.find((b) => b.relPath === rel);
				out.push(this.makeDeletedChange(rel, blob ?? {
					relPath: rel,
					existed: true,
					kind: prev.kind,
					hash: prev.hash,
					size: prev.size,
					dirtyBeforeSession: false,
					git: null
				}, source));
			}
		}
		for (const [rel, entry] of current) {
			if (renamedNew.has(rel)) continue;
			const prev = prevByPath.get(rel);
			if (!prev) out.push(await this.makeChange(workspace, rel, entry, null, source, sessionId));
			else if (prev.hash !== entry.hash) out.push(await this.makeChange(workspace, rel, entry, prev.hash, source, sessionId));
		}
		for (const r of renames) {
			const prev = prevByPath.get(r.oldPath);
			const entry = current.get(r.newPath);
			if (!prev || !entry) continue;
			out.push(await this.makeRenameChange(workspace, r.oldPath, r.newPath, entry, prev.hash, source, sessionId));
		}
		return out;
	}
	async makeChange(workspace, rel, entry, fromHash, source, sessionId) {
		let content = null;
		try {
			content = await this.fs.readFile(path.join(workspace, rel));
		} catch {
			content = null;
		}
		const toHash = content ? await sha256(content) : entry.hash;
		let diff = null;
		let added = 0;
		let removed = 0;
		if (entry.kind === "text" && content) {
			let oldBuf = await this.contentForHash(fromHash);
			const preContents = this.preContentsBySession.get(sessionId);
			if (oldBuf === null && preContents?.has(rel)) oldBuf = preContents.get(rel) ?? null;
			if (oldBuf) {
				const d = diffLines(oldBuf.toString("utf8"), content.toString("utf8"), `a/${rel}`, `b/${rel}`);
				diff = d.unified;
				added = d.addedLines;
				removed = d.removedLines;
			} else if (fromHash === null) {
				const d = diffLines("", content.toString("utf8"), `/dev/null`, `b/${rel}`);
				diff = d.unified;
				added = d.addedLines;
			}
		}
		if (content && entry.kind === "text" && entry.size <= this.config.largeFileThresholdBytes && toHash) await this.store.putObject(toHash, content);
		return {
			relPath: rel,
			status: fromHash === null ? "added" : "modified",
			kind: entry.kind,
			fromHash,
			toHash,
			size: entry.size,
			mtimeMs: entry.mtimeMs,
			addedLines: added,
			removedLines: removed,
			diff,
			source
		};
	}
	async makeRenameChange(workspace, oldPath, relPath, entry, fromHash, source, sessionId) {
		let content = null;
		try {
			content = await this.fs.readFile(path.join(workspace, relPath));
		} catch {
			content = null;
		}
		const toHash = content ? await sha256(content) : entry.hash;
		let diff = null;
		let added = 0;
		let removed = 0;
		if (entry.kind === "text" && content) {
			const oldBuf = await this.contentForHash(fromHash);
			if (oldBuf) {
				const d = diffLines(oldBuf.toString("utf8"), content.toString("utf8"), `a/${oldPath}`, `b/${relPath}`);
				diff = d.unified;
				added = d.addedLines;
				removed = d.removedLines;
			}
		}
		if (content && entry.kind === "text" && entry.size <= this.config.largeFileThresholdBytes && toHash) await this.store.putObject(toHash, content);
		return {
			relPath,
			oldPath,
			status: "renamed",
			kind: entry.kind,
			fromHash,
			toHash,
			size: entry.size,
			mtimeMs: entry.mtimeMs,
			addedLines: added,
			removedLines: removed,
			diff,
			source
		};
	}
	makeDeletedChange(rel, prev, source) {
		return {
			relPath: rel,
			status: "deleted",
			kind: prev.kind,
			fromHash: prev.hash,
			toHash: null,
			size: 0,
			mtimeMs: Date.now(),
			addedLines: 0,
			removedLines: 0,
			diff: null,
			source
		};
	}
	async contentForHash(hash) {
		if (!hash) return null;
		return this.store.getObject(hash);
	}
	async diskHashOf(rel) {
		const record = this.activeRecords.get(this.currentPreviewSession ?? "") ?? null;
		if (!record) return null;
		try {
			return await sha256(await this.fs.readFile(path.join(record.workspace, rel)));
		} catch {
			return null;
		}
	}
	async contentForPreview(rel, hash) {
		if (!hash) return null;
		const record = this.activeRecords.get(this.currentPreviewSession ?? "") ?? null;
		if (!record) return null;
		try {
			const buf = await this.fs.readFile(path.join(record.workspace, rel));
			if (await sha256(buf) === hash) return buf;
		} catch {}
		return this.store.getObject(hash);
	}
	currentPreviewSession = null;
	async gitStateFor(workspace, rel, entry) {
		try {
			return await gitFileState(workspace, rel);
		} catch {
			return null;
		}
	}
	/** Build a restore preview (never writes). */
	previewRestore(record, target, includeContents = false) {
		return this.withSessionLock(record.sessionId, async () => {
			this.activeRecords.set(record.sessionId, record);
			this.currentPreviewSession = record.sessionId;
			let previews = [];
			switch (target.kind) {
				case "baseline":
					previews = await this.planner.planBaseline(record);
					break;
				case "turn":
					previews = await this.planner.planTurnStart(record, target.turn);
					break;
				case "file": {
					const baseline = record.baseline.find((b) => b.relPath === target.relPath);
					if (target.to === "baseline") {
						const rename = this.renameByNewPath(record, target.relPath);
						if (rename && rename.oldPath) previews = [await this.planner.planFileToBaseline(record, rename.oldPath), await this.planner.planFileToBaseline(record, target.relPath)];
						else previews = [await this.planner.planFileToBaseline(record, target.relPath)];
					} else {
						const last = this.lastChangeFor(record, target.relPath);
						if (!last) return [];
						const targetHash = target.to === "prev-turn" ? baseline?.hash ?? null : last.toHash;
						previews = [await this.planner.planFile(record, target.relPath, targetHash)];
					}
					break;
				}
			}
			if (includeContents) previews = await Promise.all(previews.map((p) => this.planner.decorateContents(p)));
			return previews;
		});
	}
	renameByNewPath(record, relPath) {
		for (let i = record.turns.length - 1; i >= 0; i--) for (let j = record.turns[i].changes.length - 1; j >= 0; j--) {
			const c = record.turns[i].changes[j];
			if (c.status === "renamed" && c.relPath === relPath && c.oldPath) return c;
		}
		return null;
	}
	lastChangeFor(record, relPath) {
		for (let i = record.turns.length - 1; i >= 0; i--) for (let j = record.turns[i].changes.length - 1; j >= 0; j--) {
			const c = record.turns[i].changes[j];
			if (c.relPath === relPath) return c;
		}
		return null;
	}
	/**
	* Execute a restore AFTER the client has explicitly confirmed and the host
	* has re-checked hashes. Performs only the `ok` previews; conflict/problem
	* previews are returned untouched.
	*/
	commitRestore(record, previews, force = false) {
		return this.withSessionLock(record.sessionId, async () => {
			this.activeRecords.set(record.sessionId, record);
			this.currentPreviewSession = record.sessionId;
			const results = [];
			let performed = 0;
			for (const p of previews) {
				if (p.problem !== "ok" && !(force && p.problem === "conflict")) {
					results.push(p);
					continue;
				}
				const abs = path.join(record.workspace, p.relPath);
				let diskHash = null;
				try {
					diskHash = await sha256(await this.fs.readFile(abs));
				} catch {
					diskHash = null;
				}
				if (!force && p.expectedHash !== null && diskHash !== null && diskHash !== p.expectedHash) {
					results.push({
						...p,
						problem: "conflict",
						reason: "content changed since preview; aborting write-back"
					});
					continue;
				}
				if (!force && p.expectedHash === null && diskHash !== null) {
					results.push({
						...p,
						problem: "conflict",
						reason: "file appeared on disk since preview; aborting write-back"
					});
					continue;
				}
				if (p.action === "delete") {
					await this.fs.unlink(abs);
					performed++;
					results.push({
						...p,
						problem: "ok"
					});
				} else if (p.targetHash !== null) {
					const data = await this.store.getObject(p.targetHash);
					if (!data) {
						results.push({
							...p,
							problem: "content-not-stored",
							reason: "target content is not stored"
						});
						continue;
					}
					await this.fs.mkdirp(path.dirname(abs));
					await this.fs.writeFile(abs, data);
					performed++;
					results.push({
						...p,
						problem: "ok"
					});
				}
			}
			return {
				performed,
				results
			};
		});
	}
};
//#endregion
//#region src/core/watcher.ts
/**
* Watcher helper layer (pure core logic).
*
* The watcher is a FAST DISCOVERY HINT only — it is never the source of truth.
* A file change is always confirmed by a full scan for final consistency. This
* module is intentionally backend-agnostic so it can be unit-tested with a fake
* watcher: it owns debounce/merge, ignore filtering and sequence bookkeeping,
* and delegates the actual OS watching to an injected backend.
*
* Design:
*  - The backend calls `emit(event)` with absolute paths (or null for an
*    unknown/whole-tree event).
*  - `schedule()` coalesces bursts: only the trailing event after a quiet
*    period triggers the `onFlush` callback. Subsequent events during the quiet
*    window reset the timer and are merged (paths union).
*  - Ignore rules reuse `EngineConfig.ignoreDirs` / `ignoreFiles`.
*/
var FileWatcher = class {
	config;
	debounceMs;
	maxWaitMs;
	onFlush;
	pending = {
		paths: /* @__PURE__ */ new Set(),
		unknown: false
	};
	timer = null;
	maxTimer = null;
	disposed = false;
	constructor(options, onFlush) {
		this.config = options.config;
		this.debounceMs = options.debounceMs ?? 300;
		this.maxWaitMs = options.maxWaitMs ?? 3e3;
		this.onFlush = onFlush;
	}
	/** Reject paths under ignored directories/files. Pure, exported for tests. */
	isIgnored(absPath, base) {
		const rel = this.toRel(absPath, base);
		const parts = rel.split("/");
		const baseName = parts[parts.length - 1] ?? "";
		if (this.config.ignoreDirs.includes(baseName) || this.config.ignoreDirs.includes(rel)) return true;
		if (this.config.ignoreFiles.includes(baseName) || this.config.ignoreFiles.includes(rel)) return true;
		for (const dir of this.config.ignoreDirs) if (rel === dir || rel.startsWith(dir + "/")) return true;
		return false;
	}
	/** Normalize an absolute path to a workspace-relative posix path. */
	toRel(absPath, base) {
		const root = base ?? "";
		const rel = path.relative(root, absPath).replaceAll("\\", "/");
		return rel === "" || rel === "." ? "" : rel;
	}
	/** Begin watching via the backend. Returns a combined dispose function. */
	async start(backend, root) {
		const disposeBackend = await backend.start(root, (event) => this.emit(event, root));
		return () => {
			this.dispose();
			disposeBackend();
		};
	}
	/** Feed an OS event into the watcher (debounced + merged). */
	emit(event, base) {
		if (this.disposed) return;
		if (event.absPath) {
			if (base && this.isIgnored(event.absPath, base)) return;
			this.pending.paths.add(event.absPath);
		} else this.pending.unknown = true;
		this.resetTimer();
	}
	/** Force an immediate flush of pending events (used by periodic reconciliation). */
	async flushNow() {
		if (this.disposed) return;
		const pending = this.pending;
		this.pending = {
			paths: /* @__PURE__ */ new Set(),
			unknown: false
		};
		this.clearTimers();
		if (pending.paths.size === 0 && !pending.unknown) return;
		await this.onFlush([...Array.from(pending.paths, (p) => ({ absPath: p })), ...pending.unknown ? [{ absPath: null }] : []]);
	}
	resetTimer() {
		this.clearTimers();
		this.timer = setTimeout(() => {
			this.flushNow();
		}, this.debounceMs);
		this.maxTimer = setTimeout(() => {
			this.flushNow();
		}, this.maxWaitMs);
	}
	clearTimers() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (this.maxTimer) {
			clearTimeout(this.maxTimer);
			this.maxTimer = null;
		}
	}
	dispose() {
		this.disposed = true;
		this.clearTimers();
	}
};
//#endregion
//#region src/core/nodeFs.ts
/**
* Real node:fs implementation of HostFs (default adapter).
*/
function toInfo(st) {
	return {
		size: st.size,
		mtimeMs: st.mtimeMs,
		isDirectory: st.isDirectory(),
		isFile: st.isFile()
	};
}
const nodeFs = {
	async stat(absPath) {
		return toInfo(await promises.stat(absPath));
	},
	async readFile(absPath) {
		return promises.readFile(absPath);
	},
	async readdir(absPath) {
		return promises.readdir(absPath);
	},
	async writeFile(absPath, data) {
		await promises.writeFile(absPath, data);
	},
	async mkdirp(absPath) {
		await promises.mkdir(absPath, { recursive: true });
	},
	async unlink(absPath) {
		await promises.unlink(absPath);
	},
	async rename(from, to) {
		await promises.rename(from, to);
	},
	async exists(absPath) {
		try {
			await promises.access(absPath);
			return true;
		} catch {
			return false;
		}
	}
};
//#endregion
//#region src/core/store.ts
/**
* Sidecar store: `~/.dsh/time-machine/<sessionId>/`.
*
* Design rules (see README security model):
*  - Everything lives under the plugin's own directory; NOTHING is appended to
*    the DSH session log.
*  - Workspace file contents are stored only as content-addressed objects
*    (`objects/<sha256>`), and only when a file changes. Pristine files at
*    baseline are recorded as hash references only, never copied.
*  - Large files (>= config.largeFileThresholdBytes) are recorded by hash but
*    their content is not stored, so restore of a large file is a no-op with a
*    clear message rather than a silent copy.
*
* All writes are atomic (write temp then rename).
*/
function timeMachineRoot(dshHome = process.env.DSH_HOME ?? join(homedir(), ".dsh")) {
	return join(dshHome, "time-machine");
}
function sanitize(sessionId) {
	return sessionId.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}
async function createSidecarStore(fsh, root = timeMachineRoot()) {
	await fsh.mkdirp(root);
	const sessionDir = (sessionId) => join(root, sanitize(sessionId));
	const sessionFile = (sessionId) => join(sessionDir(sessionId), "session.json");
	const objectFile = (hash) => join(root, "objects", hash);
	const atomicWrite = async (abs, data) => {
		const dir = path.dirname(abs);
		await fsh.mkdirp(dir);
		const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`;
		await fsh.writeFile(tmp, Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8"));
		try {
			await fsh.rename(tmp, abs);
		} catch (error) {
			try {
				await fsh.unlink(abs);
			} catch {}
			await fsh.rename(tmp, abs);
		}
	};
	return {
		sessionDir,
		async readSession(sessionId) {
			try {
				const raw = await fsh.readFile(sessionFile(sessionId));
				const parsed = JSON.parse(raw.toString("utf8"));
				if (parsed.sessionId !== sessionId || !Array.isArray(parsed.baseline)) return null;
				return parsed;
			} catch {
				return null;
			}
		},
		async writeSession(record) {
			await atomicWrite(sessionFile(record.sessionId), JSON.stringify(record, null, 2));
		},
		async putObject(hash, data) {
			await atomicWrite(objectFile(hash), data);
		},
		async getObject(hash) {
			try {
				return await fsh.readFile(objectFile(hash));
			} catch {
				return null;
			}
		},
		async hasObject(hash) {
			try {
				await fsh.readFile(objectFile(hash));
				return true;
			} catch {
				return false;
			}
		},
		async clear(sessionId) {
			if (sessionId === void 0) {
				await promises.rm(root, {
					recursive: true,
					force: true
				});
				return;
			}
			await promises.rm(sessionDir(sessionId), {
				recursive: true,
				force: true
			});
		}
	};
}
//#endregion
//#region src/host/nodeWatcher.ts
/**
* Node fs.watch backend for the watcher helper layer.
*
* Uses `fs.watch` with `recursive: true` where supported (Node 20+ on Windows)
* and falls back to a non-recursive watch on the root + the FileWatcher's
* periodic reconciliation scan to catch nested changes. Emits `WatcherEvent`s
* (absolute paths, or null for whole-root events) to the core FileWatcher.
*
* This is only a fast-discovery hint; the engine always confirms via a full
* scan, so missed events here are safe.
*/
var NodeWatcherBackend = class {
	options;
	disposeFns = [];
	watcher = null;
	constructor(options = {}) {
		this.options = options;
	}
	async start(root, emit) {
		const recursive = this.options.recursive ?? isRecursiveSupported();
		await new Promise((resolve, reject) => {
			try {
				const watcher = watch(root, { recursive }, (eventType, filename) => {
					if (filename === null || filename === void 0) {
						emit({ absPath: null });
						return;
					}
					emit({ absPath: filename.toString().startsWith(root) ? filename.toString() : awaitPath(root, filename.toString()) });
				});
				this.watcher = watcher;
				watcher.once("error", (err) => {
					emit({ absPath: null });
				});
				resolve();
			} catch (error) {
				reject(error);
			}
		});
		return () => this.dispose();
	}
	dispose() {
		if (this.watcher) {
			try {
				this.watcher.close();
			} catch {}
			this.watcher = null;
		}
		for (const fn of this.disposeFns) fn();
		this.disposeFns = [];
	}
};
function awaitPath(root, rel) {
	return root + (root.endsWith("/") || root.endsWith("\\") ? "" : "/") + rel;
}
/** Windows (Node >= 20.12) and macOS (Node >= 19.1) support recursive watch. */
function isRecursiveSupported() {
	const [major, minor] = process.versions.node.split(".").map(Number);
	if (process.platform === "win32") return major > 20 || major === 20 && minor >= 12;
	if (process.platform === "darwin") return major > 19 || major === 19 && minor >= 1;
	return false;
}
//#endregion
//#region src/host/adapter.ts
/** Tools that can change the working tree (directly or via subprocess). */
const RELEVANT_RE = /^(run_code|bash|pwsh|powershell|sh|write|write_file|edit|edit_file|apply_patch|apply-patch|rm|rmdir|mv|rename|mkdir|mkfile|touch|cp|cp_r|sed|node|npm|pnpm|yarn|python|python3|git|cmd|dsh_write|dsh_edit|dsh_apply_patch|fs_write|fs_edit|file_write|file_edit|exec|command)/i;
/** Tools that only read; never trigger a scan by themselves. */
const READ_ONLY_RE = /^(read|read_file|ls|list|glob|grep|search|stat|cat|head|tail|find|pwd|get_cwd|view|inspect|show|fetch|web_search|dump)/i;
const DEBOUNCE_MS = 400;
var HostAdapter = class {
	ctx;
	engine = null;
	sidecar;
	options;
	turns = /* @__PURE__ */ new Map();
	lastScanAt = 0;
	inFlight = false;
	pendingPost = null;
	watchers = /* @__PURE__ */ new Map();
	workspaceSessions = /* @__PURE__ */ new Map();
	reconcileTimers = /* @__PURE__ */ new Map();
	constructor(ctx, options = {}) {
		this.ctx = ctx;
		this.sidecar = createSidecarStore(nodeFs);
		this.options = {
			watcherDebounceMs: options.watcherDebounceMs ?? 300,
			reconcileIntervalMs: options.reconcileIntervalMs ?? 3e4
		};
	}
	async getEngine() {
		if (!this.engine) this.engine = new TimeMachineEngine(nodeFs, await this.sidecar);
		return this.engine;
	}
	isRelevant(name) {
		if (READ_ONLY_RE.test(name)) return false;
		return RELEVANT_RE.test(name) || name.includes("file") || name.includes("workspace") || name.includes("write") || name.includes("edit");
	}
	workspace(agent) {
		return agent?.session.header.cwd;
	}
	currentTurn(agent) {
		if (!agent) return 1;
		return this.turns.get(agent.id) ?? 1;
	}
	/** Start a watcher + reconciliation timer for a workspace and remember sessions using it. */
	registerWorkspace(sessionId, workspace) {
		const sessions = this.workspaceSessions.get(workspace) ?? /* @__PURE__ */ new Set();
		sessions.add(sessionId);
		this.workspaceSessions.set(workspace, sessions);
		if (!this.watchers.has(workspace)) {
			const watcher = new FileWatcher({
				debounceMs: this.options.watcherDebounceMs,
				config: {
					largeFileThresholdBytes: 1024 * 1024,
					ignoreDirs: [
						"node_modules",
						".git",
						"build",
						"dist",
						".dsh",
						".venv",
						"venv"
					],
					ignoreFiles: [],
					maxScannedFiles: 2e4
				}
			}, () => {
				this.handleWatcherFlush(workspace).catch((e) => {
					this.ctx.logger.warn(`[dsh-time-machine] watcher flush failed: ${e instanceof Error ? e.message : String(e)}`);
				});
			});
			const backend = new NodeWatcherBackend();
			watcher.start(backend, workspace).then((dispose) => {
				this.watchers.set(workspace, {
					watcher,
					dispose
				});
			}, (error) => {
				this.ctx.logger.warn(`[dsh-time-machine] watcher start failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		}
		if (this.options.reconcileIntervalMs > 0 && !this.reconcileTimers.has(workspace)) {
			const timer = setInterval(() => {
				this.reconcile(workspace).catch((e) => {
					this.ctx.logger.warn(`[dsh-time-machine] reconciliation failed: ${e instanceof Error ? e.message : String(e)}`);
				});
			}, this.options.reconcileIntervalMs);
			this.reconcileTimers.set(workspace, timer);
		}
	}
	/** Run an ambient scan for every session sharing a workspace. */
	async reconcile(workspace) {
		const sessions = this.workspaceSessions.get(workspace);
		if (!sessions) return;
		const engine = await this.getEngine();
		await Promise.all(Array.from(sessions, async (sessionId) => {
			await engine.recordAmbient(sessionId, workspace);
		}));
	}
	/** Watcher flush is only a hint; always confirm with a full scan. */
	async handleWatcherFlush(workspace) {
		await this.reconcile(workspace);
	}
	dispose() {
		for (const timer of this.reconcileTimers.values()) clearInterval(timer);
		this.reconcileTimers.clear();
		for (const entry of this.watchers.values()) entry.dispose();
		this.watchers.clear();
		this.workspaceSessions.clear();
	}
	/** Called on `tools/pre-execute` for relevant tools. */
	onPre(exec) {
		const agent = exec.agent;
		if (!this.isRelevant(exec.name)) return;
		const workspace = this.workspace(agent);
		if (!agent || !workspace) return;
		this.registerWorkspace(agent.session.id, workspace);
		const event = {
			turn: this.currentTurn(agent),
			toolName: exec.name,
			callId: exec.callId
		};
		this.scanPre(agent.session.id, workspace, event).catch((e) => {
			this.ctx.logger.warn(`[dsh-time-machine] pre-scan failed: ${e instanceof Error ? e.message : String(e)}`);
		});
	}
	/** Called on `tools/post-execute` for relevant tools. */
	onPost(exec) {
		const agent = exec.agent;
		if (!this.isRelevant(exec.name)) return;
		const workspace = this.workspace(agent);
		if (!agent || !workspace) return;
		this.registerWorkspace(agent.session.id, workspace);
		const event = {
			turn: this.currentTurn(agent),
			toolName: exec.name,
			callId: exec.callId
		};
		this.queuePost(agent.session.id, workspace, event);
	}
	async scanPre(sessionId, workspace, event) {
		await (await this.getEngine()).recordPreTool(sessionId, workspace, event);
	}
	queuePost(sessionId, workspace, event) {
		const now = Date.now();
		const job = {
			sessionId,
			workspace,
			event
		};
		if (this.inFlight) {
			this.pendingPost = job;
			return;
		}
		if (now - this.lastScanAt < DEBOUNCE_MS) {
			if (!this.pendingPost) this.pendingPost = job;
			return;
		}
		this.runPost(job);
	}
	async runPost(job) {
		if (this.inFlight) {
			this.pendingPost = job;
			return;
		}
		this.inFlight = true;
		this.lastScanAt = Date.now();
		try {
			await (await this.getEngine()).recordPostTool(job.sessionId, job.workspace, job.event);
		} catch (e) {
			this.ctx.logger.warn(`[dsh-time-machine] post-scan failed: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			this.inFlight = false;
			const next = this.pendingPost;
			this.pendingPost = null;
			if (next) await this.runPost(next);
		}
	}
	/** On `session/event`: track turn boundaries. */
	onSessionEvent(session) {
		if (!session || session.id === void 0) return;
		const events = session.events ?? [];
		for (const ev of events) if (ev.type === "turn/start") {
			const turn = ev.data?.turn;
			if (typeof turn === "number") this.turns.set(session.id, turn);
		} else if (ev.type === "turn/end") this.finishTurn(session.id);
	}
	async finishTurn(sessionId) {
		await (await this.getEngine()).endTurn(sessionId).catch(() => void 0);
	}
	async getRecord(sessionId) {
		return (await this.getEngine()).readSession(sessionId);
	}
	async clear(sessionId) {
		await (await this.sidecar).clear(sessionId);
		if (sessionId === void 0) this.engine = null;
	}
	async previewRestore(sessionId, target, includeContents = false) {
		const engine = await this.getEngine();
		const record = await engine.readSession(sessionId);
		if (!record) throw new Error("session record not found");
		return engine.previewRestore(record, target, includeContents);
	}
	async commitRestore(sessionId, target, confirmed, force = false) {
		if (!confirmed) throw new Error("restore requires explicit confirmation (confirmed: true)");
		const engine = await this.getEngine();
		const record = await engine.readSession(sessionId);
		if (!record) throw new Error("session record not found");
		const previews = await engine.previewRestore(record, target);
		const conflict = previews.some((p) => p.problem === "conflict");
		if (previews.some((p) => p.problem === "dirty-before-session" || p.problem === "agent-did-not-create")) throw new Error("restore blocked: one or more files are hard-protected; refusing to write back");
		if (conflict && !force) throw new Error("restore blocked: one or more files conflict; pass force:true to overwrite only after explicit double-confirmation");
		return engine.commitRestore(record, previews, force);
	}
	/**
	* Save the current on-disk content of a conflicted file to a new sibling path
	* (default `<relPath>.tm-conflict`) so the user can force-overwrite without
	* losing their manual edit. Requires explicit confirmation.
	*/
	async saveCurrentAs(sessionId, relPath, confirmed, targetPath) {
		if (!confirmed) throw new Error("save-as requires explicit confirmation (confirmed: true)");
		const record = await (await this.getEngine()).readSession(sessionId);
		if (!record) throw new Error("session record not found");
		const workspace = record.workspace;
		const sourceAbs = this.resolveInsideWorkspace(workspace, relPath);
		const defaultTarget = `${relPath.replace(/^\.\/+/, "")}.tm-conflict`;
		const targetRel = targetPath && targetPath.length > 0 ? targetPath : defaultTarget;
		const targetAbs = this.resolveInsideWorkspace(workspace, targetRel);
		const sourceBuf = await nodeFs.readFile(sourceAbs).catch(() => {
			throw new Error(`source file not found on disk: ${relPath}`);
		});
		if (await nodeFs.exists?.(targetAbs)) throw new Error(`target file already exists: ${targetRel}`);
		await nodeFs.mkdirp(path.dirname(targetAbs));
		await nodeFs.writeFile(targetAbs, sourceBuf);
		return { savedPath: targetRel };
	}
	/** Resolve a workspace-relative path and ensure it stays inside the workspace. */
	resolveInsideWorkspace(workspace, rel) {
		const abs = path.resolve(workspace, rel);
		const root = path.resolve(workspace);
		const relCheck = path.relative(root, abs);
		if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) throw new Error("path escapes workspace");
		return abs;
	}
};
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
function parseTarget(body) {
	const kind = body["kind"];
	if (kind === "baseline") return { kind: "baseline" };
	if (kind === "turn") {
		const turn = body["turn"];
		if (typeof turn === "number") return {
			kind: "turn",
			turn
		};
		return;
	}
	if (kind === "file") {
		const relPath = requireString(body, "relPath");
		const to = body["to"];
		if (relPath && (to === "baseline" || to === "prev-turn" || to === "current")) return {
			kind: "file",
			relPath,
			to
		};
		return;
	}
}
function registerApi(ctx, adapter) {
	ctx.effect(() => {
		const base = "/plugins/dsh-time-machine/api";
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/timeline`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const sessionId = requireString(await readJson(req), "sessionId");
						if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
						json(res, 200, ok({ record: await adapter.getRecord(sessionId) }));
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
						const target = parseTarget(body);
						if (!sessionId || !target) return json(res, 400, fail("bad-request", "sessionId and a valid target are required"));
						const includeContents = body["includeContents"] === true;
						json(res, 200, ok({ previews: await adapter.previewRestore(sessionId, target, includeContents) }));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/restore`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const sessionId = requireString(body, "sessionId");
						const target = parseTarget(body);
						const confirmed = body["confirmed"] === true;
						const force = body["force"] === true;
						if (!sessionId || !target) return json(res, 400, fail("bad-request", "sessionId and a valid target are required"));
						if (!confirmed) return json(res, 400, fail("bad-request", "confirmed: true is required before any write-back"));
						json(res, 200, ok(await adapter.commitRestore(sessionId, target, true, force)));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/save-as`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const sessionId = requireString(body, "sessionId");
						const relPath = requireString(body, "relPath");
						const confirmed = body["confirmed"] === true;
						const targetPath = typeof body["targetPath"] === "string" ? body["targetPath"] : void 0;
						if (!sessionId || !relPath) return json(res, 400, fail("bad-request", "sessionId and relPath are required"));
						if (!confirmed) return json(res, 400, fail("bad-request", "confirmed: true is required"));
						json(res, 200, ok(await adapter.saveCurrentAs(sessionId, relPath, true, targetPath)));
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
						await adapter.clear?.(sessionId);
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
	}, "dsh-time-machine: web routes");
}
//#endregion
//#region src/host/index.ts
const name = "dsh-time-machine";
const inject = ["webServer"];
function apply(ctx) {
	const adapter = new HostAdapter(ctx);
	registerApi(ctx, adapter);
	const stopPre = ctx.on("tools/pre-execute", (exec, next) => {
		adapter.onPre(exec);
		return next();
	});
	const stopPost = ctx.on("tools/post-execute", (exec, _result, next) => {
		adapter.onPost(exec);
		return next();
	});
	const stopSession = ctx.on("session/event", (session) => {
		adapter.onSessionEvent(session);
	});
	ctx.effect(() => {
		return () => {
			stopPre();
			stopPost();
			stopSession();
			adapter.dispose();
		};
	}, "dsh-time-machine: lifecycle listeners");
}
//#endregion
export { apply, inject, name };
