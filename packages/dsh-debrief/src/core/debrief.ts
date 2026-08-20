/**
 * Pure debrief engine: deterministic, non-LLM work summaries computed from a
 * normalized session event stream. No DSH imports; unit tests and the E2E
 * script feed the exact same functions.
 */

import type {
  CommandRecord,
  DebriefConfig,
  DebriefEvent,
  FileChange,
  FileRead,
  SessionDebrief,
  ToolCallRecord,
  ToolStat,
  TurnDebrief,
  UnresolvedItem,
} from './types.ts'
import {
  buildCommandRecord,
  changedFilesFromResult,
  commandFromArgs,
  describeToolCall,
  findTodoMarkers,
  mergeFileChanges,
  mergeFileReads,
  readPathsFromCall,
  textFromContent,
  toolCallFromEvent,
  toolResultIntoRecord,
  writePathsFromCall,
} from './events.ts'
import { aggregateTokens, emptyTokens, type TokenInput } from './tokens.ts'

/** A turn boundary, or a synthetic whole-session window. */
interface Window {
  turn: number | null
  startSeq: number
  endSeq: number
  startTime: number
  endTime: number
}

function eventsInWindow(events: readonly DebriefEvent[], window: Window): DebriefEvent[] {
  return events.filter((e) => e.seq >= window.startSeq && e.seq <= window.endSeq)
}

function computeToolStats(records: readonly ToolCallRecord[]): ToolStat[] {
  const map = new Map<string, ToolStat & { _sum: number; _count: number; _slowest: ToolCallRecord | null }>()
  for (const record of records) {
    let stat = map.get(record.name)
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
        _slowest: null,
      }
      map.set(record.name, stat)
    }
    stat.callCount += 1
    if (record.errored) stat.errorCount += 1
    if (record.durationMs !== null) {
      stat._sum += record.durationMs
      stat._count += 1
      stat.totalDurationMs += record.durationMs
    }
    if (stat._slowest === null || (record.durationMs !== null && record.durationMs > (stat._slowest.durationMs ?? 0))) {
      stat._slowest = record
    }
  }
  const out: ToolStat[] = []
  for (const s of map.values()) {
    out.push({
      name: s.name,
      callCount: s.callCount,
      errorCount: s.errorCount,
      totalDurationMs: s.totalDurationMs,
      avgDurationMs: s._count > 0 ? Math.round(s._sum / s._count) : null,
      slowestCallMs: s._slowest?.durationMs ?? null,
      slowestCallCommand: commandFromArgs(s._slowest?.args ?? null) ?? null,
    })
  }
  return out.sort((a, b) => b.totalDurationMs - a.totalDurationMs || b.callCount - a.callCount)
}

function slowestOverall(records: readonly ToolCallRecord[]): ToolCallRecord | null {
  let slowest: ToolCallRecord | null = null
  for (const record of records) {
    if (record.durationMs === null) continue
    if (slowest === null || record.durationMs > (slowest.durationMs ?? 0)) slowest = record
  }
  return slowest
}

interface Analysis {
  records: ToolCallRecord[]
  commands: CommandRecord[]
  changedFiles: FileChange[]
  filesRead: FileRead[]
  unresolved: UnresolvedItem[]
  stepCount: number
  assistantMessageCount: number
}

function analyzeWindow(
  events: readonly DebriefEvent[],
  config: DebriefConfig,
  windowTurn: number | null,
): Analysis {
  const records: ToolCallRecord[] = []
  const byCallId = new Map<string, ToolCallRecord>()
  const changedFiles: FileChange[] = []
  const filesRead: FileRead[] = []
  const todoMarkers: string[] = []
  let stepCount = 0
  let assistantMessageCount = 0

  for (const event of events) {
    const data = event.data
    if (event.type === 'step/start') stepCount += 1
    if (event.type === 'assistant/message') assistantMessageCount += 1

    if (event.type === 'tool/call') {
      const record = toolCallFromEvent(event)
      if (!record) continue
      if (windowTurn !== null && record.turn !== windowTurn) continue
      records.push(record)
      byCallId.set(record.callId, record)
      filesRead.push(...readPathsFromCall(record.name, record.args).map((path) => ({ path, toolName: record.name })))
      changedFiles.push(...writePathsFromCall(record.name, record.args))
    } else if (event.type === 'tool/result') {
      const callId = data.callId
      const record = typeof callId === 'string' ? byCallId.get(callId) : undefined
      if (!record) continue
      toolResultIntoRecord(record, event)
      changedFiles.push(...changedFilesFromResult(record.resultMeta))
      const text = textFromContent(data.message && typeof data.message === 'object'
        ? (data.message as Record<string, unknown>).content
        : undefined)
      if (config.detectTodoMarkers) todoMarkers.push(...findTodoMarkers(text, 20))
    }
  }

  const commands = records
    .map((record) => buildCommandRecord(record, config))
    .filter((record): record is CommandRecord => record !== null)

  const unresolved: UnresolvedItem[] = []
  for (const command of commands) {
    if (command.errored || (command.exitCode !== null && command.exitCode !== 0)) {
      unresolved.push({
        kind: 'failed-command',
        label: `exit ${command.exitCode ?? 'err'} — ${command.command}`,
        detail: describeToolCall(command),
        turn: command.turn,
      })
    }
  }
  for (const marker of todoMarkers) {
    unresolved.push({ kind: 'todo-marker', label: marker, detail: 'TODO/FIXME 标记出现在工具输出中', turn: windowTurn ?? 0 })
  }

  return {
    records,
    commands,
    changedFiles: mergeFileChanges(changedFiles),
    filesRead: mergeFileReads(filesRead),
    unresolved,
    stepCount,
    assistantMessageCount,
  }
}

