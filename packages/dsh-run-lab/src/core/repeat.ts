/**
 * Repeat 汇总：给 A x N / B x N 的多次运行算 success rate 与中位数。
 * 纯函数，可单测。
 */
import type { BranchResult, BranchRun, Metrics, RepeatSummary } from './types.ts'
import { emptyMetrics } from './metrics.ts'

/** 取中位数；空数组或不可比元素返回 null。 */
export function median(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

/** 把多次 BranchRun 聚合成一个 BranchResult（中位数 metrics + summary）。 */
export function aggregateBranchRuns(branch: 'a' | 'b', runs: BranchRun[]): BranchResult {
  const count = runs.length
  const successCount = runs.filter((r) => r.metrics.success).length
  const wallTimes = runs.map((r) => r.metrics.wallTimeMs)
  const toolCalls = runs.map((r) => r.metrics.toolCalls)
  const inputTokens = runs.map((r) => r.metrics.inputTokens)
  const outputTokens = runs.map((r) => r.metrics.outputTokens)
  const perRunTokens = runs
    .map((r) => {
      const a = r.metrics.inputTokens
      const b = r.metrics.outputTokens
      if (a === null || b === null) return null
      return a + b
    })
    .filter((v): v is number => v !== null && Number.isFinite(v))

  const summary: RepeatSummary = {
    count,
    successCount,
    successRate: count === 0 ? 0 : successCount / count,
    medianWallTimeMs: median(wallTimes),
    medianToolCalls: median(toolCalls),
    medianInputTokens: median(inputTokens),
    medianOutputTokens: median(outputTokens),
    medianTokens: median(perRunTokens),
  }

  const agg = emptyMetrics()
  agg.success = count > 0 && successCount === count
  agg.wallTimeMs = summary.medianWallTimeMs
  agg.toolCalls = summary.medianToolCalls
  agg.inputTokens = summary.medianInputTokens
  agg.outputTokens = summary.medianOutputTokens
  // 用最后一次非 null 的 turns/llmCalls/files/diff/errors 等作为聚合展示字段。
  // 需求只要求 success rate + median wall/tool tokens；其余指标保持“尽量展示最后一遍”。
  for (const run of runs) {
    const m = run.metrics
    if (m.turns !== null) agg.turns = m.turns
    if (m.llmCalls !== null) agg.llmCalls = m.llmCalls
    if (m.filesChanged !== null) agg.filesChanged = m.filesChanged
    if (m.diffSize !== null) agg.diffSize = m.diffSize
    if (m.testsPassed !== null) agg.testsPassed = m.testsPassed
    if (m.testsFailed !== null) agg.testsFailed = m.testsFailed
    if (m.testsSkipped !== null) agg.testsSkipped = m.testsSkipped
    if (m.errors !== 0) agg.errors = m.errors
    if (m.retries !== null) agg.retries = m.retries
    if (m.compactionCount !== null) agg.compactionCount = m.compactionCount
  }
  const notes = new Set<string>()
  for (const r of runs) for (const n of r.metrics.notes ?? []) notes.add(n)
  agg.notes = [...notes]

  return {
    branch,
    status: runs.every((r) => r.status !== 'failed') ? 'completed' : 'completed',
    repeat: count,
    runs,
    metrics: agg,
    summary,
    evaluator: runs[runs.length - 1]?.evaluator ?? null,
    outputTail: runs.map((r) => `[run ${r.index}] ${r.outputTail}`).join('\n').slice(-200_000),
    error: runs.find((r) => r.error)?.error ?? null,
  }
}