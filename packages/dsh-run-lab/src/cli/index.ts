#!/usr/bin/env node
/**
 * dsh-run-lab CLI —— 独立入口，直接 `node lib/cli.js` 跑核心实验。
 * 不依赖 DSH 内部 API（只依赖 node + git + 用户配置的命令）。
 *
 * 用法：
 *   dsh-run-lab create --prompt "..." --baseline <dir> --branch-a '<json>' --branch-b '<json>'
 *   dsh-run-lab list
 *   dsh-run-lab get <id>
 *   dsh-run-lab run <id>
 *   dsh-run-lab status <id>
 */
import { createRunLabService } from '../host/service.ts'
import { runLabRoot } from '../core/manifest.ts'
import type { CreateExperimentInput, Experiment } from '../core/types.ts'

const HOME = process.env.DSH_HOME
  ?? (process.platform === 'win32' ? (process.env.USERPROFILE ?? process.env.HOME ?? '.') : (process.env.HOME ?? '.'))

function service() {
  return createRunLabService({ home: HOME })
}

function fail(msg: string, code = 1): never {
  console.error(`[dsh-run-lab] ${msg}`)
  process.exit(code)
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    if (!m) continue
    const key = m[1]
    if (m[2] !== undefined) {
      out[key] = m[2]
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      out[key] = argv[i + 1]
      i++
    } else {
      out[key] = true
    }
  }
  return out
}

function loadInput(opts: Record<string, string | boolean>): CreateExperimentInput {
  const prompt = typeof opts['prompt'] === 'string' ? opts['prompt'] : ''
  const baseline = typeof opts['baseline'] === 'string' ? opts['baseline'] : ''
  if (!prompt) fail('missing --prompt')
  if (!baseline) fail('missing --baseline')
  const branchA = parseBranchJson(opts['branch-a'], 'a')
  const branchB = parseBranchJson(opts['branch-b'], 'b')
  if (!branchA) fail('missing/invalid --branch-a')
  if (!branchB) fail('missing/invalid --branch-b')
  const repeat = typeof opts['repeat'] === 'string' ? Number(opts['repeat']) : NaN
  return {
    title: typeof opts['title'] === 'string' ? opts['title'] : undefined,
    prompt,
    baseline,
    baselineCommit: typeof opts['commit'] === 'string' ? opts['commit'] : null,
    forceCopy: opts['force-copy'] === true,
    repeat: Number.isInteger(repeat) && repeat > 0 ? repeat : undefined,
    branches: [branchA, branchB],
  }
}

function parseBranchJson(v: string | boolean | undefined, fallbackId: 'a' | 'b'): CreateExperimentInput['branches'][number] | null {
  if (typeof v !== 'string' || v.length === 0) return null
  try {
    const o = JSON.parse(v) as Record<string, unknown>
    return {
      id: o['id'] === 'a' || o['id'] === 'b' ? o['id'] as 'a' | 'b' : fallbackId,
      label: typeof o['label'] === 'string' ? o['label'] : `Branch ${fallbackId.toUpperCase()}`,
      agentCommand: typeof o['agentCommand'] === 'string' && o['agentCommand'] ? o['agentCommand'] : undefined,
      agent: toAgentSpec(o['agent']),
      workspaceOverrides: toRecord(o['workspaceOverrides']),
      evaluator: (o['evaluator'] && typeof o['evaluator'] === 'object')
        ? (o['evaluator'] as CreateExperimentInput['branches'][number]['evaluator'])
        : undefined,
    }
  } catch (error) {
    console.error(`invalid --branch-${fallbackId} JSON: ${error instanceof Error ? error.message : String(error)}`)
    return null
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

function toAgentSpec(v: unknown): CreateExperimentInput['branches'][number]['agent'] {
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

function printExperiment(exp: Experiment): void {
  console.log(JSON.stringify(exp, null, 2))
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2)
  const opts = parseArgs(rest)
  const svc = service()

  switch (cmd) {
    case 'create': {
      const input = loadInput(opts)
      const exp = await svc.create(input)
      printExperiment(exp)
      return
    }
    case 'list': {
      const exps = await svc.list()
      console.log(JSON.stringify(exps.map((e) => ({ id: e.id, title: e.title, status: e.status, createdAt: e.createdAt })), null, 2))
      return
    }
    case 'get': {
      const id = rest[0]
      if (!id) fail('missing experiment id')
      const exp = await svc.get(id)
      if (!exp) fail(`experiment ${id} not found`, 1)
      printExperiment(exp)
      return
    }
    case 'run': {
      const id = rest[0]
      if (!id) fail('missing experiment id')
      const repeat = typeof opts['repeat'] === 'string' ? Number(opts['repeat']) : NaN
      const exp = await svc.run(id, Number.isInteger(repeat) && repeat > 0 ? { repeat } : {})
      console.log(`\n[run-lab] experiment ${exp.id} -> ${exp.status}`)
      if (exp.result) {
        console.log(`winner: ${exp.result.comparison.winner}`)
        for (const run of exp.result.runs) {
          const s = run.summary
          console.log(
            `  ${run.branch} x${run.repeat}:` +
            ` successRate=${(s.successRate * 100).toFixed(0)}%` +
            ` medianWall=${s.medianWallTimeMs ?? 'n/a'}ms` +
            ` medianToolCalls=${s.medianToolCalls ?? 'n/a'}` +
            ` medianTokens=${s.medianTokens ?? 'n/a'}`,
          )
        }
      }
      printExperiment(exp)
      return
    }
    case 'status': {
      const id = rest[0]
      if (!id) fail('missing experiment id')
      const exp = await svc.get(id)
      if (!exp) fail(`experiment ${id} not found`, 1)
      console.log(`id=${exp.id} status=${exp.status} baseline=${exp.baseline} isolation=${exp.isolation}`)
      return
    }
    case 'delete': {
      const id = rest[0]
      if (!id) fail('missing experiment id')
      await svc.delete(id)
      console.log(`deleted ${id}`)
      return
    }
    case 'root': {
      console.log(runLabRoot(HOME))
      return
    }
    case 'help':
    case '--help':
    case '-h':
    case undefined: {
      console.log(`dsh-run-lab CLI
usage:
  dsh-run-lab create --prompt <p> --baseline <dir> --branch-a '<json>' --branch-b '<json>' [--title t] [--commit c] [--force-copy] [--repeat N]
  dsh-run-lab list
  dsh-run-lab get <id>
  dsh-run-lab run <id> [--repeat N]
  dsh-run-lab status <id>
  dsh-run-lab delete <id>
  dsh-run-lab root
branch json example (evaluator only):
  {"id":"a","label":"all tests","evaluator":{"command":"node test.js","regexAssertions":[]}}
agent command example:
  {"id":"a","label":"default","agent":{"driver":"command","command":"dsh --profile headless \\\"$TASK\\\""}}
`)
      return
    }
    default:
      fail(`unknown command: ${cmd}`)
  }
}

main().catch((error) => {
  console.error(`[dsh-run-lab] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
  process.exit(1)
})
