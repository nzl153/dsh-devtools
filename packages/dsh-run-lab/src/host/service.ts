/**
 * RunLabService：host API 与 CLI 共用的应用层。
 * 封装 manifest 存取 + 引擎编排，返回干净的结果对象。
 */
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Experiment, CreateExperimentInput } from '../core/types.ts'
import {
  createExperiment,
  saveManifest,
  loadManifest,
  listManifests,
  manifestsDir,
  workspacesDir,
  ensureRunLabDirs,
} from '../core/manifest.ts'
import { runExperiment } from './engine.ts'

export interface RunLabServiceOptions {
  home: string
  timeoutMs?: number
  keepWorkspaces?: boolean
}

export interface RunLabRunOptions {
  /** 本次运行覆盖 manifest.repeat；缺省用创建时的 repeat。 */
  repeat?: number
}

export interface RunLabService {
  list(): Promise<Experiment[]>
  get(id: string): Promise<Experiment | null>
  create(input: CreateExperimentInput): Promise<Experiment>
  run(id: string, options?: RunLabRunOptions): Promise<Experiment>
  delete(id: string): Promise<void>
  capabilities(): { version: string; sequential: boolean; isolation: string[]; dshTokenFeed: boolean; commandAgentDriver: boolean }
}

export function createRunLabService(opts: RunLabServiceOptions): RunLabService {
  const engineOpts = (runOptions?: RunLabRunOptions) => ({
    home: opts.home,
    workspacesDir: workspacesDir(opts.home),
    timeoutMs: opts.timeoutMs ?? 10 * 60 * 1000,
    keepWorkspaces: opts.keepWorkspaces ?? false,
    repeatOverride: runOptions?.repeat ?? undefined,
  })

  return {
    async list() {
      return listManifests(opts.home)
    },
    async get(id) {
      return loadManifest(opts.home, id)
    },
    async create(input) {
      await ensureRunLabDirs(opts.home)
      const exp = createExperiment(input)
      await saveManifest(opts.home, exp)
      return exp
    },
    async run(id, options) {
      const exp = await loadManifest(opts.home, id)
      if (!exp) throw new Error(`experiment ${id} not found`)
      const out = await runExperiment(exp, engineOpts(options))
      return out.experiment
    },
    async delete(id) {
      const exp = await loadManifest(opts.home, id)
      if (!exp) return
      const file = resolve(manifestsDir(opts.home), `${id}.json`)
      await rm(file, { force: true })
      // 尽力清理工作区目录
      await rm(resolve(workspacesDir(opts.home), id), { recursive: true, force: true })
    },
    capabilities() {
      return {
        version: '0.8.0',
        sequential: true,
        isolation: ['git-worktree', 'copy'],
        dshTokenFeed: false,
        commandAgentDriver: true,
      }
    },
  }
}
