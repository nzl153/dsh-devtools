/**
 * Restore preview + conflict detection.
 *
 * This module NEVER writes to the workspace. It computes what a restore WOULD
 * do and whether it is safe; the actual write-back happens in the host layer
 * after the client visibly confirms, and the host re-verifies hashes at commit
 * time (see `engine.commitRestore`).
 *
 * Hard safety rules encoded here (see README security model):
 *  1. Never restore over a file that was already dirty before the session
 *     started (`dirtyBeforeSession`).
 *  2. Never delete a file the agent did not create — i.e. a file that existed
 *     at baseline can only be restored to baseline content, never "deleted".
 *  3. On-disk file is re-hashed during preview AND before commit; if it no
 *     longer matches the plugin's recorded state, the restore is flagged
 *     CONFLICT and will not auto-overwrite.
 *  4. Large files whose content was never stored cannot be restored by content;
 *     a restore of them is a no-op with an explanatory flag.
 */
import type { FileChange, RelPath, SessionRecord } from './types.ts'

export type RestoreProblem =
  | 'ok'
  | 'conflict'
  | 'dirty-before-session'
  | 'agent-did-not-create'
  | 'content-not-stored'
  | 'already-at-target'

export interface RestorePreviewContents {
  /** Recorded post-change content the plugin expects on disk (null when absent). */
  readonly expected: string | null
  /** Content currently on disk (null when absent). */
  readonly current: string | null
  /** Content that would be written by restore (null for delete). */
  readonly target: string | null
}

export interface RestorePreviewFile {
  readonly relPath: RelPath
  readonly action: 'write' | 'delete' | 'noop'
  /** sha256 of the content that would be written, or null for delete. */
  readonly targetHash: string | null
  /** Hash of the file currently on disk, or null if absent. */
  readonly diskHash: string | null
  readonly problem: RestoreProblem
  /** The recorded post-change hash the plugin expects on disk. */
  readonly expectedHash: string | null
  /** Human-readable reason when `problem !== 'ok'`. */
  readonly reason: string
  /** Three-way content payload; only populated when explicitly requested. */
  readonly contents?: RestorePreviewContents
}

export type RestoreTarget =
  | { kind: 'file'; relPath: RelPath; to: 'baseline' | 'prev-turn' | 'current' }
  | { kind: 'turn'; turn: number; to: 'turn-start' }
  | { kind: 'baseline' }

export class RestorePlanner {
  private readonly diskHash: (relPath: RelPath) => Promise<string | null>
  private readonly readContent: (relPath: RelPath, hash: string | null) => Promise<Buffer | null>

  /**
   * Current on-disk hash provider + content provider. Injected so the planner
   * stays pure: hash `null` means the file is missing on disk; content provider
   * returns the bytes for a stored object (or null) and is used to build the
   * three-way contents payload.
   */
  constructor(
    diskHash: (relPath: RelPath) => Promise<string | null>,
    readContent?: (relPath: RelPath, hash: string | null) => Promise<Buffer | null>,
  ) {
    this.diskHash = diskHash
    this.readContent = readContent ?? (async () => null)
  }

  /** Last recorded change for a path (or null). */
  private lastChange(record: SessionRecord, relPath: RelPath): FileChange | null {
    for (let i = record.turns.length - 1; i >= 0; i--) {
      const turn = record.turns[i]
      for (let j = turn.changes.length - 1; j >= 0; j--) {
        const c = turn.changes[j]
        if (c.relPath === relPath) return c
      }
    }
    return null
  }

  /**
   * Baseline entry hash for a path. `undefined` when the path was not present
   * at baseline.
   */
  private baselineEntry(record: SessionRecord, relPath: RelPath) {
    return record.baseline.find((e) => e.relPath === relPath)
  }

  /**
   * The plugin's latest recorded state for a path:
   * `{ hash: null, existed: false }` means absent. A rename source counts as
   * absent because the file moved away, even if an earlier turn created it.
   */
  private latestExpectedState(record: SessionRecord, relPath: RelPath): { hash: string | null; existed: boolean } {
    for (let i = record.turns.length - 1; i >= 0; i--) {
      for (let j = record.turns[i].changes.length - 1; j >= 0; j--) {
        const c = record.turns[i].changes[j]
        if (c.status === 'renamed' && c.oldPath === relPath) {
          return { hash: null, existed: false }
        }
        if (c.relPath === relPath) {
          return { hash: c.toHash, existed: c.toHash !== null }
        }
      }
    }
    const baseline = this.baselineEntry(record, relPath)
    return { hash: baseline?.hash ?? null, existed: baseline?.existed ?? false }
  }

  private mk(
    relPath: RelPath,
    action: RestorePreviewFile['action'],
    targetHash: string | null,
    diskHash: string | null,
    expectedHash: string | null,
    problem: RestoreProblem,
    reason: string,
  ): RestorePreviewFile {
    return { relPath, action, targetHash, diskHash, expectedHash, problem, reason }
  }

