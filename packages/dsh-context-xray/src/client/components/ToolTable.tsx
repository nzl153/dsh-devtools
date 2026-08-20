import { useMemo, useState } from 'react'
import type { ContextSnapshot, ToolMetric } from '../../core/types.ts'
import { formatTokens } from '../../core/turn-diff/diff.ts'
import type { XrayKey } from '../locales.ts'

export function ToolTable({
  snapshot,
  t,
}: {
  snapshot: ContextSnapshot
  t: (key: XrayKey) => string
}) {
  const [query, setQuery] = useState('')
  const [onlyCalled, setOnlyCalled] = useState(false)
  const [onlyUnused, setOnlyUnused] = useState(false)
  const [sorted, setSorted] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const tools = useMemo(() => {
    let list = [...snapshot.tools]
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((tool) => tool.name.toLowerCase().includes(q))
    }
    if (onlyCalled) list = list.filter((tool) => tool.calledThisTurn || tool.calledEver)
    if (onlyUnused) list = list.filter((tool) => !tool.calledEver)
    if (sorted) list = list.sort((a, b) => b.tokens - a.tokens)
    return list
  }, [snapshot.tools, query, onlyCalled, onlyUnused, sorted])

  const sourceLabel = (source: ToolMetric['source']): string => {
    switch (source) {
      case 'builtin': return t('builtin')
      case 'mcp': return t('mcp')
      case 'plugin': return t('plugin')
      default: return t('unknown')
    }
  }

  const copyText = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.append(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
  }

  const toggleExpand = (name: string): void => {
    setExpanded((current) => current === name ? null : name)
  }

  const toolDiagnostic = (tool: ToolMetric): string => JSON.stringify({
    name: tool.name,
    tokens: tool.tokens,
    source: tool.source,
    calledThisTurn: tool.calledThisTurn,
    calledEver: tool.calledEver,
    callCount: tool.callCount,
    lastCalledAt: tool.lastCalledAt,
  }, null, 2)

  return (
    <div>
      <h3>{t('tools')} ({tools.length})</h3>
      <div className="xray-toolbar">
        <input
          type="search"
          placeholder="filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" onClick={() => setOnlyCalled((v) => !v)}>
          {onlyCalled ? '✓ ' : ''}{t('calledEver')}
        </button>
        <button type="button" onClick={() => setOnlyUnused((v) => !v)}>
          {onlyUnused ? '✓ ' : ''}{t('neverUsed')}
        </button>
        <button type="button" onClick={() => setSorted((v) => !v)}>
          {sorted ? '↓' : '↑'}
        </button>
      </div>
      <table className="xray-table">
        <thead>
          <tr>
            <th>{t('source')}</th>
            <th>name</th>
            <th>{t('tokens')}</th>
            <th>{t('calledThisTurn')}</th>
            <th>{t('callCount')}</th>
            <th>{t('lastCalledAt')}</th>
            <th>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <ToolRow
              key={tool.name}
              tool={tool}
              t={t}
              sourceLabel={sourceLabel}
              expanded={expanded === tool.name}
              onToggle={toggleExpand}
              onCopy={copyText}
              diagnostic={toolDiagnostic(tool)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ToolRow({
  tool,
  t,
  sourceLabel,
  expanded,
  onToggle,
  onCopy,
  diagnostic,
}: {
  tool: ToolMetric
  t: (key: XrayKey) => string
  sourceLabel: (source: ToolMetric['source']) => string
  expanded: boolean
  onToggle: (name: string) => void
  onCopy: (text: string) => void
  diagnostic: string
}) {
  return (
    <>
      <tr>
        <td>{sourceLabel(tool.source)}</td>
        <td>
          <button type="button" className="xray-tool-name" onClick={() => onToggle(tool.name)}>
            {tool.name}
          </button>
          <div className="xray-tool-actions">
            <button type="button" onClick={() => void onCopy(tool.name)}>{t('copyName')}</button>
            <button type="button" onClick={() => void onCopy(JSON.stringify(tool.schema))}>{t('copySchema')}</button>
            <button type="button" onClick={() => void onCopy(diagnostic)}>{t('copyDiagnostic')}</button>
          </div>
        </td>
        <td>{formatTokens(tool.tokens)}</td>
        <td>{tool.calledThisTurn ? '✓' : ''}</td>
        <td>{tool.callCount > 0 ? tool.callCount : '—'}</td>
        <td>{tool.lastCalledAt ? formatDate(tool.lastCalledAt) : '—'}</td>
        <td>
          <button type="button" onClick={() => onToggle(tool.name)}>
            {expanded ? '−' : '+'} {t('schema')}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="xray-schema-row">
          <td colSpan={7}>
            <pre>{JSON.stringify(tool.schema, null, 2)}</pre>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}