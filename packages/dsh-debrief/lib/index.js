import z from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
//#region src/core/types.ts
const DEFAULT_CONFIG = {
	triggerMode: "session-only",
	turnInterval: 1,
	commandToolNames: [
		"bash",
		"bash_persistent",
		"pwsh",
		"shell",
		"cmd",
		"sh",
		"zsh"
	],
	testCommandPatterns: [
		"(^|\\s)(pnpm|npm|yarn|bun|deno|npx)\\s+(run\\s+)?(test|spec|e2e)(\\s|$)",
		"(^|\\s)(pnpm|npm|yarn|bun|deno|npx)\\s+(test|spec|e2e)\\b",
		"(^|\\s)dotnet\\s+test\\b",
		"(^|\\s)cargo\\s+test\\b",
		"(^|\\s)go\\s+test\\b",
		"(^|\\s)go\\s+vet\\b",
		"(^|\\s)python\\s+-m\\s+(unittest|pytest)\\b",
		"(^|\\s)pytest\\b",
		"(^|\\s)vitest\\b",
		"(^|\\s)jest\\b",
		"(^|\\s)ts-jest\\b",
		"(^|\\s)ava\\b",
		"(^|\\s)tape\\b",
		"(^|\\s)mocha\\b",
		"(^|\\s)rspec\\b",
		"(^|\\s)rake\\s+test\\b",
		"(^|\\s)make\\s+test\\b",
		"(^|\\s)gradle\\s+test\\b",
		"(^|\\s)maven\\s+test\\b",
		"(^|\\s)mvn\\s+test\\b",
		"(^|\\s)flutter\\s+test\\b",
		"(^|\\s)poetry\\s+run\\s+pytest\\b",
		"(^|\\s)phpunit\\b",
		"(^|\\s)behave\\b",
		"(^|\\s)cypress(\\s|run)\\b",
		"(^|\\s)playwright\\b",
		"(^|\\s)testcafe\\b",
		"(^|\\s)karma\\s+start\\b"
	],
	maxFailedCommands: 10,
	maxChangedFiles: 20,
	maxUnresolved: 20,
	detectTodoMarkers: true
};
//#endregion
//#region src/host/settings.ts
const DEBRIEF_NAMESPACE = settingsNamespace("debrief");
const DebriefSettingsSchema = z.object({
	triggerMode: z.union([
		"off",
		"session-only",
		"every-n-turns",
		"on-completion"
	]).default(DEFAULT_CONFIG.triggerMode),
	turnInterval: z.natural().min(1).max(100).default(DEFAULT_CONFIG.turnInterval),
	testCommandPatterns: z.array(z.string()).default([]),
	detectTodoMarkers: z.boolean().default(DEFAULT_CONFIG.detectTodoMarkers)
});
function registerDebriefSettings(ctx) {
	return ctx.settings.register(DEBRIEF_NAMESPACE, DebriefSettingsSchema, { applies: "live" });
}
//#endregion
//#region src/core/events.ts
function parseJsonObject(raw) {
	if (typeof raw !== "string" || raw.length === 0) return null;
	try {
		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}
function firstString(record, keys) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.length > 0) return value;
	}
	return null;
}
/** Extract the command line from a tool call's parsed arguments. */
function commandFromArgs(args) {
	if (!args) return null;
	return firstString(args, [
		"cmd",
		"command",
		"script",
		"line",
		"expression"
	]);
}
function isCommandTool(name, config) {
	return config.commandToolNames.includes(name);
}
/** Classify a command as a test run using configured regex patterns. */
function isTestCommand(command, config) {
	for (const raw of config.testCommandPatterns) try {
		if (new RegExp(raw, "i").test(command)) return true;
	} catch {
		continue;
	}
	return false;
}
/**
* Read an explicitly structured test outcome from a tool/result meta blob.
*
* A tool that reports a deterministic test structure (e.g. `{ test: true,
* status: 'passed' }` or `{ testResult: { passed, failed } }`) is an
* authoritative test signal — distinct from guessing by command name or
* loosely matching arbitrary output text. Returns null when the meta carries
* no such structure.
*/
function structuredTestFromMeta(meta) {
	if (typeof meta !== "object" || meta === null) return null;
	const m = meta;
	if (m.test === true || m.kind === "test" || m.testKind === "test" || m.isTest === true) return {
		isTest: true,
		status: testStatusFromValue(m.status ?? m.testStatus ?? m.testResult?.status)
	};
	const result = m.testResult;
	if (typeof result === "object" && result !== null) {
		const r = result;
		if ([
			r.passed,
			r.failed,
			r.skipped,
			r.total
		].some((n) => typeof n === "number") || r.status !== void 0) return {
			isTest: true,
			status: testStatusFromValue(r.status)
		};
	}
	const summary = m.testSummary;
	if (typeof summary === "object" && summary !== null) {
		const s = summary;
		if (typeof s.passed === "number" || typeof s.failed === "number" || s.status !== void 0) return {
			isTest: true,
			status: testStatusFromValue(s.status)
		};
	}
	return null;
}
function testStatusFromValue(value) {
	if (typeof value !== "string") return null;
	const v = value.toLowerCase();
	if (v === "passed" || v === "pass" || v === "success" || v === "ok") return "passed";
	if (v === "failed" || v === "fail" || v === "error") return "failed";
	return "unknown";
}
/**
* Extract an exit code from a bash-style tool result string.
*
* The DSH bash tool emits a deterministic `[exit code: N]` marker line, so
* this is a structured-ish source, not a guess. Returns null when absent.
*/
function extractExitCode(text) {
	if (!text) return null;
	const match = text.match(/\[exit code:\s*(-?\d+)\]/i);
	if (!match) return null;
	const value = Number(match[1]);
	return Number.isInteger(value) ? value : null;
}
/** Collect all text content from a tool/result message's content blocks. */
function textFromContent(content) {
	if (!Array.isArray(content)) return "";
	const parts = [];
	for (const block of content) {
		if (typeof block !== "object" || block === null) continue;
		const b = block;
		if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
		if (b.type === "tool-result" && Array.isArray(b.content)) {
			const nested = textFromContent(b.content);
			if (nested) parts.push(nested);
		}
	}
	return parts.join("\n");
}
/** Extract changed files from an fs-tool's structured `meta.diffs` or `meta.changedFiles`. */
function changedFilesFromResult(meta) {
	if (typeof meta !== "object" || meta === null) return [];
	const m = meta;
	const out = [];
	if (Array.isArray(m.diffs)) for (const diff of m.diffs) {
		if (typeof diff !== "object" || diff === null) continue;
		const path = diff.path;
		if (typeof path === "string" && path.length > 0) out.push({
			path,
			kind: typeof diff.oldText === "string" ? "edit" : "write",
			structured: true
		});
	}
	if (Array.isArray(m.changedFiles)) {
		for (const item of m.changedFiles) if (typeof item === "string" && item.length > 0) out.push({
			path: item,
			kind: "unknown",
			structured: true
		});
		else if (typeof item === "object" && item !== null) {
			const path = item.path ?? item.filePath;
			if (typeof path === "string" && path.length > 0) out.push({
				path,
				kind: "unknown",
				structured: true
			});
		}
	}
	return out;
}
/** Extract file-read paths from a tool call for known read/glob/search tools. */
function readPathsFromCall(name, args) {
	if (!args) return [];
	if (!(/* @__PURE__ */ new Set([
		"read",
		"read_file",
		"fs_read",
		"read_image",
		"read_image_file",
		"glob",
		"search",
		"grep"
	])).has(name)) return [];
	const path = firstString(args, [
		"path",
		"file_path",
		"filePath",
		"pattern",
		"query",
		"include"
	]);
	return path ? [path] : [];
}
/** Collect paths from known write/edit tool arguments as a best-effort source. */
function writePathsFromCall(name, args) {
	if (!args) return [];
	if (!(/* @__PURE__ */ new Set([
		"write",
		"write_file",
		"fs_write",
		"edit",
		"edit_file",
		"fs_edit",
		"str_replace_editor"
	])).has(name)) return [];
	const path = firstString(args, [
		"file_path",
		"filePath",
		"path",
		"target"
	]);
	return path ? [{
		path,
		kind: name === "edit" || name === "fs_edit" || name === "str_replace_editor" ? "edit" : "write",
		structured: false
	}] : [];
}
const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/g;
/** Detect TODO/FIXME markers in text; returns matching lines. */
function findTodoMarkers(text, limit = 8) {
	if (!text) return [];
	const out = [];
	for (const line of text.split("\n")) if (TODO_PATTERN.test(line)) {
		out.push(line.trim().slice(0, 200));
		if (out.length >= limit) break;
	}
	return out;
}
/** Create a ToolCallRecord for a `tool/call` event. */
function toolCallFromEvent(event) {
	if (event.type !== "tool/call") return null;
	const data = event.data;
	const name = data.name;
	const argumentsRaw = data.arguments;
	const callId = data.callId;
	if (typeof name !== "string" || name.length === 0 || typeof callId !== "string" || callId.length === 0) return null;
	return {
		callId,
		name,
		arguments: typeof argumentsRaw === "string" ? argumentsRaw : JSON.stringify(argumentsRaw ?? {}),
		args: parseJsonObject(argumentsRaw),
		turn: typeof data.turn === "number" ? data.turn : 0,
		step: typeof data.step === "number" ? data.step : 0,
		startedAt: event.time,
		endedAt: null,
		durationMs: null,
		errored: false,
		resultMeta: null,
		resultPreview: null
	};
}
/** Complete a ToolCallRecord with a matching `tool/result` event. */
function toolResultIntoRecord(record, event) {
	const data = event.data;
	record.endedAt = event.time;
	record.durationMs = Math.max(0, event.time - record.startedAt);
	record.errored = Boolean(data.error);
	record.resultMeta = data.meta ?? null;
	record.resultPreview = textFromContent(data.message && typeof data.message === "object" ? data.message.content : void 0).slice(0, 500);
}
/** Extract the command line and exit code from a completed tool call. */
function commandFromRecord(record, config) {
	const command = commandFromArgs(record.args);
	if (!command) return {
		command: null,
		exitCode: null
	};
	let exitCode = null;
	if (record.resultPreview) exitCode = extractExitCode(record.resultPreview);
	return {
		command,
		exitCode
	};
}
function buildCommandRecord(record, config) {
	if (!isCommandTool(record.name, config)) return null;
	const { command, exitCode } = commandFromRecord(record, config);
	if (!command) return null;
	const structured = structuredTestFromMeta(record.resultMeta);
	const isTest = structured?.isTest === true || isTestCommand(command, config);
	const kind = isTest ? "test" : "command";
	let testStatus = null;
	let testSource = null;
	if (isTest) {
		testSource = structured?.isTest === true ? "structure" : "pattern";
		if (structured?.status) testStatus = structured.status;
		else if (exitCode === 0) testStatus = "passed";
		else if (exitCode === null) testStatus = "unknown";
		else testStatus = "failed";
	}
	return {
		...record,
		command,
		exitCode,
		kind,
		testSource,
		testStatus
	};
}
/** Aggregate FileChange lists, deduping by path (structured meta wins). */
function mergeFileChanges(...groups) {
	const map = /* @__PURE__ */ new Map();
	for (const group of groups) for (const file of group) {
		const existing = map.get(file.path);
		if (!existing || !existing.structured && file.structured) map.set(file.path, file);
	}
	return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}