  /**
   * Decorate previews with three-way contents (EXPECTED / CURRENT / TARGET).
   * Never writes; safe to call after planning. Only textual content is returned;
   * binary/large content comes back null with a note left to the UI.
   */
  async decorateContents(preview: RestorePreviewFile): Promise<RestorePreviewFile> {
    const [expectedBuf, currentBuf, targetBuf] = await Promise.all([
      this.readContent(preview.relPath, preview.expectedHash),
      preview.diskHash === null ? Promise.resolve(null) : this.readContent(preview.relPath, preview.diskHash),
      preview.targetHash === null ? Promise.resolve(null) : this.readContent(preview.relPath, preview.targetHash),
    ])
    const toStr = (b: Buffer | null): string | null => (b ? b.toString('utf8') : null)
    return {
      ...preview,
      contents: {
        expected: toStr(expectedBuf),
        current: toStr(currentBuf),
        target: toStr(targetBuf),
      },
    }
  }

  /** Plan restoring the whole session back to its baseline snapshot. */
  async planBaseline(record: SessionRecord): Promise<RestorePreviewFile[]> {
    const out: RestorePreviewFile[] = []
    // Consider every path the agent touched (present in any change).
    const touched = new Set<RelPath>()
    for (const turn of record.turns) {
      for (const c of turn.changes) {
        touched.add(c.relPath)
        // A rename also requires restoring the original path.
        if (c.status === 'renamed' && c.oldPath) touched.add(c.oldPath)
      }
    }
    for (const relPath of touched) {
      out.push(await this.planFileToBaseline(record, relPath))
    }
    return out
  }

  /** Plan restoring a whole turn (snapshot at turn start). */
  async planTurnStart(record: SessionRecord, turn: number): Promise<RestorePreviewFile[]> {
    const turnRec = record.turns.find((t) => t.turn === turn)
    if (!turnRec) throw new Error(`turn ${turn} not found`)
    const out: RestorePreviewFile[] = []
    for (const c of turnRec.changes) {
      if (c.status === 'renamed' && c.oldPath) {
        // Rename restores BOTH sides: bring the old path back, remove the new path.
        const oldBaseline = this.baselineEntry(record, c.oldPath)
        const earlierOld = this.earlierLastChange(record, c.oldPath, turn)
        const oldTargetHash = earlierOld ? earlierOld.toHash : oldBaseline?.hash ?? null
        const oldAction: RestorePreviewFile['action'] =
          oldTargetHash === null && oldBaseline?.existed === false ? 'delete' : 'write'
        out.push(await this.planToHash(record, c.oldPath, oldTargetHash, oldAction, null))

        const newBaseline = this.baselineEntry(record, c.relPath)
        const earlierNew = this.earlierLastChange(record, c.relPath, turn)
        const newTargetHash = earlierNew ? earlierNew.toHash : newBaseline?.hash ?? null
        const newAction: RestorePreviewFile['action'] =
          newTargetHash === null && newBaseline?.existed === false ? 'delete' : 'write'
        out.push(await this.planToHash(record, c.relPath, newTargetHash, newAction, c.toHash))
        continue
      }
      const baseline = this.baselineEntry(record, c.relPath)
      // State at turn start = baseline unless an earlier turn changed it.
      const earlier = this.earlierLastChange(record, c.relPath, turn)
      const targetHash = earlier ? earlier.toHash : baseline?.hash ?? null
      const targetAction: RestorePreviewFile['action'] =
        targetHash === null && baseline?.existed === false ? 'delete' : 'write'
      out.push(await this.planToHash(record, c.relPath, targetHash, targetAction, expectedHashFor(c)))
    }
    return out
  }

  /** Plan restoring a single file to baseline. */
  async planFileToBaseline(record: SessionRecord, relPath: RelPath): Promise<RestorePreviewFile> {
    const baseline = this.baselineEntry(record, relPath)
    if (!baseline) {
      // Never touched at baseline → if agent created it, restore = delete.
      return this.planFile(record, relPath, null)
    }
    if (baseline.dirtyBeforeSession) {
      return this.mk(relPath, 'noop', baseline.hash, null, null, 'dirty-before-session',
        'file was already dirty before the session started; refusing to touch it')
    }
    return this.planFile(record, relPath, baseline.hash)
  }

