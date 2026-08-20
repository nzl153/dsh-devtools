// dsh-dev-loop：HTTP API for the client panel。
// Same-origin guarded，envelope { ok, value } / { ok, error }。

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { DevLoopService } from './devloop-service.ts'
import { generateTemplate } from './config-loader.ts'

const BASE = '/plugins/dsh-dev-loop/api'

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
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
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

function requiredString(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key]
  return typeof v === 'string' ? v : undefined
}

export function registerApi(ctx: Context, service: DevLoopService): () => void {
  const routes = [
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/summary`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
        if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
        try {
          const body = await readJson(req)
          const root = optionalString(body, 'root')
          const summary = await service.summary(root ?? undefined)
          json(res, 200, ok(summary))
        } catch (error) {
          json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/run`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
        if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
        try {
          const body = await readJson(req)
          const root = requiredString(body, 'root')
          const action = requiredString(body, 'action')
          if (!root || !action) return json(res, 400, fail('bad-request', 'root and action are required'))
          const result = await service.runAction(root, action, {
            confirmTrust: body['confirmTrust'] === true,
            maxOutputChars: typeof body['maxOutputChars'] === 'number' ? body['maxOutputChars'] : undefined,
          })
          json(res, 200, ok(result))
        } catch (error) {
          json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/cancel`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
        if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
        try {
          const body = await readJson(req)
          const id = requiredString(body, 'id')
          if (!id) return json(res, 400, fail('bad-request', 'id is required'))
          const cancelled = service.cancelRun(id)
          json(res, 200, ok({ cancelled }))
        } catch (error) {
          json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/confirm-trust`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
        if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
        try {
          const body = await readJson(req)
          const root = requiredString(body, 'root')
          if (!root) return json(res, 400, fail('bad-request', 'root is required'))
          const name = optionalString(body, 'name')
          service.confirmTrust(root, name)
          json(res, 200, ok({ trusted: true, root }))
        } catch (error) {
          json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/send-error`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
        if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
        try {
          const body = await readJson(req)
          const sessionId = requiredString(body, 'sessionId')
          const root = requiredString(body, 'root')
          if (!sessionId || !root) return json(res, 400, fail('bad-request', 'sessionId and root are required'))
          const action = optionalString(body, 'action')
          const result = service.sendLastError(sessionId, root, action)
          json(res, 200, ok(result))
        } catch (error) {
          json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/watch-start`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
        if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
        try {
          const body = await readJson(req)
          const root = requiredString(body, 'root')
          if (!root) return json(res, 400, fail('bad-request', 'root is required'))
          const status = await service.watchStart(root)
          json(res, 200, ok({ status }))
        } catch (error) {
          json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/watch-stop`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
        if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
        try {
          const body = await readJson(req)
          const root = requiredString(body, 'root')
          if (!root) return json(res, 400, fail('bad-request', 'root is required'))
          const status = await service.watchStop(root)
          json(res, 200, ok({ status }))
        } catch (error) {
          json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/generate-preset`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
        if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
        try {
          const body = await readJson(req)
          const framework = requiredString(body, 'framework')
          const name = requiredString(body, 'name') ?? 'My Project'
          const root = optionalString(body, 'root') ?? ''
          const allowed = ['node', 'python', 'rust', 'dotnet', 'godot'] as const
          if (!framework || !(allowed as readonly string[]).includes(framework)) {
            return json(res, 400, fail('bad-request', `framework must be one of ${allowed.join(', ')}`))
          }
          const text = generateTemplate(framework as typeof allowed[number], name, root)
          json(res, 200, ok({ text, framework, name }))
        } catch (error) {
          json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
        }
      },
    }),
  ]

  return () => {
    for (const dispose of routes) dispose()
  }
}