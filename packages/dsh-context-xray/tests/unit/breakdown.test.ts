import { describe, expect, it } from 'vitest'
import { analyze, classifyMessage, sectionSourceOf, toolSourceOf, type CoreAnalyzerInput } from '../../src/core/analyzer/breakdown.ts'

const baseInput: CoreAnalyzerInput = {
  sessionId: 's1',
  turn: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  providerTotalTokens: null,
  contextWindow: null,
  pressureTokens: null,
  projectedTokens: null,
  assembly: {
    sections: [
      { name: 'harness:identity', order: -100, text: 'You are an AI agent powered by DeepSeek Harness.' },
      { name: 'tool:bash', order: 100, text: 'Bash guidance' },
    ],
    contexts: [{ name: 'runtime', text: 'Current time' }],
    tools: [
      { name: 'bash', description: 'Run shell', parameters: { type: 'object' } },
      { name: 'mcp__foo', description: 'Foo', parameters: {} },
    ],
  },
  messages: [
    { seq: 1, role: 'user', source: { kind: 'agent-instructions' }, content: [{ type: 'text', text: 'AGENTS instructions here' }] },
    { seq: 2, role: 'user', content: [{ type: 'text', text: 'hello' }] },
    { seq: 3, role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
    { seq: 4, role: 'user', source: { kind: 'skill-catalog' }, content: [{ type: 'text', text: 'skill catalog body' }] },
    { seq: 5, role: 'user', content: [{ type: 'image', media: 'x' }] },
  ],
  calledThisTurn: ['bash'],
  calledEver: ['bash'],
  calls: [
    { name: 'bash', turn: 1, time: 1000 },
    { name: 'bash', turn: 1, time: 500 },
    { name: 'mcp__foo', turn: 0, time: 200 },
  ],
}

describe('breakdown', () => {
  it('classifies messages by source kind', () => {
    expect(classifyMessage(baseInput.messages[0])).toBe('workspace')
    expect(classifyMessage(baseInput.messages[1])).toBe('conversation')
    expect(classifyMessage(baseInput.messages[3])).toBe('skills')
    expect(classifyMessage(baseInput.messages[4])).toBe('attachments')
  })

  it('maps section names to sources', () => {
    expect(sectionSourceOf('harness:identity')).toBe('harness')
    expect(sectionSourceOf('deployment:persona')).toBe('deployment')
    expect(sectionSourceOf('tool:bash')).toBe('tool')
    expect(sectionSourceOf('my-plugin:section')).toBe('plugin')
  })

  it('guesses tool sources conservatively', () => {
    expect(toolSourceOf('mcp__x')).toBe('mcp')
    expect(toolSourceOf('bash')).toBe('builtin')
    expect(toolSourceOf('my_tool')).toBe('plugin')
  })

  it('produces categories with estimated tokens', () => {
    const snap = analyze(baseInput)
    expect(snap.categories.length).toBeGreaterThan(1)
    const keys = snap.categories.map((c) => c.key)
    expect(keys).toContain('workspace')
    expect(keys).toContain('conversation')
    expect(keys).toContain('skills')
    expect(keys).toContain('attachments')
    expect(keys).toContain('system')
    expect(keys).toContain('tools')
    expect(snap.tools.some((t) => t.name === 'bash' && t.calledThisTurn)).toBe(true)
    expect(snap.sections.length).toBe(2)
    expect(snap.source.length).toBeGreaterThan(0)
  })

  it('computes residual other when provider total is given', () => {
    const snap = analyze({ ...baseInput, providerTotalTokens: 100000 })
    const other = snap.categories.find((c) => c.key === 'other')
    expect(other?.tokens).toBeGreaterThan(0)
  })

  it('reports tool call counts and last call time from call events', () => {
    const snap = analyze(baseInput)
    const bash = snap.tools.find((t) => t.name === 'bash')
    const foo = snap.tools.find((t) => t.name === 'mcp__foo')
    expect(bash?.callCount).toBe(2)
    expect(bash?.lastCalledAt).toBe(new Date(1000).toISOString())
    expect(bash?.calledThisTurn).toBe(true)
    expect(foo?.callCount).toBe(1)
    expect(foo?.lastCalledAt).toBe(new Date(200).toISOString())
  })

  it('computes pressure info from provider metrics', () => {
    const snap = analyze({
      ...baseInput,
      providerTotalTokens: 90_000,
      pressureTokens: 90_000,
      projectedTokens: 95_000,
      contextWindow: 100_000,
    })
    expect(snap.pressure.pressureTokens).toBe(90_000)
    expect(snap.pressure.projectedTokens).toBe(95_000)
    expect(snap.pressure.level).toBe('critical')
  })
})