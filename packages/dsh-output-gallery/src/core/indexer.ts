/**
 * Core indexer: merges a scan result (files + stat metadata + turn) into a
 * GallerySession state. Pure aside from the observation inputs; the host
 * scanner produces `ScanFile`s and this module maintains stable gallery state
 * including version history.
 */
import { classifyPath } from './classify.ts'
import { safetyForPath } from './safety.ts'
import { buildVersionHistory, changedTurns, mergeVersionHistory, normalizeKey } from './version.ts'
import type { GalleryCategory, GalleryConfig, GalleryFile, GallerySession, Observation, PreviewKind, RiskLevel, VersionRecord } from './types.ts'

/** A file discovered by the scanner at a given turn. */
export interface ScanFile {
  /** Relative posix path. */
  path: string
  /** Absolute path (host only). */
  absPath?: string
  size: number
  created: string
  modified: string
}

export interface IndexOptions {
  config: GalleryConfig
  turn: number
  /** Absolute workspace root (for absPath). */
  workspace: string
}

/** A file's derived classification for a gallery entry. */
export interface DerivedFile {
  path: string
  absPath?: string
  category: GalleryCategory
  previewKind: PreviewKind
  risk: RiskLevel
  mime: string
  previewAvailable: boolean
  size: number
  created: string
  modified: string
}

/** Classify a scan file into derived display facts (no state). */
export function deriveFile(file: ScanFile, config: GalleryConfig): DerivedFile {
  const classified = classifyPath(file.path)
  const verdict = safetyForPath(file.path, config.htmlSandbox)
  return {
    path: file.path,
    absPath: file.absPath,
    category: classified.category,
    previewKind: classified.previewKind,
    risk: classified.risk,
    mime: classified.mime,
    previewAvailable: verdict.allowPreview,
    size: file.size,
    created: file.created,
    modified: file.modified,
  }
}

/** Empty gallery state for a session. */
export function emptySession(sessionId: string, workspace: string, startedTurn: number): GallerySession {
  return {
    sessionId,
    workspace,
    startedTurn,
    lastScannedTurn: startedTurn,
    lastScanAt: new Date().toISOString(),
    files: [],
    versions: [],
    changedTurns: [],
    pins: {},
  }
}

/**
 * Index a scan into existing session state. Returns the updated session plus
 * change counters. Existing entries keep their identity; the "changed" flag and
 * version history are updated when size/mtime shift.
 */
export function indexScan(
  state: GallerySession,
  scan: readonly ScanFile[],
  options: IndexOptions,
): { session: GallerySession; added: number; changed: number; removed: number } {
  const incoming = new Map<string, ScanFile>()
  for (const file of scan) incoming.set(normalizeKey(file.path), file)

  const previous = new Map<string, GalleryFile>()
  for (const f of state.files) previous.set(normalizeKey(f.path), f)

  const observations: Observation[] = []
  for (const [key, file] of incoming) {
    observations.push({
      key,
      turn: options.turn,
      size: file.size,
      modified: file.modified,
      created: file.created,
    })
  }

  // Version history (incremental over prior records).
  let versions: VersionRecord[]
  if (options.config.trackVersions) {
    versions = mergeVersionHistory(state.versions, observations)
  } else {
    versions = []
  }

  const files: GalleryFile[] = []
  let added = 0
  let changed = 0
  for (const [key, file] of incoming) {
    const prior = previous.get(key)
    const derived = deriveFile(file, options.config)
    const seen = prior !== undefined
    const isChanged = !seen || prior.size !== file.size || prior.modified !== file.modified
    if (isChanged && seen) changed++
    if (!seen) added++
    files.push({
      path: derived.path,
      absPath: derived.absPath,
      category: derived.category,
      previewKind: derived.previewKind,
      risk: derived.risk,
      mime: derived.mime,
      size: derived.size,
      created: derived.created,
      modified: derived.modified,
      firstSeenTurn: prior ? prior.firstSeenTurn : options.turn,
      modifiedTurn: isChanged ? options.turn : (prior?.modifiedTurn ?? null),
      changed: isChanged,
      previewAvailable: derived.previewAvailable,
      associatedTurn: isChanged ? options.turn : (prior?.associatedTurn ?? options.turn),
      versionKeys: versions.filter((v) => v.key === key).map((v) => v.key),
      // Preserve previously recognized related command and user pin state.
      relatedCommand: prior?.relatedCommand ?? null,
      pinned: state.pins?.[key] === true,
    })
  }

  const removed = previous.size - files.filter((f) => previous.has(normalizeKey(f.path))).length

  return {
    session: {
      ...state,
      files,
      versions,
      changedTurns: changedTurns(versions),
      lastScannedTurn: options.turn,
      lastScanAt: new Date().toISOString(),
    },
    added,
    changed,
    removed,
  }
}

/** Select files for one category bucket. */
export function filesByCategory(session: GallerySession, category: GalleryCategory): GalleryFile[] {
  return session.files.filter((f) => f.category === category)
}

/** Turn labels for a file's version history (the "Turn 5/9/14" display). */
export function versionTurnsFor(session: GallerySession, key: string): number[] {
  const rec = session.versions.find((v) => v.key === normalizeKey(key))
  return rec ? rec.turns : []
}

/** Files the user pinned as deliverables (the top-level "final" view). */
export function pinnedFiles(session: GallerySession): GalleryFile[] {
  return session.files.filter((f) => session.pins?.[normalizeKey(f.path)] === true)
}
