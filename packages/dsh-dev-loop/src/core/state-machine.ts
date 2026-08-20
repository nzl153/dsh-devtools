// dsh-dev-loop：命令状态机 —— 纯逻辑，可单测。
// 状态：idle → running → succeeded | failed | cancelled。

import type { CommandRun, CommandStatus, Transition } from './types.ts'

export type CommandStateMachine = {
  state(): CommandStatus
  canStart(): boolean
  start(): Transition
  finish(exitCode: number): Transition
  cancel(): Transition
}

/** 合法的状态转移表。 */
const ALLOWED: Record<CommandStatus, ReadonlySet<CommandStatus>> = {
  idle: new Set(['running']),
  running: new Set(['succeeded', 'failed', 'cancelled']),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
}

export function transition(from: CommandStatus, to: CommandStatus): Transition {
  if (from === to) return { ok: false, error: `状态已是 ${from}` }
  if (!ALLOWED[from].has(to)) return { ok: false, error: `非法转移 ${from} -> ${to}` }
  return { ok: true }
}

/**
 * 用不可变方式推进一个 run 的状态。保持 run 结构稳定（只改字段），
 * 输出/日志等由外部填充。
 */
export function applyState(run: CommandRun, to: CommandStatus, patch: Partial<Pick<CommandRun, 'exitCode' | 'cancelled' | 'startedAt' | 'endedAt' | 'durationMs'>>): { run: CommandRun; transition: Transition } {
  const t = transition(run.status, to)
  if (!t.ok) return { run, transition: t }
  const next: CommandRun = { ...run, ...patch, status: to }
  if (to === 'running') {
    next.startedAt = next.startedAt ?? Date.now()
    next.endedAt = null
  } else if (to === 'succeeded' || to === 'failed' || to === 'cancelled') {
    next.endedAt = next.endedAt ?? Date.now()
    if (next.startedAt != null) next.durationMs = next.endedAt - next.startedAt
  }
  return { run: next, transition: t }
}

/** 创建带状态的机具（面向 host runner 的便捷接口）。 */
export function createStateMachine(initial: CommandStatus = 'idle'): CommandStateMachine {
  let status: CommandStatus = initial
  return {
    state: () => status,
    canStart: () => status === 'idle',
    start: () => {
      const t = transition(status, 'running')
      if (t.ok) status = 'running'
      return t
    },
    finish: (exitCode: number) => {
      const to: CommandStatus = exitCode === 0 ? 'succeeded' : 'failed'
      const t = transition(status, to)
      if (t.ok) status = to
      return t
    },
    cancel: () => {
      const t = transition(status, 'cancelled')
      if (t.ok) status = 'cancelled'
      return t
    },
  }
}
