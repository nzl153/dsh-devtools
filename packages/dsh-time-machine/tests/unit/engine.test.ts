import { describe, it, expect, beforeEach } from 'vitest'
import { TimeMachineEngine, type ToolEvent } from '../../src/core/engine.ts'
import { createSidecarStore } from '../../src/core/store.ts'
import { MemFs } from '../helpers/memFs.ts'
import type { GitFileState, SessionRecord } from '../../src/core/types.ts'

// Workspace keys are RELATIVE to '/' inside MemFs.
const WS = '/ws'
const SID = 'test-session'
const STORE_ROOT = '/store'

function ev(turn: number, toolName: string, callId: string): ToolEvent {
  return { turn, toolName, callId }
}

async function setup(seed: Record<string, string>, gitState: GitFileState | null = null) {
  const fs = new MemFs(seed)
  await fs.mkdirp('/ws')
  const store = await createSidecarStore(fs, STORE_ROOT)
  const gitProvider = async () => gitState
  const engine = new TimeMachineEngine(fs, store, undefined, gitProvider)
  return { fs, store, engine }
}

// Seed files are stored at /ws/<rel> (memfs root '/'), so seed keys include ws/.
function wsSeed(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [rel, content] of Object.entries(files)) out[`ws/${rel}`] = content
  return out
}

async function baseline(engine: TimeMachineEngine): Promise<SessionRecord> {
  return engine.establishBaseline(SID, WS)
}

// helper: pre + post a tool that writes a file
async function act(
  engine: TimeMachineEngine,
  fs: MemFs,
  turn: number,
  toolName: string,
  callId: string,
  mutate: () => void,
): Promise<SessionRecord> {
  const e = ev(turn, toolName, callId)
  await engine.recordPreTool(SID, WS, e)
  mutate()
  const { record } = await engine.recordPostTool(SID, WS, e)
  return record
}

describe('engine baseline + turn recording', () => {
  it('establishes baseline and records a new file', async () => {
    const { engine, fs } = await setup(wsSeed({ 'a.txt': 'hello\n' }))
    const rec = await baseline(engine)
    expect(rec.baseline.find((b) => b.relPath === 'a.txt')?.hash).toBeTruthy()
    expect(rec.baseline.find((b) => b.relPath === 'a.txt')?.existed).toBe(true)

    const after = await act(engine, fs, 1, 'write', 'c1', () => {
      fs.writeFile('/ws/b.txt', Buffer.from('new\n'))
    })
    const change = after.turns[0].changes.find((c) => c.relPath === 'b.txt')
    expect(change?.status).toBe('added')
    expect(change?.addedLines).toBe(1)
    expect(change?.source).toEqual({ turn: 1, toolName: 'write', callId: 'c1' })
  })

  it('records edit with +/- line counts and diff', async () => {
    const { engine, fs } = await setup(wsSeed({ 'a.txt': 'one\ntwo\nthree\n' }))
    await baseline(engine)
    const after = await act(engine, fs, 1, 'edit', 'c1', () => {
      fs.writeFile('/ws/a.txt', Buffer.from('one\ntwo! \nthree\n'))
    })
    const change = after.turns[0].changes.find((c) => c.relPath === 'a.txt')
    expect(change?.status).toBe('modified')
    expect(change?.removedLines).toBe(1)
    expect(change?.addedLines).toBe(1)
    expect(change?.diff).toMatch(/^--- a\/a\.txt/)
    expect(change?.diff).toContain('-two')
    expect(change?.diff).toContain('+two!')
  })

  it('records delete', async () => {
    const { engine, fs } = await setup(wsSeed({ 'a.txt': 'x\n' }))
    await baseline(engine)
    const after = await act(engine, fs, 1, 'rm', 'c1', () => {
      fs.unlink('/ws/a.txt')
    })
    const change = after.turns[0].changes.find((c) => c.relPath === 'a.txt')
    expect(change?.status).toBe('deleted')
    expect(change?.toHash).toBeNull()
  })

  it('records rename as renamed, not delete + add', async () => {
    const { engine, fs } = await setup(wsSeed({ 'a.txt': 'x\n' }))
    await baseline(engine)
    const after = await act(engine, fs, 1, 'mv', 'c1', () => {
      fs.rename('/ws/a.txt', '/ws/b.txt')
    })
    const changes = after.turns[0].changes
    expect(changes.length).toBe(1)
    expect(changes[0].status).toBe('renamed')
    expect(changes[0].oldPath).toBe('a.txt')
    expect(changes[0].relPath).toBe('b.txt')
  })

  it('detects same-size content-similar rename as renamed', async () => {
    const { engine, fs } = await setup(wsSeed({ 'old.ts': 'line1\nline2\n' }))
    await baseline(engine)
    const after = await act(engine, fs, 1, 'mv', 'c1', () => {
      fs.unlink('/ws/old.ts')
      fs.writeFile('/ws/new.ts', Buffer.from('line1\nline3\n'))
    })
    const changes = after.turns[0].changes
    expect(changes.some((c) => c.status === 'renamed' && c.oldPath === 'old.ts' && c.relPath === 'new.ts')).toBe(true)
  })

  it('attributes changes to turn and ends turn', async () => {
    const { engine, fs } = await setup(wsSeed({}))
    await baseline(engine)
    await act(engine, fs, 1, 'write', 'c1', () => fs.writeFile('/ws/x.txt', Buffer.from('a\n')))
    await act(engine, fs, 2, 'write', 'c2', () => fs.writeFile('/ws/y.txt', Buffer.from('b\n')))
    const rec = await engine.endTurn(SID)
    expect(rec?.turns.map((t) => t.turn)).toEqual([1, 2])
    expect(rec?.turns[0].endedAt).not.toBeNull()
  })
})

