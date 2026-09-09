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
    // 0.1.2 起 `session/event` 回调签名变为 (session, event)，且 Session 上的 events 数组被删除，
    // 所以直接用回调带上来的这一条事件判 turn 边界，不再从 session 里读整段日志。
    ctx.on('session/event', (session, event) => {
      const seen = consumed.get(session.id) ?? 0
      if (event.seq < seen) return
      consumed.set(session.id, event.seq)
      if (event.type !== 'turn/end') return
      void analyzerPromise.then((analyzer) => analyzer.recordTurnEnd(session.id)).catch((error) => {
        ctx.logger.warn(`[dsh-context-xray] turn history record failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    })
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