import { describe, it, expect } from 'vitest'
import { transition, applyState, createStateMachine } from '../../src/core/state-machine.ts'
import type { CommandRun } from '../../src/core/types.ts'

function makeRun(overrides: Partial<CommandRun> = {}): CommandRun {
  return {
    id: 'r1',
    project: 'R:/x',
    action: 'build',
    command: 'node x',
    status: 'idle',
    exitCode: null,
    cancelled: false,
    durationMs: 0,
    startedAt: null,
    endedAt: null,
    output: '',
    logFile: null,
    lastError: null,
    ...overrides,
  }
}

describe('state machine transitions', () => {
  it('legal transitions', () => {
    expect(transition('idle', 'running').ok).toBe(true)
    expect(transition('running', 'succeeded').ok).toBe(true)
    expect(transition('running', 'failed').ok).toBe(true)
    expect(transition('running', 'cancelled').ok).toBe(true)
  })

  it('illegal transitions', () => {
    expect(transition('idle', 'succeeded').ok).toBe(false)
    expect(transition('succeeded', 'failed').ok).toBe(false)
    expect(transition('cancelled', 'running').ok).toBe(false)
  })

  it('applyState fills timestamps/duration', () => {
    const start = Date.now()
    const r1 = applyState(makeRun(), 'running', { startedAt: start }).run
    expect(r1.status).toBe('running')
    expect(r1.startedAt).toBe(start)
    const r2 = applyState(r1, 'succeeded', { exitCode: 0, endedAt: start + 1000 }).run
    expect(r2.status).toBe('succeeded')
    expect(r2.exitCode).toBe(0)
    expect(r2.durationMs).toBe(1000)
  })

  it('createStateMachine rejects invalid start-from-terminal', () => {
    const sm = createStateMachine('succeeded')
    expect(sm.canStart()).toBe(false)
    expect(sm.start().ok).toBe(false)
  })
})
