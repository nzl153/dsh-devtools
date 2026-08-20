/**
 * Host-side debrief engine: keeps a per-session normalized event log and
 * computes debriefs through the pure core. It never parses UI text and never
 * calls a model.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { normalizeConfig, computeTurnDebrief, computeSessionDebrief } from '../core/index.ts'
import type { DebriefConfig, DebriefEvent, DebriefSettingsLike, SessionDebrief, TurnDebrief } from '../core/types.ts'
import type { DebriefSettingsScope } from './settings.ts'
import { DEBRIEF_NAMESPACE } from './settings.ts'
import type { TokenInput } from '../core/tokens.ts'

export function eventToDebriefEvent(event: SessionEvent): DebriefEvent {
  return {
    seq: event.seq,
    time: event.time,
    type: event.type,
    data: event.data as unknown as Record<string, unknown>,
  }
}

export class DebriefEngine {
  private readonly sessions = new Map<string, DebriefEvent[]>()

  constructor(
    private readonly ctx: Context,
    private readonly settings: DebriefSettingsScope,
  ) {}

  /** Append one DSH session event to the per-session log. */
  record(sessionId: string, event: SessionEvent): void {
    let log = this.sessions.get(sessionId)
    if (!log) {
      log = []
      this.sessions.set(sessionId, log)
    }
    log.push(eventToDebriefEvent(event))
  }

  /** Drop a session's log when the session leaves the store. */
  drop(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  get events(): ReadonlyMap<string, readonly DebriefEvent[]> {
    return this.sessions
  }

  private config(): { config: DebriefConfig; warnings: string[] } {
    const raw = this.settings.get()
    return normalizeConfig(raw)
  }

  /** Resolve token-meter pressure/context for a live session, when available. */
  private tokenInput(sessionId: string): TokenInput {
    const sessions = (this.ctx.get('sessions') as { get?: (id: string) => unknown } | undefined)
    const session = sessions?.get?.(sessionId)
    if (!session) return {}
    const projections = (this.ctx.get('sessionProjections') as { snapshot?: (s: unknown) => { values?: Record<string, unknown> } } | undefined)
    const pressure = projections?.snapshot?.(session)?.values?.['contextPressure'] as
      | { pressureTokens?: number; projectedTokens?: number; contextWindow?: number }
      | undefined
    return {
      contextPressure: pressure?.pressureTokens ?? pressure?.projectedTokens ?? null,
      contextWindow: pressure?.contextWindow ?? null,
    }
  }

  turnDebrief(sessionId: string, turn: number): TurnDebrief {
    const events = this.sessions.get(sessionId) ?? []
    const { config } = this.config()
    return computeTurnDebrief(sessionId, events, turn, config, this.tokenInput(sessionId))
  }

  sessionDebrief(sessionId: string): SessionDebrief {
    const events = this.sessions.get(sessionId) ?? []
    const { config } = this.config()
    return computeSessionDebrief(sessionId, events, config, this.tokenInput(sessionId))
  }

  /** The set of turn numbers seen in this session's log. */
  knownTurns(sessionId: string): number[] {
    const events = this.sessions.get(sessionId) ?? []
    const turns = new Set<number>()
    for (const event of events) {
      if (event.type === 'turn/start' && typeof event.data.turn === 'number') {
        turns.add(event.data.turn)
      }
    }
    return [...turns].sort((a, b) => a - b)
  }

  /** Current settings as a plain object (for the client settings route). */
  rawSettings(): DebriefSettingsLike {
    return this.settings.get()
  }

  /** Namespace string so the API route can return it. */
  namespace(): string {
    return DEBRIEF_NAMESPACE
  }
}