describe('safety: dirty-before-session and conflicts', () => {
  it('marks a pre-existing dirty file and refuses restore over it', async () => {
    const gitDirty: GitFileState = { inRepo: true, tracked: true, staged: false, dirty: true }
    const { engine, fs } = await setup(wsSeed({ 'dirty.txt': 'user-uncommitted\n' }), gitDirty)
    const rec = await baseline(engine)
    expect(rec.baseline.find((b) => b.relPath === 'dirty.txt')?.dirtyBeforeSession).toBe(true)

    // Agent also touches it.
    const after = await act(engine, fs, 1, 'edit', 'c1', () => {
      fs.writeFile('/ws/dirty.txt', Buffer.from('agent-changed\n'))
    })
    const previews = await engine.previewRestore(after, { kind: 'file', relPath: 'dirty.txt', to: 'baseline' })
    expect(previews[0].problem).toBe('dirty-before-session')
  })

  it('flags conflict when user edits after agent', async () => {
    const { engine, fs } = await setup(wsSeed({ 'a.txt': 'base\n' }))
    await baseline(engine)
    const after = await act(engine, fs, 1, 'edit', 'c1', () => {
      fs.writeFile('/ws/a.txt', Buffer.from('agent-edit\n'))
    })
    // User edits after the agent.
    fs.writeFile('/ws/a.txt', Buffer.from('user-edit-after\n'))
    const previews = await engine.previewRestore(after, { kind: 'file', relPath: 'a.txt', to: 'baseline' })
    expect(previews[0].problem).toBe('conflict')
  })

  it('preview can return EXPECTED / CURRENT / RESTORE TARGET contents', async () => {
    const { engine, fs } = await setup(wsSeed({ 'a.txt': 'base\n' }))
    await baseline(engine)
    const after = await act(engine, fs, 1, 'edit', 'c1', () => {
      fs.writeFile('/ws/a.txt', Buffer.from('agent-edit\n'))
    })
    fs.writeFile('/ws/a.txt', Buffer.from('user-edit-after\n'))
    const [preview] = await engine.previewRestore(after, { kind: 'file', relPath: 'a.txt', to: 'baseline' }, true)
    expect(preview.problem).toBe('conflict')
    expect(preview.contents?.expected).toBe('agent-edit\n')
    expect(preview.contents?.current).toBe('user-edit-after\n')
    expect(preview.contents?.target).toBe('base\n')
  })

  it('force commit can overwrite a conflict when explicitly enabled', async () => {
    const { engine, fs } = await setup(wsSeed({ 'a.txt': 'base\n' }))
    await baseline(engine)
    const after = await act(engine, fs, 1, 'edit', 'c1', () => {
      fs.writeFile('/ws/a.txt', Buffer.from('agent-edit\n'))
    })
    fs.writeFile('/ws/a.txt', Buffer.from('user-edit-after\n'))
    const previews = await engine.previewRestore(after, { kind: 'file', relPath: 'a.txt', to: 'baseline' })
    expect(previews[0].problem).toBe('conflict')
    const result = await engine.commitRestore(after, previews, true)
    expect(result.performed).toBe(1)
    expect(await fs.readText('/ws/a.txt')).toBe('base\n')
  })

  it('resurrects a baseline file the agent deleted (restore = write, not delete)', async () => {
    const { engine, fs } = await setup(wsSeed({ 'a.txt': 'base\n' }))
    await baseline(engine)
    const after = await act(engine, fs, 1, 'rm', 'c1', () => {
      fs.unlink('/ws/a.txt')
    })
    const previews = await engine.previewRestore(after, { kind: 'baseline' })
    const a = previews.find((p) => p.relPath === 'a.txt')
    expect(a?.action).toBe('write')
    expect(a?.problem).toBe('ok')
  })
})

describe('binary and non-git', () => {
  it('treats binary as change without text diff', async () => {
    const { engine, fs } = await setup(wsSeed({ 'img.bin': 'AAAA' }))
    await baseline(engine)
    const after = await act(engine, fs, 1, 'write', 'c1', () => {
      fs.writeFile('/ws/img.bin', Buffer.from([0x00, 0x01, 0x02]))
    })
    const change = after.turns[0].changes.find((c) => c.relPath === 'img.bin')
    expect(change?.kind).toBe('binary')
    expect(change?.diff).toBeNull()
    expect(change?.status).toBe('modified')
  })

  it('works without a git repository (non-git)', async () => {
    const { engine, fs } = await setup(wsSeed({ 'a.txt': 'x\n' }))
    // git state provider returns null (non-repo)
    await baseline(engine)
    const after = await act(engine, fs, 1, 'write', 'c1', () => {
      fs.writeFile('/ws/b.txt', Buffer.from('y\n'))
    })
    expect(after.baseline[0].git).toBeNull()
    expect(after.turns[0].changes.some((c) => c.relPath === 'b.txt')).toBe(true)
  })
})

describe('aborted turn', () => {
  it('does not record changes from an aborted turn (pre ran but post skipped)', async () => {
    const { engine, fs } = await setup(wsSeed({}))
    await baseline(engine)
    // Pre-scan runs (captures state) then the turn is aborted before any write.
    await engine.recordPreTool(SID, WS, ev(1, 'write', 'c1'))
    // No post-scan: nothing changed, no turn recorded.
    const rec = await engine.readSession(SID)
    expect(rec?.turns.length).toBe(0)
  })
})
