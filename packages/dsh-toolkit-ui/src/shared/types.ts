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

export const TOOLKIT_CATEGORY_LABEL: Record<ToolkitCategory, string> = {
  observe: 'OBSERVE',
  workspace: 'WORKSPACE',
  experiment: 'EXPERIMENT',
}