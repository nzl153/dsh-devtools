/**
 * Pure context-breakdown analyzer.
 *
 * This module intentionally knows nothing about DSH/Cordis. The host adapter
 * feeds it plain message/assembly data; it returns the wire snapshot. Keeping
 * it pure makes the classification and token math unit-testable.
 */
import {
  estimateMessage,
  estimateJson,
  estimateText,
} from '../token-metrics/estimate.ts'
import {
  DEFAULT_PRESSURE_THRESHOLDS,
  pressureLevel,
  type PressureMetrics,
} from '../pressure/level.ts'
import type {
  CategoryMetric,
  ContextSnapshot,
  MetricPrecision,
  PressureThresholds,
  SectionMetric,
  ToolMetric,
  ToolSource,
} from '../types.ts'

export interface CoreMessage {
  readonly seq: number
  readonly turn?: number
  readonly role: 'user' | 'assistant' | 'tool' | 'unknown'
  readonly source?: unknown
  readonly content: readonly unknown[]
}

export interface CorePromptSection {
  readonly name: string
  readonly order: number
  readonly text: string
}

export interface CorePromptContext {
  readonly name: string
  readonly text: string
}

export interface CoreToolSchema {
  readonly name: string
  readonly description?: string
  readonly parameters?: unknown
}

export interface CoreToolCall {
  readonly name: string
  readonly turn?: number
  /** Event timestamp (integer ms), used for last-call-time reporting. */
  readonly time?: number
}

export interface CoreAssembly {
  readonly sections: readonly CorePromptSection[]
  readonly contexts: readonly CorePromptContext[]
  readonly tools: readonly CoreToolSchema[]
}

export interface CoreAnalyzerInput {
  readonly sessionId: string
  readonly turn: number
  readonly generatedAt: string
  readonly providerTotalTokens: number | null
  readonly contextWindow: number | null
  readonly pressureTokens?: number | null
  readonly projectedTokens?: number | null
  readonly thresholds?: PressureThresholds
  readonly assembly: CoreAssembly
  readonly messages: readonly CoreMessage[]
  readonly calledThisTurn: readonly string[]
  /** Kept for backward compatibility; `calls` carries true counts/timestamps. */
  readonly calledEver?: readonly string[]
  readonly calls?: readonly CoreToolCall[]
}

const SECTION_SOURCE_RULES: ReadonlyArray<[RegExp, SectionMetric['source']]> = [
  [/^harness:/, 'harness'],
  [/^deployment:/, 'deployment'],
  [/^tool:/, 'tool'],
  [/^agent:/, 'agent'],
  [/^workspace:/, 'workspace'],
]

export function sectionSourceOf(name: string): SectionMetric['source'] {
  for (const [re, source] of SECTION_SOURCE_RULES) {
    if (re.test(name)) return source
  }
  return 'plugin'
}

export function isStableSection(section: CorePromptSection): boolean {
  // Sections containing a {{variable}} are dynamic; everything else is stable
  // as long as plugin load order / config stay identical.
  return !section.text.includes('{{')
}

export function sourceKind(source: unknown): string | null {
  if (typeof source !== 'object' || source === null) return null
  const kind = (source as { kind?: unknown }).kind
  return typeof kind === 'string' ? kind : null
}

export function messageHasImage(message: CoreMessage): boolean {
  return message.content.some((block) => {
    const b = block as { type?: string }
    return b?.type === 'image' || b?.type === 'image-ref' || b?.type === 'image-url'
  })
}

export function classifyMessage(message: CoreMessage): CategoryMetric['key'] {
  if (messageHasImage(message)) return 'attachments'
  const kind = sourceKind(message.source)
  switch (kind) {
    case 'agent-instructions':
      return 'workspace'
    case 'skill-catalog':
    case 'skill-invocation':
      return 'skills'
    case 'plugin':
    case 'memory':
    case 'recall':
    case 'relay':
      return 'memory'
    default:
      return 'conversation'
  }
}

const CATEGORY_LABELS: Record<CategoryMetric['key'], string> = {
  system: 'System Prompt',
  conversation: 'Conversation',
  tools: 'Tool Schemas',
  skills: 'Skills',
  memory: 'Memory / Injections',
  workspace: 'Workspace Instructions',
  attachments: 'Attachments',
  other: 'Reserved / Other',
}

const PRECISION: MetricPrecision = 'estimated'

