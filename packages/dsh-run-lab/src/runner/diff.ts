/**
 * 文件系统 diff 统计：优先 git diff --stat（工作区是 git worktree / 仓库），
 * 否则对复制隔离做前后两次快照差异（新增/修改/删除文件的个数与字节数近似）。
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import type { Metrics } from '../core/types.ts'
import { emptyMetrics } from '../core/metrics.ts'

const execFileAsync = promisify(execFile)

export interface DiffStats {
  filesChanged: number | null
  diffSize: number | null
}

/** 基于 git 统计工作区相对 HEAD 的变更（git-worktree 场景，工作区本身即 worktree）。 */
export async function gitDiffStats(baseline: string, wsDir: string): Promise<DiffStats> {
  void baseline
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', wsDir, '--no-pager', 'diff', '--stat', '--no-color', 'HEAD'],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
    )
    return parseGitDiffStat(stdout)
  } catch {
    return { filesChanged: null, diffSize: null }
  }
}

export function parseGitDiffStat(text: string): DiffStats {
  const lines = text.trim().split('\n').filter((l) => l.length > 0)
  const changed = lines.filter((l) => !l.trim().startsWith(' ') && !l.trim().startsWith('files changed')).length
  // 最后一行的 "N files changed, X insertions(+), Y deletions(-)" 解析总 diff size。
  const summary = lines[lines.length - 1] ?? ''
  const ins = summary.match(/(\d+) insertion/)
  const del = summary.match(/(\d+) deletion/)
  const changed2 = summary.match(/^(\d+) files? changed/)
  const filesChanged = changed2
    ? Number(changed2[1])
    : changed > 0 ? changed : summary.trim() === '' ? 0 : changed
  const diffSize = (ins ? Number(ins[1]) : 0) + (del ? Number(del[1]) : 0)
  return { filesChanged, diffSize }
}

/** 非 git：对两棵目录树做递归快照比较，返回变更文件数与近似 diff 大小。 */
export async function directoryDiffStats(wsDir: string, before: DirSnapshot): Promise<DiffStats> {
  const after = await snapshotDir(wsDir)
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  let filesChanged = 0
  let diffSize = 0
  for (const key of allKeys) {
    const b = before[key]
    const a = after[key]
    if (b === a) continue // 相同（含都存在且内容一致）
    filesChanged++
    if (a !== undefined) diffSize += a
    if (b !== undefined && a === undefined) diffSize += b // 删除也算删除字节
  }
  return { filesChanged, diffSize }
}

export interface DirSnapshot {
  [relativePath: string]: number // bytes
}

const SNAPSHOT_IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.tsdown', 'lib'])

/** 递归快照目录：相对路径 -> 文件字节数。忽略大目录。 */
export async function snapshotDir(root: string, base = root, acc: DirSnapshot = {}): Promise<DirSnapshot> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entry of entries) {
    if (SNAPSHOT_IGNORE.has(entry.name)) continue
    const full = join(root, entry.name)
    const rel = relative(base, full).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      await snapshotDir(full, base, acc)
    } else if (entry.isFile()) {
      try {
        const st = await stat(full)
        acc[rel] = st.size
      } catch {
        // ignore unreadable
      }
    }
  }
  return acc
}

/** 收集一个分支的 diff 指标，写入 metrics。 */
export async function collectDiffMetrics(
  metrics: Metrics,
  method: 'git-worktree' | 'copy',
  baseline: string,
  wsDir: string,
  before?: DirSnapshot,
): Promise<Metrics> {
  const next = { ...emptyMetrics(), ...metrics }
  let diff: DiffStats
  if (method === 'git-worktree') {
    diff = await gitDiffStats(baseline, wsDir)
  } else if (before) {
    diff = await directoryDiffStats(wsDir, before)
  } else {
    diff = { filesChanged: null, diffSize: null }
  }
  next.filesChanged = diff.filesChanged
  next.diffSize = diff.diffSize
  return next
}

export { resolve }
