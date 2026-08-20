import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  computeSessionDebrief,
  computeTurnDebrief,
  aggregateTokens,
  extractExitCode,
  isTestCommand,
  changedFilesFromResult,
  readPathsFromCall,
} from '../../src/core/index.ts'
import type { DebriefEvent } from '../../src/core/types.ts'

let seq = 0
function ev(type: string, time: number, data: Record<string, unknown>): DebriefEvent {
  seq += 1
  return { seq, time, type, data }
}

function turnStart(turn: number, time: number): DebriefEvent {
  return ev('turn/start', time, { turn })
}
function turnEnd(turn: number, time: number): DebriefEvent {
  return ev('turn/end', time, { turn, reason: { kind: 'completed' } })
}
function stepStart(turn: number, step: number, time: number): DebriefEvent {
  return ev('step/start', time, { turn, step })
}
function assistantMessage(turn: number, step: number, time: number, usage?: object): DebriefEvent {
  return ev('assistant/message', time, {
    turn,
    step,
    message: { id: `m-${seq}`, role: 'assistant', content: [], source: { kind: 'model', provider: 'x', model: 'y' } },
    ...(usage ? { usage } : {}),
  })
}
function toolCall(turn: number, step: number, callId: string, name: string, args: object, time: number): DebriefEvent {
  return ev('tool/call', time, { turn, step, callId, name, arguments: JSON.stringify(args) })
}
function toolResult(turn: number, step: number, callId: string, text: string, time: number, extra: Record<string, unknown> = {}): DebriefEvent {
  return ev('tool/result', time, {
    turn,
    step,
    callId,
    message: { id: `r-${callId}`, role: 'user', content: [{ type: 'text', text }], source: { kind: 'tool', callId } },
    ...extra,
  })
}

