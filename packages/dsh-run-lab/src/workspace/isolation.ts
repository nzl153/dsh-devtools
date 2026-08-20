/**
 * 隔离工作区：
 *  - git 仓库优先 `git worktree add <dir> <commit>`；
 *  - 非 git 仓库用复制目录（忽略 node_modules/.git/.dsh 等大目录）。
 * 之后可选择性地对工作区写入 BranchConfig.workspaceOverrides 覆盖文件。
 *
 * Windows 路径处理：统一用 path.resolve，交给 child_process with cwd。
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, mkdir, writeFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BranchConfig } from '../core/types.ts'

const execFileAsync = promisify(execFile)

export interface IsolationOptions {
  baseline: string
  baselineIsGit: boolean
  /** git 仓库时的 commit；非 git 时忽略。 */
  commit?: string | null
  /** 强制复制（忽略 git）。 */
  forceCopy?: boolean
  /** 覆盖文件（键为相对路径，值为内容）。 */
  overrides?: Record<string, string>
  /** 复制时忽略的顶层条目（相对名）。 */
  copyIgnore?: string[]
}

export interface IsolationResult {
  dir: string
  method: 'git-worktree' | 'copy'
}

const DEFAULT_IGNORE = ['node_modules', '.git', '.dsh', 'dist', 'build', '.nyc_output', 'coverage']

export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], {
      windowsHide: true,
    })
    return true
  } catch {
    return false
  }
}

export async function detectIsolation(
  baseline: string,
  forceCopy = false,
): Promise<{ isGit: boolean; headCommit: string | null }> {
  if (forceCopy) return { isGit: false, headCommit: null }
  const isGit = await isGitRepo(baseline)
  if (!isGit) return { isGit: false, headCommit: null }
  try {
    const { stdout } = await execFileAsync('git', ['-C', baseline, 'rev-parse', 'HEAD'], { windowsHide: true })
    return { isGit: true, headCommit: stdout.trim() || null }
  } catch {
    return { isGit: true, headCommit: null }
  }
}

/**
 * 在 targetDir 建立隔离工作区，返回实际方法。调用方负责在完成后清理。
 * git worktree 会校验 commit 存在；copy 忽略大目录。
 */
export async function createIsolatedWorkspace(
  options: IsolationOptions,
  targetDir: string,
): Promise<IsolationResult> {
  await mkdir(dirname(targetDir), { recursive: true })
  const useGit = options.baselineIsGit && !options.forceCopy
  if (useGit) {
    const commit = options.commit ?? 'HEAD'
    // 先确保 targetDir 不存在（worktree add 要求新目录）。
    await rm(targetDir, { recursive: true, force: true })
    try {
      await execFileAsync('git', ['-C', options.baseline, 'worktree', 'add', '--detach', targetDir, commit], {
        windowsHide: true,
      })
    } catch (error) {
      throw new Error(
        `git worktree add failed: ${error instanceof Error ? error.message : String(error)}. ` +
        `Try forceCopy=true (non-destructive copy) instead.`,
      )
    }
    await applyOverrides(targetDir, options.overrides)
    return { dir: targetDir, method: 'git-worktree' }
  }

  // 复制隔离：过滤掉 node_modules 等大目录，避免拷贝 DSH 自身。
  const ignore = new Set([...DEFAULT_IGNORE, ...(options.copyIgnore ?? [])])
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
  await copyFiltered(options.baseline, targetDir, ignore)
  await applyOverrides(targetDir, options.overrides)
  return { dir: targetDir, method: 'copy' }
}

async function copyFiltered(src: string, dest: string, ignore: Set<string>): Promise<void> {
  await cp(src, dest, {
    recursive: true,
    filter: (p) => {
      const rel = p.slice(src.length).replace(/[\\/]+$/, '').replace(/^[\\/]+/, '')
      const top = rel.split(/[\\/]/)[0]
      return !ignore.has(top)
    },
  })
}

async function applyOverrides(ws: string, overrides?: Record<string, string>): Promise<void> {
  if (!overrides) return
  for (const [rel, content] of Object.entries(overrides)) {
    const abs = resolve(ws, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content, 'utf8')
  }
}

/** 移除隔离工作区；git 用 worktree remove，copy 直接删目录。 */
export async function removeIsolatedWorkspace(dir: string, method: 'git-worktree' | 'copy', baseline?: string): Promise<void> {
  try {
    if (method === 'git-worktree' && baseline) {
      await execFileAsync('git', ['-C', baseline, 'worktree', 'remove', '--force', dir], { windowsHide: true })
      return
    }
  } catch {
    // fallthrough: 直接删除目录
  }
  await rm(dir, { recursive: true, force: true })
}

/** 校验路径没有空格等危险字符（隔离目录必须稳定）。 */
export function assertSafePath(p: string): void {
  if (/\s/.test(p)) throw new Error(`unsafe path (contains whitespace): ${p}`)
}

const here = dirname(fileURLToPath(import.meta.url))
export const _testSelfPath = here
