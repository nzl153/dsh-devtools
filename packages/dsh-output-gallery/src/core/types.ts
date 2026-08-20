/**
 * Core data model for dsh-output-gallery.
 *
 * Pure, framework-free types shared by host scanner/indexer, the HTTP API,
 * and the client. Everything here is metadata — no file content is stored.
 */

/** Artifact category used for the gallery's four buckets. */
export type GalleryCategory = 'images' | 'documents' | 'builds' | 'data'

/** How a file can be previewed, decided by safety rules. */
export type PreviewKind =
  | 'none'
  | 'image'
  | 'svg'
  | 'text'
  | 'code'
  | 'json'
  | 'html'
  | 'pdf'
  | 'zip'
  | 'csv'
  | 'markdown'

/** Risk level used to gate previews and downloads. */
export type RiskLevel = 'safe' | 'watch' | 'danger'

/**
 * A command / tool call recognized as related to a file: the tool that wrote
 * or modified it, or a shell command whose text names the file. `confidence`
 * is `high` for file-writing tools matched by their `file_path`/`path`
 * argument, `low` for a shell command that merely mentions the file path.
 */
export interface RelatedCommand {
  /** Tool name that produced the command, e.g. `write`, `edit`, `bash`. */
  tool: string
  /** Human-readable command text to display. */
  command: string
  /** Turn in which the command ran (when known). */
  turn?: number
  /** How reliably the command was matched to this file. */
  confidence: 'high' | 'low'
}

/** One file entry in the gallery index (a current snapshot of the file). */
export interface GalleryFile {
  /** Path relative to the session workspace, using forward slashes. */
  path: string
  /** Absolute path on disk (host side only; not sent to clients when not needed). */
  absPath?: string
  category: GalleryCategory
  previewKind: PreviewKind
  risk: RiskLevel
  /** MIME type guessed from the extension (for display / content-type). */
  mime: string
  size: number
  created: string
  modified: string
  /** Turn in which this file was first seen. */
  firstSeenTurn: number
  /** Turn in which this file was last modified (observed change). */
  modifiedTurn: number | null
  /** Whether the file changed since the previous scan of the same session. */
  changed: boolean
  previewAvailable: boolean
  /** Associated turn: the most recent turn that touched the file. */
  associatedTurn: number
  /** Non-empty when this path touches the version history (see GallerySession.versions). */
  versionKeys?: string[]
  /**
   * Latest recognized command / tool call related to this file, if any.
   * Absent/null means "unknown".
   */
  relatedCommand?: RelatedCommand | null
  /** Whether the user pinned this file as a deliverable (top-level "final" view). */
  pinned?: boolean
}

/** One recorded version observation of a single path. */
export interface VersionRecord {
  /** Synthetic stable key of the file (relative path). */
  key: string
  /** Turns at which a content change was observed, ascending. */
  turns: number[]
  /** Last known size at the latest recorded turn. */
  size: number
  /** Last known modified timestamp at the latest recorded turn. */
  modified: string
  /** Creation time of the file when first observed. */
  created: string
}

/** Per-path raw observation across turns (not persisted; used to build versions). */
export interface Observation {
  key: string
  turn: number
  size: number
  modified: string
  created: string
}

/** The complete gallery state persisted for one session. */
export interface GallerySession {
  sessionId: string
  /** Workspace root the gallery was scanned against (absolute). */
  workspace: string
  /** Turn at which tracking began. */
  startedTurn: number
  /** Latest turn observed by the last scan. */
  lastScannedTurn: number
  /** Last full scan time (ISO). */
  lastScanAt: string
  files: GalleryFile[]
  /** Version history for files modified across multiple turns. Metadata only. */
  versions: VersionRecord[]
  /** Ordered turn numbers that modified at least one tracked file. */
  changedTurns: number[]
  /**
   * User-pinned deliverables, keyed by normalized relative path. A `true`
   * value marks the file as a final deliverable shown in the top-level view.
   * Persisted in the sidecar store alongside the session metadata.
   */
  pins: Record<string, boolean>
}

/** Filtering rules parsed from config; default behavior when no config file. */
export interface GalleryFilter {
  include: string[]
  exclude: string[]
  ignoreDirs: string[]
  skipPatterns: string[]
}

/** Runtime configuration (defaults, overridden by `.dsh/output-gallery.yml`). */
export interface GalleryConfig {
  enabled: boolean
  /** Path list (glob-ish) of files/dirs to include; empty = everything not excluded. */
  include: string[]
  exclude: string[]
  ignoreDirs: string[]
  /** Extra skip patterns for temp build fragments. */
  avoid: string[]
  /** Whether to version-track files across turns. */
  trackVersions: boolean
  /** Max files to index per scan (safety cap). */
  maxFiles: number
  /** Whether HTML preview sandbox is enabled. */
  htmlSandbox: boolean
}

/** API envelope shared by host HTTP API. */
export type GalleryEnvelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }

/** Result of a refresh scan. */
export interface RefreshResult {
  sessionId: string
  scannedFiles: number
  added: number
  changed: number
  removed: number
  files: GalleryFile[]
}

/** Preview response payloads. */
export type PreviewPayload =
  | { kind: 'text'; content: string; text: string }
  | { kind: 'image'; dataUrl: string; mime: string }
  | { kind: 'svg'; content: string }
  | { kind: 'json'; tree: unknown; content: string }
  | { kind: 'html'; content: string; sandbox: boolean }
  | { kind: 'pdf'; url: string; inline: boolean }
  | { kind: 'zip'; entries: ZipEntry[] }
  | { kind: 'csv'; headers: string[]; rows: string[][] }
  | { kind: 'markdown'; content: string; text: string }
  | { kind: 'none'; reason: string }

export interface ZipEntry {
  name: string
  size: number
  isDirectory: boolean
}

/** Config API payload. */
export interface ConfigPayload {
  config: GalleryConfig
  source: 'default' | 'file'
  configPath: string | null
}
