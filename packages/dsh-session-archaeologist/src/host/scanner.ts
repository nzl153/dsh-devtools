/**
 * Session scanner: discover DSH session logs on disk and map workspaces.
 *
 * Layout (dsh-session-persistence-jsonl):
 *   <root>/<--normalized-cwd-->/<encoded-id>/session.jsonl.zstd
 *
 * The workspace mapping lives in ~/.dsh/storages/workspace.json (workspaces →
 * path/title). We use it to label workspaces and to support exclude-workspace.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { homedir } from 'node:os'

export interface SessionFile {
  sessionId: string
  workspace: string
  /** absolute path to session.jsonl.zstd */
  path: string
  fileSize: number
  mtimeMs: number
}

export interface WorkspaceInfo {
  id: string
  path: string
  title: string
}

export function dshHome(env = process.env.DSH_HOME): string {
  return env && env.length > 0 ? env : join(homedir(), '.dsh')
}

export function sessionsRoot(home: string): string {
  return join(home, 'sessions')
}

export function indexRoot(home: string): string {
  return join(home, 'session-archaeologist')
}

export function defaultIndexDbPath(home: string): string {
  return join(indexRoot(home), 'index.db')
}

/** Read workspace.json and return workspace list keyed by path. */
export function readWorkspaceMap(home: string): Map<string, WorkspaceInfo> {
  const map = new Map<string, WorkspaceInfo>()
  const file = join(home, 'storages', 'workspace.json')
  let raw: string
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    return map
  }
  try {
    const parsed = JSON.parse(raw) as {
      tables?: { workspaces?: Record<string, { path?: string; title?: string }> }
    }
    const workspaces = parsed.tables?.workspaces
    if (workspaces) {
      for (const [id, info] of Object.entries(workspaces)) {
        const path = info.path ?? ''
        const title = info.title ?? (basename(path) || id)
        if (path) map.set(path, { id, path, title })
      }
    }
  } catch {
    // unreadable — fall back to dirname-based labeling
  }
  return map
}

/**
 * Discover all session files under the sessions root.
 * Returns entries sorted by mtime descending (newest first).
 */
export function scanSessions(root: string, workspaceMap: Map<string, WorkspaceInfo> = new Map()): SessionFile[] {
  const out: SessionFile[] = []
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return out
  }
  for (const wsDir of entries) {
    const wsPath = join(root, wsDir)
    let st: ReturnType<typeof statSync>
    try {
      st = statSync(wsPath)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    // Try to resolve workspace label: the wsDir is a normalized cwd. Match by
    // denormalized path against the workspace map when possible.
    const workspace = resolveWorkspaceLabel(wsDir, workspaceMap)
    let sids: string[]
    try {
      sids = readdirSync(wsPath)
    } catch {
      continue
    }
    for (const sid of sids) {
      const sessionDir = join(wsPath, sid)
      let dSt: ReturnType<typeof statSync>
      try {
        dSt = statSync(sessionDir)
      } catch {
        continue
      }
      if (!dSt.isDirectory()) continue
      const file = join(sessionDir, 'session.jsonl.zstd')
      let fSt: ReturnType<typeof statSync>
      try {
        fSt = statSync(file)
      } catch {
        // also accept plain .jsonl when uncompressed persistence is configured
        const alt = join(sessionDir, 'session.jsonl')
        try {
          fSt = statSync(alt)
          out.push({ sessionId: sid, workspace, path: alt, fileSize: fSt.size, mtimeMs: fSt.mtimeMs })
        } catch {
          continue
        }
        continue
      }
      out.push({ sessionId: sid, workspace, path: file, fileSize: fSt.size, mtimeMs: fSt.mtimeMs })
    }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return out
}

/** Decode the normalized wsDir segment back to a workspace label. */
function resolveWorkspaceLabel(normalizedDir: string, workspaceMap: Map<string, WorkspaceInfo>): string {
  // workspace.json keys are real paths; find one whose encoding matches.
  for (const info of workspaceMap.values()) {
    if (normalizeWorkspaceDir(info.path) === normalizedDir) return info.path
  }
  // Fallback: the raw normalized token (not pretty, but stable).
  return normalizedDir
}

/**
 * Reproduce DSH's cwd-dir normalization loosely: backslashes → ~0020 etc.
 * This is best-effort; when it does not match, the raw token is used as label.
 */
export function normalizeWorkspaceDir(cwd: string): string {
  const cleaned = cwd.replace(/\\/g, '/').replace(/\//g, '~0020')
  return `--${cleaned}--`
}

/** True when a session file content exists (size > header-only heuristic). */
export function pathForFileName(root: string, wsDir: string, sessionId: string): string {
  return join(root, wsDir, sessionId, 'session.jsonl.zstd')
}

export function workspaceOfPath(sessionPath: string): string {
  return basename(dirname(dirname(sessionPath)))
}
