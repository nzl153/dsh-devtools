/**
 * TimeMachineEngine: the core snapshot engine.
 *
 * Pure logic over HostFs + SidecarStore + a git state provider. It has no DSH
 * imports, so it can be unit-tested in isolation and reused by the host adapter.
 *
 * Turn recording follows the safety model from the README:
 *  - `recordPreTool` scans the workspace BEFORE a relevant tool runs and stores
 *    content objects for small text files (so the "before" state of a file the
 *    agent is about to change is recoverable). Content-addressed + deduped.
 *  - `recordPostTool` scans AFTER the tool, diffs against the pre-snapshot (or
 *    the last recorded snapshot), attributes changes to the turn/tool call and
 *    persists only the change records + new content objects to the sidecar store.
 *
 * Everything is keyed per session and serialized per session so concurrent DSH
 * sessions do not corrupt each other's snapshots. Nothing is written to the DSH
 * session log.
 */
import path from 'node:path'
import { diffLines, findRenames } from './diff.ts'
import { sha256, type HostFs } from './fsh.ts'
import { gitFileState } from './git.ts'
import { RestorePlanner, type RestorePreviewFile } from './restore.ts'
import { WorkspaceScanner } from './scanner.ts'
import type { SidecarStore } from './store.ts'
import type {
  BaselineEntry,
  EngineConfig,
  FileChange,
  GitFileState,
  ScanEntry,
  SessionRecord,
  TurnRecord,
} from './types.ts'

export interface ToolEvent {
  readonly turn: number
  readonly toolName: string
  readonly callId: string
}

export interface EngineResult {
  readonly record: SessionRecord
  readonly changes: readonly FileChange[]
}

const DEFAULT_CONFIG: EngineConfig = {
  largeFileThresholdBytes: 1024 * 1024, // 1 MiB
  ignoreDirs: ['node_modules', '.git', 'build', 'dist', '.dsh', '.venv', 'venv'],
  ignoreFiles: [],
  maxScannedFiles: 20000,
}

export class TimeMachineEngine {
  private readonly scanner: WorkspaceScanner
  private readonly planner: RestorePlanner
  private readonly fs: HostFs
  private readonly store: SidecarStore
  private readonly config: EngineConfig

  /** Per-session latest post-scan snapshot. */
  private readonly lastPostBySession = new Map<string, Map<string, ScanEntry>>()
  /** Per-session pre-tool content buffers, used to recover overwritten text. */
  private readonly preContentsBySession = new Map<string, Map<string, Buffer>>()
  /** Per-session in-memory latest record (for the restore planner's disk lookup). */
  private readonly activeRecords = new Map<string, SessionRecord>()
  /** Per-session promise chain serializing engine mutations. */
  private readonly locks = new Map<string, Promise<unknown>>()

  private readonly gitProvider: (
    workspace: string,
    rel: string,
    entry: ScanEntry,
  ) => Promise<GitFileState | null>

  constructor(
    fs: HostFs,
    store: SidecarStore,
    config: EngineConfig = DEFAULT_CONFIG,
    gitProvider?: (workspace: string, rel: string, entry: ScanEntry) => Promise<GitFileState | null>,
  ) {
    this.fs = fs
    this.store = store
    this.config = config
    this.scanner = new WorkspaceScanner(fs, config)
    this.planner = new RestorePlanner(
      (rel) => this.diskHashOf(rel),
      (rel, hash) => this.contentForPreview(rel, hash),
    )
    this.gitProvider = gitProvider ?? ((workspace, rel, entry) => this.gitStateFor(workspace, rel, entry))
  }

