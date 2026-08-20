/**
 * dsh-time-machine core contract types.
 *
 * These are pure data shapes shared by the core engine, the host adapter, and
 * the web client. They intentionally contain no DSH imports so the core stays
 * unit-testable in isolation.
 */

/** A relative workspace path, always using forward slashes. */
export type RelPath = string

export type FileKind = 'text' | 'binary'

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'unchanged'

/** Read-only git snapshot for one file at baseline / scan time. */
export interface GitFileState {
  /** True when the workspace is inside a git repository. */
  readonly inRepo: boolean
  /** True when the file is tracked by the index. */
  readonly tracked: boolean
  /** True when the file is in the index but has staged changes. */
  readonly staged: boolean
  /** True when the file has unstaged working-tree changes vs HEAD. */
  readonly dirty: boolean
}

/** Baseline snapshot entry for one file at session start. */
export interface BaselineEntry {
  readonly relPath: RelPath
  /** Whether the file existed on disk at baseline time. */
  readonly existed: boolean
  readonly kind: FileKind
  readonly hash: string | null
  readonly size: number
  /** True when the file was already dirty (vs git) before the session started. */
  readonly dirtyBeforeSession: boolean
  readonly git: GitFileState | null
}

/**
 * A single file change attributed to one tool call inside one turn.
 * `null` source means "observed by an ambient scan not tied to a call".
 */
export interface FileChange {
  readonly relPath: RelPath
  readonly status: FileStatus
  /** For a rename, the path the file was moved from. */
  readonly oldPath?: RelPath
  readonly kind: FileKind
  /** Previous recorded content hash (null for a new file). */
  readonly fromHash: string | null
  /** Current content hash (null for a deleted file). */
  readonly toHash: string | null
  readonly size: number
  readonly mtimeMs: number
  readonly addedLines: number
  readonly removedLines: number
  /** Unified diff text for text files; null for binary or deleted content. */
  readonly diff: string | null
  readonly source: {
    readonly turn: number
    readonly toolName: string | null
    readonly callId: string | null
  } | null
}

/** One turn's aggregated record. */
export interface TurnRecord {
  readonly turn: number
  readonly startedAt: number | null
  readonly endedAt: number | null
  /** Tool call ids observed this turn (deduped). */
  readonly toolCalls: readonly string[]
  readonly changes: readonly FileChange[]
}

/** Per-file full timeline (derived from turns). */
export interface FileTimeline {
  readonly relPath: RelPath
  readonly changes: readonly FileChange[]
}

/** The full session record persisted to the sidecar store. */
export interface SessionRecord {
  readonly sessionId: string
  readonly workspace: string
  readonly baselineAt: number
  readonly baseline: readonly BaselineEntry[]
  readonly turns: readonly TurnRecord[]
}

/** A single trackable file observed by a scan. */
export interface ScanEntry {
  readonly relPath: RelPath
  readonly kind: FileKind
  readonly hash: string | null
  readonly size: number
  readonly mtimeMs: number
}

/** Result of scanning + diffing the workspace against the previous snapshot. */
export interface ScanDiff {
  readonly changed: readonly FileChange[]
  /** relPaths present in the previous snapshot but now gone. */
  readonly deleted: readonly RelPath[]
  /** relPaths that appeared since the previous snapshot. */
  readonly added: readonly RelPath[]
}

/** Config controlling what we scan and store. */
export interface EngineConfig {
  /** Per-file size cap (bytes) above which we keep only hash, not content. */
  readonly largeFileThresholdBytes: number
  readonly ignoreDirs: readonly string[]
  readonly ignoreFiles: readonly string[]
  /** Maximum files scanned in one pass before bailing (safety). */
  readonly maxScannedFiles: number
}
