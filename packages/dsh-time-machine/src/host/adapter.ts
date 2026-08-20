/**
 * Host adapter: wires DSH tool lifecycle hooks and session events to the core
 * TimeMachineEngine, with debounce and performance budget.
 *
 * Event sources used (all official DSH hooks — we never parse UI text):
 *  - `tools/pre-execute` / `tools/post-execute` : scan the workspace around
 *    relevant tool calls to catch both direct file tools and shell-indirect
 *    edits.
 *  - `session/event` : observe `turn/start` / `turn/end` to track the current
 *    turn number and close turns.
 *
 * All snapshots/history live in the sidecar store; nothing is appended to the
 * DSH session log.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import path from 'node:path'
import { TimeMachineEngine } from '../core/engine.ts'
import { FileWatcher } from '../core/watcher.ts'
import { nodeFs } from '../core/nodeFs.ts'
import { createSidecarStore, type SidecarStore } from '../core/store.ts'
import { NodeWatcherBackend } from './nodeWatcher.ts'

/** Tools that can change the working tree (directly or via subprocess). */
const RELEVANT_RE = /^(run_code|bash|pwsh|powershell|sh|write|write_file|edit|edit_file|apply_patch|apply-patch|rm|rmdir|mv|rename|mkdir|mkfile|touch|cp|cp_r|sed|node|npm|pnpm|yarn|python|python3|git|cmd|dsh_write|dsh_edit|dsh_apply_patch|fs_write|fs_edit|file_write|file_edit|exec|command)/i

/** Tools that only read; never trigger a scan by themselves. */
const READ_ONLY_RE = /^(read|read_file|ls|list|glob|grep|search|stat|cat|head|tail|find|pwd|get_cwd|view|inspect|show|fetch|web_search|dump)/i

const DEBOUNCE_MS = 400

export interface HostAdapterOptions {
  /** Watcher debounce window in ms. Defaults to 300. */
  watcherDebounceMs?: number
  /** Periodic reconciliation interval in ms. Defaults to 30s; 0 disables. */
  reconcileIntervalMs?: number
}

export class HostAdapter {
  private engine: TimeMachineEngine | null = null
  private readonly sidecar: Promise<SidecarStore>
  private readonly options: Required<HostAdapterOptions>
  private turns = new Map<string, number>()
  private lastScanAt = 0
  private inFlight = false
  private pendingPost: ScanJob | null = null
  private readonly watchers = new Map<string, { watcher: FileWatcher; dispose: () => void }>()
  private readonly workspaceSessions = new Map<string, Set<string>>()
  private readonly reconcileTimers = new Map<string, ReturnType<typeof setInterval>>()

  constructor(private readonly ctx: Context, options: HostAdapterOptions = {}) {
    this.sidecar = createSidecarStore(nodeFs)
    this.options = {
      watcherDebounceMs: options.watcherDebounceMs ?? 300,
      reconcileIntervalMs: options.reconcileIntervalMs ?? 30_000,
    }
  }

  private async getEngine(): Promise<TimeMachineEngine> {
    if (!this.engine) {
      this.engine = new TimeMachineEngine(nodeFs, await this.sidecar)
    }
    return this.engine
  }

  isRelevant(name: string): boolean {
    if (READ_ONLY_RE.test(name)) return false
    return RELEVANT_RE.test(name) || name.includes('file') || name.includes('workspace') || name.includes('write') || name.includes('edit')
  }

  private workspace(agent: Agent | undefined): string | undefined {
    return agent?.session.header.cwd
  }

  private currentTurn(agent: Agent | undefined): number {
    if (!agent) return 1
    return this.turns.get(agent.id) ?? 1
  }

