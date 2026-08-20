// dsh-dev-loop：host 命令执行器。
// - child_process.spawn 流式输出
// - Windows 取消用 taskkill /T /F 杀进程树；其他平台用 SIGTERM
// - 输出有界截断 + ANSI 安全渲染（内存中保留去 ANSI 的有界文本）
// - 完整日志本地保存（保留原始 ANSI 文本）
// - secrets redaction：从 action.env 的敏感键值中屏蔽输出

import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, relative } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { randomUUID } from 'node:crypto'
import type { DevLoopAction, CommandRun } from '../core/types.ts'
import { applyState, createStateMachine } from '../core/state-machine.ts'
import { redactText, stripAnsi, truncateOutput, extractLastFailSection } from '../core/log.ts'
import { isSecretEnvKey } from '../core/config.ts'

export const DEFAULT_MAX_OUTPUT_CHARS = 200_000
export const DEFAULT_LOG_DIR = () => join(homedir(), '.dsh', 'dev-loop', 'logs')

export interface RunOptions {
  root: string
  actionName: string
  action: DevLoopAction
  /** 覆盖默认输出上限。 */
  maxOutputChars?: number
  /** 覆盖默认日志目录（测试用）。 */
  logDir?: string
  /** 该 run 进入终态（succeeded/failed/cancelled）时回调一次。 */
  onSettled?: (run: CommandRun) => void
}

interface ActiveRun {
  child: ChildProcessWithoutNullStreams
  cancelRequested: boolean
  run: CommandRun
  rawOutput: string
  redactor: (text: string) => string
  onSettled?: () => void
}

function safeName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return (parts[parts.length - 1] || 'project').replace(/[^a-zA-Z0-9_-]/g, '_')
}

/** 生成可阅读的本地日志文件名。 */
export function logFileName(project: string, action: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const safeProject = safeName(project)
  const safeAction = action.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `${stamp}-${safeProject}-${safeAction}.log`
}

function killTree(child: ChildProcessWithoutNullStreams): void {
  if (process.platform === 'win32' && child.pid) {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {
      // taskkill 完成前 close 事件通常会先到；回调只作兜底
    })
  } else {
    child.kill('SIGTERM')
  }
}

function dirname(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return idx > 0 ? p.slice(0, idx) : '.'
}

export class CommandRunner {
  private readonly active = new Map<string, ActiveRun>()
  private readonly runs = new Map<string, CommandRun>()

  constructor(private readonly logDir: string = DEFAULT_LOG_DIR()) {
    mkdirSync(logDir, { recursive: true })
  }

  /** 当前已知运行，按开始时间倒序。 */
  allRuns(): CommandRun[] {
    return [...this.runs.values()].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
  }

  getRun(id: string): CommandRun | undefined {
    return this.runs.get(id)
  }

  isRunning(id: string): boolean {
    return this.active.has(id)
  }

