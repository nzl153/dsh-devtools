import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, filterPaths, mergeConfig, parseConfigYml, shouldTrack } from '../../src/core/filter.ts'

const cfg = DEFAULT_CONFIG

describe('filter exclude noise', () => {
  it('excludes node_modules and .git', () => {
    expect(shouldTrack('node_modules/foo/index.js', cfg)).toBe(false)
    expect(shouldTrack('.git/config', cfg)).toBe(false)
    expect(shouldTrack('src/app.ts', cfg)).toBe(true)
  })

  it('excludes build fragments (temp/cache only)', () => {
    // Build output dirs like dist/out/build can hold real deliverables, so they
    // are tracked; only temp/cache/map fragments are filtered.
    expect(shouldTrack('out/report.html', cfg)).toBe(true)
    expect(shouldTrack('dist/bundle.js', cfg)).toBe(true)
    expect(shouldTrack('build/app.zip', cfg)).toBe(true)
    expect(shouldTrack('out/report.tsbuildinfo', cfg)).toBe(false)
    expect(shouldTrack('coverage/lcov.info', cfg)).toBe(false)
    expect(shouldTrack('notes.tmp', cfg)).toBe(false)
    expect(shouldTrack('src/x.d.ts.map', cfg)).toBe(false)
    expect(shouldTrack('src/x.d.ts', { ...cfg, avoid: [...cfg.avoid, '**/*.d.ts'] })).toBe(false)
  })

  it('keeps ordinary deliverables', () => {
    expect(shouldTrack('docs/report.md', cfg)).toBe(true)
    expect(shouldTrack('assets/hero.png', cfg)).toBe(true)
    expect(shouldTrack('data/out.json', cfg)).toBe(true)
    expect(shouldTrack('build.sh', cfg)).toBe(true)
  })
})

describe('include/exclude rules', () => {
  it('exclude wins', () => {
    const c = { ...cfg, exclude: ['**/secret/**'] }
    expect(shouldTrack('secret/key.txt', c)).toBe(false)
    expect(shouldTrack('pub/key.txt', c)).toBe(true)
  })

  it('include whitelist', () => {
    const c = { ...cfg, include: ['out/**', 'assets/*.png'] }
    expect(shouldTrack('out/report.html', c)).toBe(true)
    expect(shouldTrack('assets/hero.png', c)).toBe(true)
    expect(shouldTrack('src/main.ts', c)).toBe(false)
  })

  it('filterPaths applies batch', () => {
    const c = { ...cfg, exclude: ['**/*.log'] }
    const kept = filterPaths(['a.log', 'b.md', 'c.json'], c)
    expect(kept).toEqual(['b.md', 'c.json'])
  })
})

describe('config parsing', () => {
  it('parses scalar and list yml', () => {
    const parsed = parseConfigYml(`
# comment
enabled: true
trackVersions: true
maxFiles: 100
include: [out/**, assets/**]
exclude: ['**/secret/**']
ignoreDirs: [node_modules, .git, dist]
avoid: ['**/*.map']
`)
    expect(parsed).not.toBeNull()
    expect(parsed!.enabled).toBe(true)
    expect(parsed!.trackVersions).toBe(true)
    expect(parsed!.maxFiles).toBe(100)
    expect(parsed!.include).toEqual(['out/**', 'assets/**'])
    expect(parsed!.exclude).toEqual(['**/secret/**'])
    expect(parsed!.ignoreDirs).toEqual(['node_modules', '.git', 'dist'])
    expect(parsed!.avoid).toEqual(['**/*.map'])
  })

  it('merges over defaults', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, parseConfigYml('maxFiles: 42\ntrackVersions: false'))
    expect(merged.maxFiles).toBe(42)
    expect(merged.trackVersions).toBe(false)
    expect(merged.enabled).toBe(true)
  })

  it('returns null-ish on empty', () => {
    const parsed = parseConfigYml('')
    expect(parsed).toEqual({})
  })
})
