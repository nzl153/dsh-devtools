// dsh-dev-loop：host 业务编排 —— 配置加载、命令执行、信任确认、汇总。
// 同时集成 Watch 服务和 After Agent Turn 自动执行。

import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {
  AfterAgentStatus,
  CommandRun,
  DevLoopConfig,
  DevLoopSummary,
  WatchStatus,
} from '../core/types.ts'
import { loadConfig } from './config-loader.ts'
import { CommandRunner, type RunOptions } from './command-runner.ts'
import { TrustStore } from './trust-store.ts'
import { WatchService } from './watch-service.ts'
import { sendErrorToAgent, type SendErrorResult } from './agent-error.ts'

export interface RunActionResult {
  run: CommandRun
  needsTrust: boolean
  trusted: boolean
  config: DevLoopConfig | null
  warning?: string
}

export interface RunActionOptions {
  confirmTrust?: boolean
  maxOutputChars?: number
  onSettled?: (run: CommandRun) => void
}

function normalizeRoot(root: string): string {
  return root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

export class DevLoopService {
  private readonly runner: CommandRunner
  private readonly trust: TrustStore
  private readonly watch: WatchService
  private readonly disposers: Array<() => void> = []
  private readonly afterAgentRuns = new Map<string, { runId: string; status: CommandRun['status'] }>()

  constructor(
    private readonly ctx: Context,
    private readonly logDir: string,
  ) {
    this.runner = new CommandRunner(logDir)
    this.trust = new TrustStore()
    this.watch = new WatchService({
      loadConfig: (root) => loadConfig(root),
      runAction: (root, action, opts) => this.runAction(root, action, {
        confirmTrust: opts?.confirmTrust,
        onSettled: opts?.onSettled,
      }),
      isTrusted: (root) => this.trust.isTrusted(root),
    })

    this.disposers.push(this.ctx.on('session/event', (session, event) => {
      this.onSessionEvent(session as { header: { cwd?: string } | undefined; id: { toString(): string } }, event)
    }))
  }

  async summary(root: string | undefined): Promise<DevLoopSummary> {
    if (!root) {
      return {
        project: null,
        actions: [],
        runs: {},
        lastFail: null,
        needsTrust: false,
        trusted: false,
        logDir: this.logDir,
        watch: null,
        afterAgent: null,
      }
    }
    let config: DevLoopConfig | null = null
    try {
      config = await loadConfig(root)
    } catch {
      config = null
    }
    const runs = this.runner.allRuns().reduce<Record<string, CommandRun>>((acc, r) => {
      acc[r.id] = r
      return acc
    }, {})
    const lastFail = this.findLastFail(runs)
    const key = normalizeRoot(root)
    const afterRun = this.afterAgentRuns.get(key)
    const afterAgent: AfterAgentStatus | null = config?.afterAgent
      ? {
          enabled: config.afterAgent.enabled,
          action: config.afterAgent.action,
          lastRunId: afterRun?.runId ?? null,
          lastStatus: afterRun?.status ?? null,
        }
      : null
    return {
      project: config,
      actions: config ? Object.values(config.actions).map((a) => ({ name: a.name, kind: a.file ? 'file' as const : 'command' as const })) : [],
      runs,
      lastFail: lastFail ? { action: lastFail.action, at: lastFail.endedAt ?? lastFail.startedAt ?? 0, snippet: lastFail.lastError ?? '' } : null,
      needsTrust: config ? !this.trust.isTrusted(root) : false,
      trusted: config ? this.trust.isTrusted(root) : false,
      logDir: this.logDir,
      watch: config?.watch ? await this.watch.status(root) : null,
      afterAgent,
    }
  }

  async runAction(root: string, actionName: string, opts: RunActionOptions = {}): Promise<RunActionResult> {
    const config = await loadConfig(root)
    if (!config) {
      throw new Error(`项目根目录没有找到 .dsh/devloop.yml：${root}`)
    }
    const action = config.actions[actionName]
    if (!action) {
      throw new Error(`未知 action: ${actionName}`)
    }
    if (action.file) {
      // logs 这类动作不执行命令，只返回文件路径信息。
      const run: CommandRun = {
        id: `file-${actionName}`,
        project: root,
        action: actionName,
        command: '',
        status: 'succeeded',
        exitCode: null,
        cancelled: false,
        durationMs: 0,
        startedAt: Date.now(),
        endedAt: Date.now(),
        output: `log file: ${action.file}`,
        logFile: null,
        lastError: null,
      }
      opts.onSettled?.(run)
      return { run, needsTrust: false, trusted: this.trust.isTrusted(root), config }
    }

    if (!this.trust.isTrusted(root)) {
      if (opts.confirmTrust !== true) {
        return {
          run: {
            id: '',
            project: root,
            action: actionName,
            command: action.command ?? '',
            status: 'idle',
            exitCode: null,
            cancelled: false,
            durationMs: 0,
            startedAt: null,
            endedAt: null,
            output: '',
            logFile: null,
            lastError: null,
          },
          needsTrust: true,
          trusted: false,
          config,
        }
      }
      this.trust.confirm(root, config.name)
    }

    // 简单处理 dependsOn：依序执行依赖，任一失败则不执行本体。
    const deps = action.dependsOn ?? []
    for (const dep of deps) {
      const depAction = config.actions[dep]
      if (!depAction) {
        throw new Error(`action ${actionName} 的 dependsOn 引用了不存在的 action: ${dep}`)
      }
      if (depAction.file) continue
      const depResult = this.runAction(root, dep, { confirmTrust: this.trust.isTrusted(root), maxOutputChars: opts.maxOutputChars })
      const depRun = await depResult
      if (depRun.needsTrust || (depRun.run.status !== 'succeeded' && !depRun.run.cancelled)) {
        throw new Error(`依赖 action ${dep} 未成功（${depRun.run.status}），取消执行 ${actionName}`)
      }
    }

    const runOpts: RunOptions = {
      root,
      actionName,
      action,
      maxOutputChars: opts.maxOutputChars,
      logDir: this.logDir,
      onSettled: opts.onSettled,
    }
    const run = this.runner.run(runOpts)
    return { run, needsTrust: false, trusted: true, config }
  }

  cancelRun(id: string): boolean {
    return this.runner.cancel(id)
  }

  sendLastError(sessionId: string, root: string, actionName?: string): SendErrorResult {
    const runs = this.runner.allRuns().filter((r) => (!actionName || r.action === actionName) && r.status === 'failed')
    const run = runs[0]
    if (!run) {
      return { ok: false, method: 'fallback-copy', message: '没有找到失败输出' }
    }
    return sendErrorToAgent(this.ctx, sessionId, run.lastError ?? run.output)
  }

  confirmTrust(root: string, name?: string): boolean {
    const displayName = name ?? this.trustName(root)
    this.trust.confirm(root, displayName)
    return true
  }

  async watchStart(root: string): Promise<WatchStatus | null> {
    return this.watch.start(root)
  }

  async watchStop(root: string): Promise<WatchStatus | null> {
    return this.watch.stop(root)
  }

  /** 销毁：注销 session 事件监听并停止所有 watch。 */
  dispose(): void {
    for (const dispose of this.disposers) {
      try {
        dispose()
      } catch {
        // 忽略单次注销失败
      }
    }
    this.disposers.length = 0
    this.watch.dispose()
  }

  private onSessionEvent(session: { header: { cwd?: string } | undefined; id: { toString(): string } }, event: SessionEvent): void {
    if (event.type !== 'turn/end' || event.data.reason.kind !== 'completed') return
    const root = session.header?.cwd
    if (!root) return
    void this.runAfterAgent(root, session.id.toString())
  }

  private async runAfterAgent(root: string, _sessionId: string): Promise<void> {
    const config = await loadConfig(root).catch(() => null)
    if (!config?.afterAgent?.enabled) return
    const actionName = config.afterAgent.action
    if (!config.actions[actionName]) return
    if (!this.trust.isTrusted(root)) return
    if (this.isActionRunning(root, actionName)) return
    const key = normalizeRoot(root)
    const result = await this.runAction(root, actionName, {
      confirmTrust: false,
      onSettled: (run) => {
        const rec = this.afterAgentRuns.get(key)
        if (rec?.runId === run.id) rec.status = run.status
      },
    })
    if (result.needsTrust) return
    this.afterAgentRuns.set(key, { runId: result.run.id, status: result.run.status })
  }

  private isActionRunning(root: string, actionName: string): boolean {
    const key = normalizeRoot(root)
    return this.runner.allRuns().some(
      (r) => r.status === 'running' && r.action === actionName && normalizeRoot(r.project) === key,
    )
  }

  private trustName(root: string): string {
    const parts = root.split(/[\\/]/).filter(Boolean)
    return parts[parts.length - 1] || 'project'
  }

  getLogDir(): string {
    return this.logDir
  }

  private findLastFail(runs: Record<string, CommandRun>): CommandRun | null {
    let best: CommandRun | null = null
    for (const r of Object.values(runs)) {
      if (r.status !== 'failed') continue
      if (!best || (r.endedAt ?? 0) > (best.endedAt ?? 0)) best = r
    }
    return best
  }
}