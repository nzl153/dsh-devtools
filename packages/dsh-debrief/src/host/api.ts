/**
 * HTTP API for the dsh-debrief client. Same-origin guarded, same envelope
 * style as the reference plugins: `{ ok: true, value }` / `{ ok: false, error }`.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { DebriefEngine } from './engine.ts'

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

export function registerApi(ctx: Context, engine: DebriefEngine): void {
  ctx.effect(() => {
    const base = '/plugins/dsh-debrief/api'
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/turn`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            const turn = typeof body['turn'] === 'number' && Number.isInteger(body['turn']) ? body['turn'] : undefined
            if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
            if (turn === undefined) return json(res, 400, fail('bad-request', 'turn is required'))
            json(res, 200, ok(engine.turnDebrief(sessionId, turn)))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/session`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
            json(res, 200, ok(engine.sessionDebrief(sessionId)))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/turns`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
            json(res, 200, ok({ turns: engine.knownTurns(sessionId) }))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/settings`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            json(res, 200, ok(engine.rawSettings()))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
    ]
    return () => {
      for (const dispose of routes) dispose()
    }
  }, 'dsh-debrief: web routes')
}