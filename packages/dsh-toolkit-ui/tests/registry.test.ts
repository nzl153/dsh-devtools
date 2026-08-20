/**
 * 共用外壳的全局注册表。所有插件面板的挂载、开关、排序都走这里，
 * 它错一点，所有插件一起错——所以这层要有单测。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getToolkitEntries,
  getToolkitEntriesByCategory,
  getToolkitOpenId,
  isToolkitShellReady,
  registerToolkitEntry,
  setToolkitOpenId,
  setToolkitShellReady,
  subscribeToolkit,
} from '../src/shared/registry.ts'
import type { ToolkitCategory, ToolkitEntry } from '../src/shared/types.ts'

const noop = (): null => null

function entry(id: string, category: ToolkitCategory, order: number): ToolkitEntry {
  return {
    id,
    category,
    order,
    title: id,
    renderRow: noop,
    renderQuick: noop,
    renderPanel: noop,
  }
}

// 状态挂在 globalThis 上，用例之间必须清干净，否则互相污染
beforeEach(() => {
  delete (globalThis as Record<string, unknown>)['__DSH_TOOLKIT__']
})

describe('注册与注销', () => {
  it('注册后能取到', () => {
    registerToolkitEntry(entry('a', 'observe', 1))
    expect(getToolkitEntries().map((e) => e.id)).toEqual(['a'])
  })

  it('返回的函数能注销', () => {
    const off = registerToolkitEntry(entry('a', 'observe', 1))
    off()
    expect(getToolkitEntries()).toHaveLength(0)
  })

  it('同 id 重复注册是覆盖，不是叠加', () => {
    registerToolkitEntry(entry('a', 'observe', 1))
    registerToolkitEntry({ ...entry('a', 'observe', 1), title: '新的' })
    const all = getToolkitEntries()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('新的')
  })

  it('被覆盖后，旧的注销函数不会误删新条目', () => {
    const offOld = registerToolkitEntry(entry('a', 'observe', 1))
    registerToolkitEntry({ ...entry('a', 'observe', 1), title: '新的' })
    offOld()                                   // 热重载时真实会发生
    expect(getToolkitEntries().map((e) => e.title)).toEqual(['新的'])
  })
})

describe('排序', () => {
  it('先按分类字母序，再按 order', () => {
    registerToolkitEntry(entry('w2', 'workspace', 2))
    registerToolkitEntry(entry('o2', 'observe', 2))
    registerToolkitEntry(entry('e1', 'experiment', 1))
    registerToolkitEntry(entry('o1', 'observe', 1))
    expect(getToolkitEntries().map((e) => e.id)).toEqual(['e1', 'o1', 'o2', 'w2'])
  })

  it('按分类筛选保持顺序', () => {
    registerToolkitEntry(entry('o2', 'observe', 2))
    registerToolkitEntry(entry('o1', 'observe', 1))
    registerToolkitEntry(entry('w1', 'workspace', 1))
    expect(getToolkitEntriesByCategory('observe').map((e) => e.id)).toEqual(['o1', 'o2'])
  })
})

describe('面板开关', () => {
  it('初始没有打开的面板', () => {
    expect(getToolkitOpenId()).toBeNull()
  })

  it('开了能关——就是当初点不掉的那个操作', () => {
    setToolkitOpenId('a')
    expect(getToolkitOpenId()).toBe('a')
    setToolkitOpenId(null)
    expect(getToolkitOpenId()).toBeNull()
  })

  it('外壳就绪标记可读可写', () => {
    expect(isToolkitShellReady()).toBe(false)
    setToolkitShellReady(true)
    expect(isToolkitShellReady()).toBe(true)
  })
})

describe('订阅通知', () => {
  it('注册、注销、开关面板都会通知', () => {
    const fn = vi.fn()
    subscribeToolkit(fn)
    const off = registerToolkitEntry(entry('a', 'observe', 1))
    setToolkitOpenId('a')
    off()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('值没变就不通知——避免无谓重渲染', () => {
    setToolkitOpenId('a')
    setToolkitShellReady(true)
    const fn = vi.fn()
    subscribeToolkit(fn)
    setToolkitOpenId('a')
    setToolkitShellReady(true)
    expect(fn).not.toHaveBeenCalled()
  })

  it('退订后不再收到通知', () => {
    const fn = vi.fn()
    subscribeToolkit(fn)()
    registerToolkitEntry(entry('a', 'observe', 1))
    expect(fn).not.toHaveBeenCalled()
  })
})
