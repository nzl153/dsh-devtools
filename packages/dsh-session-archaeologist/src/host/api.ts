/**
 * HTTP API for the client panel. Same-origin guarded, same envelope style as
 * dsh-context-xray / dsh-at-file: `{ ok: true, value }` / `{ ok: false, error }`.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionIndex, SessionMeta, DocRow } from './sqlite.ts'
import type { SessionFile } from './scanner.ts'
import type { ExcerptSelection, IndexedDoc, SearchFilters } from '../core/types.ts'
import { buildMultiExcerpt } from '../core/excerpt.ts'

function trustedRequest(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const host = req.headers.host
  if (!host) return false
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(`http://${host}`).host
  } catch {
    return false
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text.length === 0) return {}
  const value: unknown = JSON.parse(text)
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(value))
}

function ok<T>(value: T): unknown {
  return { ok: true, value }
}

function fail(code: string, message: string): unknown {
  return { ok: false, error: { code, message, details: {} } }
}

function str(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function num(body: Record<string, unknown>, key: string): number | undefined {
  const v = body[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function toIndexedDocs(rows: readonly DocRow[]): readonly IndexedDoc[] {
  return rows.map((r) => ({
    sessionId: r.session_id,
    seq: r.seq,
    time: r.time,
    title: r.title,
    role: r.role as IndexedDoc['role'],
    source: r.source,
    content: r.content,
    meta: r.meta,
  }))
}

function metaToSelection(
  index: SessionIndex,
  meta: SessionMeta,
  hitIds: readonly number[],
  workspace?: string,
): ExcerptSelection {
  return {
    sessionId: meta.sessionId,
    title: meta.title,
    createdAt: meta.createdAt,
    workspace: meta.workspace ?? workspace,
    docs: toIndexedDocs(index.getDocsForSession(meta.sessionId)),
    hitIds,
  }
}

export interface ApiDeps {
  index: SessionIndex
  listSessions: () => SessionFile[]
  sessionsRoot: string
}

export function registerApi(ctx: Context, deps: ApiDeps): void {
  ctx.effect(() => {
    const base = '/plugins/dsh-session-archaeologist/api'
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/status`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          json(res, 200, ok(deps.index.getStatus()))
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/search`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const query = str(body, 'query')
            if (!query) return json(res, 400, fail('bad-request', 'query is required'))
            const filters = (body['filters'] as SearchFilters | undefined) ?? undefined
            const limit = typeof body['limit'] === 'number' ? body['limit'] : 50
            const response = deps.index.search(query, { filters, limit })
            json(res, 200, ok(response))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/index`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = str(body, 'sessionId')
            const { runIndex } = await import('./indexer.ts')
            let result
            if (sessionId) {
              const target = deps.listSessions().find((s) => s.sessionId === sessionId)
              if (!target) return json(res, 404, fail('not-found', `session ${sessionId} not found`))
              result = runIndex(deps.index, [target], { force: true })
            } else {
              result = runIndex(deps.index, deps.listSessions(), {})
            }
            json(res, 200, ok(result))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/reindex`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const { runIndex } = await import('./indexer.ts')
            const result = runIndex(deps.index, deps.listSessions(), { force: true })
            json(res, 200, ok(result))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/delete-index`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          deps.index.clear()
          json(res, 200, ok({ cleared: true }))
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/exclude`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = str(body, 'sessionId')
            const workspace = str(body, 'workspace')
            const unexclude = body['unexclude'] === true
            if (!sessionId && !workspace) return json(res, 400, fail('bad-request', 'sessionId or workspace required'))
            if (sessionId) {
              if (unexclude) deps.index.removeExcludedSession(sessionId)
              else deps.index.addExcludedSession(sessionId)
            }
            if (workspace) {
              if (unexclude) deps.index.removeExcludedWorkspace(workspace)
              else deps.index.addExcludedWorkspace(workspace)
            }
            json(res, 200, ok(deps.index.getStatus()))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/timeline`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = str(body, 'sessionId')
            if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
            const meta = deps.index.getSessionMeta(sessionId)
            if (!meta) return json(res, 404, fail('not-found', `not indexed: ${sessionId}`))
            const docs = deps.index.getDocsForSession(sessionId)
            const { buildTimeline } = await import('../core/timeline.ts')
            const timeline = buildTimeline(sessionId, meta.title, meta.createdAt, docs as never, meta?.title ? [] : [], [])
            json(res, 200, ok(timeline))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/excerpt`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const selections: ExcerptSelection[] = []
            if (Array.isArray(body['selections'])) {
              for (const item of body['selections'] as unknown[]) {
                if (!item || typeof item !== 'object') continue
                const sel = item as Record<string, unknown>
                const sessionId = str(sel, 'sessionId')
                if (!sessionId) continue
                const hitIds = Array.isArray(sel['hitIds'])
                  ? (sel['hitIds'] as unknown[]).filter((x): x is number => typeof x === 'number')
                  : []
                const meta = deps.index.getSessionMeta(sessionId)
                if (!meta) continue
                selections.push(metaToSelection(deps.index, meta, hitIds))
              }
            } else {
              const sessionId = str(body, 'sessionId')
              if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
              const hitIds = Array.isArray(body['hitIds'])
                ? (body['hitIds'] as unknown[]).filter((x): x is number => typeof x === 'number')
                : []
              const meta = deps.index.getSessionMeta(sessionId)
              if (!meta) return json(res, 404, fail('not-found', `not indexed: ${sessionId}`))
              selections.push(metaToSelection(deps.index, meta, hitIds))
            }
            if (selections.length === 0) return json(res, 400, fail('bad-request', 'no valid selections'))
            const excerpt = buildMultiExcerpt(selections, {
              maxChars: num(body, 'maxChars'),
              maxTokens: num(body, 'maxTokens'),
              contextRadius: num(body, 'contextRadius'),
            })
            json(res, 200, ok(excerpt))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/context`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = str(body, 'sessionId')
            const text = str(body, 'text')
            if (!sessionId || !text) return json(res, 400, fail('bad-request', 'sessionId and text are required'))
            const mode = body['mode'] === 'steer' ? 'steer' : 'inject'
            // Do not require the agent service at plugin inject time; look it up
            // lazily so the API can still report a clean fallback when no live
            // agent is available (e.g. cold archived session).
            const agents = (ctx as { get?(name: string): { get(id: string): { inject(m: unknown): void; steer(m: unknown): void } | undefined } | undefined }).get?.('agents')
            const agent = agents?.get(sessionId)
            if (!agent) {
              json(res, 200, ok({ delivered: false, reason: 'agent-not-found', mode }))
              return
            }
            const message = createUserMessage({
              content: [{ type: 'text', text }],
              source: { kind: 'plugin', plugin: 'dsh-session-archaeologist', form: 'recall' as const },
            })
            if (mode === 'steer') agent.steer(message)
            else agent.inject(message)
            json(res, 200, ok({ delivered: true, mode }))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
    ]
    return () => {
      for (const dispose of routes) dispose()
    }
  }, 'dsh-session-archaeologist: web routes')
}