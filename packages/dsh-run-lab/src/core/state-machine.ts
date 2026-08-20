/**
 * 实验状态机：draft -> prepared -> running -> completed | failed。
 * 纯函数，可单测（不触碰文件系统）。
 */
import type { Experiment, ExperimentStatus } from './types.ts'

/** 校验状态迁移是否合法；非法返回错误信息，合法返回 null。 */
export function transitionError(from: ExperimentStatus, to: ExperimentStatus): string | null {
  const allowed: Record<ExperimentStatus, ExperimentStatus[]> = {
    draft: ['prepared', 'failed'],
    prepared: ['running', 'failed', 'draft'],
    running: ['completed', 'failed'],
    completed: [],
    failed: [],
  }
  return allowed[from]?.includes(to) ? null : `invalid transition ${from} -> ${to}`
}

export function transition(exp: Experiment, to: ExperimentStatus, now: Date = new Date()): Experiment {
  const err = transitionError(exp.status, to)
  if (err) throw new Error(err)
  return { ...exp, status: to, updatedAt: now.toISOString() }
}

/** 实验是否可运行（prepared 或 draft 均可触发 run，运行中会拒绝）。 */
export function canRun(exp: Experiment): boolean {
  return exp.status === 'draft' || exp.status === 'prepared' || exp.status === 'failed'
}

export function canRerun(exp: Experiment): boolean {
  return exp.status === 'completed' || exp.status === 'failed'
}
