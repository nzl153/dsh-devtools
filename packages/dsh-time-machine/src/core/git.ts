/**
 * Read-only git helpers.
 *
 * SAFETY: this module only ever runs *read-only* git commands
 * (`rev-parse`, `status --porcelain`, `ls-files`). It never runs
 * `reset --hard`, `clean -fd`, `checkout .`, or anything that mutates the
 * working tree or index. Non-git directories are handled gracefully (the
 * helpers report `inRepo: false`).
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitFileState } from './types.ts'

const execFileP = promisify(execFile)

function runGit(
  cwd: string,
  args: string[],
  timeoutMs = 4000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFileP('git', args, { cwd, encoding: 'utf8', timeout: timeoutMs, windowsHide: true })
      .then((r) => resolve(r.stdout))
      .catch((error: unknown) => reject(error))
  })
}

/** True when `cwd` is inside a git working tree. */
export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
    return true
  } catch {
    return false
  }
}

/**
 * Compute a GitFileState for one relative path.
 * `dirty`/`staged` are derived from `git status --porcelain`; `tracked` from
 * `git ls-files`. All read-only.
 */
export async function gitFileState(cwd: string, relPath: string): Promise<GitFileState | null> {
  let inRepo: boolean
  try {
    inRepo = await isGitRepo(cwd)
  } catch {
    inRepo = false
  }
  if (!inRepo) return null
  let status = ''
  try {
    status = await runGit(cwd, ['status', '--porcelain', '-z', '--', relPath])
  } catch {
    status = ''
  }
  let tracked = false
  try {
    const out = await runGit(cwd, ['ls-files', '-z', '--', relPath])
    tracked = out.length > 0
  } catch {
    tracked = false
  }
  let dirty = false
  let staged = false
  for (const line of status.split('\0')) {
    if (line.length < 3) continue
    const code = line.slice(0, 2)
    if (code.includes('?') || code.includes('!')) {
      // untracked or ignored
    } else if (code[0] !== ' ' && code[0] !== '?') {
      staged = true
    }
    if (code[1] !== ' ' && code[1] !== '?') {
      dirty = true
    }
  }
  return { inRepo: true, tracked, staged, dirty }
}

/** Read a single git blob for a tracked file at HEAD (read-only). */
export async function gitBlobHead(cwd: string, relPath: string): Promise<Buffer | null> {
  try {
    const { stdout } = await execFileP('git', ['show', `HEAD:${relPath}`], {
      cwd,
      encoding: 'buffer',
      timeout: 4000,
      windowsHide: true,
    } as never)
    return Buffer.from(stdout)
  } catch {
    return null
  }
}
