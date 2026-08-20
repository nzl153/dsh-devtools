import { describe, it, expect } from 'vitest'
import { median, aggregateBranchRuns } from '../../src/core/repeat.ts'
import { emptyMetrics } from '../../src/core/metrics.ts'
import type { BranchRun } from '../../src/core/types.ts'

function run(index: number, opts: {
  success?: boolean
  wallTimeMs?: number | null
  toolCalls?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
}): BranchRun {
  const m = emptyMetrics()
  m.success = opts.success ?? true
  m.wallTimeMs = opts.wallTimeMs ?? null
  m.toolCalls = opts.toolCalls ?? null
  m.inputTokens = opts.inputTokens ?? null
  m.outputTokens = opts.outputTokens ?? null
  return { index, status: 'completed', metrics: m, evaluator: null, outputTail: '', agent: null, error: null }
}

describe('repeat', () => {
  it('median returns middle/sum of middle pair', () => {
    expect(median([])).toBeNull()
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([null, 5, null])).toBe(5)
  })

  it('aggregateBranchRuns computes success rate and medians', () => {
    const runs = [
      run(0, { success: true, wallTimeMs: 300, toolCalls: 9, inputTokens: 900, outputTokens: 100 }),
      run(1, { success: true, wallTimeMs: 100, toolCalls: 5, inputTokens: 700, outputTokens: 300 }),
      run(2, { success: false, wallTimeMs: 200, toolCalls: 7, inputTokens: 800, outputTokens: 200 }),
    ]
    const agg = aggregateBranchRuns('a', runs)
    expect(agg.repeat).toBe(3)
    expect(agg.summary.successCount).toBe(2)
    expect(agg.summary.successRate).toBeCloseTo(2 / 3)
    expect(agg.summary.medianWallTimeMs).toBe(200)
    expect(agg.summary.medianToolCalls).toBe(7)
    expect(agg.summary.medianInputTokens).toBe(800)
    expect(agg.summary.medianOutputTokens).toBe(200)
    expect(agg.summary.medianTokens).toBe(1000)
    expect(agg.metrics.success).toBe(false)
    expect(agg.metrics.wallTimeMs).toBe(200)
  })

  it('aggregate handles missing metrics as null', () => {
    const agg = aggregateBranchRuns('b', [run(0, { success: true })])
    expect(agg.summary.successRate).toBe(1)
    expect(agg.summary.medianWallTimeMs).toBeNull()
    expect(agg.summary.medianToolCalls).toBeNull()
    expect(agg.summary.medianTokens).toBeNull()
  })
})