function mergeFileReads(...groups) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const group of groups) for (const read of group) {
		const key = `${read.toolName}:${read.path}`;
		if (!seen.has(key)) {
			seen.add(key);
			out.push(read);
		}
	}
	return out;
}
/** Extract a human-readable command line for a failed/error record (or null). */
function describeToolCall(record) {
	const cmd = commandFromArgs(record.args);
	if (cmd) return `${record.name}: ${cmd}`;
	return `${record.name}(${record.callId.slice(0, 8)})`;
}
//#endregion
//#region src/core/config.ts
/**
* Configuration parsing and validation for dsh-debrief.
*
* The host reads user settings (via the DSH settings service) into a plain
* object, then normalizes it here. Unknown fields are dropped, bad regexes in
* `testCommandPatterns` are filtered out with a note, and trigger mode falls
* back to the safe default rather than throwing.
*/
const TRIGGER_MODES = [
	"off",
	"session-only",
	"every-n-turns",
	"on-completion"
];
function isTriggerMode(value) {
	return typeof value === "string" && TRIGGER_MODES.includes(value);
}
function clampInt(value, fallback, min, max) {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(value)));
}
function stringArray(value) {
	if (!Array.isArray(value)) return [];
	return value.filter((item) => typeof item === "string" && item.length > 0);
}
function validRegexes(patterns) {
	return patterns.filter((pattern) => {
		try {
			new RegExp(pattern, "i");
			return true;
		} catch {
			return false;
		}
	});
}
function normalizeConfig(input) {
	const raw = typeof input === "object" && input !== null ? input : {};
	const warnings = [];
	const triggerMode = isTriggerMode(raw.triggerMode) ? raw.triggerMode : DEFAULT_CONFIG.triggerMode;
	if (!isTriggerMode(raw.triggerMode) && raw.triggerMode !== void 0) warnings.push(`triggerMode 未知，回退到 "${DEFAULT_CONFIG.triggerMode}"`);
	const userPatterns = stringArray(raw.testCommandPatterns);
	const validUser = validRegexes(userPatterns);
	if (validUser.length !== userPatterns.length) warnings.push("testCommandPatterns 中有非法正则，已忽略");
	const testCommandPatterns = [...DEFAULT_CONFIG.testCommandPatterns, ...validUser];
	const commandToolNames = stringArray(raw.commandToolNames);
	if (raw.commandToolNames !== void 0 && commandToolNames.length === 0) warnings.push("commandToolNames 为空，使用默认命令工具名");
	return {
		config: {
			triggerMode,
			turnInterval: clampInt(raw.turnInterval, DEFAULT_CONFIG.turnInterval, 1, 100),
			commandToolNames: commandToolNames.length > 0 ? commandToolNames : DEFAULT_CONFIG.commandToolNames,
			testCommandPatterns,
			maxFailedCommands: clampInt(raw.maxFailedCommands, DEFAULT_CONFIG.maxFailedCommands, 1, 200),
			maxChangedFiles: clampInt(raw.maxChangedFiles, DEFAULT_CONFIG.maxChangedFiles, 1, 200),
			maxUnresolved: clampInt(raw.maxUnresolved, DEFAULT_CONFIG.maxUnresolved, 1, 200),
			detectTodoMarkers: typeof raw.detectTodoMarkers === "boolean" ? raw.detectTodoMarkers : DEFAULT_CONFIG.detectTodoMarkers
		},
		warnings
	};
}
//#endregion
//#region src/core/tokens.ts
const EMPTY = {
	inputTokens: 0,
	outputTokens: 0,
	cacheReadTokens: 0,
	cacheWriteTokens: 0,
	totalTokens: 0,
	contextPressure: null,
	contextWindow: null,
	usageReports: 0,
	precision: "unavailable"
};
function usageFromData(data) {
	const usage = data.usage;
	if (typeof usage !== "object" || usage === null) return null;
	const u = usage;
	const input = typeof u.inputTokens === "number" ? u.inputTokens : 0;
	const output = typeof u.outputTokens === "number" ? u.outputTokens : 0;
	if (input === 0 && output === 0 && u.cacheReadTokens === void 0 && u.cacheWriteTokens === void 0) return null;
	return {
		input,
		output,
		cacheRead: typeof u.cacheReadTokens === "number" ? u.cacheReadTokens : 0,
		cacheWrite: typeof u.cacheWriteTokens === "number" ? u.cacheWriteTokens : 0
	};
}
/**
* Aggregate tokens across a set of events (optionally filtered to a turn).
* Returns null when no provider usage was observed.
*/
function aggregateTokens(events, input) {
	let inputTokens = 0;
	let outputTokens = 0;
	let cacheReadTokens = 0;
	let cacheWriteTokens = 0;
	let usageReports = 0;
	for (const event of events) {
		if (event.type !== "assistant/message") continue;
		const usage = usageFromData(event.data);
		if (!usage) continue;
		inputTokens += usage.input;
		outputTokens += usage.output;
		cacheReadTokens += usage.cacheRead;
		cacheWriteTokens += usage.cacheWrite;
		usageReports += 1;
	}
	const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
	const precision = usageReports > 0 ? "exact" : "unavailable";
	return {
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		totalTokens,
		contextPressure: input?.contextPressure ?? null,
		contextWindow: input?.contextWindow ?? null,
		usageReports,
		precision
	};
}
function emptyTokens() {
	return { ...EMPTY };
}
//#endregion
//#region src/core/debrief.ts
function eventsInWindow(events, window) {
	return events.filter((e) => e.seq >= window.startSeq && e.seq <= window.endSeq);
}
function computeToolStats(records) {
	const map = /* @__PURE__ */ new Map();
	for (const record of records) {
		let stat = map.get(record.name);
		if (!stat) {
			stat = {
				name: record.name,
				callCount: 0,
				errorCount: 0,
				totalDurationMs: 0,
				avgDurationMs: null,
				slowestCallMs: null,
				slowestCallCommand: null,
				_sum: 0,
				_count: 0,
				_slowest: null
			};
			map.set(record.name, stat);
		}
		stat.callCount += 1;
		if (record.errored) stat.errorCount += 1;
		if (record.durationMs !== null) {
			stat._sum += record.durationMs;
			stat._count += 1;
			stat.totalDurationMs += record.durationMs;
		}
		if (stat._slowest === null || record.durationMs !== null && record.durationMs > (stat._slowest.durationMs ?? 0)) stat._slowest = record;
	}
	const out = [];
	for (const s of map.values()) out.push({
		name: s.name,
		callCount: s.callCount,
		errorCount: s.errorCount,
		totalDurationMs: s.totalDurationMs,
		avgDurationMs: s._count > 0 ? Math.round(s._sum / s._count) : null,
		slowestCallMs: s._slowest?.durationMs ?? null,
		slowestCallCommand: commandFromArgs(s._slowest?.args ?? null) ?? null
	});
	return out.sort((a, b) => b.totalDurationMs - a.totalDurationMs || b.callCount - a.callCount);
}
function slowestOverall(records) {
	let slowest = null;
	for (const record of records) {
		if (record.durationMs === null) continue;
		if (slowest === null || record.durationMs > (slowest.durationMs ?? 0)) slowest = record;
	}
	return slowest;
}
function analyzeWindow(events, config, windowTurn) {
	const records = [];
	const byCallId = /* @__PURE__ */ new Map();
	const changedFiles = [];
	const filesRead = [];
	const todoMarkers = [];
	let stepCount = 0;
	let assistantMessageCount = 0;
	for (const event of events) {
		const data = event.data;
		if (event.type === "step/start") stepCount += 1;
		if (event.type === "assistant/message") assistantMessageCount += 1;
		if (event.type === "tool/call") {
			const record = toolCallFromEvent(event);
			if (!record) continue;
			if (windowTurn !== null && record.turn !== windowTurn) continue;
			records.push(record);
			byCallId.set(record.callId, record);
			filesRead.push(...readPathsFromCall(record.name, record.args).map((path) => ({
				path,
				toolName: record.name
			})));
			changedFiles.push(...writePathsFromCall(record.name, record.args));
		} else if (event.type === "tool/result") {
			const callId = data.callId;
			const record = typeof callId === "string" ? byCallId.get(callId) : void 0;
			if (!record) continue;
			toolResultIntoRecord(record, event);
			changedFiles.push(...changedFilesFromResult(record.resultMeta));
			const text = textFromContent(data.message && typeof data.message === "object" ? data.message.content : void 0);
			if (config.detectTodoMarkers) todoMarkers.push(...findTodoMarkers(text, 20));
		}
	}
	const commands = records.map((record) => buildCommandRecord(record, config)).filter((record) => record !== null);
	const unresolved = [];
	for (const command of commands) if (command.errored || command.exitCode !== null && command.exitCode !== 0) unresolved.push({
		kind: "failed-command",
		label: `exit ${command.exitCode ?? "err"} — ${command.command}`,
		detail: describeToolCall(command),
		turn: command.turn
	});
	for (const marker of todoMarkers) unresolved.push({
		kind: "todo-marker",
		label: marker,
		detail: "TODO/FIXME 标记出现在工具输出中",
		turn: windowTurn ?? 0
	});
	return {
		records,
		commands,
		changedFiles: mergeFileChanges(changedFiles),
		filesRead: mergeFileReads(filesRead),
		unresolved,
		stepCount,
		assistantMessageCount
	};
}
function notesFor(analysis, tokens, commandCount) {
	const notes = [];
	if (tokens.usageReports > 0) notes.push("tokens: provider 报告 usage");
	else notes.push("tokens: 无 provider token 报告（assistant/message 未携带 usage）");
	if (analysis.changedFiles.some((f) => !f.structured)) notes.push("changed files: 部分路径来自 write/edit 工具参数（estimated）");
	if (commandCount === 0) notes.push("commands: 未识别到命令执行");
	return notes;
}
function buildTurnDebrief(sessionId, window, events, config, tokenInput) {
	const windowed = eventsInWindow(events, window);
	const analysis = analyzeWindow(windowed, config, window.turn);
	const commandCount = analysis.commands.length;
	const tests = analysis.commands.filter((c) => c.kind === "test").map((c) => ({
		command: c.command,
		exitCode: c.exitCode,
		status: c.testStatus === "passed" ? "passed" : c.testStatus === "failed" ? "failed" : "unknown",
		turn: c.turn
	}));
	const tokens = aggregateTokens(windowed, tokenInput);
	return {
		kind: "turn",
		sessionId,
		turn: window.turn ?? 0,
		startedAt: window.startTime,
		endedAt: window.endTime,
		durationMs: Math.max(0, window.endTime - window.startTime),
		stepCount: analysis.stepCount,
		assistantMessageCount: analysis.assistantMessageCount,
		toolCallCount: analysis.records.length,
		commandCount,
		toolStats: computeToolStats(analysis.records),
		slowestToolCall: slowestOverall(analysis.records),
		commands: analysis.commands,
		failedCommands: analysis.commands.filter((c) => c.errored || c.exitCode !== null && c.exitCode !== 0),
		tests,
		changedFiles: analysis.changedFiles.slice(0, config.maxChangedFiles),
		filesRead: analysis.filesRead.slice(0, config.maxChangedFiles),
		unresolved: analysis.unresolved.slice(0, config.maxUnresolved),
		tokens,
		notes: notesFor(analysis, tokens, commandCount)
	};
}
/** Build the per-turn windows from `turn/start` .. `turn/end` pairs. */
function turnWindows(events) {
	const windows = [];
	let current = null;
	for (const event of events) if (event.type === "turn/start") {
		if (current) windows.push(current);
		current = {
			turn: typeof event.data.turn === "number" ? event.data.turn : 0,
			startSeq: event.seq,
			endSeq: event.seq,
			startTime: event.time,
			endTime: event.time
		};
	} else if (event.type === "turn/end") {
		if (current && current.turn === event.data.turn) {
			current.endSeq = event.seq;
			current.endTime = event.time;
		}
	} else if (current && event.seq > current.endSeq) {
		current.endSeq = event.seq;
		current.endTime = event.time;
	}
	if (current) windows.push(current);
	return windows;
}
/**
* Compute a debrief for a single turn.
*
* The engine looks up the turn's boundary (turn/start..turn/end) for timing,
* then analyzes all events whose `data.turn` matches. When events carry no
* `turn` field, it falls back to the window's bounded event range.
*/
function computeTurnDebrief(sessionId, events, turn, config, tokenInput = {}) {
	const boundary = turnWindows(events).find((w) => w.turn === turn);
	const turnEvents = events.filter((e) => typeof e.data.turn === "number" && e.data.turn === turn);
	let startSeq;
	let endSeq;
	if (turnEvents.length > 0) {
		startSeq = Math.min(...turnEvents.map((e) => e.seq));
		endSeq = Math.max(...turnEvents.map((e) => e.seq));
	} else {
		startSeq = boundary?.startSeq ?? 0;
		endSeq = boundary?.endSeq ?? 0;
	}
	const startTime = turnEvents[0]?.time ?? boundary?.startTime ?? 0;
	const endTime = turnEvents.length > 0 ? turnEvents[turnEvents.length - 1].time : boundary?.endTime ?? startTime;
	return buildTurnDebrief(sessionId, {
		turn,
		startSeq,
		endSeq,
		startTime,
		endTime
	}, events, config, tokenInput);
}
/** Compute a debrief for a whole session. */
function computeSessionDebrief(sessionId, events, config, tokenInput = {}) {
	if (events.length === 0) return {
		kind: "session",
		sessionId,
		startedAt: 0,
		endedAt: 0,
		durationMs: 0,
		turnCount: 0,
		stepCount: 0,
		assistantMessageCount: 0,
		toolCallCount: 0,
		commandCount: 0,
		toolStats: [],
		slowestToolCall: null,
		commands: [],
		failedCommands: [],
		tests: [],
		changedFiles: [],
		filesRead: [],
		unresolved: [],
		tokens: emptyTokens(),
		notes: ["session 无事件"]
	};
	const analysis = analyzeWindow(events, config, null);
	const commandCount = analysis.commands.length;
	const tests = analysis.commands.filter((c) => c.kind === "test").map((c) => ({
		command: c.command,
		exitCode: c.exitCode,
		status: c.testStatus === "passed" ? "passed" : c.testStatus === "failed" ? "failed" : "unknown",
		turn: c.turn
	}));
	const tokens = aggregateTokens(events, tokenInput);
	return {
		kind: "session",
		sessionId,
		startedAt: events[0].time,
		endedAt: events[events.length - 1].time,
		durationMs: Math.max(0, events[events.length - 1].time - events[0].time),
		turnCount: turnWindows(events).length,
		stepCount: analysis.stepCount,
		assistantMessageCount: analysis.assistantMessageCount,
		toolCallCount: analysis.records.length,
		commandCount,
		toolStats: computeToolStats(analysis.records),
		slowestToolCall: slowestOverall(analysis.records),
		commands: analysis.commands,
		failedCommands: analysis.commands.filter((c) => c.errored || c.exitCode !== null && c.exitCode !== 0),
		tests,
		changedFiles: analysis.changedFiles.slice(0, config.maxChangedFiles),
		filesRead: analysis.filesRead.slice(0, config.maxChangedFiles),
		unresolved: analysis.unresolved.slice(0, config.maxUnresolved),
		tokens,
		notes: notesFor(analysis, tokens, commandCount)
	};
}
//#endregion
//#region src/host/engine.ts
function eventToDebriefEvent(event) {
	return {
		seq: event.seq,
		time: event.time,
		type: event.type,
		data: event.data
	};
}
var DebriefEngine = class {
	ctx;
	settings;
	sessions = /* @__PURE__ */ new Map();
	constructor(ctx, settings) {
		this.ctx = ctx;
		this.settings = settings;
	}
	/** Append one DSH session event to the per-session log. */
	record(sessionId, event) {
		let log = this.sessions.get(sessionId);
		if (!log) {
			log = [];
			this.sessions.set(sessionId, log);
		}
		log.push(eventToDebriefEvent(event));
	}
	/** Drop a session's log when the session leaves the store. */
	drop(sessionId) {
		this.sessions.delete(sessionId);
	}
	get events() {
		return this.sessions;
	}
	config() {
		return normalizeConfig(this.settings.get());
	}
	/** Resolve token-meter pressure/context for a live session, when available. */
	tokenInput(sessionId) {
		const session = this.ctx.get("sessions")?.get?.(sessionId);
		if (!session) return {};
		const pressure = this.ctx.get("sessionProjections")?.snapshot?.(session)?.values?.["contextPressure"];
		return {
			contextPressure: pressure?.pressureTokens ?? pressure?.projectedTokens ?? null,
			contextWindow: pressure?.contextWindow ?? null
		};
	}
	turnDebrief(sessionId, turn) {
		const events = this.sessions.get(sessionId) ?? [];
		const { config } = this.config();
		return computeTurnDebrief(sessionId, events, turn, config, this.tokenInput(sessionId));
	}
	sessionDebrief(sessionId) {
		const events = this.sessions.get(sessionId) ?? [];
		const { config } = this.config();
		return computeSessionDebrief(sessionId, events, config, this.tokenInput(sessionId));
	}
	/** The set of turn numbers seen in this session's log. */
	knownTurns(sessionId) {
		const events = this.sessions.get(sessionId) ?? [];
		const turns = /* @__PURE__ */ new Set();
		for (const event of events) if (event.type === "turn/start" && typeof event.data.turn === "number") turns.add(event.data.turn);
		return [...turns].sort((a, b) => a - b);
	}
	/** Current settings as a plain object (for the client settings route). */
	rawSettings() {
		return this.settings.get();
	}
	/** Namespace string so the API route can return it. */
	namespace() {
		return DEBRIEF_NAMESPACE;
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
function registerApi(ctx, engine) {
	ctx.effect(() => {
		const base = "/plugins/dsh-debrief/api";
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/turn`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const body = await readJson(req);
						const sessionId = requireString(body, "sessionId");
						const turn = typeof body["turn"] === "number" && Number.isInteger(body["turn"]) ? body["turn"] : void 0;
						if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
						if (turn === void 0) return json(res, 400, fail("bad-request", "turn is required"));
						json(res, 200, ok(engine.turnDebrief(sessionId, turn)));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/session`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const sessionId = requireString(await readJson(req), "sessionId");
						if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
						json(res, 200, ok(engine.sessionDebrief(sessionId)));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/turns`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						const sessionId = requireString(await readJson(req), "sessionId");
						if (!sessionId) return json(res, 400, fail("bad-request", "sessionId is required"));
						json(res, 200, ok({ turns: engine.knownTurns(sessionId) }));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: `${base}/settings`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, fail("bad-request", "method not allowed"));
					if (!trustedRequest(req)) return json(res, 403, fail("forbidden", "forbidden"));
					try {
						json(res, 200, ok(engine.rawSettings()));
					} catch (error) {
						json(res, 500, fail("internal", error instanceof Error ? error.message : String(error)));
					}
				}
			})
		];
		return () => {
			for (const dispose of routes) dispose();
		};
	}, "dsh-debrief: web routes");
}
//#endregion
//#region src/host/index.ts
const name = "dsh-debrief";
const inject = [
	"settings",
	"sessions",
	"webServer"
];
function apply(ctx) {
	const engine = new DebriefEngine(ctx, registerDebriefSettings(ctx));
	registerApi(ctx, engine);
	ctx.on("session/event", (session, event) => {
		const sessionId = String(session.id);
		if (!sessionId) return;
		engine.record(sessionId, event);
	});
	ctx.on("session/disposed", (session) => {
		const sessionId = String(session.id);
		if (sessionId) engine.drop(sessionId);
	});
	ctx.effect(() => {
		return () => {
			for (const key of [...engine.events.keys()]) engine.drop(key);
		};
	}, "dsh-debrief: cleanup");
}
//#endregion
export { DEFAULT_CONFIG, apply, computeSessionDebrief, computeTurnDebrief, inject, name, normalizeConfig };