  /** Start a watcher + reconciliation timer for a workspace and remember sessions using it. */
  private registerWorkspace(sessionId: string, workspace: string): void {
    const sessions = this.workspaceSessions.get(workspace) ?? new Set<string>()
    sessions.add(sessionId)
    this.workspaceSessions.set(workspace, sessions)

    if (!this.watchers.has(workspace)) {
      const watcher = new FileWatcher(
        {
          debounceMs: this.options.watcherDebounceMs,
          config: {
            largeFileThresholdBytes: 1024 * 1024,
            ignoreDirs: ['node_modules', '.git', 'build', 'dist', '.dsh', '.venv', 'venv'],
            ignoreFiles: [],
            maxScannedFiles: 20000,
          },
        },
        () => {
          void this.handleWatcherFlush(workspace).catch((e) => {
            this.ctx.logger.warn(`[dsh-time-machine] watcher flush failed: ${e instanceof Error ? e.message : String(e)}`)
          })
        },
      )
      const backend = new NodeWatcherBackend()
      void watcher.start(backend, workspace).then(
        (dispose) => {
          this.watchers.set(workspace, { watcher, dispose })
        },
        (error) => {
          this.ctx.logger.warn(`[dsh-time-machine] watcher start failed: ${error instanceof Error ? error.message : String(error)}`)
        },
      )
    }

    if (this.options.reconcileIntervalMs > 0 && !this.reconcileTimers.has(workspace)) {
      const timer = setInterval(() => {
        void this.reconcile(workspace).catch((e) => {
          this.ctx.logger.warn(`[dsh-time-machine] reconciliation failed: ${e instanceof Error ? e.message : String(e)}`)
        })
      }, this.options.reconcileIntervalMs)
      this.reconcileTimers.set(workspace, timer)
    }
  }

  /** Run an ambient scan for every session sharing a workspace. */
  private async reconcile(workspace: string): Promise<void> {
    const sessions = this.workspaceSessions.get(workspace)
    if (!sessions) return
    const engine = await this.getEngine()
    await Promise.all(
      Array.from(sessions, async (sessionId) => {
        await engine.recordAmbient(sessionId, workspace)
      }),
    )
  }

  /** Watcher flush is only a hint; always confirm with a full scan. */
  private async handleWatcherFlush(workspace: string): Promise<void> {
    await this.reconcile(workspace)
  }

  dispose(): void {
    for (const timer of this.reconcileTimers.values()) clearInterval(timer)
    this.reconcileTimers.clear()
    for (const entry of this.watchers.values()) entry.dispose()
    this.watchers.clear()
    this.workspaceSessions.clear()
  }

  /** Called on `tools/pre-execute` for relevant tools. */
  onPre(exec: ToolExecution): void {
    const agent = (exec as { agent?: Agent }).agent
    if (!this.isRelevant(exec.name)) return
    const workspace = this.workspace(agent)
    if (!agent || !workspace) return
    this.registerWorkspace(agent.session.id, workspace)
    const turn = this.currentTurn(agent)
    const event = { turn, toolName: exec.name, callId: exec.callId }
    void this.scanPre(agent.session.id, workspace, event).catch((e) => {
      this.ctx.logger.warn(`[dsh-time-machine] pre-scan failed: ${e instanceof Error ? e.message : String(e)}`)
    })
  }

  /** Called on `tools/post-execute` for relevant tools. */
  onPost(exec: ToolExecution): void {
    const agent = (exec as { agent?: Agent }).agent
    if (!this.isRelevant(exec.name)) return
    const workspace = this.workspace(agent)
    if (!agent || !workspace) return
    this.registerWorkspace(agent.session.id, workspace)
    const turn = this.currentTurn(agent)
    const event = { turn, toolName: exec.name, callId: exec.callId }
    this.queuePost(agent.session.id, workspace, event)
  }

  private async scanPre(sessionId: string, workspace: string, event: ToolEventLike): Promise<void> {
    const engine = await this.getEngine()
    await engine.recordPreTool(sessionId, workspace, event)
  }

  private queuePost(sessionId: string, workspace: string, event: ToolEventLike): void {
    const now = Date.now()
    // Debounce: coalesce bursts of tool calls into the last post-scan.
    const job: ScanJob = { sessionId, workspace, event }
    if (this.inFlight) {
      this.pendingPost = job
      return
    }
    if (now - this.lastScanAt < DEBOUNCE_MS) {
      // Schedule one trailing post-scan.
      if (!this.pendingPost) this.pendingPost = job
      return
    }
    void this.runPost(job)
  }

