/**
 * Sidecar SQLite (FTS5) index for dsh-session-archaeologist.
 *
 * Uses Node's built-in node:sqlite DatabaseSync — no native npm dependency.
 * FTS5 is available in the same SQLite build Node ships (verified on Node 24).
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
  IndexedDoc,
  IndexStatus,
  SearchFilters,
  SearchHit,
  SearchResponse,
  SessionResult,
  SourceKind,
} from '../core/types.ts'

export interface SessionMeta {
  sessionId: string
  workspace: string
  path: string
  title: string
  createdAt: number
  fileSize: number
  mtimeMs: number
  docCount: number
  lastIndexedAt: string
}

export interface DocRow {
  rowid: number
  session_id: string
  seq: number
  time: number
  title: string
  role: string
  source: SourceKind
  content: string
  meta: string
}

export interface SearchQueryOptions {
  filters?: SearchFilters
  limit?: number
  offset?: number
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0,
  file_size INTEGER NOT NULL DEFAULT 0,
  mtime_ms INTEGER NOT NULL DEFAULT 0,
  doc_count INTEGER NOT NULL DEFAULT 0,
  last_indexed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS excluded_sessions (
  session_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS excluded_workspaces (
  workspace TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
  session_id UNINDEXED,
  seq UNINDEXED,
  time UNINDEXED,
  title UNINDEXED,
  role UNINDEXED,
  source UNINDEXED,
  content,
  meta UNINDEXED,
  tokenize = 'unicode61'
);
`

function fmt(ms = Date.now()): string {
  return new Date(ms).toISOString()
}

/** Escape user input into FTS5 AND-of-quoted-tokens query. */
export function toFtsQuery(input: string): string {
  const tokens = input.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return ''
  return tokens
    .map((tok) => {
      const escaped = tok.replaceAll('"', '""')
      // quote as literal token/phrase; multi-word user input becomes AND
      return `"${escaped}"`
    })
    .join(' ')
}

/**
 * Build a parameterized SQL filter suffix for search.
 * Returns { where, params } where `where` is appended after MATCH.
 */
function buildFilters(filters: SearchFilters | undefined, limit: number, offset: number): { where: string; params: SQLInputValue[] } {
  const clauses: string[] = []
  const params: SQLInputValue[] = []
  if (filters?.sessions && filters.sessions.length > 0) {
    clauses.push(`s.session_id IN (${filters.sessions.map(() => '?').join(',')})`)
    params.push(...filters.sessions)
  }
  if (filters?.workspaces && filters.workspaces.length > 0) {
    clauses.push(`s.workspace IN (${filters.workspaces.map(() => '?').join(',')})`)
    params.push(...filters.workspaces)
  }
  if (typeof filters?.projectPath === 'string' && filters.projectPath.length > 0) {
    clauses.push('(s.workspace = ? OR s.workspace LIKE ?)')
    const prefix = filters.projectPath.replace(/[\\/]+$/, '')
    params.push(filters.projectPath, `${prefix}%`)
  }
  if (filters?.source && filters.source.length > 0) {
    clauses.push(`d.source IN (${filters.source.map(() => '?').join(',')})`)
    params.push(...filters.source)
  }
  if (typeof filters?.after === 'number') {
    clauses.push('d.time >= ?')
    params.push(filters.after)
  }
  if (typeof filters?.before === 'number') {
    clauses.push('d.time < ?')
    params.push(filters.before)
  }
  // exclusions are applied always (not in filters to avoid accidental omission)
  void limit
  void offset
  const where = clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : ''
  return { where, params }
}

export interface SearchRow {
  rowid: number
  session_id: string
  seq: number
  time: number
  title: string
  role: string
  source: SourceKind
  content: string
  workspace: string
  bm: number
}

function formatContextDoc(doc: DocRow): string {
  const label = doc.source
  const content = doc.content.trim().replace(/\s+/g, ' ').slice(0, 200)
  return `[${label}] ${content}`
}

function contextAround(docs: readonly DocRow[], seq: number, radius = 3): { before: string[]; after: string[] } {
  const idx = docs.findIndex((d) => d.seq === seq)
  if (idx < 0) return { before: [], after: [] }
  const before = docs
    .slice(Math.max(0, idx - radius), idx)
    .map(formatContextDoc)
  const after = docs
    .slice(idx + 1, idx + 1 + radius)
    .map(formatContextDoc)
  return { before, after }
}

export class SessionIndex {
  readonly dbPath: string
  private db: DatabaseSync

  constructor(dbPath: string) {
    this.dbPath = dbPath
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new DatabaseSync(dbPath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = NORMAL')
    this.db.exec(SCHEMA)
  }

  close(): void {
    this.db.close()
  }

  getStatus(): IndexStatus {
    const sessions = this.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }
    const docs = this.db.prepare('SELECT COUNT(*) AS n FROM docs').get() as { n: number }
    const exclS = this.db.prepare('SELECT session_id FROM excluded_sessions ORDER BY session_id').all() as { session_id: string }[]
    const exclW = this.db.prepare('SELECT workspace FROM excluded_workspaces ORDER BY workspace').all() as { workspace: string }[]
    return {
      indexedSessions: sessions.n,
      indexedDocs: docs.n,
      excludedSessions: exclS.map((r) => r.session_id),
      excludedWorkspaces: exclW.map((r) => r.workspace),
      dbPath: this.dbPath,
    }
  }

