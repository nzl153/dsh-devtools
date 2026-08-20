import type { ReactNode } from 'react'
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'

export type ToolkitCategory = 'observe' | 'workspace' | 'experiment'

export interface ToolkitPanelContext {
  useWorkspaces: (selector: (state: unknown) => unknown) => unknown
  inputActions?: {
    setDraft: (draft: string) => void
  }
}

export interface ToolkitEntry {
  id: string
  category: ToolkitCategory
  order: number
  title: string
  subtitle?: string
  metric?: string
  state?: StateDotState
  icon?: ReactNode
  quick?: boolean
  getMetric?: (sessionId: string) => string | undefined
  getState?: (sessionId: string) => StateDotState | undefined
  renderRow: (sessionId: string) => ReactNode
  renderQuick: (sessionId: string) => ReactNode
  renderPanel: (sessionId: string, onClose: () => void, context: ToolkitPanelContext) => ReactNode
}

export const TOOLKIT_CATEGORY_LABEL: Record<ToolkitCategory, string>

export function registerToolkitEntry(entry: ToolkitEntry): () => void
export function getToolkitEntries(): ToolkitEntry[]
export function getToolkitEntriesByCategory(category: ToolkitCategory): ToolkitEntry[]
export function setToolkitShellReady(ready: boolean): void
export function isToolkitShellReady(): boolean
export function getToolkitOpenId(): string | null
export function setToolkitOpenId(id: string | null): void
export function subscribeToolkit(fn: () => void): () => void

export function useToolkitEntries(): ToolkitEntry[]
export function useToolkitShellReady(): boolean
export function useToolkitOpenId(): string | null
export function useToolkitPanel(id: string): {
  open: boolean
  openPanel: () => void
  closePanel: () => void
}

export interface ToolkitPanelProps {
  title: string
  icon?: ReactNode
  status?: ReactNode
  onClose: () => void
  summary?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}
export function ToolkitPanel(props: ToolkitPanelProps): React.ReactPortal | null
export function Metric(props: { value: ReactNode; label: ReactNode }): React.JSX.Element
export function SectionLabel(props: { children: ReactNode }): React.JSX.Element
export function StatusRow(props: {
  label: ReactNode
  value: ReactNode
  state?: StateDotState
}): React.JSX.Element
export function FileRow(props: {
  path: string
  meta?: ReactNode
  state?: StateDotState
  onClick?: () => void
}): React.JSX.Element
export function ToolkitEntryRow(props: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  metric?: ReactNode
  state?: StateDotState
  onClick?: () => void
}): React.JSX.Element
export function ToolkitQuickAction(props: {
  title: ReactNode
  icon?: ReactNode
  metric?: ReactNode
  state?: StateDotState
  onClick?: () => void
}): React.JSX.Element
export function openToolkitPanel(id: string): void
export function adoptToolkitStyles(): void
