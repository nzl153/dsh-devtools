/**
 * dsh-context-xray host half.
 */
import { readFileSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-token-meter'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { registerApi } from './api.ts'
import { ContextAnalyzer } from './analyzer.ts'
import { Config, type Config as ConfigType } from './config.ts'
import { createHistoryStore } from './store.ts'

export const name = 'dsh-context-xray'

export const inject = ['webServer'] as const

export { Config }

function pluginVersion(): string {
  try {
    const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    const value = JSON.parse(raw) as { version?: unknown }
    return typeof value.version === 'string' ? value.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

function dshVersionOf(ctx: Context): string {
  const safeGet = (key: string): { version?: unknown } | undefined => {
    try {
      const value = (ctx as { get?: (key: string) => unknown }).get?.(key)
      return typeof value === 'object' && value !== null ? value as { version?: unknown } : undefined
    } catch {
      return undefined
    }
  }
  const candidates: unknown[] = [
    safeGet('app')?.version,
    safeGet('root')?.version,
    safeGet('brand')?.version,
    safeGet('version'),
    process.env.DSH_VERSION,
  ]
  const found = candidates.find((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0)
  return found ?? 'unknown'
}

export function apply(ctx: Context, config: ConfigType = {}): void {
  const thresholds = config.pressureThresholds ?? {}
  const storePromise = createHistoryStore()
  const analyzerPromise = storePromise.then((store) => new ContextAnalyzer(
    ctx,
    store,
    {
      elevated: thresholds.elevated ?? 50,
      high: thresholds.high ?? 75,
      critical: thresholds.critical ?? 90,
    },
  ))
  const registered = analyzerPromise.then((analyzer) => registerApi(ctx, analyzer, {
    dshVersion: dshVersionOf(ctx),
    pluginVersion: pluginVersion(),
  }))

  ctx.effect(() => {
    const consumed = new Map<string, number>()
    const onSessionEvent = (session: { id: string; events: readonly { seq: number; type: string }[] }): void => {
      if (!session || session.id === undefined) return
      const events = session.events ?? []
      const last = events[events.length - 1]
      if (!last) return
      const seen = consumed.get(session.id) ?? 0
      if (last.seq < seen) return
      consumed.set(session.id, last.seq)
      if (last.type !== 'turn/end') return
      void analyzerPromise.then((analyzer) => analyzer.recordTurnEnd(session.id)).catch((error) => {
        ctx.logger.warn(`[dsh-context-xray] turn history record failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
    ctx.on('session/event', onSessionEvent)
    return () => {
      consumed.clear()
    }
  }, 'dsh-context-xray: turn history')

  ctx.effect(() => {
    return () => {
      void registered
      void storePromise.then((store) => store.clear())
    }
  }, 'dsh-context-xray: cleanup (registered async)')
}