import z from "@deepseek-ai/schemastery";
import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
//#region src/core/types.ts
/** Manifest 存储根目录常量（host + cli 共用）。 */
const DEFAULT_RUN_LAB_DIR = "run-lab";
const DEFAULT_MANIFESTS_DIR = "manifests";
const DEFAULT_WORKSPACES_DIR = "workspaces";
//#endregion
//#region src/runner/runner.ts
/**
* 进程 runner：在指定 cwd 执行命令，收集 stdout/stderr（tail）、退出码、墙钟耗时。
*
* 兼容性策略：
*  - POSIX：一律 `/bin/sh -c <command>`。
*  - Windows：
*    * 命令不含 shell 元字符（管道/重定向/&&/;/$/反引号等）时，直接 spawn 程序 + 参数
*      —— 这能正确处理带空格的引号路径（cmd.exe /c 对这类路径有 quote-hell）。
*    * 含 shell 元字符时才退回 `cmd.exe /d /s /c <command>`（尽力而为）。
*/
const SHELL_META = /[|&<>;`$()]/;
/** 把命令拆成 [program, ...args]，尊重双引号（Windows 风格，反斜杠不转义引号）。 */
function splitCommand(command) {
	const tokens = [];
	let cur = "";
	let inQuote = false;
	for (let i = 0; i < command.length; i++) {
		const ch = command[i];
		if (ch === "\"") {
			inQuote = !inQuote;
			continue;
		}
		if (!inQuote && /\s/.test(ch)) {
			if (cur.length > 0) {
				tokens.push(cur);
				cur = "";
			}
			continue;
		}
		cur += ch;
	}
	if (cur.length > 0) tokens.push(cur);
	return tokens;
}
/** 命令是否可安全地直接 spawn（无 shell 元字符）。 */
function canSpawnDirect(command) {
	return !SHELL_META.test(command);
}
function runCommand(options) {
	return new Promise((resolvePromise) => {
		const started = Date.now();
		let program;
		let args;
		if (process.platform === "win32" && canSpawnDirect(options.command)) {
			const parts = splitCommand(options.command);
			if (parts.length === 0) throw new Error("empty command");
			program = parts[0];
			args = parts.slice(1);
		} else if (process.platform === "win32") {
			program = process.env.ComSpec ?? "cmd.exe";
			args = [
				"/d",
				"/s",
				"/c",
				options.command
			];
		} else {
			program = "/bin/sh";
			args = ["-c", options.command];
		}
		let child;
		try {
			child = spawn(program, args, {
				cwd: options.cwd,
				windowsHide: true,
				env: {
					...process.env,
					...options.env ?? {}
				},
				stdio: [
					"ignore",
					"pipe",
					"pipe"
				]
			});
		} catch (error) {
			resolvePromise({
				exitCode: null,
				outputTail: "",
				wallTimeMs: Date.now() - started,
				timedOut: false,
				stdout: "",
				stderr: "",
				error: error instanceof Error ? error.message : String(error)
			});
			return;
		}
		const maxBytes = options.maxOutputBytes ?? 2e5;
		let stdout = Buffer.alloc(0);
		let stderr = Buffer.alloc(0);
		let combined = "";
		const append = (buf, target) => {
			if (target === "stdout") stdout = Buffer.concat([stdout, buf]).subarray(-maxBytes);
			else stderr = Buffer.concat([stderr, buf]).subarray(-maxBytes);
			combined = (combined + buf.toString("utf8")).slice(-maxBytes);
		};
		child.stdout?.on("data", (d) => append(Buffer.isBuffer(d) ? d : Buffer.from(d), "stdout"));
		child.stderr?.on("data", (d) => append(Buffer.isBuffer(d) ? d : Buffer.from(d), "stderr"));
		let settled = false;
		let timer;
		if (options.timeoutMs && options.timeoutMs > 0) timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill("SIGKILL");
			resolvePromise({
				exitCode: null,
				outputTail: combined,
				wallTimeMs: Date.now() - started,
				timedOut: true,
				stdout: stdout.toString("utf8"),
				stderr: stderr.toString("utf8"),
				signal: "SIGKILL"
			});
		}, options.timeoutMs);
		child.on("error", (error) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			resolvePromise({
				exitCode: null,
				outputTail: combined,
				wallTimeMs: Date.now() - started,
				timedOut: false,
				stdout: stdout.toString("utf8"),
				stderr: stderr.toString("utf8"),
				signal: null,
				error: error instanceof Error ? error.message : String(error)
			});
		});
		child.on("close", (code, signal) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			resolvePromise({
				exitCode: code,
				outputTail: combined,
				wallTimeMs: Date.now() - started,
				timedOut: false,
				stdout: stdout.toString("utf8"),
				stderr: stderr.toString("utf8"),
				signal
			});
		});
	});
}
//#endregion
//#region src/agent/driver.ts
/** 默认驱动：把 agentCommand 当作外部命令在隔离工作区执行。 */
var CommandAgentDriver = class {
	kind = "command";
	async run(req) {
		const res = await runCommand({
			cwd: req.cwd,
			command: req.command,
			timeoutMs: req.timeoutMs,
			maxOutputBytes: req.maxOutputBytes,
			env: req.env
		});
		return {
			success: res.exitCode === 0 && !res.timedOut,
			wallTimeMs: res.wallTimeMs,
			timedOut: res.timedOut,
			exitCode: res.exitCode,
			outputTail: res.outputTail,
			notes: res.timedOut ? ["agent command timed out"] : [],
			error: res.error ?? null
		};
	}
};
const commandDriver = new CommandAgentDriver();
/** 按名字解析驱动；未知驱动回退到 command（不抛错，保持向后兼容）。 */
function resolveAgentDriver(kind) {
	if (kind === "dsh-inproc") return commandDriver;
	return commandDriver;
}
/**
* 解析 / 归一化分支的 agent 配置（从 API/CLI 的原始 JSON）。
* 容错：未知字段忽略，类型不对回退默认。返回 AgentSpec 或 undefined（无 agent）。
*/
function parseAgentConfig(input) {
	if (input === null || input === void 0 || typeof input !== "object") return void 0;
	const o = input;
	const driver = typeof o["driver"] === "string" ? o["driver"] : "command";
	const command = typeof o["command"] === "string" && o["command"] ? o["command"] : void 0;
	if (!command) return void 0;
	return {
		driver,
		command,
		usesWorkspace: command.includes("$WORKSPACE") || command.includes("%WORKSPACE%")
	};
}
/** 从 command 模板推导 AgentSpec（老字段 agentCommand 兼容进 agent）。 */
function specFromCommand(command) {
	if (!command) return void 0;
	return {
		driver: "command",
		command,
		usesWorkspace: command.includes("$WORKSPACE") || command.includes("%WORKSPACE%")
	};
}
/**
* 替换命令模板里的工作区占位（$WORKSPACE 与 %WORKSPACE%），返回替换后的命令。
* 纯函数，可单测。
*/
function substituteWorkspace(template, wsDir) {
	return template.replaceAll("$WORKSPACE", wsDir).replaceAll("%WORKSPACE%", wsDir);
}
//#endregion
//#region src/core/manifest.ts
/**
* Manifest 序列化 / 反序列化。
* 只保存非 secret 字段；遇到疑似 secret 的键（key/token/secret/password）一律剔除。
*/
/** Manifest 根目录：~/.dsh/run-lab（可用 DSH_HOME 覆盖）。 */
function runLabRoot(home = homeDir()) {
	return resolve(home, ".dsh", DEFAULT_RUN_LAB_DIR);
}
function manifestsDir(home = homeDir()) {
	return resolve(runLabRoot(home), DEFAULT_MANIFESTS_DIR);
}
function workspacesDir(home = homeDir()) {
	return resolve(runLabRoot(home), DEFAULT_WORKSPACES_DIR);
}
function homeDir() {
	return process.env.DSH_HOME ?? (process.platform === "win32" ? process.env.USERPROFILE ?? process.env.HOME ?? "." : process.env.HOME ?? ".");
}
const SECRET_KEY = /(token|secret|password|credential|api[_-]?key|authorization|bearer)/i;
/**
* 深度脱敏：递归遍历，剔除键名命中 secret 的字段，并限制字符串长度。
* 保留结构，便于 serde 往返。用于 manifest 落盘前。
*/
function redactSecrets(value, maxString = 4e3) {
	if (value === null || value === void 0) return value;
	if (Array.isArray(value)) return value.map((v) => redactSecrets(v, maxString));
	if (typeof value === "object") {
		const out = {};
		for (const [k, v] of Object.entries(value)) {
			if (SECRET_KEY.test(k)) continue;
			out[k] = redactSecrets(v, maxString);
		}
		return out;
	}
	if (typeof value === "string") return value.length > maxString ? value.slice(0, maxString) : value;
	return value;
}
/** 归一化 BranchConfig：把 agentCommand 同步进 agent（Phase 2 推荐字段）。 */
function normalizeBranch(branch) {
	const spec = parseAgentConfig(branch.agent) ?? specFromCommand(branch.agentCommand);
	return {
		...branch,
		agent: spec ?? void 0,
		agentCommand: spec?.command ?? branch.agentCommand
	};
}
/** 通过 CreateExperimentInput 构造一个新 Experiment（不含 result）。 */
function createExperiment(input, now = /* @__PURE__ */ new Date()) {
	return {
		id: `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
		version: "0.8",
		title: input.title?.trim() || input.prompt.slice(0, 48),
		prompt: input.prompt,
		baseline: input.baseline,
		baselineIsGit: false,
		baselineCommit: input.baselineCommit ?? null,
		isolation: input.forceCopy ? "copy" : "git-worktree",
		repeat: input.repeat && Number.isInteger(input.repeat) && input.repeat > 0 ? input.repeat : 1,
		branches: [normalizeBranch(input.branches[0]), normalizeBranch(input.branches[1])],
		status: "draft",
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
		result: null
	};
}
async function saveManifest(home, experiment) {
	const dir = manifestsDir(home);
	await mkdir(dir, { recursive: true });
	const file = resolve(dir, `${experiment.id}.json`);
	const safe = redactSecrets(experiment);
	await writeFile(file, JSON.stringify(safe, null, 2), "utf8");
	return file;
}
async function loadManifest(home, id) {
	const file = resolve(manifestsDir(home), `${id}.json`);
	try {
		const text = await readFile(file, "utf8");
		return JSON.parse(text);
	} catch {
		return null;
	}
}
async function listManifests(home) {
	const { readdir } = await import("node:fs/promises");
	const dir = manifestsDir(home);
	let names;
	try {
		names = await readdir(dir);
	} catch {
		return [];
	}
	const out = [];
	for (const name of names) {
		if (!name.endsWith(".json")) continue;
		const exp = await loadManifest(home, name.slice(0, -5));
		if (exp) out.push(exp);
	}
	return out.sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1);
}
/** 保证 manifests/workspaces 目录存在（返回根目录路径）。 */
async function ensureRunLabDirs(home) {
	const root = runLabRoot(home);
	const m = manifestsDir(home);
	const w = workspacesDir(home);
	await mkdir(m, { recursive: true });
	await mkdir(w, { recursive: true });
	return {
		root,
		manifests: m,
		workspaces: w
	};
}
//#endregion
//#region src/core/metrics.ts
function emptyMetrics() {
	return {
		success: false,
		wallTimeMs: null,
		turns: null,
		llmCalls: null,
		toolCalls: null,
		inputTokens: null,
		outputTokens: null,
		filesChanged: null,
		diffSize: null,
		testsPassed: null,
		testsFailed: null,
		testsSkipped: null,
		errors: 0,
		retries: null,
		compactionCount: null
	};
}
/** 从文本中尽可能提取结构化号码（turns/llm calls/tool calls/tokens 等）。 */
function extractNumber(text, pattern) {
	const m = text.match(pattern);
	if (!m || m[1] === void 0) return null;
	const n = Number(m[1].replace(/[,_]/g, ""));
	return Number.isFinite(n) ? n : null;
}
/** 结合 evaluator：若 evaluator 解析出 tests，则回填 testsPassed/Failed/Skipped。 */
function mergeEvaluatorMetrics(base, evalResult) {
	const next = { ...base };
	if (evalResult.exitCode !== null) next.success = next.success && evalResult.exitCode === 0;
	if (evalResult.junit) {
		next.testsPassed = evalResult.junit.tests;
		next.testsFailed = evalResult.junit.failures + evalResult.junit.errors;
		next.testsSkipped = evalResult.junit.skipped;
		next.success = next.success && evalResult.junit.tests > 0 && evalResult.junit.failures === 0 && evalResult.junit.errors === 0;
	}
	return next;
}
/** 对两个分支结果做逐指标对比，判定 winner。 */
function compare(a, b, aStatus = "completed", bStatus = "completed") {
	const metricKeys = [
		{
			key: "wallTimeMs",
			betterWhen: "low"
		},
		{
			key: "turns",
			betterWhen: "low"
		},
		{
			key: "llmCalls",
			betterWhen: "low"
		},
		{
			key: "toolCalls",
			betterWhen: "low"
		},
		{
			key: "inputTokens",
			betterWhen: "low"
		},
		{
			key: "outputTokens",
			betterWhen: "low"
		},
		{
			key: "filesChanged",
			betterWhen: "low"
		},
		{
			key: "diffSize",
			betterWhen: "low"
		},
		{
			key: "testsPassed",
			betterWhen: "high"
		},
		{
			key: "errors",
			betterWhen: "low"
		},
		{
			key: "retries",
			betterWhen: "low"
		},
		{
			key: "compactionCount",
			betterWhen: "low"
		}
	];
	const metrics = {};
	let aScore = 0;
	let bScore = 0;
	let compared = 0;
	for (const { key, betterWhen } of metricKeys) {
		const av = a[key];
		const bv = b[key];
		if (av === null || bv === null) {
			metrics[key] = {
				a: av,
				b: bv,
				better: "na"
			};
			continue;
		}
		const tie = av === bv;
		const better = tie ? "tie" : (betterWhen === "low" ? av < bv : av > bv) ? "a" : "b";
		metrics[key] = {
			a: av,
			b: bv,
			better
		};
		if (!tie) {
			compared++;
			if (better === "a") aScore++;
			else bScore++;
		}
	}
	const aOk = a.success ? 1 : 0;
	const bOk = b.success ? 1 : 0;
	if (aOk !== bOk) if (aOk > bOk) aScore += 3;
	else bScore += 3;
	let winner;
	if (aScore === bScore && compared === 0 && aOk === bOk) winner = "tie";
	else if (aScore === bScore) winner = "tie";
	else winner = aScore > bScore ? "a" : "b";
	if (aStatus !== "completed" || bStatus !== "completed") winner = "incomplete";
	return {
		winner,
		metrics
	};
}
/** 判定一个分支的最终 success（结合进程退出码 + evaluator 结果）。 */
function branchSuccess(exitCode, evaluatorPassed) {
	if (evaluatorPassed !== null) return evaluatorPassed;
	return exitCode === 0;
}
//#endregion
//#region src/core/repeat.ts
/** 取中位数；空数组或不可比元素返回 null。 */
function median(values) {
	const nums = values.filter((v) => v !== null && Number.isFinite(v));
	if (nums.length === 0) return null;
	const sorted = [...nums].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[mid];
	return (sorted[mid - 1] + sorted[mid]) / 2;
}
/** 把多次 BranchRun 聚合成一个 BranchResult（中位数 metrics + summary）。 */
function aggregateBranchRuns(branch, runs) {
	const count = runs.length;
	const successCount = runs.filter((r) => r.metrics.success).length;
	const wallTimes = runs.map((r) => r.metrics.wallTimeMs);
	const toolCalls = runs.map((r) => r.metrics.toolCalls);
	const inputTokens = runs.map((r) => r.metrics.inputTokens);
	const outputTokens = runs.map((r) => r.metrics.outputTokens);
	const perRunTokens = runs.map((r) => {
		const a = r.metrics.inputTokens;
		const b = r.metrics.outputTokens;
		if (a === null || b === null) return null;
		return a + b;
	}).filter((v) => v !== null && Number.isFinite(v));
	const summary = {
		count,
		successCount,
		successRate: count === 0 ? 0 : successCount / count,
		medianWallTimeMs: median(wallTimes),
		medianToolCalls: median(toolCalls),
		medianInputTokens: median(inputTokens),
		medianOutputTokens: median(outputTokens),
		medianTokens: median(perRunTokens)
	};
	const agg = emptyMetrics();
	agg.success = count > 0 && successCount === count;
	agg.wallTimeMs = summary.medianWallTimeMs;
	agg.toolCalls = summary.medianToolCalls;
	agg.inputTokens = summary.medianInputTokens;
	agg.outputTokens = summary.medianOutputTokens;
	for (const run of runs) {
		const m = run.metrics;
		if (m.turns !== null) agg.turns = m.turns;
		if (m.llmCalls !== null) agg.llmCalls = m.llmCalls;
		if (m.filesChanged !== null) agg.filesChanged = m.filesChanged;
		if (m.diffSize !== null) agg.diffSize = m.diffSize;
		if (m.testsPassed !== null) agg.testsPassed = m.testsPassed;
		if (m.testsFailed !== null) agg.testsFailed = m.testsFailed;
		if (m.testsSkipped !== null) agg.testsSkipped = m.testsSkipped;
		if (m.errors !== 0) agg.errors = m.errors;
		if (m.retries !== null) agg.retries = m.retries;
		if (m.compactionCount !== null) agg.compactionCount = m.compactionCount;
	}
	const notes = /* @__PURE__ */ new Set();
	for (const r of runs) for (const n of r.metrics.notes ?? []) notes.add(n);
	agg.notes = [...notes];
	return {
		branch,
		status: runs.every((r) => r.status !== "failed") ? "completed" : "completed",
		repeat: count,
		runs,
		metrics: agg,
		summary,
		evaluator: runs[runs.length - 1]?.evaluator ?? null,
		outputTail: runs.map((r) => `[run ${r.index}] ${r.outputTail}`).join("\n").slice(-2e5),
		error: runs.find((r) => r.error)?.error ?? null
	};
}
//#endregion
//#region src/core/evaluator.ts
/** 解析 EvaluatorConfig（容错：未知字段忽略，类型不对则取默认）。 */
function parseEvaluatorConfig(input) {
	if (input === null || input === void 0 || typeof input !== "object") return { command: "" };
	const o = input;
	return {
		command: typeof o["command"] === "string" ? o["command"] : "",
		expectExitCode: o["expectExitCode"] === void 0 || o["expectExitCode"] === null ? null : typeof o["expectExitCode"] === "number" ? o["expectExitCode"] : null,
		expectFileExists: Array.isArray(o["expectFileExists"]) ? o["expectFileExists"].filter((v) => typeof v === "string") : void 0,
		junitFile: typeof o["junitFile"] === "string" ? o["junitFile"] : void 0,
		regexAssertions: Array.isArray(o["regexAssertions"]) ? o["regexAssertions"].filter((v) => typeof v === "string") : void 0,
		junitRoot: typeof o["junitRoot"] === "string" ? o["junitRoot"] : void 0
	};
}
/** 解析 JUnit XML 字符串 -> 汇总（tests/failures/errors/skipped）。 */
function parseJunit(xml) {
	const suiteMatch = xml.match(/<testsuite\b[^>]*>/i);
	if (!suiteMatch) return null;
	const attrs = suiteMatch[0];
	const num = (name) => {
		const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']([0-9]+)["']`, "i"));
		return m ? Number(m[1]) : 0;
	};
	const testsRaw = num("tests");
	const tests = testsRaw > 0 ? testsRaw : (xml.match(/<testcase\b/g) ?? []).length;
	const failures = num("failures");
	const errors = num("errors");
	return {
		tests,
		failures,
		errors,
		skipped: num("skipped"),
		passed: tests > 0 && failures === 0 && errors === 0
	};
}
/** 未配置 evaluator 时，只基于退出码得到的基础结果。 */
function emptyEvaluatorResult(exitCode) {
	return {
		passed: exitCode === 0,
		exitCode,
		expectExitCodeOk: null,
		junit: null,
		regexAssertions: [],
		fileExists: []
	};
}
/** 汇总 evaluator 判定：exit code + junit + regex + file exists 全通过才算 passed。 */
function summarizeEvaluator(config, exitCode, output, junitXml, fileChecks) {
	const expectExitCodeOk = config.expectExitCode === void 0 || config.expectExitCode === null ? exitCode === 0 : exitCode === config.expectExitCode;
	const junit = junitXml ? parseJunit(junitXml) : null;
	const regexAssertions = (config.regexAssertions ?? []).map((pattern) => {
		let matched = false;
		try {
			matched = new RegExp(pattern).test(output);
		} catch {
			matched = false;
		}
		return {
			pattern,
			matched
		};
	});
	let passed = true;
	passed = passed && expectExitCodeOk;
	if (junit) passed = passed && junit.passed;
	if (regexAssertions.length > 0) passed = passed && regexAssertions.every((r) => r.matched);
	if (fileChecks.length > 0) passed = passed && fileChecks.every((f) => f.exists);
	return {
		passed,
		exitCode,
		expectExitCodeOk,
		junit,
		regexAssertions,
		fileExists: fileChecks
	};
}
//#endregion
//#region src/core/state-machine.ts
/** 校验状态迁移是否合法；非法返回错误信息，合法返回 null。 */
function transitionError(from, to) {
	return {
		draft: ["prepared", "failed"],
		prepared: [
			"running",
			"failed",
			"draft"
		],
		running: ["completed", "failed"],
		completed: [],
		failed: []
	}[from]?.includes(to) ? null : `invalid transition ${from} -> ${to}`;
}
function transition(exp, to, now = /* @__PURE__ */ new Date()) {
	const err = transitionError(exp.status, to);
	if (err) throw new Error(err);
	return {
		...exp,
		status: to,
		updatedAt: now.toISOString()
	};
}
//#endregion
//#region src/workspace/isolation.ts
/**
* 隔离工作区：
*  - git 仓库优先 `git worktree add <dir> <commit>`；
*  - 非 git 仓库用复制目录（忽略 node_modules/.git/.dsh 等大目录）。
* 之后可选择性地对工作区写入 BranchConfig.workspaceOverrides 覆盖文件。
*
* Windows 路径处理：统一用 path.resolve，交给 child_process with cwd。
*/
const execFileAsync$1 = promisify(execFile);
const DEFAULT_IGNORE = [
	"node_modules",
	".git",
	".dsh",
	"dist",
	"build",
	".nyc_output",
	"coverage"
];
async function isGitRepo(dir) {
	try {
		await execFileAsync$1("git", [
			"-C",
			dir,
			"rev-parse",
			"--is-inside-work-tree"
		], { windowsHide: true });
		return true;
	} catch {
		return false;
	}
}
async function detectIsolation(baseline, forceCopy = false) {
	if (forceCopy) return {
		isGit: false,
		headCommit: null
	};
	if (!await isGitRepo(baseline)) return {
		isGit: false,
		headCommit: null
	};
	try {
		const { stdout } = await execFileAsync$1("git", [
			"-C",
			baseline,
			"rev-parse",
			"HEAD"
		], { windowsHide: true });
		return {
			isGit: true,
			headCommit: stdout.trim() || null
		};
	} catch {
		return {
			isGit: true,
			headCommit: null
		};
	}
}
/**
* 在 targetDir 建立隔离工作区，返回实际方法。调用方负责在完成后清理。
* git worktree 会校验 commit 存在；copy 忽略大目录。
*/
async function createIsolatedWorkspace(options, targetDir) {
	await mkdir(dirname(targetDir), { recursive: true });
	if (options.baselineIsGit && !options.forceCopy) {
		const commit = options.commit ?? "HEAD";
		await rm(targetDir, {
			recursive: true,
			force: true
		});
		try {
			await execFileAsync$1("git", [
				"-C",
				options.baseline,
				"worktree",
				"add",
				"--detach",
				targetDir,
				commit
			], { windowsHide: true });
		} catch (error) {
			throw new Error(`git worktree add failed: ${error instanceof Error ? error.message : String(error)}. Try forceCopy=true (non-destructive copy) instead.`);
		}
		await applyOverrides(targetDir, options.overrides);
		return {
			dir: targetDir,
			method: "git-worktree"
		};
	}
	const ignore = /* @__PURE__ */ new Set([...DEFAULT_IGNORE, ...options.copyIgnore ?? []]);
	await rm(targetDir, {
		recursive: true,
		force: true
	});
	await mkdir(targetDir, { recursive: true });
	await copyFiltered(options.baseline, targetDir, ignore);
	await applyOverrides(targetDir, options.overrides);
	return {
		dir: targetDir,
		method: "copy"
	};
}
async function copyFiltered(src, dest, ignore) {
	await cp(src, dest, {
		recursive: true,
		filter: (p) => {
			const top = p.slice(src.length).replace(/[\\/]+$/, "").replace(/^[\\/]+/, "").split(/[\\/]/)[0];
			return !ignore.has(top);
		}
	});
}
async function applyOverrides(ws, overrides) {
	if (!overrides) return;
	for (const [rel, content] of Object.entries(overrides)) {
		const abs = resolve(ws, rel);
		await mkdir(dirname(abs), { recursive: true });
		await writeFile(abs, content, "utf8");
	}
}
/** 移除隔离工作区；git 用 worktree remove，copy 直接删目录。 */
async function removeIsolatedWorkspace(dir, method, baseline) {
	try {
		if (method === "git-worktree" && baseline) {
			await execFileAsync$1("git", [
				"-C",
				baseline,
				"worktree",
				"remove",
				"--force",
				dir
			], { windowsHide: true });
			return;
		}
	} catch {}
	await rm(dir, {
		recursive: true,
		force: true
	});
}
dirname(fileURLToPath(import.meta.url));
//#endregion
//#region src/runner/diff.ts
/**
* 文件系统 diff 统计：优先 git diff --stat（工作区是 git worktree / 仓库），
* 否则对复制隔离做前后两次快照差异（新增/修改/删除文件的个数与字节数近似）。
*/
const execFileAsync = promisify(execFile);
/** 基于 git 统计工作区相对 HEAD 的变更（git-worktree 场景，工作区本身即 worktree）。 */
async function gitDiffStats(baseline, wsDir) {
	try {
		const { stdout } = await execFileAsync("git", [
			"-C",
			wsDir,
			"--no-pager",
			"diff",
			"--stat",
			"--no-color",
			"HEAD"
		], {
			windowsHide: true,
			maxBuffer: 1024 * 1024
		});
		return parseGitDiffStat(stdout);
	} catch {
		return {
			filesChanged: null,
			diffSize: null
		};
	}
}
function parseGitDiffStat(text) {
	const lines = text.trim().split("\n").filter((l) => l.length > 0);
	const changed = lines.filter((l) => !l.trim().startsWith(" ") && !l.trim().startsWith("files changed")).length;
	const summary = lines[lines.length - 1] ?? "";
	const ins = summary.match(/(\d+) insertion/);
	const del = summary.match(/(\d+) deletion/);
	const changed2 = summary.match(/^(\d+) files? changed/);
	return {
		filesChanged: changed2 ? Number(changed2[1]) : changed > 0 ? changed : summary.trim() === "" ? 0 : changed,
		diffSize: (ins ? Number(ins[1]) : 0) + (del ? Number(del[1]) : 0)
	};
}
/** 非 git：对两棵目录树做递归快照比较，返回变更文件数与近似 diff 大小。 */
async function directoryDiffStats(wsDir, before) {
	const after = await snapshotDir(wsDir);
	const allKeys = /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)]);
	let filesChanged = 0;
	let diffSize = 0;
	for (const key of allKeys) {
		const b = before[key];
		const a = after[key];
		if (b === a) continue;
		filesChanged++;
		if (a !== void 0) diffSize += a;
		if (b !== void 0 && a === void 0) diffSize += b;
	}
	return {
		filesChanged,
		diffSize
	};
}
const SNAPSHOT_IGNORE = /* @__PURE__ */ new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	".tsdown",
	"lib"
]);
/** 递归快照目录：相对路径 -> 文件字节数。忽略大目录。 */
async function snapshotDir(root, base = root, acc = {}) {
	let entries;
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch {
		return acc;
	}
	for (const entry of entries) {
		if (SNAPSHOT_IGNORE.has(entry.name)) continue;
		const full = join(root, entry.name);
		const rel = relative(base, full).replace(/\\/g, "/");
		if (entry.isDirectory()) await snapshotDir(full, base, acc);
		else if (entry.isFile()) try {
			acc[rel] = (await stat(full)).size;
		} catch {}
	}
	return acc;
}
/** 收集一个分支的 diff 指标，写入 metrics。 */
async function collectDiffMetrics(metrics, method, baseline, wsDir, before) {
	const next = {
		...emptyMetrics(),
		...metrics
	};
	let diff;
	if (method === "git-worktree") diff = await gitDiffStats(baseline, wsDir);
	else if (before) diff = await directoryDiffStats(wsDir, before);
	else diff = {
		filesChanged: null,
		diffSize: null
	};
	next.filesChanged = diff.filesChanged;
	next.diffSize = diff.diffSize;
	return next;
}
//#endregion
//#region src/dsh/adapter.ts
/**
* 从 headless 输出里尽力提取结构化指标。
* token 行示例：
*   input tokens: 1234, output tokens: 567
*   turns: 3, tool calls: 5
* 匹配不到 -> null（标 unavailable）。
*/
function parseDshOutputMetrics(output) {
	const out = {};
	const input = extractNumber(output, /input\s+tokens?:?\s*([0-9,_]+)/i);
	const outputT = extractNumber(output, /output\s+tokens?:?\s*([0-9,_]+)/i);
	if (input !== null) out.inputTokens = input;
	if (outputT !== null) out.outputTokens = outputT;
	const turns = extractNumber(output, /(?:turns?|turn count)\s*[:=]\s*([0-9,_]+)/i);
	if (turns !== null) out.turns = turns;
	const llmCalls = extractNumber(output, /llm\s+calls?:?\s*([0-9,_]+)/i);
	if (llmCalls !== null) out.llmCalls = llmCalls;
	const toolCalls = extractNumber(output, /tool\s+calls?:?\s*([0-9,_]+)/i);
	if (toolCalls !== null) out.toolCalls = toolCalls;
	const compaction = extractNumber(output, /compaction(?:s)?\s*[:=]\s*([0-9,_]+)/i);
	if (compaction !== null) out.compactionCount = compaction;
	return out;
}
//#endregion
//#region src/host/engine.ts
/**
* 探测并准备两个隔离工作区。返回 { a, b } 目录与实验更新。
* 抛错时不保留任何工作区（调用方负责清理）。
*/
async function prepareExperiment(exp, opts) {
	const { isGit, headCommit } = await detectIsolation(exp.baseline, exp.isolation === "copy");
	const isolation = isGit && exp.isolation !== "copy" ? "git-worktree" : "copy";
	const commit = exp.baselineCommit ?? headCommit ?? null;
	const updated = {
		...exp,
		baselineIsGit: isGit,
		baselineCommit: commit,
		isolation,
		status: "prepared"
	};
	const dirs = {
		a: "",
		b: ""
	};
	const cleanup = [];
	try {
		for (const branch of exp.branches) {
			const dir = resolve(opts.workspacesDir, exp.id, branch.id);
			const result = await createIsolatedWorkspace({
				baseline: exp.baseline,
				baselineIsGit: isGit,
				commit,
				forceCopy: isolation === "copy",
				overrides: branch.workspaceOverrides
			}, dir);
			dirs[branch.id] = result.dir;
			cleanup.push(() => removeIsolatedWorkspace(result.dir, result.method, exp.baseline));
		}
	} catch (error) {
		await Promise.allSettled(cleanup.map((fn) => fn()));
		throw error;
	}
	return {
		experiment: updated,
		prepared: {
			isolation,
			baselineCommit: commit,
			dirs
		}
	};
}
async function cleanWorkspaces(wsDir, expId, baseline, method) {
	for (const id of ["a", "b"]) await removeIsolatedWorkspace(resolve(wsDir, expId, id), method, baseline);
	await rm(resolve(wsDir, expId), {
		recursive: true,
		force: true
	});
}
/** 归一化出分支的 AgentSpec（manifest.agentCommand 老字段兼容进 agent）。 */
function resolveBranchAgent(branch) {
	if (branch.agent?.command) return branch.agent;
	if (branch.agentCommand) return specFromCommand(branch.agentCommand) ?? null;
	return null;
}
/**
* 运行一个分支的某一次迭代：
* Agent（AgentDriver wrapper 执行命令）→ evaluator → diff → 指标。
* 返回单次 BranchRun（index 由调用方给定）。
*/
async function runBranchIteration(exp, branch, wsDir, index, opts) {
	const metrics = emptyMetrics();
	const outputParts = [];
	const notes = [];
	let before;
	if (exp.isolation === "copy") try {
		before = await snapshotDir(wsDir);
	} catch {
		before = void 0;
	}
	const agentSpec = resolveBranchAgent(branch);
	const startedAt = Date.now();
	try {
		if (agentSpec?.command) {
			const driver = resolveAgentDriver(agentSpec.driver);
			const cmd = substituteWorkspace(agentSpec.command, wsDir);
			const res = await driver.run({
				cwd: wsDir,
				command: cmd,
				timeoutMs: opts.timeoutMs
			});
			outputParts.push(`[agent] driver=${driver.kind} exit=${String(res.exitCode)}\n${res.outputTail}`);
			metrics.wallTimeMs = res.wallTimeMs;
			metrics.errors = res.timedOut ? metrics.errors + 1 : metrics.errors;
			metrics.success = res.success;
			if (res.notes) notes.push(...res.notes);
			const dshMetrics = parseDshOutputMetrics(res.outputTail);
			Object.assign(metrics, dshMetrics);
			if (dshMetrics.inputTokens === void 0) notes.push("input/output tokens unavailable: no DSH API feed (agentCommand mode)");
		}
		let evalRes = emptyEvaluatorResult(null);
		let exitCode = branch.agentCommand ? metrics.success ? 0 : 1 : null;
		if (branch.evaluator?.command) {
			const ec = parseEvaluatorConfig(branch.evaluator);
			const evalRun = await runCommand({
				cwd: wsDir,
				command: ec.command,
				timeoutMs: opts.timeoutMs
			});
			exitCode = evalRun.exitCode;
			outputParts.push(`[evaluator] exit=${String(evalRun.exitCode)}\n${evalRun.outputTail}`);
			if (evalRun.timedOut) notes.push("evaluator command timed out");
			if (!branch.agentCommand) {
				metrics.wallTimeMs = evalRun.wallTimeMs;
				metrics.errors = evalRun.timedOut ? metrics.errors + 1 : metrics.errors;
				metrics.success = evalRun.exitCode === 0;
			}
			let junitXml = null;
			if (ec.junitFile) try {
				junitXml = await readFile(resolve(wsDir, ec.junitFile), "utf8");
			} catch {
				notes.push(`junit file not found: ${ec.junitFile}`);
			}
			const fileChecks = [];
			for (const p of ec.expectFileExists ?? []) {
				const abs = p.includes("${workspace}") ? p.replace("${workspace}", wsDir) : resolve(wsDir, p);
				fileChecks.push({
					path: p,
					exists: await __exists(abs)
				});
			}
			evalRes = summarizeEvaluator(ec, evalRun.exitCode, evalRun.outputTail, junitXml, fileChecks);
			if (evalRes.error) notes.push(String(evalRes.error));
		} else evalRes = emptyEvaluatorResult(exitCode);
		const merged = mergeEvaluatorMetrics(metrics, {
			exitCode,
			junit: evalRes.junit
		});
		merged.success = branchSuccess(exitCode, evalRes.passed);
		const withDiff = await collectDiffMetrics(merged, exp.isolation, exp.baseline, wsDir, before);
		if (metrics.wallTimeMs === null) metrics.wallTimeMs = Date.now() - startedAt;
		withDiff.notes = notes;
		return {
			index,
			status: "completed",
			metrics: withDiff,
			evaluator: evalRes,
			agent: agentSpec,
			outputTail: outputParts.join("\n").slice(-2e5),
			error: null
		};
	} catch (error) {
		return {
			index,
			status: "failed",
			metrics: {
				...metrics,
				success: false,
				notes: [...notes, `runner error: ${error instanceof Error ? error.message : String(error)}`]
			},
			evaluator: emptyEvaluatorResult(null),
			agent: agentSpec,
			outputTail: outputParts.join("\n").slice(-2e5),
			error: error instanceof Error ? error.message : String(error)
		};
	}
}
/** 运行一个分支的 N 次迭代（串行），返回聚合后的 BranchResult。 */
async function runBranch(exp, branch, wsDir, opts) {
	const repeat = opts.repeatOverride && opts.repeatOverride > 0 ? opts.repeatOverride : exp.repeat;
	const runs = [];
	for (let i = 0; i < repeat; i++) runs.push(await runBranchIteration(exp, branch, wsDir, i, opts));
	const aggregated = aggregateBranchRuns(branch.id, runs);
	const anyFailed = runs.some((r) => r.status === "failed");
	return {
		...aggregated,
		status: anyFailed ? "failed" : "completed"
	};
}
async function __exists(p) {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}
/**
* 完整跑一个实验（串行 A/B）：
*  prepare -> run A -> run B -> compare -> 更新 manifest。
* 跑完清理工作区（除非 keepWorkspaces）。返回最终 experiment + 两个分支结果。
*/
async function runExperiment(exp, opts) {
	let working;
	if (exp.status === "completed" || exp.status === "failed") working = {
		...exp,
		status: "draft",
		result: null,
		updatedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	else working = exp;
	if (opts.repeatOverride && opts.repeatOverride > 0) working = {
		...working,
		repeat: opts.repeatOverride
	};
	working = working.status === "draft" ? transition(working, "prepared") : transition(working, "running");
	let prepared = null;
	try {
		const prep = await prepareExperiment(working, opts);
		prepared = prep.prepared;
		working = transition(prep.experiment, "running");
		const a = await runBranch(working, working.branches[0], prepared.dirs.a, opts);
		const b = await runBranch(working, working.branches[1], prepared.dirs.b, opts);
		const result = {
			startedAt: (/* @__PURE__ */ new Date()).toISOString(),
			finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
			runs: [a, b],
			comparison: compare(a.metrics, b.metrics, a.status, b.status)
		};
		working = {
			...working,
			status: "completed",
			result,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		await saveManifest(opts.home ?? homeDefault$1(), working);
		return {
			experiment: working,
			branches: [a, b]
		};
	} catch (error) {
		const failedRun = (branch) => ({
			branch,
			status: "failed",
			repeat: working.repeat,
			runs: [],
			metrics: emptyMetrics(),
			summary: {
				count: 0,
				successCount: 0,
				successRate: 0,
				medianWallTimeMs: null,
				medianToolCalls: null,
				medianInputTokens: null,
				medianOutputTokens: null,
				medianTokens: null
			},
			evaluator: null,
			outputTail: "",
			error: error instanceof Error ? error.message : String(error)
		});
		working = {
			...working,
			status: "failed",
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			result: {
				startedAt: (/* @__PURE__ */ new Date()).toISOString(),
				finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
				runs: [failedRun("a"), failedRun("b")],
				comparison: compare(emptyMetrics(), emptyMetrics())
			}
		};
		await saveManifest(opts.home ?? homeDefault$1(), working).catch(() => {});
		throw error;
	} finally {
		if (prepared && !opts.keepWorkspaces) await cleanWorkspaces(opts.workspacesDir, working.id, exp.baseline, prepared.isolation);
	}
}
function homeDefault$1() {
	return process.env.DSH_HOME ?? (process.platform === "win32" ? process.env.USERPROFILE ?? process.env.HOME ?? "." : process.env.HOME ?? ".");
}
//#endregion
//#region src/host/service.ts
/**
* RunLabService：host API 与 CLI 共用的应用层。
* 封装 manifest 存取 + 引擎编排，返回干净的结果对象。
*/
function createRunLabService(opts) {
	const engineOpts = (runOptions) => ({
		home: opts.home,
		workspacesDir: workspacesDir(opts.home),
		timeoutMs: opts.timeoutMs ?? 600 * 1e3,
		keepWorkspaces: opts.keepWorkspaces ?? false,
		repeatOverride: runOptions?.repeat ?? void 0
	});
	return {
		async list() {
			return listManifests(opts.home);
		},
		async get(id) {
			return loadManifest(opts.home, id);
		},
		async create(input) {
			await ensureRunLabDirs(opts.home);
			const exp = createExperiment(input);
			await saveManifest(opts.home, exp);
			return exp;
		},
		async run(id, options) {
			const exp = await loadManifest(opts.home, id);
			if (!exp) throw new Error(`experiment ${id} not found`);
			return (await runExperiment(exp, engineOpts(options))).experiment;
		},
		async delete(id) {
			if (!await loadManifest(opts.home, id)) return;
			await rm(resolve(manifestsDir(opts.home), `${id}.json`), { force: true });
			await rm(resolve(workspacesDir(opts.home), id), {
				recursive: true,
				force: true
			});
		},
		capabilities() {
			return {
				version: "0.8.0",
				sequential: true,
				isolation: ["git-worktree", "copy"],
				dshTokenFeed: false,
				commandAgentDriver: true
			};
		}
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
function reqString(body, key) {
	const v = body[key];
	return typeof v === "string" && v.length > 0 ? v : void 0;
}
function registerRunLabApi(ctx, service) {
	ctx.effect(() => {
		const base = "/plugins/dsh-run-lab/api";
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/list`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						json(res, 200, ok(await service.list()));
					} catch (error) {
						json(res, 500, fail("internal", msg(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/get`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const id = reqString(await readJson(req), "id");
						if (!id) return json(res, 400, fail("bad-request", "id is required"));
						const exp = await service.get(id);
						if (!exp) return json(res, 404, fail("not-found", `experiment ${id} not found`));
						json(res, 200, ok(exp));
					} catch (error) {
						json(res, 500, fail("internal", msg(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/create`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const input = parseCreateInput(await readJson(req));
						if (typeof input === "string") return json(res, 400, fail("bad-request", input));
						json(res, 200, ok(await service.create(input)));
					} catch (error) {
						json(res, 500, fail("internal", msg(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/run`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const id = reqString(body, "id");
						if (!id) return json(res, 400, fail("bad-request", "id is required"));
						const runOptions = {};
						const repeat = body["repeat"];
						if (typeof repeat === "number" && Number.isInteger(repeat) && repeat > 0) runOptions.repeat = repeat;
						json(res, 200, ok(await service.run(id, runOptions)));
					} catch (error) {
						json(res, 500, fail("internal", msg(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/delete`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const id = reqString(await readJson(req), "id");
						if (!id) return json(res, 400, fail("bad-request", "id is required"));
						await service.delete(id);
						json(res, 200, ok({
							deleted: true,
							id
						}));
					} catch (error) {
						json(res, 500, fail("internal", msg(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/capabilities`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						json(res, 200, ok(service.capabilities()));
					} catch (error) {
						json(res, 500, fail("internal", msg(error)));
					}
				}
			})
		];
		return () => {
			for (const dispose of routes) dispose();
		};
	}, "dsh-run-lab: web routes");
}
/** 解析 CreateExperimentInput；返回 string 表示校验错误。 */
function parseCreateInput(body) {
	const prompt = reqString(body, "prompt");
	if (!prompt) return "prompt is required";
	const baseline = reqString(body, "baseline");
	if (!baseline) return "baseline is required";
	const branchesRaw = body["branches"];
	if (!Array.isArray(branchesRaw) || branchesRaw.length !== 2) return "branches must be an array of length 2";
	const branches = [parseBranch(branchesRaw[0], "a"), parseBranch(branchesRaw[1], "b")];
	return {
		title: typeof body["title"] === "string" ? body["title"] : void 0,
		prompt,
		baseline,
		baselineCommit: typeof body["baselineCommit"] === "string" ? body["baselineCommit"] : null,
		forceCopy: body["forceCopy"] === true,
		repeat: typeof body["repeat"] === "number" && Number.isInteger(body["repeat"]) && body["repeat"] > 0 ? body["repeat"] : void 0,
		branches
	};
}
function parseBranch(raw, fallbackId) {
	const o = raw ?? {};
	const id = o["id"] === "a" || o["id"] === "b" ? o["id"] : fallbackId;
	return {
		id,
		label: typeof o["label"] === "string" && o["label"] ? o["label"] : `Branch ${id.toUpperCase()}`,
		agentCommand: typeof o["agentCommand"] === "string" && o["agentCommand"] ? o["agentCommand"] : void 0,
		agent: toAgentSpec(o["agent"]),
		workspaceOverrides: toRecord(o["workspaceOverrides"]),
		evaluator: toEvaluator(o["evaluator"])
	};
}
function toAgentSpec(v) {
	if (!v || typeof v !== "object" || Array.isArray(v)) return void 0;
	const o = v;
	const command = typeof o["command"] === "string" && o["command"] ? o["command"] : void 0;
	if (!command) return void 0;
	return {
		driver: o["driver"] === "dsh-inproc" ? "dsh-inproc" : "command",
		command,
		usesWorkspace: command.includes("$WORKSPACE") || command.includes("%WORKSPACE%")
	};
}
function toRecord(v) {
	if (!v || typeof v !== "object" || Array.isArray(v)) return void 0;
	const out = {};
	for (const [k, val] of Object.entries(v)) if (typeof val === "string") out[k] = val;
	return Object.keys(out).length ? out : void 0;
}
function toEvaluator(v) {
	if (!v || typeof v !== "object" || Array.isArray(v)) return void 0;
	const o = v;
	return {
		command: typeof o["command"] === "string" ? o["command"] : "",
		expectExitCode: typeof o["expectExitCode"] === "number" ? o["expectExitCode"] : void 0,
		expectFileExists: Array.isArray(o["expectFileExists"]) ? o["expectFileExists"].filter((x) => typeof x === "string") : void 0,
		junitFile: typeof o["junitFile"] === "string" ? o["junitFile"] : void 0,
		regexAssertions: Array.isArray(o["regexAssertions"]) ? o["regexAssertions"].filter((x) => typeof x === "string") : void 0
	};
}
function msg(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region src/host/index.ts
const name = "dsh-run-lab";
const inject = ["webServer"];
const Config = z.object({
	home: z.string().default(""),
	timeoutMs: z.number().min(1e3).default(600 * 1e3),
	keepWorkspaces: z.boolean().default(false)
});
function apply(ctx, config) {
	const resolved = Config(config ?? {});
	const home = resolved.home && resolved.home.length > 0 ? resolved.home : homeDefault();
	ensureRunLabDirs(home).catch((error) => {
		ctx.logger.warn(`[dsh-run-lab] cannot init run-lab dirs: ${error instanceof Error ? error.message : String(error)}`);
	});
	registerRunLabApi(ctx, createRunLabService({
		home,
		timeoutMs: resolved.timeoutMs,
		keepWorkspaces: resolved.keepWorkspaces
	}));
	ctx.effect(() => {
		ctx.logger.info(`[dsh-run-lab] ready. run-lab root: ${runLabRoot(home)}`);
		return () => {};
	}, "dsh-run-lab: ready log");
}
function homeDefault() {
	return process.env.DSH_HOME ?? (process.platform === "win32" ? process.env.USERPROFILE ?? process.env.HOME ?? "." : process.env.HOME ?? ".");
}
//#endregion
export { Config, apply, inject, name };
