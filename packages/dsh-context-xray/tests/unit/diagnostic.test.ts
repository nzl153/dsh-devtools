import { describe, expect, it } from 'vitest'
import { buildDiagnostic } from '../../src/core/diagnostic/diagnostic.ts'
import type { ContextSnapshot, PressureThresholds, SessionHistory } from '../../src/core/types.ts'

const snapshot: ContextSnapshot = {
  sessionId: 's1',
  turn: 2,
  generatedAt: '2026-01-01T00:00:00.000Z',
  totalTokens: 10_000,
  contextWindow: 100_000,
  pressure: {
    pressureTokens: 10_000,
    projectedTokens: 12_000,
    contextWindow: 100_000,
    level: 'normal',
  },
  categories: [
    { key: 'conversation', label: 'Conversation', tokens: 5000, precision: 'estimated' },
    { key: 'tools', label: 'Tool Schemas', tokens: 3000, precision: 'estimated' },
  ],
  sections: [
    { id: 'harness:identity', source: 'harness', order: -100, tokens: 100, stable: true, preview: 'You are…' },
    {
      id: 'tool:bash',
      source: 'tool',
      order: 100,
      tokens: 200,
      stable: false,
      preview: 'Bash guidance',
      body: 'SECRET FULL BODY MUST NOT LEAK',
    },
  ],
  tools: [
    {
      name: 'bash',
      tokens: 100,
      schema: { name: 'bash' },
      source: 'builtin',
      calledThisTurn: true,
      calledEver: true,
      callCount: 3,
      lastCalledAt: '2026-01-01T00:00:01.000Z',
    },
  ],
  source: [],
}

const history: SessionHistory = {
  sessionId: 's1',
  entries: [
    { turn: 1, totalTokens: 8000, categories: [], toolCalls: [] },
    { turn: 2, totalTokens: 10_000, categories: [], toolCalls: ['bash'] },
  ],
}

const thresholds: PressureThresholds = { elevated: 50, high: 75, critical: 90 }

describe('diagnostic export', () => {
  it('builds a sanitized export without prompt bodies', () => {
    const diagnostic = buildDiagnostic({
      snapshot,
      history,
      dshVersion: '1.2.3',
      pluginVersion: '1.0.0',
      pressureThresholds: thresholds,
      generatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(diagnostic.schemaVersion).toBe(1)
    expect(diagnostic.dshVersion).toBe('1.2.3')
    expect(diagnostic.pluginVersion).toBe('1.0.0')
    expect(diagnostic.context.pressureLevel).toBe('normal')
    expect(diagnostic.sections).toHaveLength(2)
    expect(diagnostic.sections[1].id).toBe('tool:bash')
    expect(diagnostic.tools[0].callCount).toBe(3)
    expect(diagnostic.history?.entries).toHaveLength(2)
  })

  it('never includes section bodies or raw preview text content of full bodies', () => {
    const diag = buildDiagnostic({ snapshot, history: null, dshVersion: 'x', pluginVersion: 'y', pressureThresholds: thresholds })
    const serialized = JSON.stringify(diag)
    expect(serialized).not.toContain('SECRET FULL BODY MUST NOT LEAK')
    expect(serialized).not.toContain('body')
  })

  it('defaults unknown versions to "unknown"', () => {
    const diag = buildDiagnostic({
      snapshot,
      history: null,
      dshVersion: '',
      pluginVersion: '',
      pressureThresholds: thresholds,
    })
    expect(diag.dshVersion).toBe('unknown')
    expect(diag.pluginVersion).toBe('unknown')
  })
})