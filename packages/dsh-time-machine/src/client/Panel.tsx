/**
 * dsh-time-machine panel: session timeline + per-file/per-turn diffs +
 * restore preview with explicit confirmation.
 *
 * MVP: no fancy animation. Filters: by file, only agent edits, changed since
 * baseline, conflicts.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Button, IconArchiveOutline20, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { Metric, ToolkitPanel } from 'dsh-toolkit-ui/shared'
import type { FileChange, SessionRecord } from '../core/types.ts'
import type { RestorePreviewFile } from '../core/restore.ts'
import type { RestoreTargetShape } from '../core/engine.ts'
import type { TmKey } from './locales.ts'
import { buildTurns, tmApi } from './api.ts'
import { passesFilter } from './filters.ts'

interface Props {
  sessionId: string
  t: (key: TmKey) => string
  onClose: () => void
}

type FilterMode = import('./filters.ts').FilterMode

export function Panel({ sessionId, t, onClose }: Props): JSX.Element {
  const [record, setRecord] = useState<SessionRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileFilter, setFileFilter] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [turnFilter, setTurnFilter] = useState<number | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTarget, setPreviewTarget] = useState<RestoreTargetShape | null>(null)
  const [previews, setPreviews] = useState<RestorePreviewFile[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await tmApi.timeline(sessionId)
      if (!res.ok) throw new Error(res.error.message)
      setRecord(res.value.record)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { void load() }, [load])

  const turns = useMemo(() => buildTurns(record), [record])

  const files = useMemo(() => {
    const set = new Set<string>()
    for (const turn of turns) for (const c of turn.changes) set.add(c.relPath)
    return Array.from(set).sort()
  }, [turns])

  const allChanges = useMemo(() => turns.flatMap((t) => t.changes), [turns])

  const hasConflicts = useMemo(
    () => previews.some((p) => p.problem !== 'ok'),
    [previews],
  )

  const turnNumbers = useMemo(() => turns.map((t) => t.turn), [turns])

  const filteredTurns = useMemo(() => {
    const state = { fileFilter, mode: filterMode, turn: turnFilter }
    return turns
      .map((turn) => ({
        ...turn,
        changes: turn.changes.filter((c) => passesFilter(c, state)),
      }))
      .filter((turn) => turn.changes.length > 0)
  }, [turns, fileFilter, filterMode, turnFilter])

  const runPreview = async (target: RestoreTargetShape): Promise<void> => {
    setPreviewError(null)
    const res = await tmApi.preview(sessionId, target, true)
    if (!res.ok) {
      setPreviewError(res.error.message)
      setPreviews([])
      return
    }
    setPreviews(res.value.previews)
    setPreviewTarget(target)
    setPreviewOpen(true)
  }

  const confirmRestore = async (): Promise<void> => {
    if (!previewTarget) return
    if (hasConflicts) {
      setPreviewError(t('restoreBlocked'))
      return
    }
    const res = await tmApi.restore(sessionId, previewTarget, true)
    if (!res.ok) {
      setPreviewError(res.error.message)
      return
    }
    setPreviews(res.value.results)
    setPreviewOpen(false)
    await load()
  }

  const changeCount = allChanges.length
  const latestTurn = turnNumbers.at(-1) ?? 0

  return (
    <ToolkitPanel
      title={t('title')}
      icon={<IconArchiveOutline20 />}
      status={record ? `${changeCount} changes · Turn ${latestTurn}` : undefined}
      onClose={onClose}
      summary={
        <>
          <Metric value={changeCount} label={t('changes')} />
          <Metric value={latestTurn} label={t('currentTurn')} />
        </>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" icon={<IconRefreshOutline16 />} onClick={() => void load()}>
            {t('refresh')}
          </Button>
          {record && turns.length > 0 ? (
            <Button variant="ghost" size="sm" className="tm-danger" onClick={() => void runPreview({ kind: 'baseline' })}>
              {t('restoreBaseline')}
            </Button>
          ) : null}
        </>
      }
    >
      <p className="tm-note">{t('baselineDirtyNotice')}</p>
      {record ? (
        <p className="tm-note">
          {t('baselineTitle')}: {t('baselineAt')} {new Date(record.baselineAt).toLocaleString()} ·{' '}
          {record.baseline.filter((b) => b.dirtyBeforeSession).length} 个 dirty-before-session 文件受保护
        </p>
      ) : null}

      {loading && !record ? <div>{t('loading')}</div> : null}
      {error ? <div className="tm-error">{error}</div> : null}

      {/* Filters */}
      <div className="tm-filters">
        <label>
          {t('filterByFile')}
          <input list="tm-files" value={fileFilter} onChange={(e) => setFileFilter(e.target.value)} />
        </label>
        <datalist id="tm-files">
          {files.map((f) => <option key={f} value={f} />)}
        </datalist>
        <label>
          {t('filterByTurn')}
          <select value={turnFilter ?? ''} onChange={(e) => setTurnFilter(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">{t('allTurns')}</option>
            {turnNumbers.map((n) => <option key={n} value={n}>Turn #{n}</option>)}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={filterMode === 'agent'} onChange={() => setFilterMode(filterMode === 'agent' ? 'all' : 'agent')} />
          {t('onlyAgentEdits')}
        </label>
        <label>
          <input type="checkbox" checked={filterMode === 'baseline'} onChange={() => setFilterMode(filterMode === 'baseline' ? 'all' : 'baseline')} />
          {t('changedSinceBaseline')}
        </label>
        <label>
          <input type="checkbox" checked={filterMode === 'conflict'} onChange={() => setFilterMode(filterMode === 'conflict' ? 'all' : 'conflict')} />
          {t('conflicts')}
        </label>
      </div>

      {!record ? (
        <div>{t('notTracking')}</div>
      ) : turns.length === 0 ? (
        <div>{t('noData')}</div>
      ) : (
        <div className="tm-turns">
          {filteredTurns.map((turn) => (
            <div key={turn.turn} className="tm-turn">
              <div className="tm-turn-head">
                <strong>Turn #{turn.turn}</strong>
                <span className="tm-muted">
                  {turn.toolCalls.length} tool call(s) ·{' '}
                  {turn.changes.length} change(s)
                </span>
                <button type="button" onClick={() => void runPreview({ kind: 'turn', turn: turn.turn })}>
                  {t('restoreTurn')}
                </button>
              </div>
              {turn.changes.map((c) => (
                <ChangeRow key={`${c.relPath}-${c.mtimeMs}`} change={c} t={t}
                  onRestore={() => void runPreview({ kind: 'file', relPath: c.relPath, to: 'baseline' })} />
              ))}
            </div>
          ))}
        </div>
      )}

      {previewOpen ? (
        <RestorePreview
          sessionId={sessionId}
          t={t}
          previews={previews}
          target={previewTarget}
          error={previewError}
          onCancel={() => { setPreviewOpen(false); setPreviews([]) }}
          onConfirm={() => void confirmRestore()}
          confirmLabel={hasConflicts ? undefined : t('confirmRestore')}
          onRestored={() => void load()}
        />
      ) : null}
    </ToolkitPanel>
  )
}

function problemLabel(problem: RestorePreviewFile['problem'], t: (key: TmKey) => string): string {
  switch (problem) {
    case 'ok': return t('ok')
    case 'conflict': return t('conflict')
    case 'dirty-before-session': return t('dirtyBeforeSession')
    case 'agent-did-not-create': return t('agentDidNotCreate')
    case 'content-not-stored': return t('contentNotStored')
    case 'already-at-target': return t('alreadyAtTarget')
    default: return problem
  }
}

function ChangeRow({ change, t, onRestore }: {
  change: FileChange
  t: (key: TmKey) => string
  onRestore: () => void
}): JSX.Element {
  const statusLabel = change.status === 'added' ? t('added')
    : change.status === 'modified' ? t('modified')
    : change.status === 'deleted' ? t('deleted')
    : change.status === 'renamed' ? t('renamed') : t('unchanged')
  const displayPath = change.status === 'renamed' && change.oldPath
    ? `${change.oldPath} → ${change.relPath}`
    : change.relPath
  return (
    <div className="tm-change" data-tm-status={change.status}>
      <div className="tm-change-head">
        <span className="tm-file">{displayPath}</span>
        <span className={`tm-badge tm-badge-${change.status}`}>{statusLabel}</span>
        <span className="tm-muted">
          {change.kind} · +{change.addedLines}/-{change.removedLines} {t('lines')}
        </span>
        <span className="tm-muted">
          {change.source ? `#${change.source.turn} ${change.source.toolName ?? ''}` : t('source')}
        </span>
        <button type="button" onClick={onRestore}>{t('restoreFile')}</button>
      </div>
      {change.diff ? (
        <details>
          <summary>{t('diff')}</summary>
          <pre className="tm-diff">{change.diff}</pre>
        </details>
      ) : null}
    </div>
  )
}

function RestorePreview({ sessionId, t, previews, target, error, onCancel, onConfirm, confirmLabel, onRestored }: {
  sessionId: string
  t: (key: TmKey) => string
  previews: RestorePreviewFile[]
  target: RestoreTargetShape | null
  error: string | null
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  onRestored: () => void
}): JSX.Element {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const hasConflict = previews.some((p) => p.problem !== 'ok')
  const conflictFiles = previews.filter((p) => p.problem === 'conflict')

  const fileTargetFor = (relPath: string): RestoreTargetShape | null => {
    if (!target) return null
    if (target.kind === 'file') return target
    if (target.kind === 'baseline') return { kind: 'file', relPath, to: 'baseline' }
    return null
  }

  const copyOldVersion = async (p: RestorePreviewFile): Promise<void> => {
    const text = p.contents?.target ?? ''
    try {
      await navigator.clipboard.writeText(text)
      setFeedback(`${t('copiedToClipboard')}: ${p.relPath}`)
    } catch {
      setFeedback(t('copyFailed'))
    }
  }

  const saveCurrentAs = async (p: RestorePreviewFile): Promise<void> => {
    const res = await tmApi.saveAs(sessionId, p.relPath, true)
    if (!res.ok) {
      setFeedback(res.error.message)
      return
    }
    setFeedback(`${t('savedAs')}: ${res.value.savedPath}`)
  }

  const forceOverwrite = async (p: RestorePreviewFile): Promise<void> => {
    const fileTarget = fileTargetFor(p.relPath)
    if (!fileTarget) return
    if (!window.confirm(t('forceConfirm'))) return
    const res = await tmApi.restore(sessionId, fileTarget, true, true)
    if (!res.ok) {
      setFeedback(res.error.message)
      return
    }
    setFeedback(t('forceDone'))
    onRestored()
  }

  const forceAll = async (): Promise<void> => {
    if (!target) return
    if (!window.confirm(t('forceAllConfirm'))) return
    const res = await tmApi.restore(sessionId, target, true, true)
    if (!res.ok) {
      setFeedback(res.error.message)
      return
    }
    setFeedback(t('forceDone'))
    onRestored()
  }

  return (
    <div className="tm-preview">
      <h4>{t('restorePreviewTitle')}</h4>
      {target?.kind === 'file' ? <p className="tm-warn">{t('confirmFileWarn')}</p> : null}
      {target?.kind === 'baseline' ? <p className="tm-warn">{t('confirmBaselineWarn')}</p> : null}
      {target?.kind === 'turn' ? <p className="tm-warn">{t('confirmTurnWarn')}</p> : null}
      {error ? <div className="tm-error">{error}</div> : null}
      {feedback ? <div className="tm-note">{feedback}</div> : null}
      <table className="tm-table">
        <thead>
          <tr>
            <th>{t('files')}</th>
            <th>{t('action')}</th>
            <th>{t('problem')}</th>
            <th>{t('reason')}</th>
            <th>{t('operations')}</th>
          </tr>
        </thead>
        <tbody>
          {previews.map((p) => (
            <Fragment key={p.relPath}>
              <tr>
                <td>{p.relPath}</td>
                <td>{p.action}</td>
                <td>{problemLabel(p.problem, t)}</td>
                <td>{p.reason}</td>
                <td>
                  {p.problem === 'conflict' ? (
                    <div className="tm-conflict-actions">
                      <button type="button" onClick={() => setExpanded(expanded === p.relPath ? null : p.relPath)}>
                        {t('viewConflict')}
                      </button>
                      <button type="button" onClick={() => void copyOldVersion(p)}>{t('copyOldVersion')}</button>
                      <button type="button" onClick={() => void saveCurrentAs(p)}>{t('saveCurrentAs')}</button>
                      {fileTargetFor(p.relPath) ? (
                        <button type="button" className="tm-danger" onClick={() => void forceOverwrite(p)}>{t('forceOverwrite')}</button>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
              {expanded === p.relPath ? (
                <tr>
                  <td colSpan={5}>
                    <div className="tm-threeway">
                      <div>
                        <strong>{t('expected')}</strong>
                        <pre className="tm-diff">{p.contents?.expected ?? t('contentUnavailable')}</pre>
                      </div>
                      <div>
                        <strong>{t('current')}</strong>
                        <pre className="tm-diff">{p.contents?.current ?? t('contentUnavailable')}</pre>
                      </div>
                      <div>
                        <strong>{t('restoreTarget')}</strong>
                        <pre className="tm-diff">{p.contents?.target ?? t('contentUnavailable')}</pre>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="tm-preview-actions">
        <button type="button" onClick={onCancel}>{t('cancel')}</button>
        {hasConflict ? (
          <>
            <span className="tm-error">{t('restoreBlocked')}</span>
            {target ? (
              <button type="button" className="tm-danger" onClick={() => void forceAll()}>{t('forceAll')}</button>
            ) : null}
          </>
        ) : confirmLabel ? <button type="button" className="tm-danger" onClick={onConfirm}>{confirmLabel}</button> : null}
      </div>
    </div>
  )
}
