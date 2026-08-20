/**
 * HTTP API for the dsh-time-machine web panel.
 *
 * Same-origin guarded (trustedRequest), `{ ok, value }` / `{ ok, error }`
 * envelope — the same convention as dsh-at-file. All mutating routes require
 * explicit confirmation (`confirmed: true`) and the host re-verifies hashes
 * before any write-back.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { HostAdapter } from './adapter.ts'
import type { RestoreTargetShape } from '../core/engine.ts'

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

function ok(value: unknown): unknown {
  return { ok: true, value }
}

function fail(code: string, message: string): unknown {
  return { ok: false, error: { code, message, details: {} } }
}

function requireString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function parseTarget(body: Record<string, unknown>): RestoreTargetShape | undefined {
  const kind = body['kind']
  if (kind === 'baseline') return { kind: 'baseline' }
  if (kind === 'turn') {
    const turn = body['turn']
    if (typeof turn === 'number') return { kind: 'turn', turn }
    return undefined
  }
  if (kind === 'file') {
    const relPath = requireString(body, 'relPath')
    const to = body['to']
    if (relPath && (to === 'baseline' || to === 'prev-turn' || to === 'current')) {
      return { kind: 'file', relPath, to }
    }
    return undefined
  }
  return undefined
}

export function registerApi(ctx: Context, adapter: HostAdapter): void {
  ctx.effect(() => {
    const base = '/plugins/dsh-time-machine/api'
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/timeline`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
            const record = await adapter.getRecord(sessionId)
            json(res, 200, ok({ record }))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/preview`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            const target = parseTarget(body)
            if (!sessionId || !target) return json(res, 400, fail('bad-request', 'sessionId and a valid target are required'))
            const includeContents = body['includeContents'] === true
            const previews = await adapter.previewRestore(sessionId, target, includeContents)
            json(res, 200, ok({ previews }))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/restore`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            const target = parseTarget(body)
            const confirmed = body['confirmed'] === true
            const force = body['force'] === true
            if (!sessionId || !target) return json(res, 400, fail('bad-request', 'sessionId and a valid target are required'))
            if (!confirmed) return json(res, 400, fail('bad-request', 'confirmed: true is required before any write-back'))
            const result = await adapter.commitRestore(sessionId, target, true, force)
            json(res, 200, ok(result))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/save-as`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            const relPath = requireString(body, 'relPath')
            const confirmed = body['confirmed'] === true
            const targetPath = typeof body['targetPath'] === 'string' ? body['targetPath'] : undefined
            if (!sessionId || !relPath) return json(res, 400, fail('bad-request', 'sessionId and relPath are required'))
            if (!confirmed) return json(res, 400, fail('bad-request', 'confirmed: true is required'))
            const result = await adapter.saveCurrentAs(sessionId, relPath, true, targetPath)
            json(res, 200, ok(result))
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
            await adapter.clear?.(sessionId)
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
  }, 'dsh-time-machine: web routes')
}
