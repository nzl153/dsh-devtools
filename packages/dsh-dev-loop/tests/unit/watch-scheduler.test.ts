import { describe, it, expect } from 'vitest'
import { WatchScheduler } from '../../src/core/watch-scheduler.ts'

describe('WatchScheduler', () => {
  it('空闲时 trigger 立即启动', () => {
    const s = new WatchScheduler()
    expect(s.trigger()).toBe(true)
    expect(s.running).toBe(true)
    expect(s.pending).toBe(false)
  })

  it('运行中 trigger 不重复启动，只标记 pending', () => {
    const s = new WatchScheduler()
    s.trigger()
    expect(s.trigger()).toBe(false)
    expect(s.trigger()).toBe(false)
    expect(s.pending).toBe(true)
    expect(s.running).toBe(true)
  })

  it('运行结束后按 queued-latest 再跑一次，不堆积', () => {
    const s = new WatchScheduler()
    s.trigger()
    // 两次变更只产生一个 pending
    s.trigger()
    s.trigger()
    expect(s.pending).toBe(true)

    // 第一次 finish → 有 pending，继续跑
    expect(s.finish()).toBe(true)
    expect(s.running).toBe(true)
    expect(s.pending).toBe(false)

    // 没有新变更，第二次 finish → idle
    expect(s.finish()).toBe(false)
    expect(s.running).toBe(false)
    expect(s.pending).toBe(false)
  })

  it('reset 清空状态', () => {
    const s = new WatchScheduler()
    s.trigger()
    s.trigger()
    s.reset()
    expect(s.running).toBe(false)
    expect(s.pending).toBe(false)
    expect(s.trigger()).toBe(true)
  })
})