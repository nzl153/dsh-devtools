import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, IconRefreshOutline16, IconSearchOutline16, IconTrashOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { Metric, ToolkitPanel } from 'dsh-toolkit-ui/shared'
import type {
  Excerpt,
  IndexStatus,
  SearchResponse,
  SearchFilters,
  SearchHit,
  SessionResult,
  SourceKind,
} from '../core/types.ts'
import type { ArchKey } from './locales.ts'
import { archApi } from './api.ts'

const QUICK_QUERIES: { key: ArchKey; query: string }[] = [
  { key: 'quickErrors', query: 'error failed' },
  { key: 'quickFiles', query: '.ts .tsx .json' },
  { key: 'quickCommands', query: 'pnpm npm git' },
  { key: 'quickPrompts', query: '怎么做 实现 修复' },
]

type Scope = 'all' | 'workspace' | 'project'
type SourceToggleKey = 'user' | 'assistant' | 'error' | 'command' | 'file'

export function SearchPanel({
  t,
  onClose,
  currentSessionId,
  currentWorkspace,
  sendFollowUp,
}: {
  t: (key: ArchKey) => string
  onClose: () => void
  currentSessionId?: () => string | undefined
  currentWorkspace?: () => string | undefined
  sendFollowUp?: (text: string, mode: 'queue' | 'steer') => Promise<string | null>
}) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<SearchFilters>({})
  const [status, setStatus] = useState<IndexStatus | null>(null)
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<string | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [selected, setSelected] = useState<Record<string, number[]>>({})
  const [excerpt, setExcerpt] = useState<Excerpt | null>(null)
  const [excerptLoading, setExcerptLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceToggles, setSourceToggles] = useState<Record<SourceToggleKey, boolean>>({
    user: false,
    assistant: false,
    error: false,
    command: false,
    file: false,
  })
  const abortRef = useRef<AbortController | null>(null)

  const loadStatus = useCallback(async () => {
    const res = await archApi.status()
    if (res.ok) setStatus(res.value)
  }, [])

  useEffect(() => {
    void loadStatus()
    const stored = localStorage.getItem('archaeologist-search-history')
    if (stored) {
      try {
        setHistory(JSON.parse(stored) as string[])
      } catch {
        /* ignore */
      }
    }
  }, [loadStatus])

  const pushHistory = useCallback((q: string) => {
    const next = [q, ...history.filter((h) => h !== q)].slice(0, 8)
    setHistory(next)
    try {
      localStorage.setItem('archaeologist-search-history', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [history])

  const buildFilters = useCallback((): SearchFilters => {
    const sources: SourceKind[] = []
    if (sourceToggles.user) sources.push('user')
    if (sourceToggles.assistant) sources.push('assistant', 'reasoning')
    if (sourceToggles.error) sources.push('error')
    if (sourceToggles.command) sources.push('command')
    if (sourceToggles.file) sources.push('file')
    let after: number | undefined
    let before: number | undefined
    if (dateFrom) {
      const d = new Date(`${dateFrom}T00:00:00`)
      if (!Number.isNaN(d.getTime())) after = d.getTime()
    }
    if (dateTo) {
      const d = new Date(`${dateTo}T23:59:59.999`)
      if (!Number.isNaN(d.getTime())) before = d.getTime() + 1
    }
    const workspace = currentWorkspace?.()
    return {
      ...(scope === 'workspace' && workspace ? { workspaces: [workspace] } : {}),
      ...(scope === 'project' && workspace ? { projectPath: workspace } : {}),
      ...(after !== undefined ? { after } : {}),
      ...(before !== undefined ? { before } : {}),
      ...(sources.length > 0 ? { source: sources } : {}),
    }
  }, [scope, dateFrom, dateTo, sourceToggles, currentWorkspace])

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    setExcerpt(null)
    setCopied(false)
    setActionMsg(null)
    const nextFilters = buildFilters()
    setFilters(nextFilters)
    const res = await archApi.search(trimmed, nextFilters, 50, controller.signal)
    setLoading(false)
    if (controller.signal.aborted) return
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setResponse(res.value)
    pushHistory(trimmed)
  }, [buildFilters, pushHistory])

  const onSearchClick = useCallback(() => {
    void runSearch(query)
  }, [query, runSearch])

  const onQuick = useCallback((q: string) => {
    setQuery(q)
    void runSearch(q)
  }, [runSearch])

  const onReindex = useCallback(async () => {
    if (!window.confirm(t('confirmReindex'))) return
    setError(null)
    const res = await archApi.reindex()
    if (!res.ok) setError(res.error.message)
    await loadStatus()
  }, [t, loadStatus])

  const onDeleteIndex = useCallback(async () => {
    if (!window.confirm(t('confirmDelete'))) return
    setError(null)
    const res = await archApi.deleteIndex()
    if (!res.ok) setError(res.error.message)
    setResponse(null)
    await loadStatus()
  }, [t, loadStatus])

  const onExcludeSession = useCallback(async (sessionId: string) => {
    const res = await archApi.exclude(sessionId)
    if (res.ok) {
      if (response) setResponse({ ...response, results: response.results.filter((r) => r.sessionId !== sessionId) })
      await loadStatus()
    } else {
      setError(res.error.message)
    }
  }, [response, loadStatus])

  const onTimeline = useCallback(async (sessionId: string) => {
    setTimelineLoading(true)
    setTimeline(null)
    const res = await archApi.timeline(sessionId)
    setTimelineLoading(false)
    if (res.ok) {
      const stages = res.value.stages.map((s) => `[${s.confidence}] ${s.label}\n${s.detail}`).join('\n\n')
      setTimeline(stages)
    } else {
      setError(res.error.message)
    }
  }, [])

  const toggleHit = useCallback((sessionId: string, seq: number) => {
    setSelected((prev) => {
      const current = prev[sessionId] ?? []
      const next = current.includes(seq) ? current.filter((s) => s !== seq) : [...current, seq].sort((a, b) => a - b)
      const copy = { ...prev }
      if (next.length > 0) copy[sessionId] = next
      else delete copy[sessionId]
      return copy
    })
    setExcerpt(null)
    setCopied(false)
    setActionMsg(null)
  }, [])

  const clearSelection = useCallback(() => {
    setSelected({})
    setExcerpt(null)
    setCopied(false)
    setActionMsg(null)
  }, [])

  const selectedCount = Object.values(selected).reduce((sum, seqs) => sum + seqs.length, 0)

  const buildSelectedExcerpt = useCallback(async () => {
    if (selectedCount === 0) {
      setError(t('noSelection'))
      return
    }
    setExcerptLoading(true)
    setError(null)
    setCopied(false)
    setActionMsg(null)
    const selections = Object.entries(selected).map(([sessionId, hitIds]) => ({ sessionId, hitIds }))
    const res = await archApi.excerpt({ selections, maxChars: 8000, maxTokens: 2000, contextRadius: 3 })
    setExcerptLoading(false)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setExcerpt(res.value)
  }, [selected, selectedCount, t])

  const copyExcerpt = useCallback(async () => {
    if (!excerpt) return
    try {
      await navigator.clipboard.writeText(excerpt.text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }, [excerpt])

  const addToContext = useCallback(async () => {
    if (!excerpt) return
    const sessionId = currentSessionId?.()
    if (!sessionId) {
      setError(t('noCurrentSession'))
      return
    }
    setActionMsg(null)
    const res = await archApi.context(sessionId, excerpt.text, 'inject')
    if (res.ok && res.value.delivered) {
      setActionMsg(t('contextSent'))
      return
    }
    // Fallback: official client input API — queue it as a follow-up message.
    if (sendFollowUp) {
      const err = await sendFollowUp(excerpt.text, 'queue')
      if (err) {
        setError(err)
        return
      }
      setActionMsg(t('contextFallback'))
      return
    }
    setActionMsg(t('noCurrentSession'))
  }, [excerpt, currentSessionId, sendFollowUp, t])

  const sendAsFollowUp = useCallback(async () => {
    if (!excerpt) return
    if (!sendFollowUp) {
      setError(t('noCurrentSession'))
      return
    }
    const err = await sendFollowUp(excerpt.text, 'queue')
    if (err) setError(err)
    else setActionMsg(t('contextFallback'))
  }, [excerpt, sendFollowUp, t])

  const toggleExpand = useCallback(async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
      setTimeline(null)
      return
    }
    setExpandedSession(sessionId)
    await onTimeline(sessionId)
  }, [expandedSession, onTimeline])

  const toggleSource = useCallback((key: SourceToggleKey) => {
    setSourceToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <ToolkitPanel
      title={t('title')}
      icon={<IconSearchOutline16 />}
      onClose={onClose}
      summary={
        status ? (
          <>
            <Metric value={status.indexedSessions} label={t('sessionsIndexed')} />
            <Metric value={status.indexedDocs} label={t('docsIndexed')} />
          </>
        ) : undefined
      }
      footer={
        <>
          <Button variant="ghost" size="sm" icon={<IconRefreshOutline16 />} onClick={() => void loadStatus()}>
            {t('refresh')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void onReindex()}>
            {t('reindex')}
          </Button>
          <Button variant="ghost" size="sm" icon={<IconTrashOutline16 />} onClick={() => void onDeleteIndex()}>
            {t('deleteIndex')}
          </Button>
        </>
      }
    >
      <div className="archaeologist-search-row">
        <input
          type="text"
          value={query}
          placeholder={t('searchPlaceholder')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSearchClick() }}
        />
        <button type="button" onClick={onSearchClick}>{t('searchBtn')}</button>
        <button type="button" onClick={() => { setQuery(''); setResponse(null); setSelected({}); setExcerpt(null) }}>{t('clearSearch')}</button>
      </div>

      <div className="archaeologist-filters">
        <label className="archaeologist-meta">{t('scope')}:
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="all">{t('scopeAll')}</option>
            <option value="workspace">{t('scopeWorkspace')}</option>
            <option value="project">{t('scopeProject')}</option>
          </select>
        </label>
        <label className="archaeologist-meta">{t('dateFrom')}:
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="archaeologist-meta">{t('dateTo')}:
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
      </div>

      <div className="archaeologist-filters">
        {([['user', t('filterUser')], ['assistant', t('filterAssistant')], ['error', t('filterErrors')], ['command', t('filterCommands')], ['file', t('filterFiles')]] as [SourceToggleKey, string][]).map(([key, label]) => (
          <label key={key} className="archaeologist-meta">
            <input type="checkbox" checked={sourceToggles[key]} onChange={() => toggleSource(key)} />
            {label}
          </label>
        ))}
      </div>

      <div className="archaeologist-quick">
        {QUICK_QUERIES.map((q) => (
          <button key={q.key} type="button" onClick={() => onQuick(q.query)}>{t(q.key)}</button>
        ))}
      </div>

      {history.length > 0 ? (
        <div className="archaeologist-quick">
          <span className="archaeologist-note">{t('searchHistory')}:</span>
          {history.map((h) => (
            <button key={h} type="button" onClick={() => onQuick(h)}>{h}</button>
          ))}
        </div>
      ) : null}

      {status ? (
        <div className="archaeologist-note">
          {t('sessionsIndexed')}: {status.indexedSessions} · {t('docsIndexed')}: {status.indexedDocs}
          {status.excludedSessions.length > 0 ? ` · ${t('excluded')}: ${status.excludedSessions.length} sessions` : ''}
        </div>
      ) : null}

      {loading ? <div className="archaeologist-note">{t('loading')}</div> : null}
      {error ? <div className="archaeologist-error">{error}</div> : null}
      {actionMsg ? <div className="archaeologist-note">{actionMsg}</div> : null}

      {selectedCount > 0 ? (
        <div className="archaeologist-selectionbar">
          <span className="archaeologist-meta">{t('selectedHits')}: {selectedCount}</span>
          <button type="button" onClick={() => void buildSelectedExcerpt()} disabled={excerptLoading}>
            {excerptLoading ? t('loading') : t('excerpt')}
          </button>
          <button type="button" onClick={clearSelection}>{t('clearSelection')}</button>
        </div>
      ) : null}

      {excerpt ? (
        <div className="archaeologist-timeline">
          <div className="archaeologist-meta">
            [{t('excerptMeta')}] {t('chars')}: {excerpt.charCount}/{excerpt.maxChars} · {t('tokenEstimate')}: {excerpt.tokenEstimate}/{excerpt.maxTokens}
            {excerpt.truncated ? ` ${t('truncated')}` : ''}
            {excerpt.sources.length > 1 ? ` · ${t('selectedHits')}: ${excerpt.selectedHitCount}` : ''}
          </div>
          <div className="archaeologist-meta">
            {excerpt.sources.map((s) => `${s.title} (${s.date})`).join('; ')}
          </div>
          <pre>{excerpt.text}</pre>
          <div className="archaeologist-result-head" style={{ marginTop: 6 }}>
            <button type="button" className="archaeologist-copy" onClick={() => void copyExcerpt()}>{copied ? t('copied') : t('copy')}</button>
            <button type="button" onClick={() => void addToContext()}>{t('addToContext')}</button>
            {sendFollowUp ? <button type="button" onClick={() => void sendAsFollowUp()}>{t('sendFollowUp')}</button> : null}
          </div>
        </div>
      ) : null}

      <div className="archaeologist-results">
        {response?.results.map((result) => (
          <ResultCard
            key={result.sessionId}
            result={result}
            hits={response.hits.filter((h) => h.sessionId === result.sessionId)}
            selectedSeqs={selected[result.sessionId] ?? []}
            t={t}
            expanded={expandedSession === result.sessionId}
            timeline={timeline}
            timelineLoading={timelineLoading}
            onExpand={() => void toggleExpand(result.sessionId)}
            onExclude={() => void onExcludeSession(result.sessionId)}
            onToggleHit={(seq) => toggleHit(result.sessionId, seq)}
          />
        ))}
        {response && response.results.length === 0 && !loading ? (
          <div className="archaeologist-note">{t('noResults')}</div>
        ) : null}
      </div>
    </ToolkitPanel>
  )
}

