/**
 * Pure diagnostic export builder.
 *
 * Takes an in-memory snapshot plus history and produces the issue-report JSON.
 * This is the only place diagnostic payloads are shaped; it deliberately drops
 * SectionMetric.body and any other full prompt content.
 */
import type {
  ContextSnapshot,
  DiagnosticExport,
  PressureThresholds,
  SessionHistory,
} from '../types.ts'

export interface DiagnosticInput {
  readonly snapshot: ContextSnapshot
  readonly history: SessionHistory | null
  readonly dshVersion: string
  readonly pluginVersion: string
  readonly pressureThresholds: PressureThresholds
  readonly generatedAt?: string
}

export function buildDiagnostic(input: DiagnosticInput): DiagnosticExport {
  const snapshot = input.snapshot
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dshVersion: input.dshVersion || 'unknown',
    pluginVersion: input.pluginVersion || 'unknown',
    sessionId: snapshot.sessionId,
    turn: snapshot.turn,
    context: {
      totalTokens: snapshot.totalTokens,
      pressureTokens: snapshot.pressure.pressureTokens,
      projectedTokens: snapshot.pressure.projectedTokens,
      contextWindow: snapshot.contextWindow,
      pressureLevel: snapshot.pressure.level,
      pressureThresholds: input.pressureThresholds,
      categories: snapshot.categories,
    },
    sections: snapshot.sections.map((section) => ({
      id: section.id,
      source: section.source,
      order: section.order,
      tokens: section.tokens,
      stable: section.stable,
    })),
    tools: snapshot.tools.map((tool) => ({
      name: tool.name,
      tokens: tool.tokens,
      source: tool.source,
      calledThisTurn: tool.calledThisTurn,
      calledEver: tool.calledEver,
      callCount: tool.callCount,
      lastCalledAt: tool.lastCalledAt,
    })),
    history: input.history,
  }
}