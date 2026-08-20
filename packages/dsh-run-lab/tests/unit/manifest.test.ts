import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createExperiment, redactSecrets, saveManifest, loadManifest, listManifests } from '../../src/core/manifest.ts'
import type { CreateExperimentInput } from '../../src/core/types.ts'

function input(): CreateExperimentInput {
  return {
    title: 'test exp',
    prompt: 'fix the bug',
    baseline: 'C:/repo',
    repeat: 3,
    branches: [
      { id: 'a', label: 'A', agent: { driver: 'command', command: 'node agent.mjs $WORKSPACE' }, evaluator: { command: 'npm test' } },
      { id: 'b', label: 'B', evaluator: { command: 'npm test -- --partial' } },
    ],
  }
}

describe('manifest', () => {
  it('createExperiment builds id/status/version/repeat/agent', () => {
    const exp = createExperiment(input(), new Date('2026-01-01T00:00:00Z'))
    expect(exp.status).toBe('draft')
    expect(exp.version).toBe('0.8')
    expect(exp.repeat).toBe(3)
    expect(exp.branches).toHaveLength(2)
    expect(exp.branches[0].agent?.command).toContain('$WORKSPACE')
    expect(exp.branches[0].agent?.usesWorkspace).toBe(true)
    expect(exp.branches[0].agentCommand).toBe('node agent.mjs $WORKSPACE')
    expect(exp.prompt).toBe('fix the bug')
  })

  it('redactSecrets strips token/secret keys recursively', () => {
    const v = { apiKey: 'SECRET', token: 'x', nested: { password: 'y', ok: 1 }, arr: [{ secret: 'z' }] }
    const safe = redactSecrets(v) as Record<string, unknown>
    expect('apiKey' in safe).toBe(false)
    expect('token' in safe).toBe(false)
    expect((safe['nested'] as Record<string, unknown>)['password']).toBeUndefined()
    expect((safe['nested'] as Record<string, unknown>)['ok']).toBe(1)
    expect(Array.isArray(safe['arr'])).toBe(true)
  })

  it('save/load roundtrip through temp HOME', async () => {
    const home = await mkdtemp(join(tmpdir(), 'rl-manifest-'))
    const exp = createExperiment(input())
    await saveManifest(home, exp)
    const loaded = await loadManifest(home, exp.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe(exp.id)
    expect(loaded!.version).toBe('0.8')
    expect(loaded!.repeat).toBe(3)
    expect(loaded!.branches[0].agent?.command).toBe('node agent.mjs $WORKSPACE')
    expect(loaded!.branches[0].evaluator!.command).toBe('npm test')
    const list = await listManifests(home)
    expect(list.map((e) => e.id)).toContain(exp.id)
  })

  it('listManifests ignores non-json files', async () => {
    const home = await mkdtemp(join(tmpdir(), 'rl-manifest2-'))
    const exp = createExperiment(input())
    await saveManifest(home, exp)
    await writeFile(join(home, '.dsh', 'run-lab', 'manifests', 'junk.txt'), 'x')
    const list = await listManifests(home)
    expect(list.every((e) => e.id !== 'junk')).toBe(true)
  })

  it('does not persist secrets present in branch config', async () => {
    const home = await mkdtemp(join(tmpdir(), 'rl-manifest3-'))
    const exp = createExperiment(input())
    ;(exp as any).branches[0].evaluator.apiToken = 'hunter2'
    await saveManifest(home, exp)
    const raw = await readFile(join(home, '.dsh', 'run-lab', 'manifests', `${exp.id}.json`), 'utf8')
    expect(raw).not.toContain('hunter2')
    expect(raw).not.toContain('apiToken')
  })
})
