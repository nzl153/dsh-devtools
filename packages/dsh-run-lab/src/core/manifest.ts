/**
 * Manifest 序列化 / 反序列化。
 * 只保存非 secret 字段；遇到疑似 secret 的键（key/token/secret/password）一律剔除。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { Experiment, CreateExperimentInput, BranchConfig } from './types.ts'
import { DEFAULT_MANIFESTS_DIR, DEFAULT_RUN_LAB_DIR, DEFAULT_WORKSPACES_DIR, MANIFEST_VERSION } from './types.ts'
import { parseAgentConfig, specFromCommand } from '../agent/driver.ts'

/** Manifest 根目录：~/.dsh/run-lab（可用 DSH_HOME 覆盖）。 */
export function runLabRoot(home: string = homeDir()): string {
  return resolve(home, '.dsh', DEFAULT_RUN_LAB_DIR)
}

export function manifestsDir(home: string = homeDir()): string {
  return resolve(runLabRoot(home), DEFAULT_MANIFESTS_DIR)
}

export function workspacesDir(home: string = homeDir()): string {
  return resolve(runLabRoot(home), DEFAULT_WORKSPACES_DIR)
}

function homeDir(): string {
  // process.env.HOME 在 Windows 上常被 Git Bash 设成家目录；优先用 USERPROFILE。
  return process.env.DSH_HOME
    ?? (process.platform === 'win32' ? (process.env.USERPROFILE ?? process.env.HOME ?? '.') : (process.env.HOME ?? '.'))
}

const SECRET_KEY = /(token|secret|password|credential|api[_-]?key|authorization|bearer)/i

/**
 * 深度脱敏：递归遍历，剔除键名命中 secret 的字段，并限制字符串长度。
 * 保留结构，便于 serde 往返。用于 manifest 落盘前。
 */
export function redactSecrets(value: unknown, maxString = 4000): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, maxString))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue
      out[k] = redactSecrets(v, maxString)
    }
    return out
  }
  if (typeof value === 'string') {
    return value.length > maxString ? value.slice(0, maxString) : value
  }
  return value
}

/** 归一化 BranchConfig：把 agentCommand 同步进 agent（Phase 2 推荐字段）。 */
function normalizeBranch(branch: BranchConfig): BranchConfig {
  const spec = parseAgentConfig(branch.agent) ?? specFromCommand(branch.agentCommand)
  return {
    ...branch,
    agent: spec ?? undefined,
    agentCommand: spec?.command ?? branch.agentCommand,
  }
}

/** 通过 CreateExperimentInput 构造一个新 Experiment（不含 result）。 */
export function createExperiment(input: CreateExperimentInput, now: Date = new Date()): Experiment {
  const id = `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    version: MANIFEST_VERSION,
    title: input.title?.trim() || input.prompt.slice(0, 48),
    prompt: input.prompt,
    baseline: input.baseline,
    baselineIsGit: false,
    baselineCommit: input.baselineCommit ?? null,
    isolation: input.forceCopy ? 'copy' : 'git-worktree',
    repeat: (input.repeat && Number.isInteger(input.repeat) && input.repeat > 0) ? input.repeat : 1,
    branches: [normalizeBranch(input.branches[0]), normalizeBranch(input.branches[1])],
    status: 'draft',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    result: null,
  }
}

export async function saveManifest(home: string, experiment: Experiment): Promise<string> {
  const dir = manifestsDir(home)
  await mkdir(dir, { recursive: true })
  const file = resolve(dir, `${experiment.id}.json`)
  const safe = redactSecrets(experiment)
  await writeFile(file, JSON.stringify(safe, null, 2), 'utf8')
  return file
}

export async function loadManifest(home: string, id: string): Promise<Experiment | null> {
  const file = resolve(manifestsDir(home), `${id}.json`)
  try {
    const text = await readFile(file, 'utf8')
    return JSON.parse(text) as Experiment
  } catch {
    return null
  }
}

export async function listManifests(home: string): Promise<Experiment[]> {
  const { readdir } = await import('node:fs/promises')
  const dir = manifestsDir(home)
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const out: Experiment[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const id = name.slice(0, -'.json'.length)
    const exp = await loadManifest(home, id)
    if (exp) out.push(exp)
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

/** 保证 manifests/workspaces 目录存在（返回根目录路径）。 */
export async function ensureRunLabDirs(home: string): Promise<{ root: string; manifests: string; workspaces: string }> {
  const root = runLabRoot(home)
  const m = manifestsDir(home)
  const w = workspacesDir(home)
  await mkdir(m, { recursive: true })
  await mkdir(w, { recursive: true })
  return { root, manifests: m, workspaces: w }
}

export function manifestDirname(): string {
  return dirname(manifestsDir())
}
