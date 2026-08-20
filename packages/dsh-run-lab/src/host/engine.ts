/**
 * 实验引擎：串行 A x N / B x N。
 *  1. prepare：探测 baseline 是否 git、建立隔离工作区（a/b）。
 *  2. run：对每个分支依次执行 N 次 Agent Run（AgentDriver wrapper）→ evaluator → diff。
 *  3. 聚合 success rate / 中位数，汇总 comparison，更新 manifest。
 *
 * 引擎不依赖 DSH 内部 API（只依赖 node child_process + 文件系统），
 * AgentRunner 通过 src/agent/driver.ts 的 AgentDriver 接口解耦；当前默认
 * CommandAgentDriver 把 agentCommand 作为外部命令执行。后续在宿主进程内接
 * DSH 官方 programmatic run API 时，替换 resolveAgentDriver 即可。
 */
import type { Experiment, BranchConfig, BranchRun, BranchResult, Metrics, ExperimentResult } from '../core/types.ts'
import { saveManifest } from '../core/manifest.ts'
import { emptyMetrics, mergeEvaluatorMetrics, compare, branchSuccess } from '../core/metrics.ts'
import { aggregateBranchRuns } from '../core/repeat.ts'
import { parseEvaluatorConfig, emptyEvaluatorResult, summarizeEvaluator } from '../core/evaluator.ts'
import { transition } from '../core/state-machine.ts'
import {
  createIsolatedWorkspace,
  removeIsolatedWorkspace,
  detectIsolation,
  type IsolationResult,
} from '../workspace/isolation.ts'
import { runCommand } from '../runner/runner.ts'
import {
  resolveAgentDriver,
  substituteWorkspace,
  specFromCommand,
  type AgentSpec,
} from '../agent/driver.ts'
import { collectDiffMetrics, snapshotDir, type DirSnapshot } from '../runner/diff.ts'
import { readFile, access, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseDshOutputMetrics } from '../dsh/adapter.ts'

export interface RunLabOptions {
  home?: string
  workspacesDir: string
  /** 命令超时（默认 10 分钟）。 */
  timeoutMs?: number
  /** 是否保存工作区（调试用，默认 false：跑完清理）。 */
  keepWorkspaces?: boolean
  /** repeat 覆盖：跑实验时临时指定每分支跑几遍（0/缺省用 manifest.repeat）。 */
  repeatOverride?: number
}

export interface PrepareResult {
  isolation: 'git-worktree' | 'copy'
  baselineCommit: string | null
  dirs: Record<'a' | 'b', string>
}

export interface ResolvedRunOutcome {
  experiment: Experiment
  branches: [BranchResult, BranchResult]
}

/**
 * 探测并准备两个隔离工作区。返回 { a, b } 目录与实验更新。
 * 抛错时不保留任何工作区（调用方负责清理）。
 */
export async function prepareExperiment(
  exp: Experiment,
  opts: RunLabOptions,
): Promise<{ experiment: Experiment; prepared: PrepareResult }> {
  const { isGit, headCommit } = await detectIsolation(exp.baseline, exp.isolation === 'copy')
  const isolation: 'git-worktree' | 'copy' = isGit && exp.isolation !== 'copy' ? 'git-worktree' : 'copy'
  const commit = exp.baselineCommit ?? headCommit ?? null
  const updated: Experiment = {
    ...exp,
    baselineIsGit: isGit,
    baselineCommit: commit,
    isolation,
    status: 'prepared',
  }

  const dirs: Record<'a' | 'b', string> = { a: '', b: '' }
  const cleanup: (() => Promise<void>)[] = []
  try {
    for (const branch of exp.branches) {
      const dir = resolve(opts.workspacesDir, exp.id, branch.id)
      const result = await createIsolatedWorkspace(
        {
          baseline: exp.baseline,
          baselineIsGit: isGit,
          commit,
          forceCopy: isolation === 'copy',
          overrides: branch.workspaceOverrides,
        },
        dir,
      )
      dirs[branch.id] = result.dir
      cleanup.push(() => removeIsolatedWorkspace(result.dir, result.method, exp.baseline))
    }
  } catch (error) {
    await Promise.allSettled(cleanup.map((fn) => fn()))
    throw error
  }

  return { experiment: updated, prepared: { isolation, baselineCommit: commit, dirs } }
}

async function cleanWorkspaces(wsDir: string, expId: string, baseline: string, method: 'git-worktree' | 'copy'): Promise<void> {
  for (const id of ['a', 'b'] as const) {
    await removeIsolatedWorkspace(resolve(wsDir, expId, id), method, baseline)
  }
  // 删除实验父目录（此时 a/b 已移除，git 不会占用）。
  await rm(resolve(wsDir, expId), { recursive: true, force: true })
}

