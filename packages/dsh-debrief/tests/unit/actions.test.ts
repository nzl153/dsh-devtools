import { describe, expect, it } from 'vitest'
import { buildContinuePrompt, summarizeDebrief } from '../../src/core/index.ts'
import type { SessionDebrief } from '../../src/core/types.ts'

function makeSessionDebrief(overrides: Partial<SessionDebrief> = {}): SessionDebrief {
  return {
    kind: 'session',
    sessionId: 's1',
    startedAt: 0,
    endedAt: 1000,
    durationMs: 1000,
    turnCount: 2,
    stepCount: 3,
    assistantMessageCount: 2,
    toolCallCount: 4,
    commandCount: 3,
    toolStats: [],
    slowestToolCall: null,
    commands: [],
    failedCommands: [
      {
        callId: 'c1',
        name: 'bash',
        arguments: '{"cmd":"make build"}',
        args: { cmd: 'make build' },
        turn: 1,
        step: 0,
        startedAt: 10,
        endedAt: 20,
        durationMs: 10,
        errored: false,
        resultMeta: null,
        resultPreview: '[exit code: 2]',
        command: 'make build',
        exitCode: 2,
        kind: 'command',
        testSource: null,
        testStatus: null,
      },
    ],
    tests: [],
    changedFiles: [{ path: 'src/a.ts', kind: 'edit', structured: true }],
    filesRead: [],
    unresolved: [
      { kind: 'failed-command', label: 'make build', detail: 'bash: make build', turn: 1 },
      { kind: 'todo-marker', label: 'TODO cleanup', detail: 'TODO cleanup', turn: 1 },
    ],
    tokens: {
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 15,
      contextPressure: null,
      contextWindow: null,
      usageReports: 1,
      precision: 'exact',
    },
    notes: [],
    ...overrides,
  }
}

describe('actions', () => {
  it('builds a bounded continue prompt with the key unresolved context', () => {
    const draft = buildContinuePrompt(makeSessionDebrief(), { maxChars: 800 })
    expect(draft).toContain('失败命令')
    expect(draft).toContain('make build')
    expect(draft).toContain('相关文件')
    expect(draft).toContain('src/a.ts')
    expect(draft.length).toBeLessThanOrEqual(800)
  })

  it('limits the number of entries in the continue prompt', () => {
    const debrief = makeSessionDebrief({
      failedCommands: Array.from({ length: 20 }, (_, i) => makeSessionDebrief().failedCommands[0]).map((c, i) => ({
        ...c,
        callId: `c${i}`,
        command: `cmd-${i}`,
      })),
      unresolved: Array.from({ length: 30 }, (_, i) => ({
        kind: 'todo-marker' as const,
        label: `todo-${i}`,
        detail: `detail-${i}`,
        turn: 1,
      })),
    })
    const draft = buildContinuePrompt(debrief, { maxUnresolved: 5, maxFailedCommands: 3, maxChangedFiles: 2 })
    expect((draft.match(/cmd-\d/g) ?? []).length).toBe(3)
    expect((draft.match(/todo-\d/g) ?? []).length).toBe(5)
  })

  it('keeps the prompt below the char budget even with many items', () => {
    const debrief = makeSessionDebrief({
      unresolved: Array.from({ length: 50 }, (_, i) => ({
        kind: 'todo-marker' as const,
        label: `long todo ${'x'.repeat(40)}${i}`,
        detail: `long detail ${'y'.repeat(60)}${i}`,
        turn: 1,
      })),
    })
    const draft = buildContinuePrompt(debrief, { maxChars: 300 })
    expect(draft.length).toBeLessThanOrEqual(300)
    expect(draft.endsWith('...')).toBe(true)
  })

  it('produces a deterministic plain-text summary for copy', () => {
    const summary = summarizeDebrief(makeSessionDebrief())
    expect(summary).toContain('Session Debrief')
    expect(summary).toContain('Commands: 3')
    expect(summary).toContain('make build')
  })
})