/**
 * Host-side adapter: gathers live DSH data and feeds it into the pure core
 * analyzer. No monkey-patching, no custom session events.
 */
import type { Context } from '@deepseek-ai/cordis'
import { assembleContextFor } from '@deepseek-ai/dsh-agent'
import { deriveEventMessage } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-token-meter'
import type {} from '@deepseek-ai/dsh-session-projection'
import { analyze, type CoreAssembly, type CoreMessage } from '../core/analyzer/breakdown.ts'
import { buildDiagnostic } from '../core/diagnostic/diagnostic.ts'
import { DEFAULT_PRESSURE_THRESHOLDS } from '../core/pressure/level.ts'
import type { CategoryMetric, ContextSnapshot, PressureThresholds, SessionHistory, TurnPoint } from '../core/types.ts'
import type { HistoryStore } from './store.ts'

type AnySession = {
  readonly id: string
  readonly events: readonly any[]
}

type AnyAgent = {
  readonly id: string
  readonly session: AnySession
}

export interface AnalyzerOptions {
  includeBody?: boolean
}

export class ContextAnalyzer {
  constructor(
    private readonly ctx: Context,
    private readonly store: HistoryStore,
    private readonly pressureThresholds: PressureThresholds = DEFAULT_PRESSURE_THRESHOLDS,
  ) {}

  async snapshot(sessionId: string, options: AnalyzerOptions = {}): Promise<ContextSnapshot> {
    const session = (this.ctx.get('sessions') as any)?.get(sessionId) as AnySession | undefined
    if (!session) throw new Error(`session not found: ${sessionId}`)

    const agent = (this.ctx.get('agents') as any)?.get(sessionId) as AnyAgent | undefined
    const systemPrompt = (this.ctx.get('systemPrompt') as any)
    const rawAssembly = systemPrompt
      ? await systemPrompt.assemble(agent ? assembleContextFor(agent as any) : {})
      : { sections: [], contexts: [], tools: [] }

    const assembly: CoreAssembly = {
      sections: (rawAssembly.sections ?? []).map((section: { name?: string; text?: string }, index: number) => ({
        name: section.name ?? `section-${index}`,
        order: index,
        text: section.text ?? '',
      })),
      contexts: (rawAssembly.contexts ?? []).map((context: { name?: string; text?: string }, index: number) => ({
        name: context.name ?? `context-${index}`,
        text: context.text ?? '',
      })),
      tools: (rawAssembly.tools ?? []).map((tool: { name?: string; description?: string; parameters?: unknown }) => ({
        name: tool.name ?? '?',
        description: tool.description ?? '',
        parameters: tool.parameters ?? {},
      })),
    }

    const messages = this.collectMessages(session)
    const turn = this.latestTurn(session)
    const calledThisTurn = this.toolsCalledInTurn(session, turn)
    const calledEver = this.toolsCalledEver(session)

    const projection = (this.ctx.get('sessionProjections') as any)?.snapshot?.(session)
    const pressure = projection?.values?.['contextPressure'] as
      | { pressureTokens?: number; projectedTokens?: number; contextWindow?: number }
      | undefined

    const toolCalls = this.extractToolCalls(session)

    const coreSnapshot = analyze({
      sessionId,
      turn,
      generatedAt: new Date().toISOString(),
      providerTotalTokens: pressure?.pressureTokens ?? pressure?.projectedTokens ?? null,
      contextWindow: pressure?.contextWindow ?? null,
      pressureTokens: pressure?.pressureTokens ?? null,
      projectedTokens: pressure?.projectedTokens ?? null,
      thresholds: this.pressureThresholds,
      assembly,
      messages,
      calledThisTurn,
      calledEver,
      calls: toolCalls,
    })

    if (options.includeBody) {
      const byId = new Map(coreSnapshot.sections.map((s) => [s.id, s]))
      for (const section of rawAssembly.sections ?? []) {
        const metric = byId.get(section.name)
        if (metric) (metric as { body?: string }).body = section.text
      }
    }

    await this.recordPoint(sessionId, turn, coreSnapshot)
    return coreSnapshot
  }

  async history(sessionId: string): Promise<SessionHistory | null> {
    return this.store.read(sessionId)
  }

