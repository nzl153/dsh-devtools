/**
 * dsh-session-archaeologist host half.
 *
 * Owns the sidecar FTS index and exposes HTTP API. The search engine
 * (src/core) is DSH-free; this file is the thin DSH adapter.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { SessionIndex } from './sqlite.ts'
import { registerApi, type ApiDeps } from './api.ts'
import {
  defaultIndexDbPath,
  dshHome,
  readWorkspaceMap,
  scanSessions,
  sessionsRoot,
} from './scanner.ts'
import type { SessionFile } from './scanner.ts'

export const name = 'dsh-session-archaeologist'

export const inject = ['webServer'] as const

// Programmatic exports (used by bench/tests): the host entry doubles as the
// public engine surface after the tsdown bundle.
export { SessionIndex } from './sqlite.ts'
export { scanSessions, sessionsRoot, readWorkspaceMap, defaultIndexDbPath } from './scanner.ts'
export { runIndex } from './indexer.ts'
export { parseSession } from '../core/session-parse.ts'
export { decodeSessionLog } from '../core/zstd.ts'
export { buildExcerpt, buildMultiExcerpt } from '../core/excerpt.ts'
export { buildTimeline } from '../core/timeline.ts'

export function apply(ctx: Context): void {
  const home = dshHome()
  const dbPath = defaultIndexDbPath(home)
  const index = new SessionIndex(dbPath)
  const workspaceMap = readWorkspaceMap(home)
  const root = sessionsRoot(home)

  let cache: SessionFile[] | null = null
  const listSessions = (): SessionFile[] => {
    if (cache === null) cache = scanSessions(root, workspaceMap)
    return cache
  }

  const deps: ApiDeps = { index, listSessions, sessionsRoot: root }
  const registered = registerApi(ctx, deps)

  // Initial best-effort index on startup. Errors are non-fatal: search still
  // works against whatever is already indexed, and the panel can reindex.
  void import('./indexer.ts').then(({ runIndex }) => {
    try {
      runIndex(index, listSessions())
    } catch (error) {
      ctx.logger.warn(`[dsh-session-archaeologist] initial index failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }).catch((error: unknown) => {
    ctx.logger.warn(`[dsh-session-archaeologist] initial index skipped: ${error instanceof Error ? error.message : String(error)}`)
  })

  ctx.effect(() => {
    return () => {
      void registered
      try {
        index.close()
      } catch {
        // already closed
      }
    }
  }, 'dsh-session-archaeologist: cleanup')
}
