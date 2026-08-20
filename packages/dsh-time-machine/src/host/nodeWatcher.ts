/**
 * Node fs.watch backend for the watcher helper layer.
 *
 * Uses `fs.watch` with `recursive: true` where supported (Node 20+ on Windows)
 * and falls back to a non-recursive watch on the root + the FileWatcher's
 * periodic reconciliation scan to catch nested changes. Emits `WatcherEvent`s
 * (absolute paths, or null for whole-root events) to the core FileWatcher.
 *
 * This is only a fast-discovery hint; the engine always confirms via a full
 * scan, so missed events here are safe.
 */
import { watch, type FSWatcher } from 'node:fs'
import type { WatcherBackend, WatcherEvent } from '../core/watcher.ts'

export interface NodeWatcherOptions {
  /** Whether to attempt recursive watching (default true on Windows/Node 20+). */
  readonly recursive?: boolean
}

export class NodeWatcherBackend implements WatcherBackend {
  private options: NodeWatcherOptions
  private disposeFns: Array<() => void> = []
  private watcher: FSWatcher | null = null

  constructor(options: NodeWatcherOptions = {}) {
    this.options = options
  }

  async start(root: string, emit: (event: WatcherEvent) => void): Promise<() => void> {
    const recursive = this.options.recursive ?? isRecursiveSupported()
    await new Promise<void>((resolve, reject) => {
      try {
        const watcher = watch(root, { recursive }, (eventType, filename) => {
          if (filename === null || filename === undefined) {
            emit({ absPath: null })
            return
          }
          const abs = filename.toString().startsWith(root)
            ? filename.toString()
            : (awaitPath(root, filename.toString()))
          emit({ absPath: abs })
        })
        this.watcher = watcher
        watcher.once('error', (err) => {
          // Non-fatal: watcher is only a hint. Log via the adapter, not here.
          emit({ absPath: null })
        })
        resolve()
      } catch (error) {
        reject(error)
      }
    })
    return () => this.dispose()
  }

  dispose(): void {
    if (this.watcher) {
      try { this.watcher.close() } catch { /* ignore */ }
      this.watcher = null
    }
    for (const fn of this.disposeFns) fn()
    this.disposeFns = []
  }
}

function awaitPath(root: string, rel: string): string {
  const sep = root.endsWith('/') || root.endsWith('\\') ? '' : '/'
  return root + sep + rel
}

/** Windows (Node >= 20.12) and macOS (Node >= 19.1) support recursive watch. */
function isRecursiveSupported(): boolean {
  const [major, minor] = (process.versions.node.split('.').map(Number) as [number, number])
  if (process.platform === 'win32') return major > 20 || (major === 20 && minor >= 12)
  if (process.platform === 'darwin') return major > 19 || (major === 19 && minor >= 1)
  return false
}
