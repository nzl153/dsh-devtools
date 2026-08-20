// dsh-dev-loop：host Watch 服务。
// - 使用 Node fs.watch（每个目录独立 watcher，跨平台可用），无第三方依赖
// - 默认忽略常见 build/test 输出目录，避免 watch 触发自身产物导致死循环
// - 复用 core WatchScheduler 实现防重入 / queued-latest

import { watch, statSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { WatchConfig, DevLoopConfig, WatchStatus, CommandRun } from '../core/types.ts'
import { WatchScheduler } from '../core/watch-scheduler.ts'

const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', '.dsh', '.idea', '.vscode',
  'dist', 'build', 'out', 'target', 'bin', 'obj', 'coverage',
  '.next', '.nuxt', '.cache', '.turbo', '.parcel-cache', '.dev-loop-logs', '.dsh-memory',
])

function normalizeKey(root: string): string {
  return resolve(root).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function basenameSegments(p: string): string[] {
  return p.split(/[\\/]/).filter(Boolean).map((s) => s.toLowerCase())
}

function isIgnored(p: string, ignoreSet: Set<string>): boolean {
  return basenameSegments(p).some((seg) => ignoreSet.has(seg))
}

export interface WatchRunResult {
  run: CommandRun
  needsTrust: boolean
}

export interface WatchServiceDeps {
  loadConfig(root: string): Promise<DevLoopConfig | null>
  runAction(
    root: string,
    action: string,
    opts?: { confirmTrust?: boolean; onSettled?: (run: CommandRun) => void },
  ): Promise<WatchRunResult>
  isTrusted(root: string): boolean
}

interface WatcherHandle {
  close(): void
}

interface WatchEntry {
  root: string
  config: WatchConfig
  scheduler: WatchScheduler
  watcher: WatcherHandle | null
  timer: NodeJS.Timeout | null
  started: boolean
  needsTrust: boolean
  lastRunId: string | null
  lastStatus: CommandRun['status'] | null
  lastTriggeredAt: number | null
  lastError: string | null
  disposed: boolean
}

export class WatchService {
  private readonly entries = new Map<string, WatchEntry>()

  constructor(private readonly deps: WatchServiceDeps) {}

  /** 停止全部监听（插件卸载/热重载时调用）。 */
  dispose(): void {
    for (const entry of this.entries.values()) {
      this.stopEntry(entry)
    }
    this.entries.clear()
  }

  async start(root: string): Promise<WatchStatus | null> {
    const config = await this.deps.loadConfig(root)
    if (!config?.watch) return null
    const key = normalizeKey(root)
    const existing = this.entries.get(key)
    if (existing?.started) return this.buildStatus(existing, config.watch)

    if (!this.deps.isTrusted(root)) {
      const entry: WatchEntry = existing ?? {
        root,
        config: config.watch,
        scheduler: new WatchScheduler(),
        watcher: null,
        timer: null,
        started: false,
        needsTrust: true,
        lastRunId: null,
        lastStatus: null,
        lastTriggeredAt: null,
        lastError: null,
        disposed: false,
      }
      entry.config = config.watch
      entry.needsTrust = true
      this.entries.set(key, entry)
      return this.buildStatus(entry, config.watch)
    }

    let entry = existing
    if (!entry) {
      entry = {
        root,
        config: config.watch,
        scheduler: new WatchScheduler(),
        watcher: null,
        timer: null,
        started: false,
        needsTrust: false,
        lastRunId: null,
        lastStatus: null,
        lastTriggeredAt: null,
        lastError: null,
        disposed: false,
      }
      this.entries.set(key, entry)
    }
    entry.config = config.watch
    entry.needsTrust = false
    this.startWatchers(entry)
    return this.buildStatus(entry, config.watch)
  }

  async stop(root: string): Promise<WatchStatus | null> {
    const config = await this.deps.loadConfig(root)
    const key = normalizeKey(root)
    const entry = this.entries.get(key)
    if (entry) {
      this.stopEntry(entry)
      this.entries.delete(key)
    }
    return config?.watch ? this.status(root) : null
  }

  async status(root: string): Promise<WatchStatus | null> {
    const config = await this.deps.loadConfig(root)
    if (!config?.watch) return null
    const key = normalizeKey(root)
    const entry = this.entries.get(key)
    if (!entry) {
      return {
        configured: true,
        started: false,
        action: config.watch.action,
        paths: config.watch.paths,
        debounce: config.watch.debounce,
        running: false,
        pending: false,
        needsTrust: !this.deps.isTrusted(root),
        lastRunId: null,
        lastStatus: null,
        lastTriggeredAt: null,
        lastError: null,
      }
    }
    return this.buildStatus(entry, config.watch)
  }

  private startWatchers(entry: WatchEntry): void {
    this.stopWatcher(entry)
    const ignoreSet = new Set(DEFAULT_IGNORE_DIRS)
    for (const ig of entry.config.ignore ?? []) {
      ignoreSet.add(ig.toLowerCase())
    }
    let startedAny = false
    let lastError: string | null = null
    const handles: WatcherHandle[] = []
    for (const rel of entry.config.paths) {
      const target = resolve(entry.root, rel)
      try {
        const st = statSync(target)
        if (!st.isDirectory()) {
          lastError = `watch.paths 不是目录：${target}`
          continue
        }
        const handle = createRecursiveWatcher(
          target,
          ignoreSet,
          () => this.schedule(entry),
          (error) => {
            entry.lastError = error instanceof Error ? error.message : String(error)
          },
        )
        handles.push(handle)
        startedAny = true
      } catch (error) {
        lastError = `无法监听 ${target}：${error instanceof Error ? error.message : String(error)}`
      }
    }
    if (!startedAny) {
      entry.needsTrust = false
      entry.lastError = lastError
      entry.started = false
      entry.lastStatus = null
      for (const h of handles) h.close()
      return
    }
    entry.watcher = {
      close: () => { for (const h of handles) h.close() },
    }
    entry.started = true
    entry.lastError = lastError
  }

  private stopWatcher(entry: WatchEntry): void {
    if (entry.watcher) {
      entry.watcher.close()
      entry.watcher = null
    }
    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
    entry.started = false
  }

  private stopEntry(entry: WatchEntry): void {
    entry.disposed = true
    this.stopWatcher(entry)
    entry.scheduler.reset()
  }

  private schedule(entry: WatchEntry): void {
    if (!entry.started || entry.disposed) return
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      entry.timer = null
      void this.fire(entry)
    }, Math.max(0, entry.config.debounce))
  }

  private async fire(entry: WatchEntry): Promise<void> {
    if (!entry.started || entry.disposed) return
    entry.lastTriggeredAt = Date.now()
    entry.lastError = null
    const shouldStart = entry.scheduler.trigger()
    if (shouldStart) await this.execute(entry)
  }

  private async execute(entry: WatchEntry): Promise<void> {
    if (entry.disposed) return
    try {
      const result = await this.deps.runAction(entry.root, entry.config.action, {
        confirmTrust: false,
        onSettled: (run) => this.onRunSettled(entry, run),
      })
      if (result.needsTrust) {
        entry.needsTrust = true
        entry.lastError = 'watch 自动执行需要先信任该项目'
        this.stopWatcher(entry)
        entry.scheduler.reset()
        return
      }
      entry.needsTrust = false
      entry.lastRunId = result.run.id
      entry.lastStatus = result.run.status
      // onSettled 由 runAction/CommandRunner 负责触发：command 在终态触发，file 同步触发
    } catch (error) {
      entry.lastError = error instanceof Error ? error.message : String(error)
      if (entry.scheduler.finish()) {
        void this.execute(entry)
      }
    }
  }

  private onRunSettled(entry: WatchEntry, run: CommandRun): void {
    if (entry.disposed) return
    entry.lastStatus = run.status
    if (entry.scheduler.finish()) {
      void this.execute(entry)
    }
  }

  private buildStatus(entry: WatchEntry, config: WatchConfig): WatchStatus {
    return {
      configured: true,
      started: entry.started,
      action: config.action,
      paths: config.paths,
      debounce: config.debounce,
      running: entry.scheduler.running,
      pending: entry.scheduler.pending,
      needsTrust: entry.needsTrust,
      lastRunId: entry.lastRunId,
      lastStatus: entry.lastStatus,
      lastTriggeredAt: entry.lastTriggeredAt,
      lastError: entry.lastError,
    }
  }
}

