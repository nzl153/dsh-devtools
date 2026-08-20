/**
 * Watcher helper layer (pure core logic).
 *
 * The watcher is a FAST DISCOVERY HINT only — it is never the source of truth.
 * A file change is always confirmed by a full scan for final consistency. This
 * module is intentionally backend-agnostic so it can be unit-tested with a fake
 * watcher: it owns debounce/merge, ignore filtering and sequence bookkeeping,
 * and delegates the actual OS watching to an injected backend.
 *
 * Design:
 *  - The backend calls `emit(event)` with absolute paths (or null for an
 *    unknown/whole-tree event).
 *  - `schedule()` coalesces bursts: only the trailing event after a quiet
 *    period triggers the `onFlush` callback. Subsequent events during the quiet
 *    window reset the timer and are merged (paths union).
 *  - Ignore rules reuse `EngineConfig.ignoreDirs` / `ignoreFiles`.
 */
import path from 'node:path'
import type { EngineConfig } from './types.ts'

export interface WatcherEvent {
  /** Absolute path observed by the OS, or null for an unknown/whole-tree event. */
  readonly absPath: string | null
}

/** Minimal backend contract satisfied by both the real fs.watch backend and test fakes. */
export interface WatcherBackend {
  /** Begin watching. Returns a dispose function. */
  start(root: string, emit: (event: WatcherEvent) => void): Promise<() => void>
}

/** Callback invoked after a debounce window closes and there are pending events. */
export type WatcherFlush = (events: readonly WatcherEvent[]) => void | Promise<void>

export interface WatcherOptions {
  /** Debounce window in ms. Default 300. */
  readonly debounceMs?: number
  /** Max quiet window before a forced flush even under sustained load. Default 3000. */
  readonly maxWaitMs?: number
  readonly config: EngineConfig
}

interface Pending {
  readonly paths: Set<string>
  unknown: boolean
}

export class FileWatcher {
  private readonly config: EngineConfig
  private readonly debounceMs: number
  private readonly maxWaitMs: number
  private readonly onFlush: WatcherFlush
  private pending: Pending = { paths: new Set(), unknown: false }
  private timer: ReturnType<typeof setTimeout> | null = null
  private maxTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  constructor(options: WatcherOptions, onFlush: WatcherFlush) {
    this.config = options.config
    this.debounceMs = options.debounceMs ?? 300
    this.maxWaitMs = options.maxWaitMs ?? 3000
    this.onFlush = onFlush
  }

  /** Reject paths under ignored directories/files. Pure, exported for tests. */
  isIgnored(absPath: string, base?: string): boolean {
    const rel = this.toRel(absPath, base)
    const parts = rel.split('/')
    const baseName = parts[parts.length - 1] ?? ''
    if (this.config.ignoreDirs.includes(baseName) || this.config.ignoreDirs.includes(rel)) return true
    if (this.config.ignoreFiles.includes(baseName) || this.config.ignoreFiles.includes(rel)) return true
    // A path nested inside an ignored directory is ignored too.
    for (const dir of this.config.ignoreDirs) {
      if (rel === dir || rel.startsWith(dir + '/')) return true
    }
    return false
  }

  /** Normalize an absolute path to a workspace-relative posix path. */
  toRel(absPath: string, base?: string): string {
    const root = base ?? ''
    const rel = path.relative(root, absPath).replaceAll('\\', '/')
    return rel === '' || rel === '.' ? '' : rel
  }

  /** Begin watching via the backend. Returns a combined dispose function. */
  async start(backend: WatcherBackend, root: string): Promise<() => void> {
    const disposeBackend = await backend.start(root, (event) => this.emit(event, root))
    return () => {
      this.dispose()
      disposeBackend()
    }
  }

  /** Feed an OS event into the watcher (debounced + merged). */
  emit(event: WatcherEvent, base?: string): void {
    if (this.disposed) return
    if (event.absPath) {
      if (base && this.isIgnored(event.absPath, base)) return
      this.pending.paths.add(event.absPath)
    } else {
      this.pending.unknown = true
    }
    this.resetTimer()
  }

  /** Force an immediate flush of pending events (used by periodic reconciliation). */
  async flushNow(): Promise<void> {
    if (this.disposed) return
    const pending = this.pending
    this.pending = { paths: new Set(), unknown: false }
    this.clearTimers()
    if (pending.paths.size === 0 && !pending.unknown) return
    await this.onFlush([
      ...Array.from(pending.paths, (p) => ({ absPath: p })),
      ...(pending.unknown ? [{ absPath: null }] : []),
    ])
  }

  private resetTimer(): void {
    this.clearTimers()
    this.timer = setTimeout(() => { void this.flushNow() }, this.debounceMs)
    // Safety: force flush if the debounce keeps resetting (event storm).
    this.maxTimer = setTimeout(() => { void this.flushNow() }, this.maxWaitMs)
  }

  private clearTimers(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (this.maxTimer) { clearTimeout(this.maxTimer); this.maxTimer = null }
  }

  dispose(): void {
    this.disposed = true
    this.clearTimers()
  }
}
