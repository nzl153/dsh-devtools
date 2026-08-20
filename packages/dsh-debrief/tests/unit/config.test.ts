import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, normalizeConfig, isTriggerMode } from '../../src/core/index.ts'

describe('config', () => {
  it('normalizes unknown/missing fields to safe defaults', () => {
    const { config, warnings } = normalizeConfig({})
    expect(config.triggerMode).toBe(DEFAULT_CONFIG.triggerMode)
    expect(config.turnInterval).toBe(1)
    expect(config.commandToolNames).toEqual(DEFAULT_CONFIG.commandToolNames)
    expect(warnings).toEqual([])
  })

  it('recognizes valid trigger modes', () => {
    expect(isTriggerMode('off')).toBe(true)
    expect(isTriggerMode('session-only')).toBe(true)
    expect(isTriggerMode('every-n-turns')).toBe(true)
    expect(isTriggerMode('on-completion')).toBe(true)
    expect(isTriggerMode('party-time')).toBe(false)
  })

  it('filters invalid regex patterns without throwing', () => {
    const { config, warnings } = normalizeConfig({
      testCommandPatterns: ['pytest', '(unclosed', 'pnpm test'],
    })
    expect(config.testCommandPatterns).toContain('pytest')
    expect(config.testCommandPatterns).toContain('pnpm test')
    expect(config.testCommandPatterns.some((p) => p === '(unclosed')).toBe(false)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('uses user command tool names when provided', () => {
    const { config } = normalizeConfig({ commandToolNames: ['nix-shell'] })
    expect(config.commandToolNames).toEqual(['nix-shell'])
  })

  it('clamps numeric fields', () => {
    const { config } = normalizeConfig({ turnInterval: 0, maxFailedCommands: 99999 })
    expect(config.turnInterval).toBe(1)
    expect(config.maxFailedCommands).toBe(200)
  })
})