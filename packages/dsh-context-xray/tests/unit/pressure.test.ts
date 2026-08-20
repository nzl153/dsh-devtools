import { describe, expect, it } from 'vitest'
import { pressureLevel, DEFAULT_PRESSURE_THRESHOLDS } from '../../src/core/pressure/level.ts'

describe('pressure-level', () => {
  it('returns null when no context window is known', () => {
    expect(pressureLevel({ pressureTokens: 5000, projectedTokens: null, contextWindow: null })).toBeNull()
    expect(pressureLevel({ pressureTokens: null, projectedTokens: null, contextWindow: 100_000 })).toBeNull()
  })

  it('classifies normal below elevated threshold', () => {
    const level = pressureLevel({ pressureTokens: 30_000, projectedTokens: 30_000, contextWindow: 100_000 })
    expect(level).toBe('normal')
  })

  it('classifies elevated between 50% and 75%', () => {
    const level = pressureLevel({ pressureTokens: 60_000, projectedTokens: null, contextWindow: 100_000 })
    expect(level).toBe('elevated')
  })

  it('classifies high between 75% and 90%', () => {
    const level = pressureLevel({ pressureTokens: null, projectedTokens: 80_000, contextWindow: 100_000 })
    expect(level).toBe('high')
  })

  it('classifies critical at or above 90%', () => {
    const level = pressureLevel({ pressureTokens: 95_000, projectedTokens: 95_000, contextWindow: 100_000 })
    expect(level).toBe('critical')
  })

  it('prefers projectedTokens over pressureTokens', () => {
    const level = pressureLevel({ pressureTokens: 20_000, projectedTokens: 80_000, contextWindow: 100_000 })
    expect(level).toBe('high')
  })

  it('honors custom thresholds', () => {
    const level = pressureLevel(
      { pressureTokens: 30_000, projectedTokens: null, contextWindow: 100_000 },
      { ...DEFAULT_PRESSURE_THRESHOLDS, elevated: 20, high: 25, critical: 60 },
    )
    expect(level).toBe('high')
  })
})