/**
 * 递归目录监听：为每个目录单独 fs.watch，并跟随新出现的子目录。
 * 每次变化时把绝对路径交给 onChange；被 ignore 的目录整体跳过。
 */
function createRecursiveWatcher(
  rootDir: string,
  ignoreSet: Set<string>,
  onChange: (filePath: string) => void,
  onError: (error: Error) => void,
): WatcherHandle {
  const watchers = new Map<string, import('node:fs').FSWatcher>()
  const watchedDirs = new Set<string>()
  let closed = false

  const watchDir = (dir: string): void => {
    if (closed || watchedDirs.has(dir) || isIgnored(dir, ignoreSet)) return
    let st
    try {
      st = statSync(dir)
    } catch {
      return
    }
    if (!st.isDirectory()) return
    watchedDirs.add(dir)

    let watcher: import('node:fs').FSWatcher
    try {
      watcher = watch(dir, (eventType, filename) => {
        const child = filename ? join(dir, filename.toString()) : dir
        if (isIgnored(child, ignoreSet)) return
        try {
          const childSt = statSync(child)
          if (childSt.isDirectory() && !watchedDirs.has(child)) watchDir(child)
        } catch {
          // 文件被删除/移动：不视为目录
        }
        onChange(child)
      })
      watcher.on('error', (error) => onError(error))
      watchers.set(dir, watcher)
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)))
      return
    }

    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (ent.isDirectory()) watchDir(join(dir, ent.name))
    }
  }

  watchDir(rootDir)

  return {
    close: () => {
      closed = true
      for (const w of watchers.values()) w.close()
      watchers.clear()
      watchedDirs.clear()
    },
  }
}