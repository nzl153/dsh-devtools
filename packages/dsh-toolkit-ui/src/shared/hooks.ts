import { useEffect, useState } from 'react'
import {
  getToolkitEntries,
  getToolkitOpenId,
  isToolkitShellReady,
  setToolkitOpenId,
  subscribeToolkit,
} from './registry.ts'
import type { ToolkitEntry } from './types.ts'

export function useToolkitEntries(): ToolkitEntry[] {
  const [entries, setEntries] = useState<ToolkitEntry[]>(() => getToolkitEntries())
  useEffect(() => subscribeToolkit(() => setEntries(getToolkitEntries())), [])
  return entries
}

export function useToolkitShellReady(): boolean {
  const [ready, setReady] = useState<boolean>(() => isToolkitShellReady())
  useEffect(() => subscribeToolkit(() => setReady(isToolkitShellReady())), [])
  return ready
}

export function useToolkitOpenId(): string | null {
  const [openId, setOpenId] = useState<string | null>(() => getToolkitOpenId())
  useEffect(() => subscribeToolkit(() => setOpenId(getToolkitOpenId())), [])
  return openId
}

export function useToolkitPanel(id: string): {
  open: boolean
  openPanel: () => void
  closePanel: () => void
} {
  const openId = useToolkitOpenId()
  return {
    open: openId === id,
    openPanel: () => setToolkitOpenId(id),
    closePanel: () => setToolkitOpenId(null),
  }
}
