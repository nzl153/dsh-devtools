import { describe, it, expect } from 'vitest'
import { emptyMetrics, extractNumber, mergeEvaluatorMetrics, compare } from '../../src/core/metrics.ts'

describe('metrics', () => {
  it('emptyMetrics has all nullable numeric fields', () => {
    const m = emptyMetrics()
    expect(m.success).toBe(false)
    expect(m.wallTimeMs).toBeNull()
    expect(m.turns).toBeNull()
    expect(m.llmCalls).toBeNull()
    expect(m.toolCalls).toBeNull()
    expect(m.inputTokens).toBeNull()
    expect(m.outputTokens).toBeNull()
    expect(m.filesChanged).toBeNull()
    expect(m.diffSize).toBeNull()
    expect(m.testsPassed).toBeNull()
    expect(m.testsFailed).toBeNull()
    expect(m.errors).toBe(0)
    expect(m.retries).toBeNull()
    expect(m.compactionCount).toBeNull()
  })

  it('extractNumber parses commas and underscores', () => {
    expect(extractNumber('input tokens: 1,234', /input\s+tokens:?\s*([0-9,_]+)/i)).toBe(1234)
    expect(extractNumber('turns = 3', /turns?\s*[:=]\s*([0-9]+)/i)).toBe(3)
    expect(extractNumber('nothing here', /input\s+tokens:?\s*([0-9,_]+)/i)).toBeNull()
  })

  it('mergeEvaluatorMetrics fills tests from junit', () => {
    const base = emptyMetrics()
    base.success = true
    const merged = mergeEvaluatorMetrics(base, {
      exitCode: 0,
      junit: { tests: 5, failures: 1, errors: 0, skipped: 0 },
    })
    expect(merged.testsPassed).toBe(5)
    expect(merged.testsFailed).toBe(1)
    expect(merged.success).toBe(false)
  })

  it('compare picks winner on lower wall time', () => {
    const a = emptyMetrics()
    const b = emptyMetrics()
    a.success = true
    b.success = true
    a.wallTimeMs = 1000
    b.wallTimeMs = 2000
    const c = compare(a, b)
    expect(c.winner).toBe('a')
    expect(c.metrics['wallTimeMs'].better).toBe('a')
  })

  it('compare returns incomplete when a branch not completed', () => {
    const a = emptyMetrics()
    const b = emptyMetrics()
    a.wallTimeMs = 1
    b.wallTimeMs = 2
    const c = compare(a, b, 'failed', 'completed')
    expect(c.winner).toBe('incomplete')
  })
})
