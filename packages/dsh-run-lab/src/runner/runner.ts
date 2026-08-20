/**
 * 进程 runner：在指定 cwd 执行命令，收集 stdout/stderr（tail）、退出码、墙钟耗时。
 *
 * 兼容性策略：
 *  - POSIX：一律 `/bin/sh -c <command>`。
 *  - Windows：
 *    * 命令不含 shell 元字符（管道/重定向/&&/;/$/反引号等）时，直接 spawn 程序 + 参数
 *      —— 这能正确处理带空格的引号路径（cmd.exe /c 对这类路径有 quote-hell）。
 *    * 含 shell 元字符时才退回 `cmd.exe /d /s /c <command>`（尽力而为）。
 */
import { spawn } from 'node:child_process'
import type { ExecResult } from './types.ts'

export interface RunCommandOptions {
  cwd: string
  command: string
  timeoutMs?: number
  maxOutputBytes?: number
  env?: Record<string, string>
}

export interface RunCommandResult extends ExecResult {
  outputTail: string
  exitCode: number | null
  wallTimeMs: number
  signal?: string | null
  error?: string | null
}

const SHELL_META = /[|&<>;`$()]/

/** 把命令拆成 [program, ...args]，尊重双引号（Windows 风格，反斜杠不转义引号）。 */
export function splitCommand(command: string): string[] {
  const tokens: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    if (ch === '"') {
      inQuote = !inQuote
      continue
    }
    if (!inQuote && /\s/.test(ch)) {
      if (cur.length > 0) {
        tokens.push(cur)
        cur = ''
      }
      continue
    }
    cur += ch
  }
  if (cur.length > 0) tokens.push(cur)
  return tokens
}

/** 命令是否可安全地直接 spawn（无 shell 元字符）。 */
export function canSpawnDirect(command: string): boolean {
  return !SHELL_META.test(command)
}

export function runCommand(options: RunCommandOptions): Promise<RunCommandResult> {
  return new Promise((resolvePromise) => {
    const started = Date.now()

    let program: string
    let args: string[]
    let isShell = false

    if (process.platform === 'win32' && canSpawnDirect(options.command)) {
      // 直接 spawn，不用 cmd.exe（规避 quote-hell）
      const parts = splitCommand(options.command)
      if (parts.length === 0) throw new Error('empty command')
      program = parts[0]
      args = parts.slice(1)
    } else {
      isShell = true
      if (process.platform === 'win32') {
        program = process.env.ComSpec ?? 'cmd.exe'
        args = ['/d', '/s', '/c', options.command]
      } else {
        program = '/bin/sh'
        args = ['-c', options.command]
      }
    }

    let child
    try {
      child = spawn(program, args, {
        cwd: options.cwd,
        windowsHide: true,
        env: { ...process.env, ...(options.env ?? {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      resolvePromise({
        exitCode: null,
        outputTail: '',
        wallTimeMs: Date.now() - started,
        timedOut: false,
        stdout: '',
        stderr: '',
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }

    const maxBytes = options.maxOutputBytes ?? 200_000
    let stdout = Buffer.alloc(0)
    let stderr = Buffer.alloc(0)
    let combined = ''

    const append = (buf: Buffer, target: 'stdout' | 'stderr'): void => {
      if (target === 'stdout') stdout = Buffer.concat([stdout, buf]).subarray(-maxBytes)
      else stderr = Buffer.concat([stderr, buf]).subarray(-maxBytes)
      combined = (combined + buf.toString('utf8')).slice(-maxBytes)
    }

    child.stdout?.on('data', (d: Buffer) => append(Buffer.isBuffer(d) ? d : Buffer.from(d), 'stdout'))
    child.stderr?.on('data', (d: Buffer) => append(Buffer.isBuffer(d) ? d : Buffer.from(d), 'stderr'))

    let settled = false
    let timer: NodeJS.Timeout | undefined
    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return
        settled = true
        child.kill('SIGKILL')
        resolvePromise({
          exitCode: null,
          outputTail: combined,
          wallTimeMs: Date.now() - started,
          timedOut: true,
          stdout: stdout.toString('utf8'),
          stderr: stderr.toString('utf8'),
          signal: 'SIGKILL',
        })
      }, options.timeoutMs)
    }

    child.on('error', (error) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolvePromise({
        exitCode: null,
        outputTail: combined,
        wallTimeMs: Date.now() - started,
        timedOut: false,
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'),
        signal: null,
        error: error instanceof Error ? error.message : String(error),
      })
    })

    child.on('close', (code, signal) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolvePromise({
        exitCode: code,
        outputTail: combined,
        wallTimeMs: Date.now() - started,
        timedOut: false,
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'),
        signal,
      })
    })
  })
}