  /** 执行一个 action。依赖解析由上层负责。返回 run 的初始快照。 */
  run(opts: RunOptions): CommandRun {
    const { action } = opts
    const actionName = opts.actionName
    const id = randomUUID()
    const startedAt = Date.now()
    const command = action.command ?? ''
    const shell = action.shell ?? (process.platform === 'win32' ? 'cmd.exe' : '/bin/sh')
    const cwd = resolve(opts.root, action.cwd ?? '.')
    const env: NodeJS.ProcessEnv = { ...process.env, ...(action.env ?? {}) }
    const projectName = safeName(opts.root)
    const logFile = join(this.logDir, projectName, logFileName(projectName, actionName))
    mkdirSync(dirname(logFile), { recursive: true })
    writeFileSync(logFile, `# dsh-dev-loop run ${id}\n# project: ${opts.root}\n# action: ${actionName}\n# command: ${command}\n# started: ${new Date(startedAt).toISOString()}\n\n`, 'utf8')

    const run: CommandRun = {
      id,
      project: opts.root,
      action: actionName,
      command,
      status: 'idle',
      exitCode: null,
      cancelled: false,
      durationMs: 0,
      startedAt,
      endedAt: null,
      output: '',
      logFile,
      lastError: null,
    }
    const machine = createStateMachine()
    machine.start()
    const started = applyState(run, 'running', { startedAt })
    let current = started.run

    const secrets = Object.entries(action.env ?? {})
      .filter(([k]) => isSecretEnvKey(k))
      .map(([, v]) => v)
    const redactor = (text: string) => redactText(text, secrets)

    let rawOutput = ''
    let bounded = ''
    let truncated = false
    let settled = false
    let onSettled: (() => void) | undefined = undefined

    const settle = (): void => {
      const cb = onSettled
      onSettled = undefined
      if (cb) cb()
    }

    const finalize = (status: 'succeeded' | 'failed' | 'cancelled', exitCode: number | null): void => {
      if (settled) return
      settled = true
      const endedAt = Date.now()
      const cancelled = status === 'cancelled'
      const ended = applyState(current, status, { exitCode, cancelled, endedAt, durationMs: endedAt - startedAt })
      current = ended.run
      if (status === 'failed' || (status === 'cancelled' && rawOutput.length > 0)) {
        const section = extractLastFailSection(bounded || stripAnsi(rawOutput))
        current.lastError = section
      }
      if (!current.lastError && status === 'failed') {
        current.lastError = stripAnsi(rawOutput).slice(-2000)
      }
      appendFileSync(logFile, `\n# ended: ${new Date(endedAt).toISOString()}\n# exit: ${exitCode ?? 'null'} status=${status}\n`, 'utf8')
      this.runs.set(id, current)
      this.active.delete(id)
      settle()
    }

    try {
      const child = spawn(command, {
        cwd,
        env,
        shell,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }) as unknown as ChildProcessWithoutNullStreams
      const handle: ActiveRun = {
        child,
        cancelRequested: false,
        run: current,
        rawOutput,
        redactor,
      }
      this.active.set(id, handle)

      const stdoutDecoder = new StringDecoder('utf8')
      const stderrDecoder = new StringDecoder('utf8')

      const ingest = (chunk: string): void => {
        rawOutput += chunk
        handle.rawOutput = rawOutput
        const redacted = redactor(stripAnsi(chunk))
        bounded += redacted
        const res = truncateOutput(bounded, { maxLength: opts.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS })
        bounded = res.text
        truncated = truncated || res.truncated
        appendFileSync(logFile, chunk, 'utf8')
        const updated = { ...current, output: bounded }
        current = updated
        handle.run = updated
        this.runs.set(id, updated)
      }

      child.stdout.on('data', (chunk: Buffer) => ingest(stdoutDecoder.write(chunk)))
      child.stderr.on('data', (chunk: Buffer) => ingest(stderrDecoder.write(chunk)))

      child.on('error', (error: Error) => {
        rawOutput += `\n[spawn error] ${error.message}\n`
        handle.rawOutput = rawOutput
        appendFileSync(logFile, `\n[spawn error] ${error.message}\n`, 'utf8')
        finalize('failed', null)
      })

      child.on('close', (code: number | null, signal: string | null) => {
        if (handle.cancelRequested || signal === 'SIGTERM') {
          finalize('cancelled', code)
        } else {
          finalize(code === 0 ? 'succeeded' : 'failed', code)
        }
      })

      onSettled = opts.onSettled ? () => opts.onSettled!(current) : () => {}
      if (action.timeout && action.timeout > 0) {
        const timer = setTimeout(() => {
          handle.cancelRequested = true
          killTree(child)
        }, action.timeout)
        const prevSettle = onSettled
        onSettled = () => {
          clearTimeout(timer)
          if (prevSettle) prevSettle()
        }
      }
      handle.onSettled = onSettled
    } catch (error: unknown) {
      const message = `[spawn failed] ${error instanceof Error ? error.message : String(error)}`
      rawOutput = message
      bounded = message
      const failed = applyState(current, 'failed', { exitCode: null, endedAt: Date.now(), durationMs: Date.now() - startedAt })
      current = failed.run
      current.output = bounded
      current.lastError = message
      this.runs.set(id, current)
      this.active.delete(id)
      settle()
    }

    this.runs.set(id, current)
    return current
  }

  /** 取消指定运行。 */
  cancel(id: string): boolean {
    const handle = this.active.get(id)
    if (!handle) return false
    handle.cancelRequested = true
    killTree(handle.child)
    return true
  }

  /** 清理内存中的历史（不影响已落盘日志）。 */
  clear(): void {
    this.runs.clear()
  }
}