  async diagnostic(sessionId: string, dshVersion: string, pluginVersion: string) {
    const snapshot = await this.snapshot(sessionId)
    const history = await this.history(sessionId)
    return buildDiagnostic({
      snapshot,
      history,
      dshVersion,
      pluginVersion,
      pressureThresholds: this.pressureThresholds,
    })
  }

  async recordTurnEnd(sessionId: string): Promise<void> {
    const session = (this.ctx.get('sessions') as any)?.get(sessionId) as AnySession | undefined
    if (!session) return
    const projection = (this.ctx.get('sessionProjections') as any)?.snapshot?.(session)
    const pressure = projection?.values?.['contextPressure'] as
      | { pressureTokens?: number; projectedTokens?: number; contextWindow?: number }
      | undefined
    const breakdown = projection?.values?.['contextBreakdown'] as
      | { systemTokens?: number; toolsTokens?: number; messageTokens?: number }
      | undefined
    const turn = this.latestTurn(session)
    const categories: CategoryMetric[] = [
      { key: 'system', label: 'System Prompt', tokens: breakdown?.systemTokens ?? 0, precision: 'estimated' },
      { key: 'tools', label: 'Tool Schemas', tokens: breakdown?.toolsTokens ?? 0, precision: 'estimated' },
      { key: 'conversation', label: 'Conversation', tokens: breakdown?.messageTokens ?? 0, precision: 'estimated' },
    ]
    const totalTokens = pressure?.pressureTokens ?? pressure?.projectedTokens ?? null
    const otherTokens = totalTokens === null
      ? 0
      : Math.max(0, totalTokens - categories.reduce((s, c) => s + c.tokens, 0))
    if (otherTokens > 0) {
      categories.push({ key: 'other', label: 'Reserved / Other', tokens: otherTokens, precision: 'exact' })
    }
    const point: TurnPoint = {
      turn,
      totalTokens,
      categories,
      toolCalls: this.toolsCalledInTurn(session, turn),
    }
    await this.store.append(sessionId, point)
  }

  async clear(sessionId?: string): Promise<void> {
    await this.store.clear(sessionId)
  }

  private collectMessages(session: AnySession): CoreMessage[] {
    const out: CoreMessage[] = []
    for (const event of session.events ?? []) {
      const message = deriveEventMessage(event)
      if (!message) continue
      const content = Array.isArray((message as { content?: unknown }).content)
        ? (message as { content: readonly unknown[] }).content
        : []
      const source = event.type === 'user/message'
        ? event.data?.message?.source ?? event.data?.source
        : undefined
      out.push({
        seq: event.seq,
        turn: event.data?.turn,
        role: event.type === 'user/message'
          ? 'user'
          : event.type === 'assistant/message'
            ? 'assistant'
            : event.type === 'tool/result'
              ? 'tool'
              : 'unknown',
        source,
        content,
      })
    }
    return out
  }

  private latestTurn(session: AnySession): number {
    let turn = 0
    for (const event of session.events ?? []) {
      if (event.type === 'turn/start') turn = event.data?.turn ?? turn
    }
    return turn
  }

  private extractToolCalls(session: AnySession): Array<{ turn?: number; name: string; time?: number }> {
    const calls: Array<{ turn?: number; name: string; time?: number }> = []
    for (const event of session.events ?? []) {
      if (event.type !== 'assistant/message') continue
      const content = event.data?.message?.content ?? []
      for (const block of content as Array<{ type?: string; name?: string }>) {
        if (block?.type === 'tool-call' && block.name) {
          calls.push({ turn: event.data?.turn, name: block.name, time: event.time })
        }
      }
    }
    return calls
  }

  private toolsCalledInTurn(session: AnySession, turn: number): string[] {
    return [...new Set(this.extractToolCalls(session).filter((c) => c.turn === turn).map((c) => c.name))]
  }

  private toolsCalledEver(session: AnySession): string[] {
    return [...new Set(this.extractToolCalls(session).map((c) => c.name))]
  }

  private async recordPoint(sessionId: string, turn: number, snapshot: ContextSnapshot): Promise<void> {
    const point: TurnPoint = {
      turn,
      totalTokens: snapshot.totalTokens,
      categories: snapshot.categories,
      toolCalls: snapshot.tools.filter((t) => t.calledThisTurn).map((t) => t.name),
    }
    await this.store.append(sessionId, point)
  }
}