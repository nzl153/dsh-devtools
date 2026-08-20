/**
 * Incremental indexer: scan session files, decode (zstd), parse, and push into
 * the sidecar FTS index. Skips excluded sessions/workspaces and unchanged files.
 */
import { readFileSync, statSync } from 'node:fs'
import type { SessionIndex, SessionMeta } from './sqlite.ts'
import type { SessionFile } from './scanner.ts'
import { decodeSessionLog } from '../core/zstd.ts'
import { parseSession, type ParsedSession } from '../core/session-parse.ts'
import type { IndexedDoc } from '../core/types.ts'

export interface IndexResult {
  scanned: number
  indexed: number
  skippedUnchanged: number
  skippedExcluded: number
  failed: number
  failedIds: string[]
  docCount: number
}

export interface IndexerOptions {
  /** Rebuild a single session even if unchanged. */
  forceSessionId?: string
  /** Skip mtime check and re-index everything. */
  force?: boolean
}

export function decodeSessionFile(path: string): string[] {
  return decodeSessionLog(readFileSync(path))
}

export function parseSessionFile(
  path: string,
  sessionId: string,
  createdAt = 0,
): ParsedSession {
  const lines = decodeSessionFile(path)
  return parseSession(lines, sessionId, createdAt)
}

/** Run an incremental index pass. Returns stats. */
export function runIndex(
  index: SessionIndex,
  sessions: readonly SessionFile[],
  options: IndexerOptions = {},
): IndexResult {
  const result: IndexResult = {
    scanned: 0,
    indexed: 0,
    skippedUnchanged: 0,
    skippedExcluded: 0,
    failed: 0,
    failedIds: [],
    docCount: 0,
  }
  const excludedSessions = new Set(index.getStatus().excludedSessions)
  const excludedWorkspaces = new Set(index.getStatus().excludedWorkspaces)

  for (const session of sessions) {
    result.scanned += 1
    if (excludedSessions.has(session.sessionId)) {
      result.skippedExcluded += 1
      continue
    }
    if (excludedWorkspaces.has(session.workspace)) {
      result.skippedExcluded += 1
      continue
    }
    const existing = index.getSessionMeta(session.sessionId)
    const unchanged =
      existing !== null &&
      existing.mtimeMs === session.mtimeMs &&
      existing.fileSize === session.fileSize &&
      options.forceSessionId !== session.sessionId &&
      !options.force
    if (unchanged) {
      result.skippedUnchanged += 1
      continue
    }
    try {
      const parsed = parseSessionFile(session.path, session.sessionId)
      const docs: readonly IndexedDoc[] = parsed.docs
      const meta: SessionMeta = {
        sessionId: session.sessionId,
        workspace: session.workspace,
        path: session.path,
        title: parsed.title,
        createdAt: parsed.createdAt,
        fileSize: session.fileSize,
        mtimeMs: session.mtimeMs,
        docCount: docs.length,
        lastIndexedAt: new Date().toISOString(),
      }
      index.upsertSession(meta)
      index.insertDocs(session.sessionId, docs)
      result.indexed += 1
      result.docCount += docs.length
    } catch (error) {
      result.failed += 1
      result.failedIds.push(session.sessionId)
      // eslint-disable-next-line no-console
      // console.error(`[dsh-session-archaeologist] index failed ${session.sessionId}: ${(error as Error).message}`)
    }
  }
  return result
}

/** Index a single session file directly (used by the search panel "index session" action). */
export function indexOne(index: SessionIndex, session: SessionFile, force = false): void {
  runIndex(index, [session], { force })
}

/** Rebuild a single session from a known session path. */
export function reindexOne(index: SessionIndex, session: SessionFile): void {
  indexOne(index, session, true)
}

export function pathMtime(path: string): { size: number; mtimeMs: number } | null {
  try {
    const st = statSync(path)
    return { size: st.size, mtimeMs: st.mtimeMs }
  } catch {
    return null
  }
}
