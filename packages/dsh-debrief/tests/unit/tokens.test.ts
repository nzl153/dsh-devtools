import { describe, expect, it } from 'vitest'
import { aggregateTokens, mergeTokenTotals, formatDuration, formatTokens } from '../../src/core/index.ts'
import type { DebriefEvent } from '../../src/core/types.ts'

function message(seq: number, usage?: object): DebriefEvent {
  return {
    seq,
    time: 1000 + seq,
    type: 'assistant/message',
    data: {
      turn: 1,
      step: 0,
      message: { id: `m${seq}`, role: 'assistant', content: [], source: { kind: 'model', provider: 'x', model: 'y' } },
      ...(usage ? { usage } : {}),
    },
  }
}

describe('tokens', () => {
  it('sums provider usage buckets', () => {
    const events = [
      message(1, { inputTokens: 10, outputTokens: 5 }),
      message(2, { inputTokens: 100, outputTokens: 20, cacheReadTokens: 7, cacheWriteTokens: 3 }),
    ]
    const totals = aggregateTokens(events)
    expect(totals.inputTokens).toBe(110)
    expect(totals.outputTokens).toBe(25)
    expect(totals.cacheReadTokens).toBe(7)
    expect(totals.cacheWriteTokens).toBe(3)
    expect(totals.totalTokens).toBe(145)
    expect(totals.usageReports).toBe(2)
    expect(totals.precision).toBe('exact')
  })

  it('ignores messages without usage', () => {
    const totals = aggregateTokens([message(1)])
    expect(totals.usageReports).toBe(0)
    expect(totals.precision).toBe('unavailable')
  })

  it('merges totals with last-wins context fields', () => {
    const a = aggregateTokens([message(1, { inputTokens: 1, outputTokens: 1 })], { contextPressure: 100, contextWindow: 200 })
    const b = aggregateTokens([message(2, { inputTokens: 2, outputTokens: 2 })], { contextPressure: 150, contextWindow: 250 })
    const merged = mergeTokenTotals(a, b)
    expect(merged.inputTokens).toBe(3)
    expect(merged.contextPressure).toBe(150)
    expect(merged.contextWindow).toBe(250)
  })
})

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(61_000)).toBe('1m 1s')
  })

  it('formats tokens', () => {
    expect(formatTokens(500)).toBe('500')
    expect(formatTokens(1500)).toBe('1.5k')
    expect(formatTokens(1_500_000)).toBe('1.5M')
  })
})