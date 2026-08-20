/** dsh-context-xray core wire types. Pure JSON / type only. */

export type SectionSource =
  | 'harness'
  | 'deployment'
  | 'tool'
  | 'plugin'
  | 'agent'
  | 'workspace'
  | 'unknown'

export interface SectionMetric {
  readonly id: string
  readonly source: SectionSource
  readonly order: number
  readonly tokens: number
  /** Static sections are cacheable if text/order stays identical. */
  readonly stable: boolean
  /** Truncated preview, safe to persist. */
  readonly preview: string
  /** Full body; only present when the client explicitly asks. */
  readonly body?: string
}

export type ToolSource = 'builtin' | 'plugin' | 'mcp' | 'unknown'

export interface ToolMetric {
  readonly name: string
  readonly tokens: number
  readonly schema: unknown
  readonly source: ToolSource
  readonly calledThisTurn: boolean
  readonly calledEver: boolean
  /** Number of tool-call blocks in this session, including repeated calls. */
  readonly callCount: number
  /** ISO timestamp of the last tool-call event, if any. */
  readonly lastCalledAt: string | null
}

export type MetricPrecision = 'exact' | 'estimated' | 'unavailable'

export type PressureLevel = 'normal' | 'elevated' | 'high' | 'critical'

export interface PressureThresholds {
  /** Ratio (0-100) of projected/pressure tokens to context window that triggers 'elevated'. */
  readonly elevated: number
  readonly high: number
  readonly critical: number
}

export interface PressureInfo {
  readonly pressureTokens: number | null
  readonly projectedTokens: number | null
  readonly contextWindow: number | null
  readonly level: PressureLevel | null
}

export interface CategoryMetric {
  readonly key: string
  readonly label: string
  readonly tokens: number
  readonly precision: MetricPrecision
  readonly note?: string
}

export interface SnapshotSource {
  readonly metric: string
  readonly note: string
}

export interface ContextSnapshot {
  readonly sessionId: string
  readonly turn: number
  readonly generatedAt: string
  /** Provider-reported prompt-side pressure, when available. */
  readonly totalTokens: number | null
  readonly contextWindow: number | null
  readonly pressure: PressureInfo
  readonly categories: readonly CategoryMetric[]
  readonly sections: readonly SectionMetric[]
  readonly tools: readonly ToolMetric[]
  readonly source: readonly SnapshotSource[]
}

export interface TurnPoint {
  readonly turn: number
  readonly totalTokens: number | null
  readonly categories: readonly CategoryMetric[]
  readonly toolCalls: readonly string[]
}

export interface SessionHistory {
  readonly sessionId: string
  readonly entries: readonly TurnPoint[]
}

export interface SectionDiagnosticMetric {
  readonly id: string
  readonly source: SectionSource
  readonly order: number
  readonly tokens: number
  readonly stable: boolean
}

export interface ToolDiagnosticMetric {
  readonly name: string
  readonly tokens: number
  readonly source: ToolSource
  readonly calledThisTurn: boolean
  readonly calledEver: boolean
  readonly callCount: number
  readonly lastCalledAt: string | null
}

export interface DiagnosticExport {
  readonly schemaVersion: 1
  readonly generatedAt: string
  readonly dshVersion: string
  readonly pluginVersion: string
  readonly sessionId: string
  readonly turn: number
  readonly context: {
    readonly totalTokens: number | null
    readonly pressureTokens: number | null
    readonly projectedTokens: number | null
    readonly contextWindow: number | null
    readonly pressureLevel: PressureLevel | null
    readonly pressureThresholds: PressureThresholds
    readonly categories: readonly CategoryMetric[]
  }
  readonly sections: readonly SectionDiagnosticMetric[]
  readonly tools: readonly ToolDiagnosticMetric[]
  readonly history: SessionHistory | null
}

export const CATEGORY_KEYS = [
  'system',
  'conversation',
  'tools',
  'skills',
  'memory',
  'workspace',
  'attachments',
  'other',
] as const

export type CategoryKey = (typeof CATEGORY_KEYS)[number]