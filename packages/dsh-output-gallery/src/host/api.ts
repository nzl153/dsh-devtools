/**
 * HTTP API for the gallery client.
 *
 * Same-origin guarded, same envelope style as dsh-context-xray / dsh-at-file:
 * `{ ok: true, value }` / `{ ok: false, error: { code, message, details } }`.
 * Static file serving is limited to tracked files and non-dangerous kinds.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { GalleryRuntime } from './runtime.ts'
import { safetyForPath } from '../core/safety.ts'
import { classifyPath } from '../core/classify.ts'
import type { GallerySession } from '../core/types.ts'

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

async function findTrackedFile(
  runtime: GalleryRuntime,
  sessionId: string,
  path: string,
): Promise<{ session: GallerySession; file: GallerySession['files'][number] } | null> {
  const session = await runtime.list(sessionId)
  if (!session) return null
  const normalized = path.replace(/\\/g, '/')
  const file = session.files.find((f) => f.path.replace(/\\/g, '/') === normalized)
  return file ? { session, file } : null
}

export function registerApi(ctx: Context, runtime: GalleryRuntime): void {
  ctx.effect(() => {
    const base = '/plugins/dsh-output-gallery/api'
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/list`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
            const session = await runtime.list(sessionId)
            json(res, 200, ok({ session }))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/refresh`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            if (!sessionId) return json(res, 400, fail('bad-request', 'sessionId is required'))
            const turn = typeof body['turn'] === 'number' ? body['turn'] : undefined
            const result = await runtime.refresh(sessionId, turn)
            json(res, 200, ok(result))
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
            const path = requireString(body, 'path')
            if (!sessionId || !path) return json(res, 400, fail('bad-request', 'sessionId and path are required'))
            const payload = await runtime.preview(sessionId, path)
            json(res, 200, ok(payload))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/pin`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            const path = requireString(body, 'path')
            const pinned = body['pinned'] === true || body['pinned'] === false ? body['pinned'] as boolean : undefined
            if (!sessionId || !path || pinned === undefined) {
              return json(res, 400, fail('bad-request', 'sessionId, path and pinned are required'))
            }
            const session = await runtime.setPinned(sessionId, path, pinned)
            json(res, 200, ok({ session }))
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
            const sessions = await runtime.listSessions()
            json(res, 200, ok({ sessions }))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/config`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const sessionId = requireString(body, 'sessionId')
            const result = await runtime.getConfig(sessionId ?? '')
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
            await runtime.clear(sessionId)
            json(res, 200, ok({ cleared: true, sessionId: sessionId ?? null }))
          } catch (error: unknown) {
            json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
          }
        },
      }),
    ]

    // Static raw file route: currently used for PDF inline preview.
    // Serves only tracked, non-dangerous files.
    routes.push(ctx.webServer.register({
      kind: 'prefix',
      path: '/plugins/dsh-output-gallery/file/',
      handler: async (req, res) => {
        if (req.method !== 'GET') return json(res, 405, fail('bad-request', 'method not allowed'))
        if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const rel = decodeURIComponent(url.pathname.slice('/plugins/dsh-output-gallery/file/'.length))
          const sessionId = req.headers['x-dsh-gallery-session'] as string | undefined
          if (!sessionId) return json(res, 400, fail('bad-request', 'missing x-dsh-gallery-session header'))
          const found = await findTrackedFile(runtime, sessionId, rel)
          if (!found) return json(res, 404, fail('not-found', 'file not tracked'))
          const verdict = safetyForPath(found.file.path, runtime.currentConfig().htmlSandbox)
          if (!verdict.allowDownload || verdict.kind === 'none') {
            return json(res, 403, fail('forbidden', 'file download is not allowed'))
          }
          const data = await readFile(found.file.absPath ?? '')
          const contentType = found.file.mime.startsWith('text/')
            ? `${found.file.mime}; charset=utf-8`
            : found.file.mime
          res.writeHead(200, {
            'content-type': contentType,
            'content-disposition': `inline; filename="${encodeURIComponent(found.file.path.split('/').pop() ?? 'file')}"`,
            'cache-control': 'private, no-store',
            'x-content-type-options': 'nosniff',
          })
          res.end(data)
        } catch (error: unknown) {
          json(res, 500, fail('internal', error instanceof Error ? error.message : String(error)))
        }
      },
    }))

    return () => {
      for (const dispose of routes) dispose()
    }
  }, 'dsh-output-gallery: web routes')
}