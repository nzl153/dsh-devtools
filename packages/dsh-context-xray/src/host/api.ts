/**
 * HTTP API for the client panel. Same-origin guarded, same envelope style as
 * dsh-at-file: `{ ok: true, value }` / `{ ok: false, error }`.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { ContextAnalyzer } from './analyzer.ts'

function trustedRequest(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const host = req.headers.host
  if (host === undefined) return false
  const origin = req.headers.origin
  if (origin === undefined) return true
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

function requireString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export interface ApiVersions {
  readonly dshVersion: string
  readonly pluginVersion: string
}

export function registerApi(ctx: Context, analyzer: ContextAnalyzer, versions: ApiVersions): void {
  ctx.effect(() => {
    const base = '/plugins/dsh-context-xray/api'
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/snapshot`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
            const snapshot = await analyzer.snapshot(sessionId, {
              includeBody: body['includeBody'] === true,
            })
            json(res, 200, ok(snapshot))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/sessions`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const sessions = (ctx.get('sessions') as { list?: () => Array<{ id: string }> } | undefined)?.list?.() ?? []
            json(res, 200, ok({ sessions: sessions.map((s) => ({ id: s.id })) }))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/history`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
            const history = await analyzer.history(sessionId)
            json(res, 200, ok({ history }))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/diagnostic`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
            const diagnostic = await analyzer.diagnostic(sessionId, versions.dshVersion, versions.pluginVersion)
            json(res, 200, ok(diagnostic))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/clear`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            await analyzer.clear(sessionId)
            json(res, 200, ok({ cleared: true, sessionId: sessionId ?? null }))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
    ]
    return () => {
      for (const dispose of routes) dispose()
    }
  }, 'dsh-context-xray: web routes')
}