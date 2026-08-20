import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  IconCopyOutline16,
  IconDataOutline16,
  IconDownloadOutline16,
  IconRefreshOutline16,
  IconTrashOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { Metric, ToolkitPanel } from 'dsh-toolkit-ui/shared'
import type { ContextSnapshot, DiagnosticExport, SessionHistory } from '../core/types.ts'
import { formatTokens } from '../core/turn-diff/diff.ts'
import type { XrayKey } from './locales.ts'
import { xrayApi } from './api.ts'
import { Breakdown } from './components/Breakdown.tsx'
import { PressureBadge } from './components/PressureBadge.tsx'
import { ToolTable } from './components/ToolTable.tsx'
import { HistoryChart } from './components/HistoryChart.tsx'

export function Panel({
  sessionId,
  t,
  onClose,
}: {
  sessionId: string
  t: (key: XrayKey) => string
  onClose: () => void
}) {
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null)
  const [history, setHistory] = useState<SessionHistory | null>(null)
  const [showSections, setShowSections] = useState(false)
  const [includeBody, setIncludeBody] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (withBody = false) => {
    setLoading(true)
    setError(null)
    try {
      const snapRes = await xrayApi.snapshot(sessionId, withBody)
      if (!snapRes.ok) throw new Error(snapRes.error.message)
      setSnapshot(snapRes.value)
      const histRes = await xrayApi.history(sessionId)
      if (histRes.ok) setHistory(histRes.value.history)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void load(false)
  }, [load])

  const toggleBody = async (): Promise<void> => {
    const next = !includeBody
    setIncludeBody(next)
    await load(next)
  }

  const clear = async (): Promise<void> => {
    if (!window.confirm(t('clearConfirm'))) return
    await xrayApi.clear(sessionId)
    setHistory(null)
  }

  const loadDiagnostic = async (): Promise<DiagnosticExport> => {
    const res = await xrayApi.diagnostic(sessionId)
    if (!res.ok) throw new Error(res.error.message)
    return res.value
  }

  const downloadDiagnostic = async (): Promise<void> => {
    try {
      const diagnostic = await loadDiagnostic()
      const blob = new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `dsh-context-xray-${diagnostic.sessionId}-turn${diagnostic.turn}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const copyDiagnostic = async (): Promise<void> => {
    try {
      const diagnostic = await loadDiagnostic()
      await navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const pressure = snapshot?.pressure.pressureTokens ?? snapshot?.totalTokens ?? null
  const entries = history?.entries ?? []
  const latest = entries.at(-1)
  const prev = entries.at(-2)
  const delta = latest && prev && latest.totalTokens !== null && prev.totalTokens !== null
    ? latest.totalTokens - prev.totalTokens
    : null

  return (
    <ToolkitPanel
      title={t('title')}
      icon={<IconDataOutline16 />}
      status={snapshot ? <PressureBadge pressure={snapshot.pressure} t={t} /> : undefined}
      onClose={onClose}
      summary={
        <>
          <Metric value={pressure !== null ? formatTokens(pressure) : '—'} label={t('providerTotal')} />
          <Metric value={snapshot?.contextWindow !== null && snapshot?.contextWindow !== undefined ? formatTokens(snapshot.contextWindow) : '—'} label={t('contextWindow')} />
          <Metric value={delta !== null ? `+${formatTokens(delta)}` : '—'} label={t('delta')} />
        </>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" icon={<IconRefreshOutline16 />} onClick={() => void load(includeBody)}>
            {t('refresh')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void toggleBody()}>
            {includeBody ? t('expanded') : t('preview')}
          </Button>
          <Button variant="ghost" size="sm" icon={<IconDownloadOutline16 />} onClick={() => void downloadDiagnostic()}>
            {t('downloadDiagnostic')}
          </Button>
          <Button variant="ghost" size="sm" icon={<IconCopyOutline16 />} onClick={() => void copyDiagnostic()}>
            {t('copyDiagnostic')}
          </Button>
          <Button variant="ghost" size="sm" icon={<IconTrashOutline16 />} onClick={() => void clear()}>
            {t('clear')}
          </Button>
        </>
      }
    >
      {loading && !snapshot ? <div>{t('loading')}</div> : null}
      {error ? <div className="xray-note" style={{ color: 'var(--dsw-alias-state-error-primary)' }}>{error}</div> : null}
      {snapshot ? (
        <>
          <Breakdown snapshot={snapshot} t={t} />
          <div className="dsh-tk-section">
            <span className="dsh-tk-section-title">{t('sections')} ({snapshot.sections.length})</span>
            <table className="xray-table">
              <thead>
                <tr>
                  <th>id</th>
                  <th>{t('source')}</th>
                  <th>{t('tokens')}</th>
                  <th>{t('delta')}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.sections.map((section) => (
                  <tr key={section.id}>
                    <td>{section.id}</td>
                    <td>{section.source}</td>
                    <td>{section.tokens}</td>
                    <td>{section.stable ? t('stable') : t('dynamic')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {snapshot.sections.map((section) => (
              <details key={section.id}>
                <summary>{section.id}</summary>
                <pre>{section.body ?? section.preview}</pre>
              </details>
            ))}
          </div>
          <ToolTable snapshot={snapshot} t={t} />
          <HistoryChart history={history} t={t} />
        </>
      ) : null}
      {snapshot?.source.map((s) => (
        <div key={s.metric} className="xray-note">{s.metric}: {s.note}</div>
      ))}
    </ToolkitPanel>
  )
}
