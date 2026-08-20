/** Shared presentational helpers for dsh-debrief UI cards. */
import type { ReactNode } from 'react'
import type { CommandRecord, FileChange, TestRunResult, ToolStat } from '../../core/types.ts'
import { formatDuration, formatTokens } from '../../core/format.ts'
import { summarizeDebrief } from '../../core/actions.ts'
export { summarizeDebrief }

export function MetricRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="dsh-debrief-metric">
      <span className="dsh-debrief-metric-label">{label}</span>
      <span className="dsh-debrief-metric-value">{value}</span>
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="dsh-debrief-section-title">{children}</div>
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="dsh-debrief-empty">{children}</div>
}

/** Render changed files with a simple list. */
export function ChangedFilesList({ files, limit }: { files: readonly FileChange[]; limit?: number }) {
  const shown = limit !== undefined ? files.slice(0, limit) : files
  if (shown.length === 0) {
    return <EmptyNote>—</EmptyNote>
  }
  return (
    <ul className="dsh-debrief-list">
      {shown.map((file) => (
        <li key={file.path} className="dsh-debrief-list-item">
          <span className={`dsh-debrief-tag dsh-debrief-tag-${file.structured ? 'exact' : 'est'}`}>
            {file.kind}
          </span>
          <code>{file.path}</code>
        </li>
      ))}
    </ul>
  )
}

export function CommandList({ commands, limit }: { commands: readonly CommandRecord[]; limit?: number }) {
  const shown = limit !== undefined ? commands.slice(0, limit) : commands
  if (shown.length === 0) return <EmptyNote>—</EmptyNote>
  return (
    <ul className="dsh-debrief-list">
      {shown.map((cmd) => (
        <li key={cmd.callId} className="dsh-debrief-list-item">
          <span className={`dsh-debrief-exit dsh-debrief-exit-${cmd.exitCode === 0 ? 'ok' : 'bad'}`}>
            {cmd.exitCode === null ? '?' : `exit ${cmd.exitCode}`}
          </span>
          <code>{cmd.command}</code>
        </li>
      ))}
    </ul>
  )
}

export function ToolTable({ stats }: { stats: readonly ToolStat[] }) {
  if (stats.length === 0) return <EmptyNote>—</EmptyNote>
  return (
    <table className="dsh-debrief-table">
      <thead>
        <tr>
          <th>tool</th>
          <th>calls</th>
          <th>err</th>
          <th>total</th>
          <th>slowest</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((stat) => (
          <tr key={stat.name}>
            <td><code>{stat.name}</code></td>
            <td>{stat.callCount}</td>
            <td>{stat.errorCount}</td>
            <td>{formatDuration(stat.totalDurationMs)}</td>
            <td>{stat.slowestCallMs === null ? '—' : formatDuration(stat.slowestCallMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function UnresolvedList({ items, limit }: {
  items: readonly { label: string; detail: string }[]
  limit?: number
}) {
  const shown = limit !== undefined ? items.slice(0, limit) : items
  if (shown.length === 0) return <EmptyNote>—</EmptyNote>
  return (
    <ul className="dsh-debrief-list">
      {shown.map((item, index) => (
        <li key={`${item.label}-${index}`} className="dsh-debrief-list-item dsh-debrief-unresolved">
          <code>{item.detail}</code>
        </li>
      ))}
    </ul>
  )
}

export function TestSummary({ tests }: { tests: readonly TestRunResult[] }) {
  if (tests.length === 0) return <EmptyNote>—</EmptyNote>
  const passed = tests.filter((t) => t.status === 'passed').length
  const failed = tests.filter((t) => t.status === 'failed').length
  const unknown = tests.filter((t) => t.status === 'unknown').length
  const parts: string[] = []
  if (passed > 0) parts.push(`✅ ${passed}`)
  if (failed > 0) parts.push(`❌ ${failed}`)
  if (unknown > 0) parts.push(`? ${unknown}`)
  return <span className="dsh-debrief-tests">{parts.join('  ')}</span>
}