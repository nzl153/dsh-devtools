/**
 * dsh-output-gallery host half.
 *
 * On turn/end, scans the session workspace, indexes tracked deliverables into
 * the sidecar store, and exposes the HTTP API used by the client panel.
 * Metadata-only persistence; previews read files live.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { DEFAULT_CONFIG } from '../core/filter.ts'
import type { GalleryConfig } from '../core/types.ts'
import { createGalleryStore } from './store.ts'
import { GalleryRuntime } from './runtime.ts'
import { registerApi } from './api.ts'

export const name = 'dsh-output-gallery'

export const inject = ['webServer'] as const

// Re-exported for embedding / E2E / tests that run the scanner+indexer without
// a full DSH context.
export { scanWorkspace } from './scanner.ts'
export type { ScanOutcome, ScanOptions } from './scanner.ts'
export { createGalleryStore, galleryDir } from './store.ts'
export type { GalleryStore } from './store.ts'
export { runStandaloneIndex, GalleryRuntime } from './runtime.ts'
export { buildPreview, resolveWorkspacePath } from './preview.ts'

export interface Config extends GalleryConfig {}

export const Config = z.object({
  enabled: z.boolean().default(true),
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  ignoreDirs: z.array(z.string()).default([...DEFAULT_CONFIG.ignoreDirs]),
  avoid: z.array(z.string()).default([...DEFAULT_CONFIG.avoid]),
  trackVersions: z.boolean().default(true),
  maxFiles: z.natural().min(1).default(5000),
  htmlSandbox: z.boolean().default(true),
})

export function apply(ctx: Context, config?: Partial<Config>): void {
  const resolved: Config = Config(config ?? {}) as Config
  const storePromise = createGalleryStore()
  const runtimePromise = storePromise.then((store) => new GalleryRuntime(ctx, store, resolved))

  const registered = runtimePromise.then((runtime) => registerApi(ctx, runtime))

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
      void runtimePromise.then((runtime) => runtime.refresh(session.id, latestTurn(events))).catch((error) => {
        ctx.logger.warn(`[dsh-output-gallery] turn scan failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
    ctx.on('session/event', onSessionEvent)
    return () => {
      consumed.clear()
    }
  }, 'dsh-output-gallery: turn scan')

  ctx.effect(() => {
    return () => {
      void registered
      void storePromise.then((store) => store.clear())
    }
  }, 'dsh-output-gallery: cleanup (async registered)')
}

function latestTurn(events: readonly { type: string; data?: { turn?: number } }[]): number {
  let turn = 0
  for (const event of events) {
    if (event.type === 'turn/start') turn = event.data?.turn ?? turn
  }
  return turn
}