  /** Plan restoring a single file to a specific target hash (or delete). */
  async planFile(record: SessionRecord, relPath: RelPath, targetHash: string | null): Promise<RestorePreviewFile> {
    const latest = this.latestExpectedState(record, relPath)
    const baseline = this.baselineEntry(record, relPath)
    const expectedHash = latest.hash

    // If restoring to content and that content is a large file we never stored,
    // we cannot honor it.
    if (targetHash !== null && targetHash !== expectedHash) {
      // Determine whether the target object is a stored small object by asking
      // the caller — the planner does not hold the store. We approximate: if the
      // engine recorded a change lacking a diff (large/binary), its content is
      // not restorable. Handled by engine when it builds the preview; here we
      // only emit 'content-not-stored' when the target equals a change's toHash
      // that had `diff === null` AND was a large/binary file.
      const sourceChange = record.turns
        .flatMap((t) => t.changes)
        .find((c) => c.relPath === relPath && c.toHash === targetHash)
      if (sourceChange && sourceChange.kind === 'binary') {
        return this.mk(relPath, 'noop', targetHash, null, expectedHash, 'content-not-stored',
          'binary content is only hashed, not stored; cannot restore by content')
      }
    }

    const diskHash = await this.diskHash(relPath)
    const action: RestorePreviewFile['action'] =
      targetHash === null ? 'delete' : targetHash === diskHash ? 'noop' : 'write'

    // Safety rule 2: never delete a file the agent did not create.
    if (action === 'delete' && baseline?.existed === true) {
      return this.mk(relPath, 'delete', null, diskHash, expectedHash, 'agent-did-not-create',
        'file existed at baseline; refusing to delete it (only restore content)')
    }

    // Safety rule 1: never restore a dirty-before-session file.
    if (baseline?.dirtyBeforeSession) {
      return this.mk(relPath, 'noop', targetHash, diskHash, expectedHash, 'dirty-before-session',
        'file was already dirty before the session started; refusing to touch it')
    }

    // Safety rule 3: conflict detection. If the current disk hash differs from
    // what the plugin recorded as the latest state, someone edited it after the
    // agent — do not auto-overwrite.
    if (expectedHash !== null && diskHash !== null && diskHash !== expectedHash) {
      return this.mk(relPath, 'noop', targetHash, diskHash, expectedHash, 'conflict',
        'on-disk content differs from the recorded state (external edit detected); refusing to overwrite')
    }
    // Also: if we recorded the file as existing but it no longer exists on disk.
    if (expectedHash !== null && diskHash === null) {
      return this.mk(relPath, 'noop', targetHash, diskHash, expectedHash, 'conflict',
        'file is missing on disk (was deleted outside the plugin); refusing to recreate blindly')
    }
    // Symmetric safety: if we recorded the file as absent/deleted but it is
    // present on disk, someone recreated it — never delete/overwrite blindly.
    if (expectedHash === null && diskHash !== null) {
      return this.mk(relPath, 'noop', targetHash, diskHash, expectedHash, 'conflict',
        'file exists on disk but was recorded as absent/deleted (external edit detected); refusing to remove it')
    }

    if (action === 'noop') {
      return this.mk(relPath, 'noop', targetHash, diskHash, expectedHash, 'already-at-target',
        'file already at target state')
    }
    return this.mk(relPath, action, targetHash, diskHash, expectedHash, 'ok', '')
  }

  private planToHash(
    record: SessionRecord,
    relPath: RelPath,
    targetHash: string | null,
    action: RestorePreviewFile['action'],
    expectedHash: string | null,
  ): Promise<RestorePreviewFile> {
    return (async () => {
      const diskHash = await this.diskHash(relPath)
      const baseline = this.baselineEntry(record, relPath)
      if (baseline?.dirtyBeforeSession) {
        return this.mk(relPath, 'noop', targetHash, diskHash, expectedHash, 'dirty-before-session',
          'file was already dirty before the session started; refusing to touch it')
      }
      if (action === 'delete' && baseline?.existed === true) {
        return this.mk(relPath, 'delete', null, diskHash, expectedHash, 'agent-did-not-create',
          'file existed at baseline; refusing to delete it')
      }
      if (expectedHash !== null && diskHash !== null && diskHash !== expectedHash) {
        return this.mk(relPath, 'noop', targetHash, diskHash, expectedHash, 'conflict',
          'on-disk content differs from the recorded state; refusing to overwrite')
      }
      if (expectedHash !== null && diskHash === null) {
        return this.mk(relPath, 'noop', targetHash, diskHash, expectedHash, 'conflict',
          'file is missing on disk; refusing to recreate blindly')
      }
      if (expectedHash === null && diskHash !== null) {
        return this.mk(relPath, 'noop', targetHash, diskHash, expectedHash, 'conflict',
          'file exists on disk but was recorded as absent/deleted; refusing to remove it')
      }
      if (action === 'noop') {
        return this.mk(relPath, 'noop', targetHash, diskHash, expectedHash,
          targetHash === diskHash ? 'already-at-target' : 'content-not-stored', '')
      }
      return this.mk(relPath, action, targetHash, diskHash, expectedHash, 'ok', '')
    })()
  }

  /** Last change to a path strictly before the given turn, or null. */
  private earlierLastChange(record: SessionRecord, relPath: RelPath, turn: number): FileChange | null {
    let found: FileChange | null = null
    for (const t of record.turns) {
      if (t.turn >= turn) break
      for (const c of t.changes) {
        if (c.relPath === relPath) found = c
      }
    }
    return found
  }
}

function expectedHashFor(c: FileChange): string | null {
  return c.toHash
}
