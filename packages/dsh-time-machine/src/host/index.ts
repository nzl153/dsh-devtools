/**
 * dsh-time-machine host half.
 *
 * Wires DSH tool lifecycle hooks + session events to the core TimeMachineEngine
 * and exposes a same-origin HTTP API for the web panel.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {
  PostToolDecision,
  PreToolDecision,
  ToolExecution,
} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session'
import { HostAdapter } from './adapter.ts'
import { registerApi } from './api.ts'

export const name = 'dsh-time-machine'

export const inject = ['webServer'] as const

export function apply(ctx: Context): void {
  const adapter = new HostAdapter(ctx)
  registerApi(ctx, adapter)

  // Observe tool lifecycle. `tools/pre-execute` and `tools/post-execute` are
  // wateralls: we must call `next` and never replace decisions.
  const stopPre = ctx.on('tools/pre-execute', (exec: ToolExecution, next: () => Promise<PreToolDecision>) => {
    adapter.onPre(exec)
    return next()
  })

  const stopPost = ctx.on('tools/post-execute', (exec: ToolExecution, _result: unknown, next: () => Promise<PostToolDecision>) => {
    adapter.onPost(exec)
    return next()
  })

  // Track turn boundaries so changes are attributed to the right turn.
  const stopSession = ctx.on('session/event', (session: { id: string; events: readonly { seq: number; type: string }[] }) => {
    adapter.onSessionEvent(session)
  })

  ctx.effect(() => {
    return () => {
      stopPre()
      stopPost()
      stopSession()
      adapter.dispose()
    }
  }, 'dsh-time-machine: lifecycle listeners')
}
