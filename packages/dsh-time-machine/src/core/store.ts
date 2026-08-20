/**
 * Sidecar store: `~/.dsh/time-machine/<sessionId>/`.
 *
 * Design rules (see README security model):
 *  - Everything lives under the plugin's own directory; NOTHING is appended to
 *    the DSH session log.
 *  - Workspace file contents are stored only as content-addressed objects
 *    (`objects/<sha256>`), and only when a file changes. Pristine files at
 *    baseline are recorded as hash references only, never copied.
 *  - Large files (>= config.largeFileThresholdBytes) are recorded by hash but
 *    their content is not stored, so restore of a large file is a no-op with a
 *    clear message rather than a silent copy.
 *
 * All writes are atomic (write temp then rename).
 */
import path from 'node:path'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { promises as fs } from 'node:fs'
import type { HostFs } from './fsh.ts'
import type { SessionRecord } from './types.ts'

export interface SidecarStore {
  sessionDir(sessionId: string): string
  readSession(sessionId: string): Promise<SessionRecord | null>
  writeSession(record: SessionRecord): Promise<void>
  putObject(hash: string, data: Buffer): Promise<void>
  getObject(hash: string): Promise<Buffer | null>
  hasObject(hash: string): Promise<boolean>
  clear(sessionId?: string): Promise<void>
}

export function timeMachineRoot(dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')): string {
  return join(dshHome, 'time-machine')
}

function sanitize(sessionId: string): string {
  return sessionId.replaceAll(/[^a-zA-Z0-9._-]/g, '_')
}

export async function createSidecarStore(
  fsh: HostFs,
  root = timeMachineRoot(),
): Promise<SidecarStore> {
  await fsh.mkdirp(root)
  const sessionDir = (sessionId: string): string => join(root, sanitize(sessionId))
  const sessionFile = (sessionId: string): string => join(sessionDir(sessionId), 'session.json')
  const objectFile = (hash: string): string => join(root, 'objects', hash)

  const atomicWrite = async (abs: string, data: string | Buffer): Promise<void> => {
    const dir = path.dirname(abs)
    await fsh.mkdirp(dir)
    const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`
    await fsh.writeFile(tmp, Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'))
    try {
      await fsh.rename(tmp, abs)
    } catch (error) {
      // Windows rename over existing file may fail; fall back to remove + rename.
      try {
        await fsh.unlink(abs)
      } catch {
        /* ignore */
      }
      await fsh.rename(tmp, abs)
    }
  }

  return {
    sessionDir,
    async readSession(sessionId) {
      try {
        const raw = await fsh.readFile(sessionFile(sessionId))
        const parsed = JSON.parse(raw.toString('utf8')) as SessionRecord
        if (parsed.sessionId !== sessionId || !Array.isArray(parsed.baseline)) return null
        return parsed
      } catch {
        return null
      }
    },
    async writeSession(record) {
      await atomicWrite(sessionFile(record.sessionId), JSON.stringify(record, null, 2))
    },
    async putObject(hash, data) {
      await atomicWrite(objectFile(hash), data)
    },
    async getObject(hash) {
      try {
        return await fsh.readFile(objectFile(hash))
      } catch {
        return null
      }
    },
    async hasObject(hash) {
      try {
        await fsh.readFile(objectFile(hash))
        return true
      } catch {
        return false
      }
    },
    async clear(sessionId) {
      if (sessionId === undefined) {
        await fs.rm(root, { recursive: true, force: true })
        return
      }
      await fs.rm(sessionDir(sessionId), { recursive: true, force: true })
    },
  }
}
