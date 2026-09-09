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
    // 0.1.2 起 `session/event` 回调签名变为 (session, event)，Session.events 数组被删除，
    // 所以直接消费回调里的这一条事件；turn/end 自带 turn 号，不必再回读整段日志。
    ctx.on('session/event', (session, event) => {
      const seen = consumed.get(session.id) ?? 0
      if (event.seq < seen) return
      consumed.set(session.id, event.seq)
      if (event.type !== 'turn/end') return
      void runtimePromise.then((runtime) => runtime.refresh(session.id, event.data.turn)).catch((error) => {
        ctx.logger.warn(`[dsh-output-gallery] turn scan failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    })
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