export function analyze(input: CoreAnalyzerInput): ContextSnapshot {
  const pressureMetrics: PressureMetrics = {
    pressureTokens: input.pressureTokens ?? null,
    projectedTokens: input.projectedTokens ?? null,
    contextWindow: input.contextWindow ?? null,
  }
  const level = pressureLevel(pressureMetrics, input.thresholds ?? DEFAULT_PRESSURE_THRESHOLDS)

  const categories = new Map<CategoryMetric['key'], number>()

  const add = (key: CategoryMetric['key'], tokens: number): void => {
    categories.set(key, (categories.get(key) ?? 0) + tokens)
  }

  // System prompt: sections + runtime contexts
  let systemTokens = 0
  for (const section of input.assembly.sections) {
    systemTokens += estimateText(section.text)
  }
  for (const context of input.assembly.contexts) {
    systemTokens += estimateText(context.text)
  }
  add('system', systemTokens)

  // Conversation / workspace / skills / memory / attachments from messages
  for (const message of input.messages) {
    const tokens = estimateMessage({ content: message.content })
    const key = classifyMessage(message)
    add(key, tokens)
  }

  // Tool schemas (separate from system prompt tokens so users can see the cost)
  let toolsTokens = 0
  for (const tool of input.assembly.tools) {
    toolsTokens += estimateJson({
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.parameters ?? {},
    })
  }
  add('tools', toolsTokens)

  const categoryEntries: CategoryMetric[] = Array.from(categories.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, tokens]) => ({
      key,
      label: CATEGORY_LABELS[key],
      tokens,
      precision: PRECISION,
    }))

  const categoriesTotal = categoryEntries.reduce((sum, c) => sum + c.tokens, 0)
  const knownTotal = input.providerTotalTokens ?? categoriesTotal
  const otherTokens = Math.max(0, knownTotal - categoriesTotal)

  if (otherTokens > 0 || categories.get('other')) {
    categoryEntries.push({
      key: 'other',
      label: CATEGORY_LABELS.other,
      tokens: otherTokens,
      precision: input.providerTotalTokens !== null ? 'exact' : 'estimated',
      note: input.providerTotalTokens !== null
        ? 'residual of provider-reported total minus heuristic breakdown'
        : undefined,
    })
  }

  const sections: SectionMetric[] = input.assembly.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      id: section.name,
      source: sectionSourceOf(section.name),
      order: section.order,
      tokens: estimateText(section.text),
      stable: isStableSection(section),
      preview: section.text.slice(0, 160),
    }))

  const callStats = new Map<string, { count: number; lastTime: number }>()
  for (const call of input.calls ?? []) {
    const stat = callStats.get(call.name) ?? { count: 0, lastTime: -1 }
    stat.count += 1
    if (call.time !== undefined && call.time > stat.lastTime) stat.lastTime = call.time
    callStats.set(call.name, stat)
  }

  const tools: ToolMetric[] = input.assembly.tools
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((tool) => {
      const stat = callStats.get(tool.name)
      const callCount = stat?.count ?? (input.calledEver?.includes(tool.name) ? 1 : 0)
      return {
        name: tool.name,
        tokens: estimateJson({
          name: tool.name,
          description: tool.description ?? '',
          parameters: tool.parameters ?? {},
        }),
        schema: tool,
        source: toolSourceOf(tool.name),
        calledThisTurn: input.calledThisTurn.includes(tool.name),
        calledEver: input.calledEver?.includes(tool.name) ?? callCount > 0,
        callCount,
        lastCalledAt: stat && stat.lastTime >= 0 ? new Date(stat.lastTime).toISOString() : null,
      } satisfies ToolMetric
    })

  const sourceNotes: ContextSnapshot['source'] = [
    {
      metric: 'tokens',
      note: 'All per-section/per-tool/per-category token counts use the official DSH heuristic (4 chars ≈ 1 token + overhead). They are estimates, not provider billing numbers.',
    },
    {
      metric: 'providerTotalTokens',
      note: input.providerTotalTokens !== null
        ? 'Provider-reported prompt-side pressure from @deepseek-ai/dsh-token-meter contextPressure.'
        : 'No provider usage reported yet.',
    },
    {
      metric: 'toolSource',
      note: 'Tool source (builtin/plugin/MCP) is inferred from name prefixes. The runtime API does not expose the registering plugin id.',
    },
  ]

  return {
    sessionId: input.sessionId,
    turn: input.turn,
    generatedAt: input.generatedAt,
    totalTokens: input.providerTotalTokens,
    contextWindow: input.contextWindow,
    pressure: {
      pressureTokens: pressureMetrics.pressureTokens,
      projectedTokens: pressureMetrics.projectedTokens,
      contextWindow: pressureMetrics.contextWindow,
      level,
    },
    categories: categoryEntries,
    sections,
    tools,
    source: sourceNotes,
  }
}

export function toolSourceOf(name: string): ToolSource {
  const lower = name.toLowerCase()
  if (lower.startsWith('mcp__') || lower.startsWith('mcp_') || lower.startsWith('mcp-')) return 'mcp'
  const builtin = new Set([
    'bash', 'read', 'write', 'edit', 'glob', 'grep', 'todo', 'task',
    'skill', 'subagent', 'web_search', 'web_fetch', 'pwsh', 'fs',
    'goal', 'jobs', 'workflow', 'ralph', 'ask_user', 'str_replace_editor',
  ])
  if (builtin.has(lower)) return 'builtin'
  // Third-party plugins usually register unprefixed names; without a catalog
  // we cannot distinguish them from builtin reliably.
  return 'plugin'
}