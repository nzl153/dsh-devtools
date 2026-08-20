import type { ReactNode } from 'react'
import { Button, IconCloseOutline16, StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import { setToolkitOpenId } from './registry.ts'

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

export function ToolkitPanel({
  title,
  icon,
  status,
  onClose,
  summary,
  children,
  footer,
  className,
}: ToolkitPanelProps) {
  const panel = (
    <div className={`dsh-tk dsh-tk-panel${className ? ` ${className}` : ''}`} role="dialog" aria-label={title}>
      <div className="dsh-tk-panel-header">
        {icon ? <span className="dsh-tk-panel-header-icon">{icon}</span> : null}
        <span className="dsh-tk-panel-header-title">{title}</span>
        {status ? <span className="dsh-tk-panel-header-status">{status}</span> : null}
        <span className="dsh-tk-panel-header-actions">
          <Button variant="ghost" size="sm" icon={<IconCloseOutline16 />} onClick={onClose} aria-label="Close" />
        </span>
      </div>
      {summary ? <div className="dsh-tk-panel-summary">{summary}</div> : null}
      {children ? <div className="dsh-tk-panel-content">{children}</div> : null}
      {footer ? <div className="dsh-tk-panel-footer">{footer}</div> : null}
    </div>
  )
  // Render in place, not via portal: DSH composes multiple React roots/slot
  // containers, and portaled trees can miss the root's delegated event
  // listeners — which made panel close buttons dead. `.dsh-tk-panel` uses
  // `position: fixed`, so staying in the header action tree still overlays.
  return panel
}

export function Metric({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="dsh-tk-metric">
      <span className="dsh-tk-metric-value">{value}</span>
      <span className="dsh-tk-metric-label">{label}</span>
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="dsh-tk-section-title">{children}</span>
}

export function StatusRow({
  label,
  value,
  state,
}: {
  label: ReactNode
  value: ReactNode
  state?: StateDotState
}) {
  return (
    <div className="dsh-tk-status-row">
      {state ? <StateDot state={state} /> : null}
      <span className="dsh-tk-status-label">{label}</span>
      <span className="dsh-tk-status-value">{value}</span>
    </div>
  )
}

export function FileRow({
  path,
  meta,
  state,
  onClick,
}: {
  path: string
  meta?: ReactNode
  state?: StateDotState
  onClick?: () => void
}) {
  const content = (
    <>
      {state ? <StateDot state={state} /> : null}
      <span className="dsh-tk-file-path">{path}</span>
      {meta ? <span className="dsh-tk-file-meta">{meta}</span> : null}
    </>
  )
  if (onClick) {
    return (
      <button type="button" className="dsh-tk-file-row" onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className="dsh-tk-file-row">{content}</div>
}

export function ToolkitEntryRow({
  title,
  subtitle,
  icon,
  metric,
  state,
  onClick,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  metric?: ReactNode
  state?: StateDotState
  onClick?: () => void
}) {
  return (
    <button type="button" className="dsh-tk-entry" onClick={onClick}>
      {icon ? <span className="dsh-tk-entry-icon">{icon}</span> : null}
      <span className="dsh-tk-entry-body">
        <span className="dsh-tk-entry-title">{title}</span>
        {subtitle ? <span className="dsh-tk-entry-subtitle">{subtitle}</span> : null}
      </span>
      {state ? <StateDot state={state} /> : null}
      {metric ? <span className="dsh-tk-entry-metric">{metric}</span> : null}
    </button>
  )
}

export function ToolkitQuickAction({
  title,
  icon,
  metric,
  state,
  onClick,
}: {
  title: ReactNode
  icon?: ReactNode
  metric?: ReactNode
  state?: StateDotState
  onClick?: () => void
}) {
  return (
    <button type="button" className="dsh-tk-toolbar-item" onClick={onClick} title={typeof title === 'string' ? title : undefined}>
      {icon ? <span className="dsh-tk-toolbar-icon">{icon}</span> : null}
      <span className="dsh-tk-toolbar-label">{title}</span>
      {state ? <StateDot state={state} size={8} /> : null}
      {metric ? <span className="dsh-tk-toolbar-metric">{metric}</span> : null}
    </button>
  )
}

export function openToolkitPanel(id: string): void {
  setToolkitOpenId(id)
}
