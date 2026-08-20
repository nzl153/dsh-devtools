/**
 * Line-based diff utilities.
 *
 * The engine uses these to compute added/removed line counts and a compact
 * unified diff for text files. Implementation is a simple Myers-style LCS over
 * lines with a cost cap; beyond the cap we fall back to whole-file replace so a
 * pathological file never blows up the process. Pure — no DSH, no node deps.
 */
import type { ScanEntry } from './types.ts'

export interface LineDiff {
  readonly addedLines: number
  readonly removedLines: number
  readonly unified: string
}

export interface RenameMatch {
  readonly oldPath: string
  readonly newPath: string
  readonly exact: boolean
  readonly similarity: number
}

const MAX_MATRIX = 4000 * 4000

/**
 * Content similarity in [0,1]. 1 means identical after line diff.
 * Uses the same diff engine as the rest of the plugin.
 */
export function lineSimilarity(oldText: string, newText: string): number {
  const a = oldText.split(/\r?\n/)
  const b = newText.split(/\r?\n/)
  const d = diffLines(oldText, newText)
  const total = a.length + b.length
  if (total === 0) return 1
  return Math.max(0, 1 - (d.addedLines + d.removedLines) / total)
}

/**
 * Find rename pairs between two snapshots.
 *
 * First version rules:
 *  - Require same byte size.
 *  - Exact rename when hashes match.
 *  - Otherwise, for text files, require content similarity >= threshold.
 *
 * Matching is greedy by score so each path participates in at most one pair.
 */
export type RenameSide = 'old' | 'new'

export async function findRenames(
  previous: ReadonlyMap<string, ScanEntry>,
  current: ReadonlyMap<string, ScanEntry>,
  readText: (relPath: string, side: RenameSide) => Promise<string | null>,
  threshold = 0.6,
): Promise<RenameMatch[]> {
  const deleted = [...previous.keys()].filter((k) => !current.has(k))
  const added = [...current.keys()].filter((k) => !previous.has(k))
  if (deleted.length === 0 || added.length === 0) return []

  interface Candidate extends RenameMatch { readonly oldPath: string }

  const candidates: Candidate[] = []
  for (const oldPath of deleted) {
    const prev = previous.get(oldPath)
    if (!prev) continue
    for (const newPath of added) {
      const next = current.get(newPath)
      if (!next) continue
      if (prev.size !== next.size) continue
      const exact = prev.hash !== null && prev.hash === next.hash
      if (exact) {
        candidates.push({ oldPath, newPath, exact: true, similarity: 1 })
        continue
      }
      if (prev.kind !== 'text' || next.kind !== 'text') continue
      const oldText = await readText(oldPath, 'old')
      const newText = await readText(newPath, 'new')
      if (oldText === null || newText === null) continue
      const similarity = lineSimilarity(oldText, newText)
      if (similarity >= threshold) {
        candidates.push({ oldPath, newPath, exact: false, similarity })
      }
    }
  }

  candidates.sort((a, b) =>
    b.exact === a.exact
      ? b.similarity - a.similarity
      : (b.exact ? 1 : 0) - (a.exact ? 1 : 0),
  )

  const usedOld = new Set<string>()
  const usedNew = new Set<string>()
  const out: RenameMatch[] = []
  for (const c of candidates) {
    if (usedOld.has(c.oldPath) || usedNew.has(c.newPath)) continue
    usedOld.add(c.oldPath)
    usedNew.add(c.newPath)
    out.push(c)
  }
  return out
}

/**
 * Compute a line diff between two texts.
 * `oldLabel` / `newLabel` are used in the unified header (defaults are fine).
 */
export function diffLines(
  oldText: string,
  newText: string,
  oldLabel = 'a',
  newLabel = 'b',
): LineDiff {
  const a = oldText.split(/\r?\n/)
  const b = newText.split(/\r?\n/)
  // Split leaves a trailing "" for files ending in newline; preserve that.
  const n = a.length
  const m = b.length
  let added = 0
  let removed = 0
  let unified: string

  const total = n * m
  if (total > MAX_MATRIX) {
    // Cost cap: treat as full replace.
    removed = n
    added = m
    unified = renderUnified([], a, b, oldLabel, newLabel)
    return { addedLines: added, removedLines: removed, unified }
  }

  // LCS table (classic DP with small ints).
  const lcs: Int32Array = new Int32Array((n + 1) * (m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const idx = (i + 1) * (m + 1) + (j + 1)
      if (a[i] === b[j]) {
        lcs[i * (m + 1) + j] = lcs[idx] + 1
      } else {
        const right = lcs[i * (m + 1) + (j + 1)]
        const down = lcs[(i + 1) * (m + 1) + j]
        lcs[i * (m + 1) + j] = right > down ? right : down
      }
    }
  }

  // Backtrack to produce an edit script.
  const ops: Array<{ kind: 'eq' | 'del' | 'add'; line: string }> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'eq', line: a[i] })
      i++
      j++
    } else if (lcs[(i + 1) * (m + 1) + j] >= lcs[i * (m + 1) + (j + 1)]) {
      ops.push({ kind: 'del', line: a[i] })
      removed++
      i++
    } else {
      ops.push({ kind: 'add', line: b[j] })
      added++
      j++
    }
  }
  while (i < n) {
    ops.push({ kind: 'del', line: a[i++] })
    removed++
  }
  while (j < m) {
    ops.push({ kind: 'add', line: b[j++] })
    added++
  }

  unified = renderOps(ops, oldLabel, newLabel)
  return { addedLines: added, removedLines: removed, unified }
}

function renderOps(
  ops: Array<{ kind: 'eq' | 'del' | 'add'; line: string }>,
  oldLabel: string,
  newLabel: string,
): string {
  const lines: string[] = [`--- ${oldLabel}`, `+++ ${newLabel}`]
  // Single hunk covering the span of changes.
  let hunkStart = -1
  let bStart = 1
  let aStart = 1
  let aPos = 1
  let bPos = 1
  for (const op of ops) {
    if (op.kind !== 'eq' && hunkStart < 0) {
      hunkStart = aPos
      aStart = aPos
      bStart = bPos
    }
    if (op.kind === 'eq') {
      aPos++
      bPos++
    } else if (op.kind === 'del') {
      aPos++
    } else {
      bPos++
    }
  }
  if (hunkStart < 0) {
    return lines.join('\n')
  }
  lines.push(`@@ -${aStart},${removedOr(aPos, aStart)} +${bStart},${removedOr(bPos, bStart)} @@`)
  for (const op of ops) {
    if (op.kind === 'eq') lines.push(' ' + op.line)
    else if (op.kind === 'del') lines.push('-' + op.line)
    else lines.push('+' + op.line)
  }
  return lines.join('\n')
}

function removedOr(end: number, start: number): number {
  const count = end - start
  return count === 0 ? 1 : count
}

function renderUnified(
  _ops: unknown[],
  a: string[],
  b: string[],
  oldLabel: string,
  newLabel: string,
): string {
  const lines: string[] = [`--- ${oldLabel}`, `+++ ${newLabel}`]
  lines.push(`@@ -1,${a.length} +1,${b.length} @@`)
  for (const line of a) lines.push('-' + line)
  for (const line of b) lines.push('+' + line)
  return lines.join('\n')
}
