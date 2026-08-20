import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parse } from "yaml";
import { execFile, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, watch, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { StringDecoder } from "node:string_decoder";
import { randomUUID } from "node:crypto";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
//#region src/core/config.ts
/** 识别应被脱敏的环境变量名（KEY/TOKEN/SECRET/PASSWORD/…) */
const SECRET_KEY_RE = /(KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH|CREDENTIAL|API_?KEY)/i;
function isRecord(v) {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}
function toStr(v) {
	return typeof v === "string" ? v : void 0;
}
function toPosInt(v) {
	if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
	if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
}
/**
* 从原始 YAML 对象解析出配置。会做基础结构校验，不符合的字段跳过并给 warning，
* 结构性错误（actions 缺失、action 既无 command 也无 file）抛异常。
*/
function parseDevLoopConfig(raw, root, fallbackName = "project") {
	const warnings = [];
	if (!isRecord(raw)) throw new Error("devloop.yml 顶层必须是对象");
	const name = toStr(raw["name"])?.trim() || fallbackName;
	const actionsRaw = raw["actions"];
	if (!isRecord(actionsRaw) || Object.keys(actionsRaw).length === 0) throw new Error("devloop.yml 需要非空的 actions 对象");
	const actions = {};
	for (const [actionName, value] of Object.entries(actionsRaw)) {
		if (!isRecord(value)) {
			warnings.push(`action "${actionName}" 不是对象，已跳过`);
			continue;
		}
		const ra = value;
		const command = toStr(ra.command);
		const file = toStr(ra.file);
		if (!command && !file) throw new Error(`action "${actionName}" 必须提供 command 或 file 之一`);
		const env = {};
		if (ra.env !== void 0) if (isRecord(ra.env)) for (const [k, v] of Object.entries(ra.env)) if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") env[k] = String(v);
		else warnings.push(`action "${actionName}" 的 env.${k} 不是标量，已忽略`);
		else warnings.push(`action "${actionName}" 的 env 必须是对象`);
		actions[actionName] = {
			name: actionName,
			command,
			file,
			cwd: toStr(ra.cwd),
			env,
			timeout: toPosInt(ra.timeout),
			shell: toStr(ra.shell),
			dependsOn: Array.isArray(ra.dependsOn) ? ra.dependsOn.filter((x) => typeof x === "string") : void 0
		};
	}
	const config = {
		name,
		actions,
		root
	};
	const watchRaw = raw["watch"];
	if (watchRaw !== void 0) if (!isRecord(watchRaw)) warnings.push("watch 必须是对象，已忽略");
	else {
		const action = toStr(watchRaw.action);
		if (!action) throw new Error("watch.action 必须提供");
		const paths = (Array.isArray(watchRaw.paths) ? watchRaw.paths.filter((x) => typeof x === "string" && x.trim().length > 0) : []).map((p) => p.trim());
		if (paths.length === 0) {
			warnings.push("watch.paths 为空，默认监听 src");
			paths.push("src");
		}
		config.watch = {
			enabled: typeof watchRaw.enabled === "boolean" ? watchRaw.enabled : true,
			paths,
			debounce: toPosInt(watchRaw.debounce) ?? 500,
			action,
			...Array.isArray(watchRaw.ignore) ? { ignore: watchRaw.ignore.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) } : {}
		};
		if (!config.actions[config.watch.action]) warnings.push(`watch.action "${config.watch.action}" 在 actions 中不存在`);
	}
	const afterAgentRaw = raw["afterAgent"];
	if (afterAgentRaw !== void 0) if (!isRecord(afterAgentRaw)) warnings.push("afterAgent 必须是对象，已忽略");
	else {
		const action = toStr(afterAgentRaw.action);
		if (!action) throw new Error("afterAgent.action 必须提供");
		const afterAgent = {
			enabled: typeof afterAgentRaw.enabled === "boolean" ? afterAgentRaw.enabled : true,
			action
		};
		if (!config.actions[afterAgent.action]) warnings.push(`afterAgent.action "${afterAgent.action}" 在 actions 中不存在`);
		config.afterAgent = afterAgent;
	}
	return {
		config,
		warnings
	};
}
/** 判断环境变量名是否应脱敏。 */
function isSecretEnvKey(key) {
	return SECRET_KEY_RE.test(key);
}
/** 预设模板：渲染一份 .dsh/devloop.yml 字符串。 */
function renderTemplate(framework, name, root) {
	const lines = [];
	const push = (s) => {
		lines.push(s);
	};
	push(`# ${name} — dsh-dev-loop 配置`);
	push("# 命令完全来自当前 workspace 的这份文件；首次执行前会要求确认信任。");
	push("name: " + JSON.stringify(name));
	push("actions:");
	const add = (action, body) => {
		push(`  ${action}:`);
		for (const [k, v] of Object.entries(body)) if (Array.isArray(v)) {
			if (v.length === 0) continue;
			push(`    ${k}:`);
			for (const item of v) push(`      - ${JSON.stringify(item)}`);
		} else push(`    ${k}: ${JSON.stringify(v)}`);
	};
	switch (framework) {
		case "node":
			add("install", {
				command: "npm install",
				dependsOn: []
			});
			add("build", {
				command: "npm run build",
				dependsOn: ["install"]
			});
			add("test", {
				command: "npm test",
				dependsOn: ["install"]
			});
			add("run", { command: "node ." });
			break;
		case "python":
			add("install", {
				command: "pip install -r requirements.txt",
				dependsOn: []
			});
			add("test", {
				command: "python -m pytest",
				dependsOn: ["install"]
			});
			add("run", { command: "python main.py" });
			break;
		case "rust":
			add("build", {
				command: "cargo build",
				dependsOn: []
			});
			add("test", {
				command: "cargo test",
				dependsOn: ["build"]
			});
			add("run", { command: "cargo run" });
			break;
		case "dotnet":
			add("build", {
				command: "dotnet build",
				dependsOn: []
			});
			add("test", {
				command: "dotnet test",
				dependsOn: ["build"]
			});
			add("run", { command: "dotnet run" });
			break;
		case "godot":
			add("build", {
				command: "godot --headless --export-release \"default\"",
				dependsOn: []
			});
			add("test", {
				command: "godot --headless --script res://tests/run_tests.gd",
				dependsOn: ["build"]
			});
			add("run", { command: "godot --path ." });
			break;
	}
	return lines.join("\n") + "\n";
}
//#endregion
//#region src/host/config-loader.ts
const CONFIG_FILE = ".dsh/devloop.yml";
const CONFIG_FILE_YAML = ".dsh/devloop.yaml";
/** 在项目根下查找配置文件（优先 .yml，其次 .yaml）。 */
async function findConfigFile(root) {
	for (const rel of [CONFIG_FILE, CONFIG_FILE_YAML]) {
		const full = join(root, rel);
		try {
			if ((await import("node:fs/promises").then((m) => m.stat(full))).isFile()) return full;
		} catch {}
	}
	return null;
}
/** 加载并解析配置。找不到文件返回 null，解析失败抛异常。 */
async function loadConfig(root) {
	const file = await findConfigFile(root);
	if (!file) return null;
	return parseDevLoopConfig(parse(await readFile(file, "utf8")), root, basename(root) || "project").config;
}
/** 生成预设模板文本（不写盘，由 API/CLI 调用方决定写入）。 */
function generateTemplate(framework, name, root) {
	return renderTemplate(framework, name, root);
}
//#endregion
//#region src/core/state-machine.ts
/** 合法的状态转移表。 */
const ALLOWED = {
	idle: /* @__PURE__ */ new Set(["running"]),
	running: /* @__PURE__ */ new Set([
		"succeeded",
		"failed",
		"cancelled"
	]),
	succeeded: /* @__PURE__ */ new Set(),
	failed: /* @__PURE__ */ new Set(),
	cancelled: /* @__PURE__ */ new Set()
};
function transition(from, to) {
	if (from === to) return {
		ok: false,
		error: `状态已是 ${from}`
	};
	if (!ALLOWED[from].has(to)) return {
		ok: false,
		error: `非法转移 ${from} -> ${to}`
	};
	return { ok: true };
}
/**
* 用不可变方式推进一个 run 的状态。保持 run 结构稳定（只改字段），
* 输出/日志等由外部填充。
*/
function applyState(run, to, patch) {
	const t = transition(run.status, to);
	if (!t.ok) return {
		run,
		transition: t
	};
	const next = {
		...run,
		...patch,
		status: to
	};
	if (to === "running") {
		next.startedAt = next.startedAt ?? Date.now();
		next.endedAt = null;
	} else if (to === "succeeded" || to === "failed" || to === "cancelled") {
		next.endedAt = next.endedAt ?? Date.now();
		if (next.startedAt != null) next.durationMs = next.endedAt - next.startedAt;
	}
	return {
		run: next,
		transition: t
	};
}
/** 创建带状态的机具（面向 host runner 的便捷接口）。 */
function createStateMachine(initial = "idle") {
	let status = initial;
	return {
		state: () => status,
		canStart: () => status === "idle",
		start: () => {
			const t = transition(status, "running");
			if (t.ok) status = "running";
			return t;
		},
		finish: (exitCode) => {
			const to = exitCode === 0 ? "succeeded" : "failed";
			const t = transition(status, to);
			if (t.ok) status = to;
			return t;
		},
		cancel: () => {
			const t = transition(status, "cancelled");
			if (t.ok) status = "cancelled";
			return t;
		}
	};
}
//#endregion
//#region src/core/log.ts
/** ANSI 转义序列：OSC / CSI / 普通转义。 */
const ANSI_RE = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
/** 去除 ANSI 转义序列，保留可读文本。 */
function stripAnsi(text) {
	return text.replace(ANSI_RE, "");
}
/**
* 有界截断：超过 maxLength 时保留 head + tail，中间用省略标记替换。
* 返回截断后的文本以及是否被截断。
*/
function truncateOutput(text, opts) {
	const max = Math.max(1, Math.floor(opts.maxLength));
	if (text.length <= max) return {
		text,
		truncated: false
	};
	const marker = "\n… [output truncated] …\n";
	if (24 >= max) return {
		text: marker.slice(0, max),
		truncated: true
	};
	const headRatio = opts.headRatio ?? .5;
	const avail = max - 24;
	const head = Math.floor(avail * Math.min(Math.max(headRatio, 0), 1));
	const tail = avail - head;
	return {
		text: text.slice(0, head) + marker + text.slice(text.length - tail),
		truncated: true
	};
}
/**
* 文本级脱敏：把给定环境里每个 secret 值在文本中的出现替换为 ***。
* 用于命令输出里的 secrets redaction（基础能力）。
*/
function redactText(text, secrets) {
	let out = text;
	for (const secret of secrets) {
		if (!secret) continue;
		const needle = secret;
		if (needle.length >= 3) out = out.split(needle).join("***");
	}
	return out;
}
/**
* 从日志里提取“最后失败”的 bounded context：
* 取最后若干行含 error/fail/exception/fatal 的行，以及其前后各 context 行。
*/
function extractLastFailSection(text, maxLines = 40) {
	const lines = text.split(/\r?\n/);
	const hits = [];
	for (let i = 0; i < lines.length; i++) if (/\b(error|fail|exception|fatal|panic|traceback|failed|✗|×)\b/i.test(lines[i])) hits.push(i);
	if (hits.length === 0) return null;
	const last = hits[hits.length - 1];
	const before = 8;
	const after = 6;
	const start = Math.max(0, last - before);
	const end = Math.min(lines.length, last + after + 1);
	let section = lines.slice(start, end).join("\n");
	if (section.length > 4e3) section = truncateOutput(section, { maxLength: 4e3 }).text;
	return section;
}
const DEFAULT_LOG_DIR = () => join(homedir(), ".dsh", "dev-loop", "logs");
function safeName(p) {
	const parts = p.split(/[\\/]/).filter(Boolean);
	return (parts[parts.length - 1] || "project").replace(/[^a-zA-Z0-9_-]/g, "_");
}
/** 生成可阅读的本地日志文件名。 */
function logFileName(project, action) {
	return `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${safeName(project)}-${action.replace(/[^a-zA-Z0-9_-]/g, "_")}.log`;
}
function killTree(child) {
	if (process.platform === "win32" && child.pid) execFile("taskkill", [
		"/pid",
		String(child.pid),
		"/T",
		"/F"
	], () => {});
	else child.kill("SIGTERM");
}
function dirname$1(p) {
	const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
	return idx > 0 ? p.slice(0, idx) : ".";
}
var CommandRunner = class {
	logDir;
	active = /* @__PURE__ */ new Map();
	runs = /* @__PURE__ */ new Map();
	constructor(logDir = DEFAULT_LOG_DIR()) {
		this.logDir = logDir;
		mkdirSync(logDir, { recursive: true });
	}
	/** 当前已知运行，按开始时间倒序。 */
	allRuns() {
		return [...this.runs.values()].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
	}
	getRun(id) {
		return this.runs.get(id);
	}
	isRunning(id) {
		return this.active.has(id);
	}
	/** 执行一个 action。依赖解析由上层负责。返回 run 的初始快照。 */
	run(opts) {
		const { action } = opts;
		const actionName = opts.actionName;
		const id = randomUUID();
		const startedAt = Date.now();
		const command = action.command ?? "";
		const shell = action.shell ?? (process.platform === "win32" ? "cmd.exe" : "/bin/sh");
		const cwd = resolve(opts.root, action.cwd ?? ".");
		const env = {
			...process.env,
			...action.env ?? {}
		};
		const projectName = safeName(opts.root);
		const logFile = join(this.logDir, projectName, logFileName(projectName, actionName));
		mkdirSync(dirname$1(logFile), { recursive: true });
		writeFileSync(logFile, `# dsh-dev-loop run ${id}\n# project: ${opts.root}\n# action: ${actionName}\n# command: ${command}\n# started: ${new Date(startedAt).toISOString()}\n\n`, "utf8");
		const run = {
			id,
			project: opts.root,
			action: actionName,
			command,
			status: "idle",
			exitCode: null,
			cancelled: false,
			durationMs: 0,
			startedAt,
			endedAt: null,
			output: "",
			logFile,
			lastError: null
		};
		createStateMachine().start();
		let current = applyState(run, "running", { startedAt }).run;
		const secrets = Object.entries(action.env ?? {}).filter(([k]) => isSecretEnvKey(k)).map(([, v]) => v);
		const redactor = (text) => redactText(text, secrets);
		let rawOutput = "";
		let bounded = "";
		let truncated = false;
		let settled = false;
		let onSettled = void 0;
		const settle = () => {
			const cb = onSettled;
			onSettled = void 0;
			if (cb) cb();
		};
		const finalize = (status, exitCode) => {
			if (settled) return;
			settled = true;
			const endedAt = Date.now();
			current = applyState(current, status, {
				exitCode,
				cancelled: status === "cancelled",
				endedAt,
				durationMs: endedAt - startedAt
			}).run;
			if (status === "failed" || status === "cancelled" && rawOutput.length > 0) {
				const section = extractLastFailSection(bounded || stripAnsi(rawOutput));
				current.lastError = section;
			}
			if (!current.lastError && status === "failed") current.lastError = stripAnsi(rawOutput).slice(-2e3);
			appendFileSync(logFile, `\n# ended: ${new Date(endedAt).toISOString()}\n# exit: ${exitCode ?? "null"} status=${status}\n`, "utf8");
			this.runs.set(id, current);
			this.active.delete(id);
			settle();
		};
		try {
			const child = spawn(command, {
				cwd,
				env,
				shell,
				windowsHide: true,
				stdio: [
					"ignore",
					"pipe",
					"pipe"
				]
			});
			const handle = {
				child,
				cancelRequested: false,
				run: current,
				rawOutput,
				redactor
			};
			this.active.set(id, handle);
			const stdoutDecoder = new StringDecoder("utf8");
			const stderrDecoder = new StringDecoder("utf8");
			const ingest = (chunk) => {
				rawOutput += chunk;
				handle.rawOutput = rawOutput;
				const redacted = redactor(stripAnsi(chunk));
				bounded += redacted;
				const res = truncateOutput(bounded, { maxLength: opts.maxOutputChars ?? 2e5 });
				bounded = res.text;
				truncated = truncated || res.truncated;
				appendFileSync(logFile, chunk, "utf8");
				const updated = {
					...current,
					output: bounded
				};
				current = updated;
				handle.run = updated;
				this.runs.set(id, updated);
			};
			child.stdout.on("data", (chunk) => ingest(stdoutDecoder.write(chunk)));
			child.stderr.on("data", (chunk) => ingest(stderrDecoder.write(chunk)));
			child.on("error", (error) => {
				rawOutput += `\n[spawn error] ${error.message}\n`;
				handle.rawOutput = rawOutput;
				appendFileSync(logFile, `\n[spawn error] ${error.message}\n`, "utf8");
				finalize("failed", null);
			});
			child.on("close", (code, signal) => {
				if (handle.cancelRequested || signal === "SIGTERM") finalize("cancelled", code);
				else finalize(code === 0 ? "succeeded" : "failed", code);
			});
			onSettled = opts.onSettled ? () => opts.onSettled(current) : () => {};
			if (action.timeout && action.timeout > 0) {
				const timer = setTimeout(() => {
					handle.cancelRequested = true;
					killTree(child);
				}, action.timeout);
				const prevSettle = onSettled;
				onSettled = () => {
					clearTimeout(timer);
					if (prevSettle) prevSettle();
				};
			}
			handle.onSettled = onSettled;
		} catch (error) {
			const message = `[spawn failed] ${error instanceof Error ? error.message : String(error)}`;
			rawOutput = message;
			bounded = message;
			current = applyState(current, "failed", {
				exitCode: null,
				endedAt: Date.now(),
				durationMs: Date.now() - startedAt
			}).run;
			current.output = bounded;
			current.lastError = message;
			this.runs.set(id, current);
			this.active.delete(id);
			settle();
		}
		this.runs.set(id, current);
		return current;
	}
	/** 取消指定运行。 */
	cancel(id) {
		const handle = this.active.get(id);
		if (!handle) return false;
		handle.cancelRequested = true;
		killTree(handle.child);
		return true;
	}
	/** 清理内存中的历史（不影响已落盘日志）。 */
	clear() {
		this.runs.clear();
	}
};
//#endregion
//#region src/host/trust-store.ts
const DEFAULT_STORE_PATH = () => join(homedir(), ".dsh", "dev-loop", "trust.json");
var TrustStore = class {
	filePath;
	records = /* @__PURE__ */ new Map();
	constructor(filePath = DEFAULT_STORE_PATH()) {
		this.filePath = filePath;
		this.load();
	}
	key(root) {
		return root.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
	}
	load() {
		try {
			if (!existsSync(this.filePath)) return;
			const data = JSON.parse(readFileSync(this.filePath, "utf8"));
			if (Array.isArray(data)) {
				for (const item of data) if (item && typeof item === "object" && "root" in item && typeof item.root === "string") {
					const rec = item;
					this.records.set(this.key(rec.root), rec);
				}
			}
		} catch {}
	}
	persist() {
		try {
			mkdirSync(dirname(this.filePath), { recursive: true });
			writeFileSync(this.filePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
		} catch {}
	}
	isTrusted(root) {
		return this.records.has(this.key(root));
	}
	confirm(root, name) {
		const rec = {
			root,
			name,
			confirmedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		this.records.set(this.key(root), rec);
		this.persist();
	}
	revoke(root) {
		this.records.delete(this.key(root));
		this.persist();
	}
};
function dirname(p) {
	const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
	return idx > 0 ? p.slice(0, idx) : ".";
}
//#endregion
//#region src/core/watch-scheduler.ts
/**
* 队列策略：
* - 同一 action 正在跑时，新的触发不重复 spawn，只把 pending 置为 true。
* - pending 已经是 true 时再次触发不堆叠（始终只有最新一次）。
* - 当前跑完后若 pending，则再启动一次并清空 pending。
*/
var WatchScheduler = class {
	stateInternal = {
		running: false,
		pending: false
	};
	get state() {
		return { ...this.stateInternal };
	}
	get running() {
		return this.stateInternal.running;
	}
	get pending() {
		return this.stateInternal.pending;
	}
	/**
	* 外部收到一次 debounce 后的“需要执行”信号时调用。
	* @returns true 表示这次应该立即开始执行；false 表示已有一个正在跑，本次并入 pending。
	*/
	trigger() {
		if (this.stateInternal.running) {
			this.stateInternal.pending = true;
			return false;
		}
		this.stateInternal.running = true;
		this.stateInternal.pending = false;
		return true;
	}
	/**
	* 当前这次执行结束时调用。
	* @returns true 表示有 pending，调用方应紧接着再启动一次；false 表示回到 idle。
	*/
	finish() {
		if (this.stateInternal.pending) {
			this.stateInternal.pending = false;
			return true;
		}
		this.stateInternal.running = false;
		return false;
	}
	/** 清理状态（停止 watch 或出错时使用）。 */
	reset() {
		this.stateInternal = {
			running: false,
			pending: false
		};
	}
};
//#endregion
//#region src/host/watch-service.ts
const DEFAULT_IGNORE_DIRS = /* @__PURE__ */ new Set([
	"node_modules",
	".git",
	".hg",
	".svn",
	".dsh",
	".idea",
	".vscode",
	"dist",
	"build",
	"out",
	"target",
	"bin",
	"obj",
	"coverage",
	".next",
	".nuxt",
	".cache",
	".turbo",
	".parcel-cache",
	".dev-loop-logs",
	".dsh-memory"
]);
function normalizeKey(root) {
	return resolve(root).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}
function basenameSegments(p) {
	return p.split(/[\\/]/).filter(Boolean).map((s) => s.toLowerCase());
}
function isIgnored(p, ignoreSet) {
	return basenameSegments(p).some((seg) => ignoreSet.has(seg));
}
var WatchService = class {
	deps;
	entries = /* @__PURE__ */ new Map();
	constructor(deps) {
		this.deps = deps;
	}
	/** 停止全部监听（插件卸载/热重载时调用）。 */
	dispose() {
		for (const entry of this.entries.values()) this.stopEntry(entry);
		this.entries.clear();
	}
	async start(root) {
		const config = await this.deps.loadConfig(root);
		if (!config?.watch) return null;
		const key = normalizeKey(root);
		const existing = this.entries.get(key);
		if (existing?.started) return this.buildStatus(existing, config.watch);
		if (!this.deps.isTrusted(root)) {
			const entry = existing ?? {
				root,
				config: config.watch,
				scheduler: new WatchScheduler(),
				watcher: null,
				timer: null,
				started: false,
				needsTrust: true,
				lastRunId: null,
				lastStatus: null,
				lastTriggeredAt: null,
				lastError: null,
				disposed: false
			};
			entry.config = config.watch;
			entry.needsTrust = true;
			this.entries.set(key, entry);
			return this.buildStatus(entry, config.watch);
		}
		let entry = existing;
		if (!entry) {
			entry = {
				root,
				config: config.watch,
				scheduler: new WatchScheduler(),
				watcher: null,
				timer: null,
				started: false,
				needsTrust: false,
				lastRunId: null,
				lastStatus: null,
				lastTriggeredAt: null,
				lastError: null,
				disposed: false
			};
			this.entries.set(key, entry);
		}
		entry.config = config.watch;
		entry.needsTrust = false;
		this.startWatchers(entry);
		return this.buildStatus(entry, config.watch);
	}
	async stop(root) {
		const config = await this.deps.loadConfig(root);
		const key = normalizeKey(root);
		const entry = this.entries.get(key);
		if (entry) {
			this.stopEntry(entry);
			this.entries.delete(key);
		}
		return config?.watch ? this.status(root) : null;
	}
	async status(root) {
		const config = await this.deps.loadConfig(root);
		if (!config?.watch) return null;
		const key = normalizeKey(root);
		const entry = this.entries.get(key);
		if (!entry) return {
			configured: true,
			started: false,
			action: config.watch.action,
			paths: config.watch.paths,
			debounce: config.watch.debounce,
			running: false,
			pending: false,
			needsTrust: !this.deps.isTrusted(root),
			lastRunId: null,
			lastStatus: null,
			lastTriggeredAt: null,
			lastError: null
		};
		return this.buildStatus(entry, config.watch);
	}
	startWatchers(entry) {
		this.stopWatcher(entry);
		const ignoreSet = new Set(DEFAULT_IGNORE_DIRS);
		for (const ig of entry.config.ignore ?? []) ignoreSet.add(ig.toLowerCase());
		let startedAny = false;
		let lastError = null;
		const handles = [];
		for (const rel of entry.config.paths) {
			const target = resolve(entry.root, rel);
			try {
				if (!statSync(target).isDirectory()) {
					lastError = `watch.paths 不是目录：${target}`;
					continue;
				}
				const handle = createRecursiveWatcher(target, ignoreSet, () => this.schedule(entry), (error) => {
					entry.lastError = error instanceof Error ? error.message : String(error);
				});
				handles.push(handle);
				startedAny = true;
			} catch (error) {
				lastError = `无法监听 ${target}：${error instanceof Error ? error.message : String(error)}`;
			}
		}
		if (!startedAny) {
			entry.needsTrust = false;
			entry.lastError = lastError;
			entry.started = false;
			entry.lastStatus = null;
			for (const h of handles) h.close();
			return;
		}
		entry.watcher = { close: () => {
			for (const h of handles) h.close();
		} };
		entry.started = true;
		entry.lastError = lastError;
	}
	stopWatcher(entry) {
		if (entry.watcher) {
			entry.watcher.close();
			entry.watcher = null;
		}
		if (entry.timer) {
			clearTimeout(entry.timer);
			entry.timer = null;
		}
		entry.started = false;
	}
	stopEntry(entry) {
		entry.disposed = true;
		this.stopWatcher(entry);
		entry.scheduler.reset();
	}
	schedule(entry) {
		if (!entry.started || entry.disposed) return;
		if (entry.timer) clearTimeout(entry.timer);
		entry.timer = setTimeout(() => {
			entry.timer = null;
			this.fire(entry);
		}, Math.max(0, entry.config.debounce));
	}
	async fire(entry) {
		if (!entry.started || entry.disposed) return;
		entry.lastTriggeredAt = Date.now();
		entry.lastError = null;
		if (entry.scheduler.trigger()) await this.execute(entry);
	}
	async execute(entry) {
		if (entry.disposed) return;
		try {
			const result = await this.deps.runAction(entry.root, entry.config.action, {
				confirmTrust: false,
				onSettled: (run) => this.onRunSettled(entry, run)
			});
			if (result.needsTrust) {
				entry.needsTrust = true;
				entry.lastError = "watch 自动执行需要先信任该项目";
				this.stopWatcher(entry);
				entry.scheduler.reset();
				return;
			}
			entry.needsTrust = false;
			entry.lastRunId = result.run.id;
			entry.lastStatus = result.run.status;
		} catch (error) {
			entry.lastError = error instanceof Error ? error.message : String(error);
			if (entry.scheduler.finish()) this.execute(entry);
		}
	}
	onRunSettled(entry, run) {
		if (entry.disposed) return;
		entry.lastStatus = run.status;
		if (entry.scheduler.finish()) this.execute(entry);
	}
	buildStatus(entry, config) {
		return {
			configured: true,
			started: entry.started,
			action: config.action,
			paths: config.paths,
			debounce: config.debounce,
			running: entry.scheduler.running,
			pending: entry.scheduler.pending,
			needsTrust: entry.needsTrust,
			lastRunId: entry.lastRunId,
			lastStatus: entry.lastStatus,
			lastTriggeredAt: entry.lastTriggeredAt,
			lastError: entry.lastError
		};
	}
};
/**
* 递归目录监听：为每个目录单独 fs.watch，并跟随新出现的子目录。
* 每次变化时把绝对路径交给 onChange；被 ignore 的目录整体跳过。
*/
function createRecursiveWatcher(rootDir, ignoreSet, onChange, onError) {
	const watchers = /* @__PURE__ */ new Map();
	const watchedDirs = /* @__PURE__ */ new Set();
	let closed = false;
	const watchDir = (dir) => {
		if (closed || watchedDirs.has(dir) || isIgnored(dir, ignoreSet)) return;
		let st;
		try {
			st = statSync(dir);
		} catch {
			return;
		}
		if (!st.isDirectory()) return;
		watchedDirs.add(dir);
		let watcher;
		try {
			watcher = watch(dir, (eventType, filename) => {
				const child = filename ? join(dir, filename.toString()) : dir;
				if (isIgnored(child, ignoreSet)) return;
				try {
					if (statSync(child).isDirectory() && !watchedDirs.has(child)) watchDir(child);
				} catch {}
				onChange(child);
			});
			watcher.on("error", (error) => onError(error));
			watchers.set(dir, watcher);
		} catch (error) {
			onError(error instanceof Error ? error : new Error(String(error)));
			return;
		}
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const ent of entries) if (ent.isDirectory()) watchDir(join(dir, ent.name));
	};
	watchDir(rootDir);
	return { close: () => {
		closed = true;
		for (const w of watchers.values()) w.close();
		watchers.clear();
		watchedDirs.clear();
	} };
}
//#endregion
//#region src/host/agent-error.ts
function sendErrorToAgent(ctx, sessionId, text) {
	if (!sessionId || !text.trim()) return {
		ok: false,
		method: "fallback-copy",
		message: "没有可发送的错误文本"
	};
	const trimmed = text.length > 12e3 ? `${text.slice(0, 12e3)}\n… [truncated]` : text;
	try {
		const agent = ctx.agents?.get(sessionId);
		if (!agent) return {
			ok: false,
			method: "fallback-copy",
			message: "当前会话没有 live agent，请复制错误文本后手动发送"
		};
		const message = createUserMessage({
			content: [{
				type: "text",
				text: `[dsh-dev-loop] 最近一次命令失败输出（bounded context）：\n\n${trimmed}`
			}],
			source: {
				kind: "plugin",
				plugin: "dsh-dev-loop",
				form: "notice",
				summary: `dev-loop 失败输出已发送给当前 Agent（${Math.min(trimmed.length, 12e3)} chars）`
			}
		});
		agent.followup(message);
		return {
			ok: true,
			method: "agent-followup",
			message: "已作为 follow-up 消息发送给当前 Agent"
		};
	} catch (error) {
		return {
			ok: false,
			method: "fallback-copy",
			message: `发送失败（${error instanceof Error ? error.message : String(error)}），请复制错误文本`
		};
	}
}
//#endregion
//#region src/host/devloop-service.ts
function normalizeRoot(root) {
	return root.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}
var DevLoopService = class {
	ctx;
	logDir;
	runner;
	trust;
	watch;
	disposers = [];
	afterAgentRuns = /* @__PURE__ */ new Map();
	constructor(ctx, logDir) {
		this.ctx = ctx;
		this.logDir = logDir;
		this.runner = new CommandRunner(logDir);
		this.trust = new TrustStore();
		this.watch = new WatchService({
			loadConfig: (root) => loadConfig(root),
			runAction: (root, action, opts) => this.runAction(root, action, {
				confirmTrust: opts?.confirmTrust,
				onSettled: opts?.onSettled
			}),
			isTrusted: (root) => this.trust.isTrusted(root)
		});
		this.disposers.push(this.ctx.on("session/event", (session, event) => {
			this.onSessionEvent(session, event);
		}));
	}
	async summary(root) {
		if (!root) return {
			project: null,
			actions: [],
			runs: {},
			lastFail: null,
			needsTrust: false,
			trusted: false,
			logDir: this.logDir,
			watch: null,
			afterAgent: null
		};
		let config = null;
		try {
			config = await loadConfig(root);
		} catch {
			config = null;
		}
		const runs = this.runner.allRuns().reduce((acc, r) => {
			acc[r.id] = r;
			return acc;
		}, {});
		const lastFail = this.findLastFail(runs);
		const key = normalizeRoot(root);
		const afterRun = this.afterAgentRuns.get(key);
		const afterAgent = config?.afterAgent ? {
			enabled: config.afterAgent.enabled,
			action: config.afterAgent.action,
			lastRunId: afterRun?.runId ?? null,
			lastStatus: afterRun?.status ?? null
		} : null;
		return {
			project: config,
			actions: config ? Object.values(config.actions).map((a) => ({
				name: a.name,
				kind: a.file ? "file" : "command"
			})) : [],
			runs,
			lastFail: lastFail ? {
				action: lastFail.action,
				at: lastFail.endedAt ?? lastFail.startedAt ?? 0,
				snippet: lastFail.lastError ?? ""
			} : null,
			needsTrust: config ? !this.trust.isTrusted(root) : false,
			trusted: config ? this.trust.isTrusted(root) : false,
			logDir: this.logDir,
			watch: config?.watch ? await this.watch.status(root) : null,
			afterAgent
		};
	}
	async runAction(root, actionName, opts = {}) {
		const config = await loadConfig(root);
		if (!config) throw new Error(`项目根目录没有找到 .dsh/devloop.yml：${root}`);
		const action = config.actions[actionName];
		if (!action) throw new Error(`未知 action: ${actionName}`);
		if (action.file) {
			const run = {
				id: `file-${actionName}`,
				project: root,
				action: actionName,
				command: "",
				status: "succeeded",
				exitCode: null,
				cancelled: false,
				durationMs: 0,
				startedAt: Date.now(),
				endedAt: Date.now(),
				output: `log file: ${action.file}`,
				logFile: null,
				lastError: null
			};
			opts.onSettled?.(run);
			return {
				run,
				needsTrust: false,
				trusted: this.trust.isTrusted(root),
				config
			};
		}
		if (!this.trust.isTrusted(root)) {
			if (opts.confirmTrust !== true) return {
				run: {
					id: "",
					project: root,
					action: actionName,
					command: action.command ?? "",
					status: "idle",
					exitCode: null,
					cancelled: false,
					durationMs: 0,
					startedAt: null,
					endedAt: null,
					output: "",
					logFile: null,
					lastError: null
				},
				needsTrust: true,
				trusted: false,
				config
			};
			this.trust.confirm(root, config.name);
		}
		const deps = action.dependsOn ?? [];
		for (const dep of deps) {
			const depAction = config.actions[dep];
			if (!depAction) throw new Error(`action ${actionName} 的 dependsOn 引用了不存在的 action: ${dep}`);
			if (depAction.file) continue;
			const depRun = await this.runAction(root, dep, {
				confirmTrust: this.trust.isTrusted(root),
				maxOutputChars: opts.maxOutputChars
			});
			if (depRun.needsTrust || depRun.run.status !== "succeeded" && !depRun.run.cancelled) throw new Error(`依赖 action ${dep} 未成功（${depRun.run.status}），取消执行 ${actionName}`);
		}
		const runOpts = {
			root,
			actionName,
			action,
			maxOutputChars: opts.maxOutputChars,
			logDir: this.logDir,
			onSettled: opts.onSettled
		};
		return {
			run: this.runner.run(runOpts),
			needsTrust: false,
			trusted: true,
			config
		};
	}
	cancelRun(id) {
		return this.runner.cancel(id);
	}
	sendLastError(sessionId, root, actionName) {
		const run = this.runner.allRuns().filter((r) => (!actionName || r.action === actionName) && r.status === "failed")[0];
		if (!run) return {
			ok: false,
			method: "fallback-copy",
			message: "没有找到失败输出"
		};
		return sendErrorToAgent(this.ctx, sessionId, run.lastError ?? run.output);
	}
	confirmTrust(root, name) {
		const displayName = name ?? this.trustName(root);
		this.trust.confirm(root, displayName);
		return true;
	}
	async watchStart(root) {
		return this.watch.start(root);
	}
	async watchStop(root) {
		return this.watch.stop(root);
	}
	/** 销毁：注销 session 事件监听并停止所有 watch。 */
	dispose() {
		for (const dispose of this.disposers) try {
			dispose();
		} catch {}
		this.disposers.length = 0;
		this.watch.dispose();
	}
	onSessionEvent(session, event) {
		if (event.type !== "turn/end" || event.data.reason.kind !== "completed") return;
		const root = session.header?.cwd;
		if (!root) return;
		this.runAfterAgent(root, session.id.toString());
	}
	async runAfterAgent(root, _sessionId) {
		const config = await loadConfig(root).catch(() => null);
		if (!config?.afterAgent?.enabled) return;
		const actionName = config.afterAgent.action;
		if (!config.actions[actionName]) return;
		if (!this.trust.isTrusted(root)) return;
		if (this.isActionRunning(root, actionName)) return;
		const key = normalizeRoot(root);
		const result = await this.runAction(root, actionName, {
			confirmTrust: false,
			onSettled: (run) => {
				const rec = this.afterAgentRuns.get(key);
				if (rec?.runId === run.id) rec.status = run.status;
			}
		});
		if (result.needsTrust) return;
		this.afterAgentRuns.set(key, {
			runId: result.run.id,
			status: result.run.status
		});
	}
	isActionRunning(root, actionName) {
		const key = normalizeRoot(root);
		return this.runner.allRuns().some((r) => r.status === "running" && r.action === actionName && normalizeRoot(r.project) === key);
	}
	trustName(root) {
		const parts = root.split(/[\\/]/).filter(Boolean);
		return parts[parts.length - 1] || "project";
	}
	getLogDir() {
		return this.logDir;
	}
	findLastFail(runs) {
		let best = null;
		for (const r of Object.values(runs)) {
			if (r.status !== "failed") continue;
			if (!best || (r.endedAt ?? 0) > (best.endedAt ?? 0)) best = r;
		}
		return best;
	}
};
//#endregion
//#region src/host/api.ts
const BASE = "/plugins/dsh-dev-loop/api";
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
function requiredString(body, key) {
	const v = body[key];
	return typeof v === "string" && v.length > 0 ? v : void 0;
}
function optionalString(body, key) {
	const v = body[key];
	return typeof v === "string" ? v : void 0;
}
function registerApi(ctx, service) {
	const routes = [
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/summary`,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
				if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
				try {
					const root = optionalString(await readJson(req), "root");
					json(res, 200, ok(await service.summary(root ?? void 0)));
				} catch (error) {
					json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
				}
			}
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/run`,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
				if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
				try {
					const body = await readJson(req);
					const root = requiredString(body, "root");
					const action = requiredString(body, "action");
					if (!root || !action) return json(res, 400, fail("bad-request", "root and action are required"));
					json(res, 200, ok(await service.runAction(root, action, {
						confirmTrust: body["confirmTrust"] === true,
						maxOutputChars: typeof body["maxOutputChars"] === "number" ? body["maxOutputChars"] : void 0
					})));
				} catch (error) {
					json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
				}
			}
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/cancel`,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
				if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
				try {
					const id = requiredString(await readJson(req), "id");
					if (!id) return json(res, 400, fail("bad-request", "id is required"));
					json(res, 200, ok({ cancelled: service.cancelRun(id) }));
				} catch (error) {
					json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
				}
			}
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/confirm-trust`,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
				if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
				try {
					const body = await readJson(req);
					const root = requiredString(body, "root");
					if (!root) return json(res, 400, fail("bad-request", "root is required"));
					const name = optionalString(body, "name");
					service.confirmTrust(root, name);
					json(res, 200, ok({
						trusted: true,
						root
					}));
				} catch (error) {
					json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
				}
			}
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/send-error`,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
				if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
				try {
					const body = await readJson(req);
					const sessionId = requiredString(body, "sessionId");
					const root = requiredString(body, "root");
					if (!sessionId || !root) return json(res, 400, fail("bad-request", "sessionId and root are required"));
					const action = optionalString(body, "action");
					json(res, 200, ok(service.sendLastError(sessionId, root, action)));
				} catch (error) {
					json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
				}
			}
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/watch-start`,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
				if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
				try {
					const root = requiredString(await readJson(req), "root");
					if (!root) return json(res, 400, fail("bad-request", "root is required"));
					json(res, 200, ok({ status: await service.watchStart(root) }));
				} catch (error) {
					json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
				}
			}
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/watch-stop`,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
				if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
				try {
					const root = requiredString(await readJson(req), "root");
					if (!root) return json(res, 400, fail("bad-request", "root is required"));
					json(res, 200, ok({ status: await service.watchStop(root) }));
				} catch (error) {
					json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
				}
			}
		}),
		ctx.webServer.register({
			kind: "exact",
			path: `${BASE}/generate-preset`,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
				if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
				try {
					const body = await readJson(req);
					const framework = requiredString(body, "framework");
					const name = requiredString(body, "name") ?? "My Project";
					const root = optionalString(body, "root") ?? "";
					const allowed = [
						"node",
						"python",
						"rust",
						"dotnet",
						"godot"
					];
					if (!framework || !allowed.includes(framework)) return json(res, 400, fail("bad-request", `framework must be one of ${allowed.join(", ")}`));
					json(res, 200, ok({
						text: generateTemplate(framework, name, root),
						framework,
						name
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
}
//#endregion
//#region src/host/index.ts
const name = "dsh-dev-loop";
const inject = ["webServer"];
function apply(ctx) {
	const service = new DevLoopService(ctx, DEFAULT_LOG_DIR());
	const dispose = registerApi(ctx, service);
	ctx.effect(() => {
		return () => {
			dispose();
			service.dispose();
		};
	}, "dsh-dev-loop: web routes + services");
}
//#endregion
export { CommandRunner, DEFAULT_LOG_DIR, DevLoopService, TrustStore, WatchService, apply, findConfigFile, generateTemplate, inject, loadConfig, name, sendErrorToAgent };