  upsertSession(meta: SessionMeta): void {
    this.db.prepare(`
      INSERT INTO sessions (session_id, workspace, path, title, created_at, file_size, mtime_ms, doc_count, last_indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        workspace=excluded.workspace,
        path=excluded.path,
        title=excluded.title,
        created_at=excluded.created_at,
        file_size=excluded.file_size,
        mtime_ms=excluded.mtime_ms,
        doc_count=excluded.doc_count,
        last_indexed_at=excluded.last_indexed_at
    `).run(meta.sessionId, meta.workspace, meta.path, meta.title, meta.createdAt, meta.fileSize, meta.mtimeMs, meta.docCount, meta.lastIndexedAt)
  }

  deleteSession(sessionId: string): void {
    this.db.prepare('DELETE FROM docs WHERE session_id = ?').run(sessionId)
    this.db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId)
  }

  insertDocs(sessionId: string, docs: readonly IndexedDoc[]): void {
    this.db.prepare('DELETE FROM docs WHERE session_id = ?').run(sessionId)
    const ins = this.db.prepare(`
      INSERT INTO docs (session_id, seq, time, title, role, source, content, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const d of docs) {
      ins.run(d.sessionId, d.seq, d.time, d.title, d.role, d.source, d.content, d.meta ?? '')
    }
  }

  getSessionMeta(sessionId: string): (SessionMeta & { doc_count: number }) | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId) as Record<string, unknown> | undefined
    if (!row) return null
    return {
      sessionId: row.session_id as string,
      workspace: row.workspace as string,
      path: row.path as string,
      title: row.title as string,
      createdAt: row.created_at as number,
      fileSize: row.file_size as number,
      mtimeMs: row.mtime_ms as number,
      docCount: row.doc_count as number,
      lastIndexedAt: row.last_indexed_at as string,
      doc_count: row.doc_count as number,
    } as SessionMeta & { doc_count: number }
  }

  /** All docs for a session, sorted by seq. */
  getDocsForSession(sessionId: string): DocRow[] {
    return this.db.prepare(
      'SELECT rowid, session_id, seq, time, title, role, source, content, meta FROM docs WHERE session_id = ? ORDER BY seq ASC',
    ).all(sessionId) as unknown as DocRow[]
  }

  /** Context slice around a seq within a session. */
  getContext(sessionId: string, seq: number, radius = 4): DocRow[] {
    return this.db.prepare(
      `SELECT rowid, session_id, seq, time, title, role, source, content, meta
       FROM docs WHERE session_id = ? AND seq >= ? AND seq <= ?
       ORDER BY seq ASC`,
    ).all(sessionId, seq - radius, seq + radius) as unknown as DocRow[]
  }

  addExcludedSession(sessionId: string): void {
    this.db.prepare('INSERT OR IGNORE INTO excluded_sessions (session_id, created_at) VALUES (?, ?)').run(sessionId, fmt())
  }

  removeExcludedSession(sessionId: string): void {
    this.db.prepare('DELETE FROM excluded_sessions WHERE session_id = ?').run(sessionId)
  }

  addExcludedWorkspace(workspace: string): void {
    this.db.prepare('INSERT OR IGNORE INTO excluded_workspaces (workspace, created_at) VALUES (?, ?)').run(workspace, fmt())
  }

  removeExcludedWorkspace(workspace: string): void {
    this.db.prepare('DELETE FROM excluded_workspaces WHERE workspace = ?').run(workspace)
  }

  clear(): void {
    this.db.exec('DELETE FROM docs')
    this.db.exec('DELETE FROM sessions')
  }

  getSessionCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }
    return row.n
  }

  search(query: string, options: SearchQueryOptions = {}): SearchResponse {
    const started = Date.now()
    const fts = toFtsQuery(query)
    if (!fts) {
      return {
        query,
        total: 0,
        results: [],
        hits: [],
        tookMs: Date.now() - started,
      }
    }
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
    const offset = Math.max(options.offset ?? 0, 0)
    const { where, params } = buildFilters(options.filters, limit, offset)

    const countRow = this.db.prepare(`
      SELECT COUNT(*) AS n
      FROM docs d JOIN sessions s ON s.session_id = d.session_id
      WHERE docs MATCH ?
        AND s.session_id NOT IN (SELECT session_id FROM excluded_sessions)
        AND s.workspace NOT IN (SELECT workspace FROM excluded_workspaces)
        ${where}
    `).get(fts, ...params) as { n: number }

    const sql = `
      SELECT d.rowid, d.session_id, d.seq, d.time, d.title, d.role, d.source, d.content,
             s.workspace AS workspace,
             bm25(docs) AS bm
      FROM docs d JOIN sessions s ON s.session_id = d.session_id
      WHERE docs MATCH ?
        AND s.session_id NOT IN (SELECT session_id FROM excluded_sessions)
        AND s.workspace NOT IN (SELECT workspace FROM excluded_workspaces)
        ${where}
      ORDER BY bm25(docs), d.time DESC, d.seq DESC
      LIMIT ? OFFSET ?
    `
    const rows = this.db.prepare(sql).all(fts, ...params, limit, offset) as unknown as SearchRow[]

    // Normalize BM25 to a 0-100 display score. BM25 values are negative;
    // higher (closer to zero) is better.
    const scores = rows.map((r) => -r.bm)
    const maxScore = scores.length > 0 ? Math.max(...scores) : 1
    const minScore = scores.length > 0 ? Math.min(...scores) : 0
    const span = Math.max(maxScore - minScore, 1e-9)

    // Cache all docs per session once. Search result sets are bounded (≤200),
    // so this stays cheap and avoids N+1 context queries.
    const sessionDocs = new Map<string, DocRow[]>()
    const getDocs = (sessionId: string): DocRow[] => {
      let docs = sessionDocs.get(sessionId)
      if (!docs) {
        docs = this.getDocsForSession(sessionId)
        sessionDocs.set(sessionId, docs)
      }
      return docs
    }

    // Group hits by session to build aggregate results.
    const sessionMap = new Map<string, { score: number; count: number; first: SearchRow; fields: Set<SourceKind> }>()
    const hits: SearchHit[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const score = scores[i] ?? 0
      const relevance = Math.round(((score - minScore) / span) * 100)
      const snippetRaw = this.db.prepare(
        `SELECT snippet(docs, 6, '[', ']', '…', 12) AS s FROM docs WHERE rowid = ?`,
      ).get(r.rowid) as { s: string }
      const snippet = snippetRaw?.s ?? r.content.slice(0, 160)
      const docs = getDocs(r.session_id)
      const ctx = contextAround(docs, r.seq)
      hits.push({
        sessionId: r.session_id,
        seq: r.seq,
        time: r.time,
        title: r.title,
        source: r.source,
        role: r.role,
        snippet,
        relevance,
        sessionHitCount: 0, // filled below
        workspace: r.workspace,
        contextBefore: ctx.before,
        contextAfter: ctx.after,
      })
      const agg = sessionMap.get(r.session_id) ?? { score: 0, count: 0, first: r, fields: new Set<SourceKind>() }
      agg.count += 1
      agg.score += score
      agg.fields.add(r.source)
      sessionMap.set(r.session_id, agg)
    }
    // sessionHitCount per hit after aggregation
    for (const hit of hits) {
      hit.sessionHitCount = sessionMap.get(hit.sessionId)?.count ?? 1
    }

    const results: SessionResult[] = []
    for (const [sessionId, agg] of sessionMap) {
      const first = agg.first
      const docsInSession = getDocs(sessionId)
      const filesSet = new Set<string>()
      const commandsSet = new Set<string>()
      let hasError = false
      for (const doc of docsInSession) {
        if (doc.source === 'tool' || doc.source === 'tool-result') {
          for (const m of doc.content.matchAll(/(?:[A-Za-z]:[\\/]|\/)[^\s"']+\.(?:ts|tsx|js|jsx|json|py|md|c|cpp|rs|go|java|sh|ps1|yml|yaml|toml|css|html|sql|mjs|cjs)(?=[\s"')\]]|$)/g)) {
            filesSet.add(m[0].trim())
          }
          if (doc.source === 'tool-result' && /error|failed|failure|exception|traceback|exit code/i.test(doc.content)) hasError = true
        }
        if (doc.source === 'tool') {
          const cmd = doc.meta
          if (cmd && /^(?:bash|pwsh|powershell|cmd|sh|shell|zsh|git|node|npm|pnpm|python)/.test(cmd)) commandsSet.add(cmd)
        }
      }
      const outcome = [...docsInSession].sort((a, b) => b.seq - a.seq).find((d) => d.source === 'outcome')?.content ?? null
      results.push({
        sessionId,
        date: first.time ? new Date(first.time).toISOString() : '',
        title: first.title || '(untitled)',
        workspace: first.workspace,
        relevance: Math.min(100, Math.max(0, Math.round((agg.score / maxScore) * 100))),
        hitCount: agg.count,
        snippet: agg.first.content.slice(0, 200),
        hitFields: [...agg.fields],
        files: [...filesSet].slice(0, 30),
        commands: [...commandsSet].slice(0, 20),
        hasError,
        outcome,
      })
    }
    results.sort((a, b) => b.relevance - a.relevance || b.hitCount - a.hitCount)

    return {
      query,
      total: countRow.n,
      results,
      hits,
      tookMs: Date.now() - started,
    }
  }
}