  private async runPost(job: ScanJob): Promise<void> {
    if (this.inFlight) {
      this.pendingPost = job
      return
    }
    this.inFlight = true
    this.lastScanAt = Date.now()
    try {
      const engine = await this.getEngine()
      await engine.recordPostTool(job.sessionId, job.workspace, job.event)
    } catch (e) {
      this.ctx.logger.warn(`[dsh-time-machine] post-scan failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      this.inFlight = false
      const next = this.pendingPost
      this.pendingPost = null
      if (next) {
        await this.runPost(next)
      }
    }
  }

  /** On `session/event`: track turn boundaries. */
  onSessionEvent(session: { id: string; events: readonly { seq: number; type: string }[] }): void {
    if (!session || session.id === undefined) return
    const events = session.events ?? []
    for (const ev of events) {
      if (ev.type === 'turn/start') {
        // Get the turn number from the event data when available.
        const data = (ev as { data?: { turn?: number } }).data
        const turn = data?.turn
        if (typeof turn === 'number') this.turns.set(session.id, turn)
      } else if (ev.type === 'turn/end') {
        void this.finishTurn(session.id)
      }
    }
  }

  private async finishTurn(sessionId: string): Promise<void> {
    const engine = await this.getEngine()
    await engine.endTurn(sessionId).catch(() => undefined)
  }

  async getRecord(sessionId: string) {
    const engine = await this.getEngine()
    return engine.readSession(sessionId)
  }

  async clear(sessionId?: string): Promise<void> {
    const store = await this.sidecar
    await store.clear(sessionId)
    if (sessionId === undefined) this.engine = null
  }

  async previewRestore(sessionId: string, target: Parameters<TimeMachineEngine['previewRestore']>[1], includeContents = false) {
    const engine = await this.getEngine()
    const record = await engine.readSession(sessionId)
    if (!record) throw new Error('session record not found')
    return engine.previewRestore(record, target, includeContents)
  }

  async commitRestore(sessionId: string, target: Parameters<TimeMachineEngine['previewRestore']>[1], confirmed: boolean, force = false) {
    if (!confirmed) throw new Error('restore requires explicit confirmation (confirmed: true)')
    const engine = await this.getEngine()
    const record = await engine.readSession(sessionId)
    if (!record) throw new Error('session record not found')
    const previews = await engine.previewRestore(record, target)
    const conflict = previews.some((p) => p.problem === 'conflict')
    const hardBlock = previews.some((p) => p.problem === 'dirty-before-session' || p.problem === 'agent-did-not-create')
    if (hardBlock) {
      throw new Error('restore blocked: one or more files are hard-protected; refusing to write back')
    }
    if (conflict && !force) {
      throw new Error('restore blocked: one or more files conflict; pass force:true to overwrite only after explicit double-confirmation')
    }
    return engine.commitRestore(record, previews, force)
  }

  /**
   * Save the current on-disk content of a conflicted file to a new sibling path
   * (default `<relPath>.tm-conflict`) so the user can force-overwrite without
   * losing their manual edit. Requires explicit confirmation.
   */
  async saveCurrentAs(sessionId: string, relPath: string, confirmed: boolean, targetPath?: string): Promise<{ savedPath: string }> {
    if (!confirmed) throw new Error('save-as requires explicit confirmation (confirmed: true)')
    const engine = await this.getEngine()
    const record = await engine.readSession(sessionId)
    if (!record) throw new Error('session record not found')
    const workspace = record.workspace
    const sourceAbs = this.resolveInsideWorkspace(workspace, relPath)
    const defaultTarget = `${relPath.replace(/^\.\/+/, '')}.tm-conflict`
    const targetRel = targetPath && targetPath.length > 0 ? targetPath : defaultTarget
    const targetAbs = this.resolveInsideWorkspace(workspace, targetRel)
    const sourceBuf = await nodeFs.readFile(sourceAbs).catch(() => {
      throw new Error(`source file not found on disk: ${relPath}`)
    })
    if (await nodeFs.exists?.(targetAbs)) {
      throw new Error(`target file already exists: ${targetRel}`)
    }
    await nodeFs.mkdirp(path.dirname(targetAbs))
    await nodeFs.writeFile(targetAbs, sourceBuf)
    return { savedPath: targetRel }
  }

  /** Resolve a workspace-relative path and ensure it stays inside the workspace. */
  private resolveInsideWorkspace(workspace: string, rel: string): string {
    const abs = path.resolve(workspace, rel)
    const root = path.resolve(workspace)
    const relCheck = path.relative(root, abs)
    if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
      throw new Error('path escapes workspace')
    }
    return abs
  }
}

interface ToolEventLike {
  turn: number
  toolName: string
  callId: string
}

interface ScanJob {
  sessionId: string
  workspace: string
  event: ToolEventLike
}
