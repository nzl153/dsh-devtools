import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, mkdir, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isGitRepo,
  detectIsolation,
  createIsolatedWorkspace,
  removeIsolatedWorkspace,
} from '../../src/workspace/isolation.ts'

const execFileAsync = promisify(execFile)
let repo: string
let workRoot: string

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'rl-git-'))
  workRoot = await mkdtemp(join(tmpdir(), 'rl-work-'))
  await execFileAsync('git', ['init', '-q', repo], { windowsHide: true })
  await execFileAsync('git', ['-C', repo, 'config', 'user.email', 'test@example.com'], { windowsHide: true })
  await execFileAsync('git', ['-C', repo, 'config', 'user.name', 'Test'], { windowsHide: true })
  await writeFile(join(repo, 'a.txt'), 'hello\n')
  await execFileAsync('git', ['-C', repo, 'add', '.'], { windowsHide: true })
  await execFileAsync('git', ['-C', repo, 'commit', '-q', '-m', 'init'], { windowsHide: true })
}, 30000)

afterAll(async () => {
  await rm(repo, { recursive: true, force: true })
  await rm(workRoot, { recursive: true, force: true })
})

describe('workspace isolation', () => {
  it('detects git repo and head commit', async () => {
    expect(await isGitRepo(repo)).toBe(true)
    const info = await detectIsolation(repo, false)
    expect(info.isGit).toBe(true)
    expect(info.headCommit).toBeTruthy()
  })

  it('creates a git worktree and applies overrides', async () => {
    const target = join(workRoot, 'wt')
    const res = await createIsolatedWorkspace(
      {
        baseline: repo,
        baselineIsGit: true,
        commit: 'HEAD',
        overrides: { 'a.txt': 'overridden\n' },
      },
      target,
    )
    expect(res.method).toBe('git-worktree')
    const content = await readFile(join(target, 'a.txt'), 'utf8')
    expect(content).toBe('overridden\n')
    // worktree entries list includes target
    const { stdout } = await execFileAsync('git', ['-C', repo, 'worktree', 'list'], { windowsHide: true })
    const normalized = target.replace(/\\/g, '/')
    expect(stdout.replace(/\\/g, '/')).toContain(normalized)
    await removeIsolatedWorkspace(target, 'git-worktree', repo)
  })

  it('fallback to copy for non-git dir', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'rl-plain-'))
    await writeFile(join(plain, 'x.txt'), 'data')
    await mkdir(join(plain, 'node_modules'))
    await writeFile(join(plain, 'node_modules', 'big.bin'), 'skipped')
    const target = join(workRoot, 'copy')
    const res = await createIsolatedWorkspace(
      { baseline: plain, baselineIsGit: false, overrides: { 'y.txt': 'new' } },
      target,
    )
    expect(res.method).toBe('copy')
    expect(await readFile(join(target, 'x.txt'), 'utf8')).toBe('data')
    expect(await readFile(join(target, 'y.txt'), 'utf8')).toBe('new')
    // node_modules not copied
    const entries = await readdir(target)
    expect(entries).not.toContain('node_modules')
    await removeIsolatedWorkspace(target, 'copy')
    await rm(plain, { recursive: true, force: true })
  })
})