function ResultCard({
  result,
  hits,
  selectedSeqs,
  t,
  expanded,
  timeline,
  timelineLoading,
  onExpand,
  onExclude,
  onToggleHit,
}: {
  result: SessionResult
  hits: SearchHit[]
  selectedSeqs: number[]
  t: (key: ArchKey) => string
  expanded: boolean
  timeline: string | null
  timelineLoading: boolean
  onExpand: () => void
  onExclude: () => void
  onToggleHit: (seq: number) => void
}) {
  return (
    <div className="archaeologist-result" data-session-id={result.sessionId}>
      <div className="archaeologist-result-head">
        <span className="archaeologist-title">{result.title}</span>
        <span className="archaeologist-meta">{t('date')}: {result.date || '—'}</span>
        <span className="archaeologist-meta">{t('workspace')}: {result.workspace || '—'}</span>
        <span className="archaeologist-meta">{t('relevance')}: {result.relevance}%</span>
        <span className="archaeologist-meta">hits: {result.hitCount}</span>
        <span className="archaeologist-meta">{result.sessionId}</span>
      </div>
      <div className="archaeologist-snippet">{result.snippet}</div>
      <div className="archaeologist-badges">
        {result.hitFields.map((f) => <span key={f} className="archaeologist-badge" title={t('hitFields')}>{f}</span>)}
        {result.files.slice(0, 4).map((f) => <span key={f} className="archaeologist-badge" title={f}>{f}</span>)}
        {result.commands.slice(0, 4).map((c) => <span key={c} className="archaeologist-badge" title={c}>💻 {c}</span>)}
        {result.hasError ? <span className="archaeologist-badge">⚠ error</span> : null}
        {result.outcome ? <span className="archaeologist-badge">{t('outcome')}: {result.outcome}</span> : null}
      </div>
      {hits.slice(0, 10).map((h) => (
        <div key={h.seq} className="archaeologist-snippet" style={{ color: 'var(--dsh-muted, #9aa0a6)' }}>
          <label className="archaeologist-meta">
            <input
              type="checkbox"
              checked={selectedSeqs.includes(h.seq)}
              onChange={() => onToggleHit(h.seq)}
            />
            [{h.source}] {t('date')}: {h.time ? new Date(h.time).toISOString() : '—'}
          </label>
          <div>{h.snippet}</div>
          {h.contextBefore.length > 0 ? (
            <div className="archaeologist-context"><span className="archaeologist-meta">{t('before')}:</span> {h.contextBefore.join(' / ').slice(0, 300)}</div>
          ) : null}
          {h.contextAfter.length > 0 ? (
            <div className="archaeologist-context"><span className="archaeologist-meta">{t('after')}:</span> {h.contextAfter.join(' / ').slice(0, 300)}</div>
          ) : null}
        </div>
      ))}
      <div className="archaeologist-result-head" style={{ marginTop: 6 }}>
        <button type="button" onClick={onExpand}>
          {expanded ? t('close') : t('timeline')}
        </button>
        <button type="button" onClick={onExclude}>exclude</button>
        <button
          type="button"
          title="Open in Time Machine"
          onClick={() => {
            const btn = [...document.querySelectorAll('button')].find((b) => ['时间机器', 'Time Machine'].some((k) => (b.textContent ?? '').includes(k)))
            btn?.click()
          }}
        >
          ⏱
        </button>
      </div>
      {expanded ? (
        <div className="archaeologist-timeline">
          {timelineLoading ? <div className="archaeologist-note">{t('loading')}</div> : null}
          {timeline ? <pre>{timeline}</pre> : null}
        </div>
      ) : null}
    </div>
  )
}