/**
 * Local stats store for dsh-tool-router.
 *
 * Stores only local statistics under ~/.dsh/dsh-tool-router/stats.json.
 * No network, no credentials, no raw full prompts (only an optional preview).
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { StatsFile, StatsRecord } from '../core/types.ts'

const MAX_EVENTS = 5000

export interface StatsStore {
  record(event: StatsRecord): void
  flush(): Promise<void>
  clear(): Promise<void>
}

export function statsDir(dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')): string {
  return join(dshHome, 'dsh-tool-router')
}

export async function createStatsStore(dir = statsDir()): Promise<StatsStore> {
  await mkdir(dir, { recursive: true })
  const file = join(dir, 'stats.json')
  let events: StatsRecord[] = []
  let flushTimer: NodeJS.Timeout | undefined

  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw) as StatsFile
    if (parsed.version === 1 && Array.isArray(parsed.events)) {
      events = parsed.events.slice(-MAX_EVENTS)
    }
  } catch {
    // first run or corrupt file; start fresh
  }

  const scheduleFlush = (): void => {
    if (flushTimer !== undefined) return
    flushTimer = setTimeout(() => {
      flushTimer = undefined
      void flush()
    }, 2000)
    flushTimer.unref?.()
  }

  const flush = async (): Promise<void> => {
    const snapshot: StatsFile = { version: 1, events: events.slice(-MAX_EVENTS) }
    // Direct write: Windows/sandbox environments can reject rename-over-existing,
    // and these stats are not critical enough to make a temp-file dance mandatory.
    await writeFile(file, JSON.stringify(snapshot, null, 2), 'utf8')
  }

  return {
    record(event) {
      events.push(event)
      scheduleFlush()
    },
    async flush() {
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer)
        flushTimer = undefined
      }
      await flush()
    },
    async clear() {
      events = []
      await rm(file, { force: true })
      await mkdir(dirname(file), { recursive: true })
    },
  }
}