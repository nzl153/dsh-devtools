// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DebriefBody } from '../../src/client/components/DebriefBody.tsx'
import { shouldShowTurn, defaultCollapsedFor } from '../../src/client/index.tsx'
import type { DebriefSettingsLike, SessionDebrief } from '../../src/core/types.ts'

const t = (key: string): string => key

function makeSessionDebrief(): SessionDebrief {
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
    unresolved: [{ kind: 'failed-command', label: 'make build', detail: 'bash: make build', turn: 1 }],
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
  }
}

describe('conversation card rendering smoke', () => {
  it('renders action buttons for files, failed commands, and continue', () => {
    const html = renderToStaticMarkup(
      <DebriefBody debrief={makeSessionDebrief()} t={t} onContinue={() => {}} />,
    )
    expect(html).toContain('viewFiles')
    expect(html).toContain('viewFailed')
    expect(html).toContain('continueWork')
    expect(html).toContain('copySummary')
  })

  it('renders no continue button when no open handler is supplied', () => {
    const html = renderToStaticMarkup(
      <DebriefBody debrief={makeSessionDebrief()} t={t} />,
    )
    expect(html).toContain('copySummary')
    expect(html).not.toContain('continueWork')
  })

  it('shows a low-interference card in session-only mode', () => {
    const settings: DebriefSettingsLike = {
      triggerMode: 'session-only',
      turnInterval: 1,
      testCommandPatterns: [],
      detectTodoMarkers: true,
    }
    expect(shouldShowTurn(settings, 2)).toBe(true)
    expect(defaultCollapsedFor(settings)).toBe(true)
  })

  it('respects every-n-turns and off modes', () => {
    const settings: DebriefSettingsLike = {
      triggerMode: 'every-n-turns',
      turnInterval: 3,
      testCommandPatterns: [],
      detectTodoMarkers: true,
    }
    expect(shouldShowTurn(settings, 3)).toBe(true)
    expect(shouldShowTurn(settings, 4)).toBe(false)
    expect(defaultCollapsedFor(settings)).toBe(false)

    const off: DebriefSettingsLike = {
      triggerMode: 'off',
      turnInterval: 1,
      testCommandPatterns: [],
      detectTodoMarkers: true,
    }
    expect(shouldShowTurn(off, 1)).toBe(false)
  })
})