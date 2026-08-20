/**
 * Version tracking: builds per-path version history metadata from a sequence
 * of observations across turns. Never stores file content — only turn numbers,
 * sizes and timestamps. Detects a "change" by size and mtime shift.
 */
import type { Observation, VersionRecord } from './types.ts'

/**
 * Normalize an observation key (relative posix path, no leading slash).
 */
export function normalizeKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

/** Equality of a size+mtime observation (change detection). */
export function sameVersion(a: { size: number; modified: string }, b: { size: number; modified: string }): boolean {
  return a.size === b.size && a.modified === b.modified
}

/** Build per-path version history from cumulative observations (ascending turns). */
export function buildVersionHistory(observations: readonly Observation[]): VersionRecord[] {
  const byKey = new Map<string, Observation[]>()
  for (const obs of observations) {
    const key = normalizeKey(obs.key)
    const list = byKey.get(key)
    if (list) list.push(obs)
    else byKey.set(key, [obs])
  }

  const out: VersionRecord[] = []
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.turn - b.turn)
    const turns: number[] = []
    let previous: Observation | null = null
    for (const obs of sorted) {
      if (!previous || !sameVersion(previous, obs)) {
        turns.push(obs.turn)
      }
      previous = obs
    }
    const last = sorted[sorted.length - 1]
    out.push({
      key,
      turns,
      size: last.size,
      modified: last.modified,
      created: sorted[0].created,
    })
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

/**
 * Append a scan observation set to an existing version history (incremental).
 * Preserves the full existing turn lists: for each new observation, a turn is
 * appended only when the observed size/mtime differs from the record's latest.
 */
export function mergeVersionHistory(
  existing: readonly VersionRecord[],
  newObservations: readonly Observation[],
): VersionRecord[] {
  const byKey = new Map<string, VersionRecord>()
  for (const rec of existing) byKey.set(normalizeKey(rec.key), { ...rec, turns: [...rec.turns] })

  for (const obs of newObservations) {
    const key = normalizeKey(obs.key)
    const rec = byKey.get(key)
    if (!rec) {
      byKey.set(key, {
        key,
        turns: [obs.turn],
        size: obs.size,
        modified: obs.modified,
        created: obs.created,
      })
      continue
    }
    if (!sameVersion({ size: rec.size, modified: rec.modified }, { size: obs.size, modified: obs.modified })) {
      rec.turns.push(obs.turn)
      rec.size = obs.size
      rec.modified = obs.modified
      if (!rec.created) rec.created = obs.created
    }
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}

/** Collect changed turn numbers across a version history (ascending, deduped). */
export function changedTurns(versions: readonly VersionRecord[]): number[] {
  const set = new Set<number>()
  for (const v of versions) {
    for (const turn of v.turns) set.add(turn)
  }
  return [...set].sort((a, b) => a - b)
}