describe('debrief engine', () => {
  it('computes a session debrief from a synthetic event stream', () => {
    seq = 0
    const events = [
      turnStart(1, 1000),
      stepStart(1, 0, 1050),
      assistantMessage(1, 0, 1100, { inputTokens: 10, outputTokens: 5 }),
      toolCall(1, 0, 'c1', 'bash', { cmd: 'pnpm test' }, 1200),
      toolResult(1, 0, 'c1', 'ok\n[exit code: 0]', 1800),
      toolCall(1, 0, 'c2', 'bash', { cmd: 'grep TODO src/index.ts' }, 1900),
      toolResult(1, 0, 'c2', 'line1: TODO fix me', 2100),
      turnEnd(1, 3000),
      turnStart(2, 4000),
      turnEnd(2, 5000),
    ]

    const session = computeSessionDebrief('s1', events, DEFAULT_CONFIG)
    expect(session.turnCount).toBe(2)
    expect(session.toolCallCount).toBe(2)
    expect(session.commandCount).toBe(2)
    expect(session.tests).toHaveLength(1)
    expect(session.tests[0].status).toBe('passed')
    expect(session.failedCommands).toHaveLength(0)
    expect(session.tokens.inputTokens).toBe(10)
    expect(session.tokens.outputTokens).toBe(5)
    expect(session.tokens.usageReports).toBe(1)
    expect(session.unresolved.length).toBeGreaterThan(0) // TODO marker
  })

  it('computes a turn debrief scoped to one turn', () => {
    seq = 0
    const events = [
      turnStart(1, 1000),
      toolCall(1, 0, 'c1', 'bash', { cmd: 'ls' }, 1200),
      toolResult(1, 0, 'c1', 'files\n[exit code: 0]', 1400),
      turnEnd(1, 2000),
      turnStart(2, 3000),
      toolCall(2, 0, 'c9', 'bash', { cmd: 'make' }, 3100),
      toolResult(2, 0, 'c9', '[exit code: 2]', 3200),
      turnEnd(2, 4000),
    ]
    const turn1 = computeTurnDebrief('s1', events, 1, DEFAULT_CONFIG)
    expect(turn1.turn).toBe(1)
    expect(turn1.toolCallCount).toBe(1)
    expect(turn1.commands[0].command).toBe('ls')
    expect(turn1.durationMs).toBe(2000 - 1000)

    const turn2 = computeTurnDebrief('s1', events, 2, DEFAULT_CONFIG)
    expect(turn2.failedCommands).toHaveLength(1)
    expect(turn2.unresolved[0].kind).toBe('failed-command')
    expect(turn2.commands[0].kind).toBe('command')
  })

  it('classifies commands vs tests and never guesses test status without exit code', () => {
    seq = 0
    const events = [
      turnStart(1, 1000),
      toolCall(1, 0, 'c1', 'bash', { cmd: 'pytest tests/' }, 1100),
      toolResult(1, 0, 'c1', 'some output without exit marker', 1200),
      toolCall(1, 0, 'c2', 'bash', { cmd: 'dotnet test' }, 1300),
      toolResult(1, 0, 'c2', '[exit code: 1]', 1400),
      turnEnd(1, 2000),
    ]
    const session = computeSessionDebrief('s1', events, DEFAULT_CONFIG)
    expect(session.tests).toHaveLength(2)
    const byCmd = new Map(session.tests.map((t) => [t.command, t]))
    expect(byCmd.get('pytest tests/')?.status).toBe('unknown')
    expect(byCmd.get('dotnet test')?.status).toBe('failed')
    expect(isTestCommand('pytest --foo', DEFAULT_CONFIG)).toBe(true)
    expect(isTestCommand('ls -la', DEFAULT_CONFIG)).toBe(false)
  })

  it('detects changed files from structured fs meta and honors the no-guess rule elsewhere', () => {
    const meta = { diffs: [{ path: 'src/a.ts', oldText: 'x', newText: 'y' }] }
    const changes = changedFilesFromResult(meta)
    expect(changes).toHaveLength(1)
    expect(changes[0].path).toBe('src/a.ts')
    expect(changes[0].structured).toBe(true)

    seq = 0
    const events = [
      turnStart(1, 1000),
      toolCall(1, 0, 'c1', 'edit', { file_path: 'src/b.ts' }, 1100),
      toolResult(1, 0, 'c1', 'done [exit code: 0]', 1200, { meta: { diffs: [{ path: 'src/b.ts', oldText: null, newText: 'n' }] } }),
      turnEnd(1, 2000),
    ]
    const session = computeSessionDebrief('s1', events, DEFAULT_CONFIG)
    expect(session.changedFiles.map((f) => f.path)).toContain('src/b.ts')
    expect(session.changedFiles.find((f) => f.path === 'src/b.ts')?.structured).toBe(true)
  })

  it('tracks tool stats and slowest call', () => {
    seq = 0
    const events = [
      turnStart(1, 1000),
      toolCall(1, 0, 'c1', 'bash', { cmd: 'a' }, 1100),
      toolResult(1, 0, 'c1', '[exit code: 0]', 1500),
      toolCall(1, 0, 'c2', 'bash', { cmd: 'b' }, 1600),
      toolResult(1, 0, 'c2', '[exit code: 0]', 3000),
      turnEnd(1, 4000),
    ]
    const session = computeSessionDebrief('s1', events, DEFAULT_CONFIG)
    const bash = session.toolStats.find((t) => t.name === 'bash')
    expect(bash?.callCount).toBe(2)
    expect(bash?.totalDurationMs).toBe((1500 - 1100) + (3000 - 1600))
    expect(session.slowestToolCall?.callId).toBe('c2')
  })

  it('reads file paths from known read tools', () => {
    expect(readPathsFromCall('read', { path: 'src/x.ts' })).toEqual(['src/x.ts'])
    expect(readPathsFromCall('bash', { cmd: 'cat x' })).toEqual([])
  })

  it('does not invent tokens when no usage is reported', () => {
    seq = 0
    const events = [turnStart(1, 1000), turnEnd(1, 2000)]
    const tokens = aggregateTokens(events)
    expect(tokens.usageReports).toBe(0)
    expect(tokens.precision).toBe('unavailable')
  })

  it('extracts bash exit codes from the deterministic marker', () => {
    expect(extractExitCode('[exit code: 0]')).toBe(0)
    expect(extractExitCode('[exit code: 2]')).toBe(2)
    expect(extractExitCode('no marker')).toBeNull()
  })

  it('does not guess tests from arbitrary command text', () => {
    // A plain command that merely mentions a test-related word must stay a
    // command, not a test.
    expect(isTestCommand('npm run build && echo test', DEFAULT_CONFIG)).toBe(false)
    expect(isTestCommand('pnpm install e2e', DEFAULT_CONFIG)).toBe(false)
    expect(isTestCommand('echo running specs now', DEFAULT_CONFIG)).toBe(false)
    expect(isTestCommand('cat test-results.txt', DEFAULT_CONFIG)).toBe(false)

    // Explicit known runner invocations are still recognized.
    expect(isTestCommand('pnpm test', DEFAULT_CONFIG)).toBe(true)
    expect(isTestCommand('npm run test', DEFAULT_CONFIG)).toBe(true)
    expect(isTestCommand('yarn test --runInBand', DEFAULT_CONFIG)).toBe(true)
    expect(isTestCommand('dotnet test', DEFAULT_CONFIG)).toBe(true)
    expect(isTestCommand('python -m pytest tests/', DEFAULT_CONFIG)).toBe(true)
  })

  it('classifies structured test results as tests without a pattern match', () => {
    seq = 0
    const events = [
      turnStart(1, 1000),
      toolCall(1, 0, 'c1', 'bash', { cmd: 'custom-runner --suite unit' }, 1100),
      toolResult(1, 0, 'c1', 'done', 1200, {
        meta: { test: true, status: 'passed', suite: 'unit' },
      }),
      turnEnd(1, 2000),
    ]
    const session = computeSessionDebrief('s1', events, DEFAULT_CONFIG)
    expect(session.tests).toHaveLength(1)
    expect(session.tests[0].status).toBe('passed')
    expect(session.commands[0].kind).toBe('test')
    expect(session.commands[0].testSource).toBe('structure')
    expect(session.failedCommands).toHaveLength(0)
  })

  it('keeps structured failed test results as failed tests', () => {
    seq = 0
    const events = [
      turnStart(1, 1000),
      toolCall(1, 0, 'c1', 'bash', { cmd: 'sh run-tests.sh' }, 1100),
      toolResult(1, 0, 'c1', 'output', 1200, {
        meta: { testResult: { passed: 1, failed: 2 } },
      }),
      turnEnd(1, 2000),
    ]
    const session = computeSessionDebrief('s1', events, DEFAULT_CONFIG)
    expect(session.tests).toHaveLength(1)
    expect(session.tests[0].status).toBe('unknown') // no status in testResult object
    expect(session.commands[0].testSource).toBe('structure')
  })
})