  /** Serialize all engine operations for one session. */
  private withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(sessionId) ?? Promise.resolve()
    const run = prev.then(fn)
    this.locks.set(sessionId, run.then(() => undefined, () => undefined))
    return run
  }

  /** Establish the session baseline from the current workspace state. */
  establishBaseline(sessionId: string, workspace: string): Promise<SessionRecord> {
    return this.withSessionLock(sessionId, () => this.establishBaselineLocked(sessionId, workspace))
  }

  private async establishBaselineLocked(sessionId: string, workspace: string): Promise<SessionRecord> {
    const scan = await this.scanner.scan(workspace)
    const baseline: BaselineEntry[] = []
    for (const [rel, entry] of scan) {
      const git = await this.gitProvider(workspace, rel, entry)
      baseline.push({
        relPath: rel,
        existed: true,
        kind: entry.kind,
        hash: entry.hash,
        size: entry.size,
        dirtyBeforeSession: git?.dirty === true || git?.staged === true,
        git,
      })
    }
    const record: SessionRecord = {
      sessionId,
      workspace,
      baselineAt: Date.now(),
      baseline,
      turns: [],
    }
    await this.store.writeSession(record)
    this.lastPostBySession.set(sessionId, scan)
    this.activeRecords.set(sessionId, record)
    return record
  }

  /**
   * Pre-tool scan: capture the workspace state before a relevant tool runs.
   * Stores content objects for small text files so the pre-change state is
   * recoverable for diffing and baseline restore.
   */
  recordPreTool(sessionId: string, workspace: string, event: ToolEvent): Promise<SessionRecord> {
    return this.withSessionLock(sessionId, () => this.recordPreToolLocked(sessionId, workspace, event))
  }

  private async recordPreToolLocked(
    sessionId: string,
    workspace: string,
    event: ToolEvent,
  ): Promise<SessionRecord> {
    const record = (await this.store.readSession(sessionId)) ?? (await this.establishBaselineLocked(sessionId, workspace))
    this.activeRecords.set(sessionId, record)
    let scan: Map<string, ScanEntry>
    try {
      scan = await this.scanner.scan(workspace)
    } catch {
      return record
    }
    const preContents = this.preContentsBySession.get(sessionId) ?? new Map<string, Buffer>()
    this.preContentsBySession.set(sessionId, preContents)
    for (const [rel, entry] of scan) {
      if (entry.kind !== 'text' || entry.size > this.config.largeFileThresholdBytes) continue
      if (!entry.hash) continue
      if (await this.store.hasObject(entry.hash)) continue
      try {
        const buf = await this.fs.readFile(path.join(workspace, rel))
        await this.store.putObject(entry.hash, buf)
        preContents.set(rel, buf)
      } catch {
        /* skip */
      }
    }
    return record
  }

  /**
   * Post-tool scan: diff against the last known snapshot, attribute changes to
   * the given turn/tool call, persist change records + new content objects.
   */
  recordPostTool(sessionId: string, workspace: string, event: ToolEvent): Promise<EngineResult> {
    return this.withSessionLock(sessionId, () => this.recordPostToolLocked(sessionId, workspace, event))
  }

  private async recordPostToolLocked(
    sessionId: string,
    workspace: string,
    event: ToolEvent,
  ): Promise<EngineResult> {
    const record = (await this.store.readSession(sessionId)) ?? (await this.establishBaselineLocked(sessionId, workspace))
    this.activeRecords.set(sessionId, record)
    let scan: Map<string, ScanEntry>
    try {
      scan = await this.scanner.scan(workspace)
    } catch {
      return { record, changes: [] }
    }

    const previous = this.lastPostBySession.get(sessionId) ?? null
    const changes = await this.diffSnapshots(record, workspace, previous, scan, event, sessionId)
    this.lastPostBySession.set(sessionId, scan)

    if (changes.length === 0) {
      return { record, changes }
    }

    const next: SessionRecord = {
      ...record,
      turns: this.appendTurn(record.turns, changes, event.turn),
    }
    await this.store.writeSession(next)
    this.activeRecords.set(sessionId, next)
    return { record: next, changes }
  }

  /** End the current turn (timestamps the last turn if still open). */
  endTurn(sessionId: string): Promise<SessionRecord | null> {
    return this.withSessionLock(sessionId, () => this.endTurnLocked(sessionId))
  }

  /**
   * Ambient scan: called by the watcher / periodic reconciliation. Records
   * changes not attributable to a particular tool call (source = null).
   */
  recordAmbient(sessionId: string, workspace: string): Promise<EngineResult> {
    return this.withSessionLock(sessionId, () => this.recordAmbientLocked(sessionId, workspace))
  }

  private async recordAmbientLocked(sessionId: string, workspace: string): Promise<EngineResult> {
    const record = (await this.store.readSession(sessionId)) ?? (await this.establishBaselineLocked(sessionId, workspace))
    this.activeRecords.set(sessionId, record)
    let scan: Map<string, ScanEntry>
    try {
      scan = await this.scanner.scan(workspace)
    } catch {
      return { record, changes: [] }
    }
    const previous = this.lastPostBySession.get(sessionId) ?? null
    const changes = await this.diffSnapshots(record, workspace, previous, scan, null, sessionId)
    this.lastPostBySession.set(sessionId, scan)
    if (changes.length === 0) return { record, changes }
    const turn = record.turns.length > 0 ? record.turns[record.turns.length - 1].turn : 0
    const next: SessionRecord = {
      ...record,
      turns: this.appendTurn(record.turns, changes, turn),
    }
    await this.store.writeSession(next)
    this.activeRecords.set(sessionId, next)
    return { record: next, changes }
  }

  private async endTurnLocked(sessionId: string): Promise<SessionRecord | null> {
    const record = await this.store.readSession(sessionId)
    if (!record) return null
    if (record.turns.length === 0) return record
    const last = record.turns[record.turns.length - 1]
    if (last.endedAt !== null) return record
    const updated: TurnRecord = { ...last, endedAt: Date.now() }
    const next: SessionRecord = { ...record, turns: [...record.turns.slice(0, -1), updated] }
    await this.store.writeSession(next)
    this.activeRecords.set(sessionId, next)
    return next
  }

  readSession(sessionId: string): Promise<SessionRecord | null> {
    return this.store.readSession(sessionId)
  }

  private appendTurn(turns: readonly TurnRecord[], changes: readonly FileChange[], turn: number): TurnRecord[] {
    const existing = turns.find((t) => t.turn === turn)
    const toolCalls = Array.from(
      new Set([
        ...(existing?.toolCalls ?? []),
        ...changes.flatMap((c) => (c.source?.callId ? [c.source.callId] : [])),
      ]),
    )
    if (existing) {
      return turns.map((t) =>
        t.turn === turn ? { ...t, toolCalls, changes: [...t.changes, ...changes] } : t,
      )
    }
    // Starting a later turn closes any previously open turns.
    const now = Date.now()
    const closedTurns = turns.map((t) => (t.endedAt === null ? { ...t, endedAt: now } : t))
    return [
      ...closedTurns,
      { turn, startedAt: now, endedAt: null, toolCalls, changes },
    ]
  }

  private async diffSnapshots(
    record: SessionRecord,
    workspace: string,
    previous: Map<string, ScanEntry> | null,
    current: Map<string, ScanEntry>,
    event: ToolEvent | null,
    sessionId: string,
  ): Promise<FileChange[]> {
    const out: FileChange[] = []
    const source = event ? { turn: event.turn, toolName: event.toolName, callId: event.callId } : null
    if (!previous) {
      // Fresh process: compare against the recorded baseline (which is the
      // best known ground truth).
      const baselineByPath = new Map(record.baseline.map((b) => [b.relPath, b]))
      for (const [rel, entry] of current) {
        const bl = baselineByPath.get(rel)
        if (bl && bl.hash === entry.hash && bl.kind === entry.kind) continue
        if (bl) out.push(await this.makeChange(workspace, rel, entry, bl.hash, source, sessionId))
        else out.push(await this.makeChange(workspace, rel, entry, null, source, sessionId))
      }
      for (const [rel, blob] of baselineByPath) {
        if (!current.has(rel) && blob.existed) {
          out.push(this.makeDeletedChange(rel, blob, source))
        }
      }
      return out
    }

    // Try to detect renames between the previous and current snapshots.
    const renames = await findRenames(previous, current, async (rel, side) => {
      try {
        if (side === 'old') {
          const prev = previous.get(rel)
          if (prev?.hash) {
            const buf = await this.store.getObject(prev.hash)
            if (buf) return buf.toString('utf8')
          }
          return null
        }
        const buf = await this.fs.readFile(path.join(workspace, rel))
        return buf.toString('utf8')
      } catch {
        return null
      }
    })
    const renamedOld = new Set(renames.map((r) => r.oldPath))
    const renamedNew = new Set(renames.map((r) => r.newPath))
    const renameByOld = new Map(renames.map((r) => [r.oldPath, r]))
    const renameByNew = new Map(renames.map((r) => [r.newPath, r]))

    const prevByPath = new Map<string, ScanEntry>()
    for (const [rel, entry] of previous) prevByPath.set(rel, entry)

    for (const [rel, prev] of prevByPath) {
      if (renamedOld.has(rel)) continue
      if (!current.has(rel)) {
        const blob = record.baseline.find((b) => b.relPath === rel)
        out.push(this.makeDeletedChange(
          rel,
          blob ?? { relPath: rel, existed: true, kind: prev.kind, hash: prev.hash, size: prev.size, dirtyBeforeSession: false, git: null },
          source,
        ))
      }
    }
    for (const [rel, entry] of current) {
      if (renamedNew.has(rel)) continue
      const prev = prevByPath.get(rel)
      if (!prev) {
        out.push(await this.makeChange(workspace, rel, entry, null, source, sessionId))
      } else if (prev.hash !== entry.hash) {
        out.push(await this.makeChange(workspace, rel, entry, prev.hash, source, sessionId))
      }
    }
    for (const r of renames) {
      const prev = prevByPath.get(r.oldPath)
      const entry = current.get(r.newPath)
      if (!prev || !entry) continue
      out.push(await this.makeRenameChange(workspace, r.oldPath, r.newPath, entry, prev.hash, source, sessionId))
    }
    return out
  }

  private async makeChange(
    workspace: string,
    rel: string,
    entry: ScanEntry,
    fromHash: string | null,
    source: FileChange['source'],
    sessionId: string,
  ): Promise<FileChange> {
    let content: Buffer | null = null
    try {
      content = await this.fs.readFile(path.join(workspace, rel))
    } catch {
      content = null
    }
    const toHash = content ? await sha256(content) : entry.hash
    let diff: string | null = null
    let added = 0
    let removed = 0
    if (entry.kind === 'text' && content) {
      let oldBuf: Buffer | null = await this.contentForHash(fromHash)
      const preContents = this.preContentsBySession.get(sessionId)
      if (oldBuf === null && preContents?.has(rel)) oldBuf = preContents.get(rel) ?? null
      if (oldBuf) {
        const d = diffLines(oldBuf.toString('utf8'), content.toString('utf8'), `a/${rel}`, `b/${rel}`)
        diff = d.unified
        added = d.addedLines
        removed = d.removedLines
      } else if (fromHash === null) {
        const d = diffLines('', content.toString('utf8'), `/dev/null`, `b/${rel}`)
        diff = d.unified
        added = d.addedLines
      }
    }
    if (content && entry.kind === 'text' && entry.size <= this.config.largeFileThresholdBytes && toHash) {
      await this.store.putObject(toHash, content)
    }
    return {
      relPath: rel,
      status: fromHash === null ? 'added' : 'modified',
      kind: entry.kind,
      fromHash,
      toHash,
      size: entry.size,
      mtimeMs: entry.mtimeMs,
      addedLines: added,
      removedLines: removed,
      diff,
      source,
    }
  }

  private async makeRenameChange(
    workspace: string,
    oldPath: string,
    relPath: string,
    entry: ScanEntry,
    fromHash: string | null,
    source: FileChange['source'],
    sessionId: string,
  ): Promise<FileChange> {
    let content: Buffer | null = null
    try {
      content = await this.fs.readFile(path.join(workspace, relPath))
    } catch {
      content = null
    }
    const toHash = content ? await sha256(content) : entry.hash
    let diff: string | null = null
    let added = 0
    let removed = 0
    if (entry.kind === 'text' && content) {
      const oldBuf = await this.contentForHash(fromHash)
      if (oldBuf) {
        const d = diffLines(oldBuf.toString('utf8'), content.toString('utf8'), `a/${oldPath}`, `b/${relPath}`)
        diff = d.unified
        added = d.addedLines
        removed = d.removedLines
      }
    }
    if (content && entry.kind === 'text' && entry.size <= this.config.largeFileThresholdBytes && toHash) {
      await this.store.putObject(toHash, content)
    }
    return {
      relPath,
      oldPath,
      status: 'renamed',
      kind: entry.kind,
      fromHash,
      toHash,
      size: entry.size,
      mtimeMs: entry.mtimeMs,
      addedLines: added,
      removedLines: removed,
      diff,
      source,
    }
  }

  private makeDeletedChange(
    rel: string,
    prev: BaselineEntry,
    source: FileChange['source'],
  ): FileChange {
    return {
      relPath: rel,
      status: 'deleted',
      kind: prev.kind,
      fromHash: prev.hash,
      toHash: null,
      size: 0,
      mtimeMs: Date.now(),
      addedLines: 0,
      removedLines: 0,
      diff: null,
      source,
    }
  }

  private async contentForHash(hash: string | null): Promise<Buffer | null> {
    if (!hash) return null
    return this.store.getObject(hash)
  }

  private async diskHashOf(rel: string): Promise<string | null> {
    const record = this.activeRecords.get(this.currentPreviewSession ?? '') ?? null
    if (!record) return null
    try {
      const buf = await this.fs.readFile(path.join(record.workspace, rel))
      return await sha256(buf)
    } catch {
      return null
    }
  }

  private async contentForPreview(rel: string, hash: string | null): Promise<Buffer | null> {
    if (!hash) return null
    const record = this.activeRecords.get(this.currentPreviewSession ?? '') ?? null
    if (!record) return null
    try {
      const buf = await this.fs.readFile(path.join(record.workspace, rel))
      if (await sha256(buf) === hash) return buf
    } catch {
      /* not on disk */
    }
    return this.store.getObject(hash)
  }

  private currentPreviewSession: string | null = null

  private async gitStateFor(workspace: string, rel: string, entry: ScanEntry): Promise<GitFileState | null> {
    try {
      return await gitFileState(workspace, rel)
    } catch {
      return null
    }
  }

  /** Build a restore preview (never writes). */
  previewRestore(
    record: SessionRecord,
    target: RestoreTargetShape,
    includeContents = false,
  ): Promise<RestorePreviewFile[]> {
    return this.withSessionLock(record.sessionId, async () => {
      this.activeRecords.set(record.sessionId, record)
      this.currentPreviewSession = record.sessionId
      let previews: RestorePreviewFile[] = []
      switch (target.kind) {
        case 'baseline':
          previews = await this.planner.planBaseline(record)
          break
        case 'turn':
          previews = await this.planner.planTurnStart(record, target.turn)
          break
        case 'file': {
          const baseline = record.baseline.find((b) => b.relPath === target.relPath)
          if (target.to === 'baseline') {
            const rename = this.renameByNewPath(record, target.relPath)
            if (rename && rename.oldPath) {
              previews = [
                await this.planner.planFileToBaseline(record, rename.oldPath),
                await this.planner.planFileToBaseline(record, target.relPath),
              ]
            } else {
              previews = [await this.planner.planFileToBaseline(record, target.relPath)]
            }
          } else {
            const last = this.lastChangeFor(record, target.relPath)
            if (!last) return []
            const targetHash = target.to === 'prev-turn' ? (baseline?.hash ?? null) : last.toHash
            previews = [await this.planner.planFile(record, target.relPath, targetHash)]
          }
          break
        }
      }
      if (includeContents) {
        previews = await Promise.all(previews.map((p) => this.planner.decorateContents(p)))
      }
      return previews
    })
  }

  private renameByNewPath(record: SessionRecord, relPath: string): FileChange | null {
    for (let i = record.turns.length - 1; i >= 0; i--) {
      for (let j = record.turns[i].changes.length - 1; j >= 0; j--) {
        const c = record.turns[i].changes[j]
        if (c.status === 'renamed' && c.relPath === relPath && c.oldPath) return c
      }
    }
    return null
  }

  private lastChangeFor(record: SessionRecord, relPath: string): FileChange | null {
    for (let i = record.turns.length - 1; i >= 0; i--) {
      for (let j = record.turns[i].changes.length - 1; j >= 0; j--) {
        const c = record.turns[i].changes[j]
        if (c.relPath === relPath) return c
      }
    }
    return null
  }

  /**
   * Execute a restore AFTER the client has explicitly confirmed and the host
   * has re-checked hashes. Performs only the `ok` previews; conflict/problem
   * previews are returned untouched.
   */
  commitRestore(
    record: SessionRecord,
    previews: readonly RestorePreviewFile[],
    force = false,
  ): Promise<{ performed: number; results: RestorePreviewFile[] }> {
    return this.withSessionLock(record.sessionId, async () => {
      this.activeRecords.set(record.sessionId, record)
      this.currentPreviewSession = record.sessionId
      const results: RestorePreviewFile[] = []
      let performed = 0
      for (const p of previews) {
        // Force overwrite only overrides CONFLICT (external edit); hard safety
        // blocks such as dirty-before-session / agent-did-not-create remain.
        if (p.problem !== 'ok' && !(force && p.problem === 'conflict')) {
          results.push(p)
          continue
        }
        const abs = path.join(record.workspace, p.relPath)
        let diskHash: string | null = null
        try {
          diskHash = await sha256(await this.fs.readFile(abs))
        } catch {
          diskHash = null
        }
        if (!force && p.expectedHash !== null && diskHash !== null && diskHash !== p.expectedHash) {
          results.push({ ...p, problem: 'conflict', reason: 'content changed since preview; aborting write-back' })
          continue
        }
        if (!force && p.expectedHash === null && diskHash !== null) {
          results.push({ ...p, problem: 'conflict', reason: 'file appeared on disk since preview; aborting write-back' })
          continue
        }
        if (p.action === 'delete') {
          await this.fs.unlink(abs)
          performed++
          results.push({ ...p, problem: 'ok' })
        } else if (p.targetHash !== null) {
          const data = await this.store.getObject(p.targetHash)
          if (!data) {
            results.push({ ...p, problem: 'content-not-stored', reason: 'target content is not stored' })
            continue
          }
          await this.fs.mkdirp(path.dirname(abs))
          await this.fs.writeFile(abs, data)
          performed++
          results.push({ ...p, problem: 'ok' })
        }
      }
      return { performed, results }
    })
  }
}

export type RestoreTargetShape =
  | { kind: 'baseline' }
  | { kind: 'turn'; turn: number }
  | { kind: 'file'; relPath: string; to: 'baseline' | 'prev-turn' | 'current' }