/**
 * dsh-debrief host half.
 *
 * Listens to the DSH `session/event` firehose, keeps a per-session normalized
 * event log, and serves deterministic debriefs over the webServer HTTP API.
 * No model calls, no UI parsing.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import { registerDebriefSettings } from './settings.ts'
import { DebriefEngine } from './engine.ts'
import { registerApi } from './api.ts'

export const name = 'dsh-debrief'

export const inject = ['settings', 'sessions', 'webServer'] as const

// Re-export the pure core so the E2E script and external tooling can consume
// the debrief engine without running DSH.
export {
  computeTurnDebrief,
  computeSessionDebrief,
  normalizeConfig,
  DEFAULT_CONFIG,
} from '../core/index.ts'
export type {
  DebriefConfig,
  DebriefEvent,
  TurnDebrief,
  SessionDebrief,
} from '../core/types.ts'

export function apply(ctx: Context): void {
  const settings = registerDebriefSettings(ctx)
  const engine = new DebriefEngine(ctx, settings)
  registerApi(ctx, engine)

  ctx.on('session/event', (session, event) => {
    const sessionId = String((session as unknown as { id: unknown }).id)
    if (!sessionId) return
    engine.record(sessionId, event)
  })

  ctx.on('session/disposed', (session) => {
    const sessionId = String((session as unknown as { id: unknown }).id)
    if (sessionId) engine.drop(sessionId)
  })

  ctx.effect(() => {
    return () => {
      for (const key of [...engine.events.keys()]) engine.drop(key)
    }
  }, 'dsh-debrief: cleanup')
}