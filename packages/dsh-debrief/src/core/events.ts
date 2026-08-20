/**
 * Normalized event helpers used by the pure debrief engine.
 *
 * These functions only read plain JSON-shaped event data. They do not depend
 * on DSH packages, so the same code runs in unit tests, the E2E script, and
 * inside the host.
 */

import type {
  CommandRecord,
  DebriefConfig,
  DebriefEvent,
  FileChange,
  FileRead,
  ToolCallRecord,
} from './types.ts'

export function parseJsonObject(raw: string | unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

/** Extract the command line from a tool call's parsed arguments. */
export function commandFromArgs(args: Record<string, unknown> | null): string | null {
  if (!args) return null
  return firstString(args, ['cmd', 'command', 'script', 'line', 'expression'])
}

export function isCommandTool(name: string, config: DebriefConfig): boolean {
  return config.commandToolNames.includes(name)
}

/** Classify a command as a test run using configured regex patterns. */
export function isTestCommand(command: string, config: DebriefConfig): boolean {
  for (const raw of config.testCommandPatterns) {
    try {
      if (new RegExp(raw, 'i').test(command)) return true
    } catch {
      // A bad user regex must not break the whole debrief engine.
      continue
    }
  }
  return false
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
export function structuredTestFromMeta(meta: unknown): { isTest: boolean; status: 'passed' | 'failed' | 'unknown' | null } | null {
  if (typeof meta !== 'object' || meta === null) return null
  const m = meta as Record<string, unknown>

  const explicit = m.test === true || m.kind === 'test' || m.testKind === 'test' || m.isTest === true
  if (explicit) {
    return { isTest: true, status: testStatusFromValue(m.status ?? m.testStatus ?? (m.testResult as Record<string, unknown> | undefined)?.status) }
  }

  const result = m.testResult
  if (typeof result === 'object' && result !== null) {
    const r = result as Record<string, unknown>
    const counts = [r.passed, r.failed, r.skipped, r.total].some((n) => typeof n === 'number')
    if (counts || r.status !== undefined) {
      return { isTest: true, status: testStatusFromValue(r.status) }
    }
  }

  const summary = m.testSummary
  if (typeof summary === 'object' && summary !== null) {
    const s = summary as Record<string, unknown>
    if (typeof s.passed === 'number' || typeof s.failed === 'number' || s.status !== undefined) {
      return { isTest: true, status: testStatusFromValue(s.status) }
    }
  }

  return null
}

function testStatusFromValue(value: unknown): 'passed' | 'failed' | 'unknown' | null {
  if (typeof value !== 'string') return null
  const v = value.toLowerCase()
  if (v === 'passed' || v === 'pass' || v === 'success' || v === 'ok') return 'passed'
  if (v === 'failed' || v === 'fail' || v === 'error') return 'failed'
  return 'unknown'
}

/**
 * Extract an exit code from a bash-style tool result string.
 *
 * The DSH bash tool emits a deterministic `[exit code: N]` marker line, so
 * this is a structured-ish source, not a guess. Returns null when absent.
 */
export function extractExitCode(text: string | null | undefined): number | null {
  if (!text) return null
  const match = text.match(/\[exit code:\s*(-?\d+)\]/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isInteger(value) ? value : null
}

/** Collect all text content from a tool/result message's content blocks. */
export function textFromContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue
    const b = block as Record<string, unknown>
    if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
    if (b.type === 'tool-result' && Array.isArray(b.content)) {
      const nested = textFromContent(b.content)
      if (nested) parts.push(nested)
    }
  }
  return parts.join('\n')
}

/** Extract changed files from an fs-tool's structured `meta.diffs` or `meta.changedFiles`. */
export function changedFilesFromResult(meta: unknown): FileChange[] {
  if (typeof meta !== 'object' || meta === null) return []
  const m = meta as Record<string, unknown>
  const out: FileChange[] = []
  if (Array.isArray(m.diffs)) {
    for (const diff of m.diffs) {
      if (typeof diff !== 'object' || diff === null) continue
      const path = (diff as Record<string, unknown>).path
      if (typeof path === 'string' && path.length > 0) {
        out.push({ path, kind: typeof (diff as Record<string, unknown>).oldText === 'string' ? 'edit' : 'write', structured: true })
      }
    }
  }
  if (Array.isArray(m.changedFiles)) {
    for (const item of m.changedFiles) {
      if (typeof item === 'string' && item.length > 0) {
        out.push({ path: item, kind: 'unknown', structured: true })
      } else if (typeof item === 'object' && item !== null) {
        const path = (item as Record<string, unknown>).path ?? (item as Record<string, unknown>).filePath
        if (typeof path === 'string' && path.length > 0) {
          out.push({ path, kind: 'unknown', structured: true })
        }
      }
    }
  }
  return out
}

/** Extract file-read paths from a tool call for known read/glob/search tools. */
export function readPathsFromCall(name: string, args: Record<string, unknown> | null): string[] {
  if (!args) return []
  const readTools = new Set([
    'read',
    'read_file',
    'fs_read',
    'read_image',
    'read_image_file',
    'glob',
    'search',
    'grep',
  ])
  if (!readTools.has(name)) return []
  const path = firstString(args, ['path', 'file_path', 'filePath', 'pattern', 'query', 'include'])
  return path ? [path] : []
}

/** Collect paths from known write/edit tool arguments as a best-effort source. */
export function writePathsFromCall(name: string, args: Record<string, unknown> | null): FileChange[] {
  if (!args) return []
  const writeTools = new Set([
    'write',
    'write_file',
    'fs_write',
    'edit',
    'edit_file',
    'fs_edit',
    'str_replace_editor',
  ])
  if (!writeTools.has(name)) return []
  const path = firstString(args, ['file_path', 'filePath', 'path', 'target'])
  return path ? [{ path, kind: name === 'edit' || name === 'fs_edit' || name === 'str_replace_editor' ? 'edit' : 'write', structured: false }] : []
}

const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/g

/** Detect TODO/FIXME markers in text; returns matching lines. */
export function findTodoMarkers(text: string | null | undefined, limit = 8): string[] {
  if (!text) return []
  const out: string[] = []
  for (const line of text.split('\n')) {
    if (TODO_PATTERN.test(line)) {
      out.push(line.trim().slice(0, 200))
      if (out.length >= limit) break
    }
  }
  return out
}

/** Create a ToolCallRecord for a `tool/call` event. */
export function toolCallFromEvent(event: DebriefEvent): ToolCallRecord | null {
  if (event.type !== 'tool/call') return null
  const data = event.data
  const name = data.name
  const argumentsRaw = data.arguments
  const callId = data.callId
  if (typeof name !== 'string' || name.length === 0 || typeof callId !== 'string' || callId.length === 0) {
    return null
  }
  return {
    callId,
    name,
    arguments: typeof argumentsRaw === 'string' ? argumentsRaw : JSON.stringify(argumentsRaw ?? {}),
    args: parseJsonObject(argumentsRaw),
    turn: typeof data.turn === 'number' ? data.turn : 0,
    step: typeof data.step === 'number' ? data.step : 0,
    startedAt: event.time,
    endedAt: null,
    durationMs: null,
    errored: false,
    resultMeta: null,
    resultPreview: null,
  }
}

/** Complete a ToolCallRecord with a matching `tool/result` event. */
export function toolResultIntoRecord(record: ToolCallRecord, event: DebriefEvent): void {
  const data = event.data
  record.endedAt = event.time
  record.durationMs = Math.max(0, event.time - record.startedAt)
  record.errored = Boolean(data.error)
  record.resultMeta = data.meta ?? null
  record.resultPreview = textFromContent(data.message && typeof data.message === 'object'
    ? (data.message as Record<string, unknown>).content
    : undefined).slice(0, 500)
}

export interface CommandCompletion {
  command: string | null
  exitCode: number | null
}

/** Extract the command line and exit code from a completed tool call. */
export function commandFromRecord(record: ToolCallRecord, config: DebriefConfig): CommandCompletion {
  const command = commandFromArgs(record.args)
  if (!command) return { command: null, exitCode: null }
  let exitCode: number | null = null
  if (record.resultPreview) {
    exitCode = extractExitCode(record.resultPreview)
  }
  return { command, exitCode }
}

export function buildCommandRecord(record: ToolCallRecord, config: DebriefConfig): CommandRecord | null {
  if (!isCommandTool(record.name, config)) return null
  const { command, exitCode } = commandFromRecord(record, config)
  if (!command) return null
  const structured = structuredTestFromMeta(record.resultMeta)
  const isTest = structured?.isTest === true || isTestCommand(command, config)
  const kind = isTest ? 'test' : 'command'
  let testStatus: CommandRecord['testStatus'] = null
  let testSource: CommandRecord['testSource'] = null
  if (isTest) {
    testSource = structured?.isTest === true ? 'structure' : 'pattern'
    if (structured?.status) testStatus = structured.status
    else if (exitCode === 0) testStatus = 'passed'
    else if (exitCode === null) testStatus = 'unknown'
    else testStatus = 'failed'
  }
  return {
    ...record,
    command,
    exitCode,
    kind,
    testSource,
    testStatus,
  }
}

/** Aggregate FileChange lists, deduping by path (structured meta wins). */
export function mergeFileChanges(...groups: readonly FileChange[][]): FileChange[] {
  const map = new Map<string, FileChange>()
  for (const group of groups) {
    for (const file of group) {
      const existing = map.get(file.path)
      if (!existing || (!existing.structured && file.structured)) {
        map.set(file.path, file)
      }
    }
  }
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path))
}

export function mergeFileReads(...groups: readonly FileRead[][]): FileRead[] {
  const seen = new Set<string>()
  const out: FileRead[] = []
  for (const group of groups) {
    for (const read of group) {
      const key = `${read.toolName}:${read.path}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push(read)
      }
    }
  }
  return out
}

/** Extract a human-readable command line for a failed/error record (or null). */
export function describeToolCall(record: ToolCallRecord): string {
  const cmd = commandFromArgs(record.args)
  if (cmd) return `${record.name}: ${cmd}`
  return `${record.name}(${record.callId.slice(0, 8)})`
}