import { describe, expect, it } from 'vitest'
import type { TurnPoint } from '../../src/core/types.ts'
import {
  diffTurns,
  explanationKeyForCategory,
  formatSignedTokens,
  formatTokens,
} from '../../src/core/turn-diff/diff.ts'

const prev: TurnPoint = {
  turn: 1,
  totalTokens: 1000,
  categories: [
    { key: 'conversation', label: 'Conversation', tokens: 500, precision: 'estimated' },
    { key: 'system', label: 'System Prompt', tokens: 200, precision: 'estimated' },
  ],
  toolCalls: [],
}

const next: TurnPoint = {
  turn: 2,
  totalTokens: 1600,
  categories: [
    { key: 'conversation', label: 'Conversation', tokens: 800, precision: 'estimated' },
    { key: 'system', label: 'System Prompt', tokens: 220, precision: 'estimated' },
    { key: 'tools', label: 'Tool Schemas', tokens: 580, precision: 'estimated' },
  ],
  toolCalls: ['bash'],
}

describe('turn-diff', () => {
  it('computes deltas and total delta', () => {
    const diff = diffTurns(prev, next)
    expect(diff.totalDelta).toBe(900)
    expect(diff.deltas.find((d) => d.key === 'conversation')?.delta).toBe(300)
    expect(diff.deltas.find((d) => d.key === 'tools')?.delta).toBe(580)
  })

  it('summarizes major gain sorted desc', () => {
    const diff = diffTurns(prev, next)
    expect(diff.majorGain[0]).toContain('tool schemas')
    expect(diff.majorGain[1]).toContain('conversation')
  })

  it('formats tokens', () => {
    expect(formatTokens(500)).toBe('500')
    expect(formatTokens(1500)).toBe('1.5k')
    expect(formatTokens(150000)).toBe('150k')
  })

  it('formats signed tokens for the history list', () => {
    expect(formatSignedTokens(0)).toBe('±0')
    expect(formatSignedTokens(3000)).toBe('+3k')
    expect(formatSignedTokens(-1500)).toBe('-1.5k')
  })

  it('attaches explanation keys for every delta category', () => {
    const diff = diffTurns(prev, next)
    expect(diff.deltas.find((d) => d.key === 'conversation')?.explanationKey).toBe('delta.conversation')
    expect(diff.deltas.find((d) => d.key === 'tools')?.explanationKey).toBe('delta.tools')
  })

  it('maps unknown categories to a generic explanation key', () => {
    expect(explanationKeyForCategory('unknown-category')).toBe('delta.other')
  })
})