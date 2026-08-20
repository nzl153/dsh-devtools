import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileWatcher, type WatcherBackend, type WatcherEvent } from '../../src/core/watcher.ts'
import type { EngineConfig } from '../../src/core/types.ts'

const WS = '/ws'
const CONFIG: EngineConfig = {
  largeFileThresholdBytes: 1024 * 1024,
  ignoreDirs: ['node_modules', 'dist'],
  ignoreFiles: ['.env'],
  maxScannedFiles: 100,
}

class FakeBackend implements WatcherBackend {
  emit: ((event: WatcherEvent) => void) | null = null

  async start(_root: string, emit: (event: WatcherEvent) => void): Promise<() => void> {
    this.emit = emit
    return () => { this.emit = null }
  }
}

describe('FileWatcher (pure logic, injectable backend)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces and merges a burst into one flush', async () => {
    const backend = new FakeBackend()
    const flushes: Array<readonly WatcherEvent[]> = []
    const w = new FileWatcher({ config: CONFIG, debounceMs: 50 }, (events) => {
      flushes.push(events)
    })
    await w.start(backend, WS)
    backend.emit?.({ absPath: '/ws/a.ts' })
    backend.emit?.({ absPath: '/ws/b.ts' })
    backend.emit?.({ absPath: '/ws/a.ts' })
    vi.advanceTimersByTime(60)
    expect(flushes).toHaveLength(1)
    expect(flushes[0].map((e) => e.absPath).sort()).toEqual(['/ws/a.ts', '/ws/b.ts'])
  })

  it('ignores configured directories and files', async () => {
    const backend = new FakeBackend()
    const flushes: Array<readonly WatcherEvent[]> = []
    const w = new FileWatcher({ config: CONFIG, debounceMs: 50 }, (events) => {
      flushes.push(events)
    })
    await w.start(backend, WS)
    backend.emit?.({ absPath: '/ws/node_modules/pkg/index.js' })
    backend.emit?.({ absPath: '/ws/dist/out.js' })
    backend.emit?.({ absPath: '/ws/.env' })
    backend.emit?.({ absPath: '/ws/src/keep.ts' })
    vi.advanceTimersByTime(60)
    expect(flushes).toHaveLength(1)
    expect(flushes[0].map((e) => e.absPath)).toEqual(['/ws/src/keep.ts'])
  })

  it('flushNow returns pending events immediately and clears them', async () => {
    const backend = new FakeBackend()
    const flushes: Array<readonly WatcherEvent[]> = []
    const w = new FileWatcher({ config: CONFIG, debounceMs: 1000 }, (events) => {
      flushes.push(events)
    })
    await w.start(backend, WS)
    backend.emit?.({ absPath: '/ws/a.ts' })
    await w.flushNow()
    expect(flushes).toHaveLength(1)
    await w.flushNow()
    expect(flushes).toHaveLength(1)
  })

  it('does not flush after dispose', async () => {
    const backend = new FakeBackend()
    const flushes: Array<readonly WatcherEvent[]> = []
    const w = new FileWatcher({ config: CONFIG, debounceMs: 50 }, (events) => {
      flushes.push(events)
    })
    const dispose = await w.start(backend, WS)
    dispose()
    backend.emit?.({ absPath: '/ws/a.ts' })
    vi.advanceTimersByTime(100)
    expect(flushes).toHaveLength(0)
  })
})