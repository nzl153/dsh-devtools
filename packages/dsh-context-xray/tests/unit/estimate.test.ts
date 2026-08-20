import { describe, expect, it } from 'vitest'
import { estimateBlocks, estimateJson, estimateMessage, estimateText } from '../../src/core/token-metrics/estimate.ts'

describe('estimate', () => {
  it('prices text using the official 4-char-per-token rule', () => {
    expect(estimateText('abcd')).toBe(5)
    expect(estimateText('')).toBe(4)
  })

  it('prices JSON with structural overhead', () => {
    expect(estimateJson({ a: 1 })).toBe(Math.ceil(JSON.stringify({ a: 1 }).length / 4) + 4)
  })

  it('prices message content blocks', () => {
    const tokens = estimateMessage({
      content: [
        { type: 'text', text: 'hello world' },
        { type: 'tool-call', name: 'bash', arguments: '{"cmd":"ls"}' },
      ],
    })
    expect(tokens).toBeGreaterThan(0)
    expect(estimateMessage(null)).toBe(0)
  })

  it('handles unknown blocks', () => {
    const tokens = estimateBlocks([{ type: 'image', foo: 'bar' }])
    expect(tokens).toBeGreaterThan(0)
  })
})