function notesFor(analysis: Analysis, tokens: ReturnType<typeof aggregateTokens>, commandCount: number): string[] {
  const notes: string[] = []
  if (tokens.usageReports > 0) {
    notes.push('tokens: provider 报告 usage')
  } else {
    notes.push('tokens: 无 provider token 报告（assistant/message 未携带 usage）')
  }
  if (analysis.changedFiles.some((f) => !f.structured)) {
    notes.push('changed files: 部分路径来自 write/edit 工具参数（estimated）')
  }
  if (commandCount === 0) {
    notes.push('commands: 未识别到命令执行')
  }
  return notes
}

function buildTurnDebrief(
  sessionId: string,
  window: Window,
  events: readonly DebriefEvent[],
  config: DebriefConfig,
  tokenInput: TokenInput,
): TurnDebrief {
  const windowed = eventsInWindow(events, window)
  const analysis = analyzeWindow(windowed, config, window.turn)
  const commandCount = analysis.commands.length
  const tests = analysis.commands
    .filter((c) => c.kind === 'test')
    .map((c) => ({
      command: c.command,
      exitCode: c.exitCode,
      status: c.testStatus === 'passed' ? 'passed' as const : c.testStatus === 'failed' ? 'failed' as const : 'unknown' as const,
      turn: c.turn,
    }))
  const tokens = aggregateTokens(windowed, tokenInput)

  return {
    kind: 'turn',
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
    failedCommands: analysis.commands.filter((c) => c.errored || (c.exitCode !== null && c.exitCode !== 0)),
    tests,
    changedFiles: analysis.changedFiles.slice(0, config.maxChangedFiles),
    filesRead: analysis.filesRead.slice(0, config.maxChangedFiles),
    unresolved: analysis.unresolved.slice(0, config.maxUnresolved),
    tokens,
    notes: notesFor(analysis, tokens, commandCount),
  }
}

/** Build the per-turn windows from `turn/start` .. `turn/end` pairs. */
function turnWindows(events: readonly DebriefEvent[]): Window[] {
  const windows: Window[] = []
  let current: Window | null = null
  for (const event of events) {
    if (event.type === 'turn/start') {
      if (current) windows.push(current)
      current = {
        turn: typeof event.data.turn === 'number' ? event.data.turn : 0,
        startSeq: event.seq,
        endSeq: event.seq,
        startTime: event.time,
        endTime: event.time,
      }
    } else if (event.type === 'turn/end') {
      if (current && current.turn === event.data.turn) {
        current.endSeq = event.seq
        current.endTime = event.time
      }
    } else if (current && event.seq > current.endSeq) {
      current.endSeq = event.seq
      current.endTime = event.time
    }
  }
  if (current) windows.push(current)
  return windows
}

/**
 * Compute a debrief for a single turn.
 *
 * The engine looks up the turn's boundary (turn/start..turn/end) for timing,
 * then analyzes all events whose `data.turn` matches. When events carry no
 * `turn` field, it falls back to the window's bounded event range.
 */
export function computeTurnDebrief(
  sessionId: string,
  events: readonly DebriefEvent[],
  turn: number,
  config: DebriefConfig,
  tokenInput: TokenInput = {},
): TurnDebrief {
  const boundary = turnWindows(events).find((w) => w.turn === turn)
  const turnEvents = events.filter((e) => typeof e.data.turn === 'number' && e.data.turn === turn)

  let startSeq: number
  let endSeq: number
  if (turnEvents.length > 0) {
    startSeq = Math.min(...turnEvents.map((e) => e.seq))
    endSeq = Math.max(...turnEvents.map((e) => e.seq))
  } else {
    startSeq = boundary?.startSeq ?? 0
    endSeq = boundary?.endSeq ?? 0
  }
  const startTime = turnEvents[0]?.time ?? boundary?.startTime ?? 0
  const endTime = turnEvents.length > 0
    ? turnEvents[turnEvents.length - 1].time
    : boundary?.endTime ?? startTime

  return buildTurnDebrief(sessionId, {
    turn,
    startSeq,
    endSeq,
    startTime,
    endTime,
  }, events, config, tokenInput)
}

/** Compute a debrief for a whole session. */
export function computeSessionDebrief(
  sessionId: string,
  events: readonly DebriefEvent[],
  config: DebriefConfig,
  tokenInput: TokenInput = {},
): SessionDebrief {
  if (events.length === 0) {
    return {
      kind: 'session',
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
      notes: ['session 无事件'],
    }
  }

  const analysis = analyzeWindow(events, config, null)
  const commandCount = analysis.commands.length
  const tests = analysis.commands
    .filter((c) => c.kind === 'test')
    .map((c) => ({
      command: c.command,
      exitCode: c.exitCode,
      status: c.testStatus === 'passed' ? 'passed' as const : c.testStatus === 'failed' ? 'failed' as const : 'unknown' as const,
      turn: c.turn,
    }))
  const tokens = aggregateTokens(events, tokenInput)

  return {
    kind: 'session',
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
    failedCommands: analysis.commands.filter((c) => c.errored || (c.exitCode !== null && c.exitCode !== 0)),
    tests,
    changedFiles: analysis.changedFiles.slice(0, config.maxChangedFiles),
    filesRead: analysis.filesRead.slice(0, config.maxChangedFiles),
    unresolved: analysis.unresolved.slice(0, config.maxUnresolved),
    tokens,
    notes: notesFor(analysis, tokens, commandCount),
  }
}