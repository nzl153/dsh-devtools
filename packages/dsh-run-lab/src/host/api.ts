/**
 * dsh-run-lab host HTTP API（webServer 路由）。
 * 同 dsh-at-file 模式：trustedRequest + { ok, value } envelope。
 * 端点：
 *   list                 —— 实验列表
 *   get                  —— 单个实验
 *   create               —— 创建实验（返回 Experiment）
 *   prepare              —— 准备隔离工作区
 *   run                  —— 串行跑 A/B
 *   delete               —— 删除实验 manifest（可选清理）
 *   capabilities         —— 返回版本/是否可用信息
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { RunLabService, RunLabRunOptions } from './service.ts'
import type { CreateExperimentInput, AgentSpec } from '../core/types.ts'

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

function reqString(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

export function registerRunLabApi(ctx: Context, service: RunLabService): void {
  ctx.effect(() => {
    const base = '/plugins/dsh-run-lab/api'
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/list`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            json(res, 200, ok(await service.list()))
          } catch (error) {
            json(res, 500, fail('internal', msg(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/get`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const id = reqString(body, 'id')
            if (!id) return json(res, 400, fail('bad-request', 'id is required'))
            const exp = await service.get(id)
            if (!exp) return json(res, 404, fail('not-found', `experiment ${id} not found`))
            json(res, 200, ok(exp))
          } catch (error) {
            json(res, 500, fail('internal', msg(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/create`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const input = parseCreateInput(body)
            if (typeof input === 'string') return json(res, 400, fail('bad-request', input))
            const exp = await service.create(input)
            json(res, 200, ok(exp))
          } catch (error) {
            json(res, 500, fail('internal', msg(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/run`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const id = reqString(body, 'id')
            if (!id) return json(res, 400, fail('bad-request', 'id is required'))
            const runOptions: RunLabRunOptions = {}
            const repeat = body['repeat']
            if (typeof repeat === 'number' && Number.isInteger(repeat) && repeat > 0) runOptions.repeat = repeat
            const out = await service.run(id, runOptions)
            json(res, 200, ok(out))
          } catch (error) {
            json(res, 500, fail('internal', msg(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/delete`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            const body = await readJson(req)
            const id = reqString(body, 'id')
            if (!id) return json(res, 400, fail('bad-request', 'id is required'))
            await service.delete(id)
            json(res, 200, ok({ deleted: true, id }))
          } catch (error) {
            json(res, 500, fail('internal', msg(error)))
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/capabilities`,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, fail('bad-request', 'method not allowed'))
          if (!trustedRequest(req)) return json(res, 403, fail('forbidden', 'forbidden'))
          try {
            json(res, 200, ok(service.capabilities()))
          } catch (error) {
            json(res, 500, fail('internal', msg(error)))
          }
        },
      }),
    ]
    return () => {
      for (const dispose of routes) dispose()
    }
  }, 'dsh-run-lab: web routes')
}

/** 解析 CreateExperimentInput；返回 string 表示校验错误。 */
export function parseCreateInput(body: Record<string, unknown>): CreateExperimentInput | string {
  const prompt = reqString(body, 'prompt')
  if (!prompt) return 'prompt is required'
  const baseline = reqString(body, 'baseline')
  if (!baseline) return 'baseline is required'
  const branchesRaw = body['branches']
  if (!Array.isArray(branchesRaw) || branchesRaw.length !== 2) {
    return 'branches must be an array of length 2'
  }
  const branches: CreateExperimentInput['branches'] = [parseBranch(branchesRaw[0], 'a'), parseBranch(branchesRaw[1], 'b')]
  const title = typeof body['title'] === 'string' ? body['title'] : undefined
  const baselineCommit = typeof body['baselineCommit'] === 'string' ? body['baselineCommit'] : null
  const forceCopy = body['forceCopy'] === true
  const repeat = typeof body['repeat'] === 'number' && Number.isInteger(body['repeat']) && body['repeat'] > 0
    ? body['repeat']
    : undefined
  return { title, prompt, baseline, baselineCommit, forceCopy, repeat, branches }
}

function parseBranch(raw: unknown, fallbackId: 'a' | 'b'): CreateExperimentInput['branches'][number] {
  const o = (raw ?? {}) as Record<string, unknown>
  const id = o['id'] === 'a' || o['id'] === 'b' ? o['id'] : fallbackId
  return {
    id,
    label: typeof o['label'] === 'string' && o['label'] ? o['label'] : `Branch ${id.toUpperCase()}`,
    agentCommand: typeof o['agentCommand'] === 'string' && o['agentCommand'] ? o['agentCommand'] : undefined,
    agent: toAgentSpec(o['agent']),
    workspaceOverrides: toRecord(o['workspaceOverrides']),
    evaluator: toEvaluator(o['evaluator']),
  }
}

function toAgentSpec(v: unknown): AgentSpec | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  const command = typeof o['command'] === 'string' && o['command'] ? o['command'] : undefined
  if (!command) return undefined
  return {
    driver: o['driver'] === 'dsh-inproc' ? 'dsh-inproc' : 'command',
    command,
    usesWorkspace: command.includes('$WORKSPACE') || command.includes('%WORKSPACE%'),
  }
}

function toRecord(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string') out[k] = val
  }
  return Object.keys(out).length ? out : undefined
}

function toEvaluator(v: unknown): CreateExperimentInput['branches'][number]['evaluator'] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  return {
    command: typeof o['command'] === 'string' ? o['command'] : '',
    expectExitCode: typeof o['expectExitCode'] === 'number' ? o['expectExitCode'] : undefined,
    expectFileExists: Array.isArray(o['expectFileExists']) ? o['expectFileExists'].filter((x) => typeof x === 'string') : undefined,
    junitFile: typeof o['junitFile'] === 'string' ? o['junitFile'] : undefined,
    regexAssertions: Array.isArray(o['regexAssertions']) ? o['regexAssertions'].filter((x) => typeof x === 'string') : undefined,
  }
}

function msg(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
