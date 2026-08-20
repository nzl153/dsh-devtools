import type { ToolkitEntry } from './types.ts'

const GLOBAL_KEY = '__DSH_TOOLKIT__'

interface ToolkitGlobalState {
  entries: Map<string, ToolkitEntry>
  shellReady: boolean
  openId: string | null
  listeners: Set<() => void>
}

type ToolkitWindow = Window & {
  [GLOBAL_KEY]?: ToolkitGlobalState
}

function ensureGlobal(): ToolkitGlobalState {
  const win = globalThis as unknown as ToolkitWindow
  if (!win[GLOBAL_KEY]) {
    win[GLOBAL_KEY] = {
      entries: new Map(),
      shellReady: false,
      openId: null,
      listeners: new Set(),
    }
  }
  return win[GLOBAL_KEY]!
}

function emit(state: ToolkitGlobalState): void {
  for (const fn of state.listeners) fn()
}

export function registerToolkitEntry(entry: ToolkitEntry): () => void {
  const state = ensureGlobal()
  state.entries.set(entry.id, entry)
  emit(state)
  return () => {
    if (state.entries.get(entry.id) === entry) {
      state.entries.delete(entry.id)
      emit(state)
    }
  }
}

export function getToolkitEntries(): ToolkitEntry[] {
  const state = ensureGlobal()
  return [...state.entries.values()].sort((a, b) => {
    const cat = a.category.localeCompare(b.category)
    if (cat !== 0) return cat
    return a.order - b.order
  })
}

export function getToolkitEntriesByCategory(category: ToolkitEntry['category']): ToolkitEntry[] {
  return getToolkitEntries().filter((entry) => entry.category === category)
}

export function setToolkitShellReady(ready: boolean): void {
  const state = ensureGlobal()
  if (state.shellReady === ready) return
  state.shellReady = ready
  emit(state)
}

export function isToolkitShellReady(): boolean {
  return ensureGlobal().shellReady
}

export function getToolkitOpenId(): string | null {
  return ensureGlobal().openId
}

export function setToolkitOpenId(id: string | null): void {
  const state = ensureGlobal()
  if (state.openId === id) return
  state.openId = id
  emit(state)
}

export function subscribeToolkit(fn: () => void): () => void {
  const state = ensureGlobal()
  state.listeners.add(fn)
  return () => {
    state.listeners.delete(fn)
  }
}