/** 归一化出分支的 AgentSpec（manifest.agentCommand 老字段兼容进 agent）。 */
function resolveBranchAgent(branch: BranchConfig): AgentSpec | null {
  if (branch.agent?.command) return branch.agent
  if (branch.agentCommand) return specFromCommand(branch.agentCommand) ?? null
  return null
}

/**
 * 运行一个分支的某一次迭代：
 * Agent（AgentDriver wrapper 执行命令）→ evaluator → diff → 指标。
 * 返回单次 BranchRun（index 由调用方给定）。
 */
export async function runBranchIteration(
  exp: Experiment,
  branch: BranchConfig,
  wsDir: string,
  index: number,
  opts: RunLabOptions,
): Promise<BranchRun> {
  const metrics: Metrics = emptyMetrics()
  const outputParts: string[] = []
  const notes: string[] = []

  // 记录 copy 隔离的 before 快照（用于 diff）。
  let before: DirSnapshot | undefined
  if (exp.isolation === 'copy') {
    try {
      before = await snapshotDir(wsDir)
    } catch {
      before = undefined
    }
  }

  const agentSpec = resolveBranchAgent(branch)
  const startedAt = Date.now()
  try {
    // 1) Agent Run（AgentDriver wrapper；默认为 command 驱动）
    if (agentSpec?.command) {
      const driver = resolveAgentDriver(agentSpec.driver)
      const cmd = substituteWorkspace(agentSpec.command, wsDir)
      const res = await driver.run({ cwd: wsDir, command: cmd, timeoutMs: opts.timeoutMs })
      outputParts.push(`[agent] driver=${driver.kind} exit=${String(res.exitCode)}\n${res.outputTail}`)
      metrics.wallTimeMs = res.wallTimeMs
      metrics.errors = res.timedOut ? metrics.errors + 1 : metrics.errors
      metrics.success = res.success
      if (res.notes) notes.push(...res.notes)
      const dshMetrics = parseDshOutputMetrics(res.outputTail)
      Object.assign(metrics, dshMetrics)
      if (dshMetrics.inputTokens === undefined) {
        notes.push('input/output tokens unavailable: no DSH API feed (agentCommand mode)')
      }
    }

    // 2) Evaluator
    let evalRes = emptyEvaluatorResult(null)
    let exitCode: number | null = branch.agentCommand ? (metrics.success ? 0 : 1) : null
    if (branch.evaluator?.command) {
      const ec = parseEvaluatorConfig(branch.evaluator)
      const evalRun = await runCommand({ cwd: wsDir, command: ec.command, timeoutMs: opts.timeoutMs })
      exitCode = evalRun.exitCode
      outputParts.push(`[evaluator] exit=${String(evalRun.exitCode)}\n${evalRun.outputTail}`)
      if (evalRun.timedOut) notes.push('evaluator command timed out')
      if (!branch.agentCommand) {
        metrics.wallTimeMs = evalRun.wallTimeMs
        metrics.errors = evalRun.timedOut ? metrics.errors + 1 : metrics.errors
        metrics.success = evalRun.exitCode === 0
      }

      // JUnit
      let junitXml: string | null = null
      if (ec.junitFile) {
        try {
          junitXml = await readFile(resolve(wsDir, ec.junitFile), 'utf8')
        } catch {
          notes.push(`junit file not found: ${ec.junitFile}`)
        }
      }

      // file exists
      const fileChecks: { path: string; exists: boolean }[] = []
      for (const p of ec.expectFileExists ?? []) {
        const abs = p.includes('${workspace}') ? p.replace('${workspace}', wsDir) : resolve(wsDir, p)
        fileChecks.push({ path: p, exists: await __exists(abs) })
      }

      evalRes = summarizeEvaluator(ec, evalRun.exitCode, evalRun.outputTail, junitXml, fileChecks)
      if (evalRes.error) notes.push(String(evalRes.error))
    } else {
      // 无 evaluator：以 agent 退出码为准
      evalRes = emptyEvaluatorResult(exitCode)
    }

    // 3) 指标合并
    const merged = mergeEvaluatorMetrics(metrics, {
      exitCode,
      junit: evalRes.junit,
    })
    merged.success = branchSuccess(exitCode, evalRes.passed)

    // 4) diff
    const withDiff = await collectDiffMetrics(merged, exp.isolation, exp.baseline, wsDir, before)

    // 5) 时长：若既没 agent 也没 evaluator，墙钟为 0
    if (metrics.wallTimeMs === null) metrics.wallTimeMs = Date.now() - startedAt

    withDiff.notes = notes
    return {
      index,
      status: 'completed', // 指标里 success=false 也视为“跑完了”；引擎级异常走 catch
      metrics: withDiff,
      evaluator: evalRes,
      agent: agentSpec,
      outputTail: outputParts.join('\n').slice(-200_000),
      error: null,
    }
  } catch (error) {
    return {
      index,
      status: 'failed',
      metrics: { ...metrics, success: false, notes: [...notes, `runner error: ${error instanceof Error ? error.message : String(error)}`] },
      evaluator: emptyEvaluatorResult(null),
      agent: agentSpec,
      outputTail: outputParts.join('\n').slice(-200_000),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** 运行一个分支的 N 次迭代（串行），返回聚合后的 BranchResult。 */
export async function runBranch(
  exp: Experiment,
  branch: BranchConfig,
  wsDir: string,
  opts: RunLabOptions,
): Promise<BranchResult> {
  const repeat = opts.repeatOverride && opts.repeatOverride > 0 ? opts.repeatOverride : exp.repeat
  const runs: BranchRun[] = []
  for (let i = 0; i < repeat; i++) {
    runs.push(await runBranchIteration(exp, branch, wsDir, i, opts))
  }
  const aggregated = aggregateBranchRuns(branch.id, runs)
  const anyFailed = runs.some((r) => r.status === 'failed')
  return { ...aggregated, status: anyFailed ? 'failed' : 'completed' }
}

async function __exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/**
 * 完整跑一个实验（串行 A/B）：
 *  prepare -> run A -> run B -> compare -> 更新 manifest。
 * 跑完清理工作区（除非 keepWorkspaces）。返回最终 experiment + 两个分支结果。
 */
export async function runExperiment(
  exp: Experiment,
  opts: RunLabOptions,
): Promise<ResolvedRunOutcome> {
  let working: Experiment
  if (exp.status === 'completed' || exp.status === 'failed') {
    // 重新运行：清除旧结果，回到 draft 再走 prepared。
    working = { ...exp, status: 'draft', result: null, updatedAt: new Date().toISOString() }
  } else {
    working = exp
  }
  if (opts.repeatOverride && opts.repeatOverride > 0) {
    working = { ...working, repeat: opts.repeatOverride }
  }
  working = working.status === 'draft' ? transition(working, 'prepared') : transition(working, 'running')

  let prepared: PrepareResult | null = null
  try {
    const prep = await prepareExperiment(working, opts)
    prepared = prep.prepared
    working = transition(prep.experiment, 'running')

    const a = await runBranch(working, working.branches[0], prepared.dirs.a, opts)
    // 串行：A 全部 repeat 完成后再跑 B（并发留给后续版本）。
    const b = await runBranch(working, working.branches[1], prepared.dirs.b, opts)

    const result: ExperimentResult = {
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      runs: [a, b],
      comparison: compare(a.metrics, b.metrics, a.status, b.status),
    }

    working = {
      ...working,
      status: 'completed',
      result,
      updatedAt: new Date().toISOString(),
    }
    await saveManifest(opts.home ?? homeDefault(), working)
    return { experiment: working, branches: [a, b] }
  } catch (error) {
    const failedRun = (branch: 'a' | 'b'): BranchResult => ({
      branch,
      status: 'failed',
      repeat: working.repeat,
      runs: [],
      metrics: emptyMetrics(),
      summary: { count: 0, successCount: 0, successRate: 0, medianWallTimeMs: null, medianToolCalls: null, medianInputTokens: null, medianOutputTokens: null, medianTokens: null },
      evaluator: null,
      outputTail: '',
      error: error instanceof Error ? error.message : String(error),
    })
    working = {
      ...working,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      result: {
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        runs: [failedRun('a'), failedRun('b')],
        comparison: compare(emptyMetrics(), emptyMetrics()),
      },
    }
    await saveManifest(opts.home ?? homeDefault(), working).catch(() => {})
    throw error
  } finally {
    if (prepared && !opts.keepWorkspaces) {
      await cleanWorkspaces(opts.workspacesDir, working.id, exp.baseline, prepared.isolation)
    }
  }
}

function homeDefault(): string {
  return process.env.DSH_HOME ?? (process.platform === 'win32' ? (process.env.USERPROFILE ?? process.env.HOME ?? '.') : (process.env.HOME ?? '.'))
}
