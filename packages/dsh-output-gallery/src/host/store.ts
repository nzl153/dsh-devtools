/**
 * Sidecar store: `~/.dsh/output-gallery/<sessionId>.json`.
 *
 * Only metadata is written — file paths, sizes, timestamps, categories,
 * version-history turn numbers. File contents are never copied into the store;
 * previews read files live from disk. No cross-session data is mixed.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { GallerySession } from '../core/types.ts'

export interface GalleryStore {
  read(sessionId: string): Promise<GallerySession | null>
  write(session: GallerySession): Promise<void>
  listSessions(): Promise<Array<{ sessionId: string; workspace: string; lastScanAt: string }>>
  clear(sessionId?: string): Promise<void>
}

export function galleryDir(dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')): string {
  return join(dshHome, 'output-gallery')
}

function fileFor(dir: string, sessionId: string): string {
  const safe = sessionId.replaceAll(/[^a-zA-Z0-9._-]/g, '_')
  return join(dir, `${safe}.json`)
}

export async function createGalleryStore(dir = galleryDir()): Promise<GalleryStore> {
  await mkdir(dir, { recursive: true })
  return {
    async read(sessionId) {
      try {
        const raw = await readFile(fileFor(dir, sessionId), 'utf8')
        const parsed = JSON.parse(raw) as GallerySession
        if (parsed.sessionId !== sessionId || !Array.isArray(parsed.files)) return null
        // Backfill pins for stores written before Phase 2.
        if (!parsed.pins || typeof parsed.pins !== 'object' || Array.isArray(parsed.pins)) {
          parsed.pins = {}
        }
        return parsed
      } catch {
        return null
      }
    },
    async write(session) {
      await writeFile(fileFor(dir, session.sessionId), JSON.stringify(session, null, 2), 'utf8')
    },
    async listSessions() {
      const { readdir } = await import('node:fs/promises')
      const out: Array<{ sessionId: string; workspace: string; lastScanAt: string }> = []
      try {
        const names = await readdir(dir)
        for (const name of names) {
          if (!name.endsWith('.json')) continue
          try {
            const raw = await readFile(join(dir, name), 'utf8')
            const parsed = JSON.parse(raw) as GallerySession
            out.push({ sessionId: parsed.sessionId, workspace: parsed.workspace, lastScanAt: parsed.lastScanAt })
          } catch {
            // skip unreadable
          }
        }
      } catch {
        // dir missing
      }
      return out
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
