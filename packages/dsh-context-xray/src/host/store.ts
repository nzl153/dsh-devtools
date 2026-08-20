/**
 * Sidecar history store: ~/.dsh/context-xray/<sessionId>.json
 *
 * Only metadata/token counts and tool names are persisted. Full prompt text,
 * message bodies, and tool schemas are never written to this store.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { SessionHistory, TurnPoint } from '../core/types.ts'

export interface HistoryStore {
  append(sessionId: string, point: TurnPoint): Promise<void>
  read(sessionId: string): Promise<SessionHistory | null>
  clear(sessionId?: string): Promise<void>
}

export function historyDir(dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')): string {
  return join(dshHome, 'context-xray')
}

function fileFor(dir: string, sessionId: string): string {
  return join(dir, `${sessionId.replaceAll(/[^a-zA-Z0-9._-]/g, '_')}.json`)
}

export async function createHistoryStore(dir = historyDir()): Promise<HistoryStore> {
  await mkdir(dir, { recursive: true })
  return {
    async append(sessionId, point) {
      const file = fileFor(dir, sessionId)
      let history: SessionHistory = { sessionId, entries: [] }
      try {
        const raw = await readFile(file, 'utf8')
        history = JSON.parse(raw) as SessionHistory
        if (history.sessionId !== sessionId || !Array.isArray(history.entries)) {
          history = { sessionId, entries: [] }
        }
      } catch {
        // first write
      }
      const next: SessionHistory = {
        sessionId,
        entries: [...history.entries.filter((e) => e.turn !== point.turn), point]
          .sort((a, b) => a.turn - b.turn),
      }
      await writeFile(file, JSON.stringify(next, null, 2), 'utf8')
    },
    async read(sessionId) {
      try {
        const raw = await readFile(fileFor(dir, sessionId), 'utf8')
        return JSON.parse(raw) as SessionHistory
      } catch {
        return null
      }
    },
    async clear(sessionId) {
      if (sessionId === undefined) {
        await rm(dir, { recursive: true, force: true })
        await mkdir(dir, { recursive: true })
        return
      }
      await rm(fileFor(dir, sessionId), { force: true })
    },
  }
}