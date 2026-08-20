/**
 * Gallery panel: session filter + category tabs + file table + live preview.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconFolderOpenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { Metric, ToolkitPanel } from 'dsh-toolkit-ui/shared'
import type { GalleryCategory, GalleryFile, GallerySession, PreviewPayload } from '../core/types.ts'
import { formatBytes } from '../core/classify.ts'
import { galleryApi } from './api.ts'
import type { GalleryKey } from './locales.ts'

const CATEGORIES: GalleryCategory[] = ['images', 'documents', 'builds', 'data']

export function GalleryPanel({
  sessionId,
  t,
  onClose,
}: {
  sessionId: string
  t: (key: GalleryKey) => string
  onClose: () => void
}) {
  const [session, setSession] = useState<GallerySession | null>(null)
  const [sessions, setSessions] = useState<Array<{ sessionId: string; workspace: string; lastScanAt: string }>>([])
  const [selected, setSelected] = useState(sessionId)
  const [category, setCategory] = useState<GalleryCategory | 'all'>('all')
  const [deliverablesOnly, setDeliverablesOnly] = useState(false)
  const [previewing, setPreviewing] = useState<GalleryFile | null>(null)
  const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tmAvailable, setTmAvailable] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/plugins/dsh-time-machine/api/timeline', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then((res) => { if (alive) setTmAvailable(res.status !== 404) }).catch(() => { if (alive) setTmAvailable(false) })
    return () => { alive = false }
  }, [])

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await galleryApi.list(id)
      if (!res.ok) throw new Error(res.error.message)
      setSession(res.value.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(selected)
    void galleryApi.sessions().then((res) => {
      if (res.ok) {
        setSessions(res.value.sessions)
        // Auto-select current session if present; otherwise first available.
        if (res.value.sessions.length > 0 && !res.value.sessions.some((s) => s.sessionId === sessionId)) {
          setSelected(res.value.sessions[0].sessionId)
        }
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await galleryApi.refresh(selected)
      if (!res.ok) throw new Error(res.error.message)
      const list = await galleryApi.list(selected)
      if (list.ok) setSession(list.value.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [selected])

  const clear = useCallback(async () => {
    if (!window.confirm(t('clearConfirm'))) return
    await galleryApi.clear(selected)
    setSession(null)
    setPreviewPayload(null)
    setPreviewing(null)
  }, [selected, t])

  const togglePin = useCallback(async (file: GalleryFile) => {
    const pinnedNow = session?.pins?.[file.path] === true || file.pinned === true
    const nextPinned = !pinnedNow
    try {
      const res = await galleryApi.pin(selected, file.path, nextPinned)
      if (!res.ok) throw new Error(res.error.message)
      setSession(res.value.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [selected, session])

  const openPreview = useCallback(async (file: GalleryFile) => {
    setPreviewing(file)
    setPreviewPayload(null)
    setPreviewLoading(true)
    try {
      const res = await galleryApi.preview(selected, file.path)
      if (!res.ok) throw new Error(res.error.message)
      setPreviewPayload(res.value)
    } catch (err) {
      setPreviewPayload({ kind: 'none', reason: err instanceof Error ? err.message : String(err) })
    } finally {
      setPreviewLoading(false)
    }
  }, [selected])

  const changeSession = useCallback((id: string) => {
    setSelected(id)
    setPreviewing(null)
    setPreviewPayload(null)
    void load(id)
  }, [load])

  const files = useMemo(() => {
    if (!session) return []
    const byCategory = category === 'all' ? session.files : session.files.filter((f) => f.category === category)
    if (!deliverablesOnly) return byCategory
    return byCategory.filter((f) => f.pinned === true || session.pins?.[f.path] === true)
  }, [session, category, deliverablesOnly])

  const counts = useMemo(() => {
    const c: Record<GalleryCategory, number> = { images: 0, documents: 0, builds: 0, data: 0 }
    for (const f of session?.files ?? []) c[f.category]++
    return c
  }, [session])

  const versionTurns = useCallback((f: GalleryFile): number[] => {
    if (!session) return []
    const rec = session.versions.find((v) => v.key === f.path.replace(/\\/g, '/'))
    return rec ? rec.turns : []
  }, [session])

  return (
    <ToolkitPanel
      title={t('title')}
      icon={<IconFolderOpenOutline16 />}
      onClose={onClose}
      summary={
        session ? (
          <>
            <Metric value={session.files.length} label={t('categoryAll')} />
            <Metric value={counts.images ?? 0} label={t('images')} />
          </>
        ) : undefined
      }
    >
      <div className="gallery-toolbar">
        <select value={selected} onChange={(e) => changeSession(e.target.value)} title={t('session')}>
          {sessions.length === 0 ? (
            <option value={selected}>{sessionId}</option>
          ) : null}
          {sessions.map((s) => (
            <option key={s.sessionId} value={s.sessionId}>{s.sessionId}</option>
          ))}
        </select>
        <button type="button" onClick={() => void refresh()} title={t('refreshHint')}>{t('refresh')}</button>
        <label className="gallery-deliverable-mode" title={t('menuDeliverables')}>
          <input
            type="checkbox"
            checked={deliverablesOnly}
            onChange={(e) => setDeliverablesOnly(e.target.checked)}
          /> {t('deliverables')}
        </label>
        <button type="button" onClick={() => void clear()}>{t('clear')}</button>
      </div>

      {loading && !session ? <div className="gallery-note">{t('loading')}</div> : null}
      {error ? <div className="gallery-note gallery-error">{error}</div> : null}
      {!session ? <div className="gallery-note">{t('noFiles')}</div> : null}

      {session ? (
        <>
          <div className="gallery-tabs">
            <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>
              {t('categoryAll')} <span className="gallery-count">{session.files.length}</span>
            </button>
            {CATEGORIES.map((cat) => (
              <button key={cat} type="button" className={category === cat ? 'active' : ''} onClick={() => setCategory(cat)}>
                {t(cat)} <span className="gallery-count">{counts[cat]}</span>
              </button>
            ))}
          </div>

          <table className="gallery-table">
            <thead>
              <tr>
                <th>{t('path')}</th>
                <th>{t('type')}</th>
                <th>{t('size')}</th>
                <th>{t('created')}</th>
                <th>{t('modified')}</th>
                <th>{t('turn')}</th>
                <th>{t('relatedCommand')}</th>
                <th>{t('preview')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.map((file) => {
                const vt = versionTurns(file)
                const pinned = file.pinned === true || session?.pins?.[file.path] === true
                return (
                  <tr
                    key={file.path}
                    className={`gallery-row${file.changed ? ' changed' : ''}`}
                    onClick={() => void openPreview(file)}
                    title={file.path}
                  >
                    <td className="gallery-path">{pinned ? `${t('pinnedIndicator')} ` : ''}{file.path}</td>
                    <td>{file.category} · {file.previewKind}{file.risk === 'danger' ? ' ⚠' : ''}</td>
                    <td>{formatBytes(file.size)}</td>
                    <td>{fmtDate(file.created)}</td>
                    <td>{fmtDate(file.modified)}</td>
                    <td>
                      <div>{t('generatedTurn')} {file.firstSeenTurn}</div>
                      {file.modifiedTurn != null ? <div>{t('modifiedTurn')} {file.modifiedTurn}</div> : null}
                      {vt.length > 1 ? (
                        <div className="gallery-versions">{t('versionHistory')}: {vt.map((n) => `${t('turnLabel')} ${n}`).join(' / ')}</div>
                      ) : null}
                      {tmAvailable ? (
                        <button
                          type="button"
                          className="gallery-tm-link"
                          onClick={(e) => {
                            e.stopPropagation()
                            const btn = [...document.querySelectorAll('button')].find((b) => ['时间机器', 'Time Machine'].some((k) => (b.textContent ?? '').includes(k)))
                            btn?.click()
                          }}
                        >
                          {t('openTimeMachine')}
                        </button>
                      ) : null}
                    </td>
                    <td>
                      {file.relatedCommand ? (
                        <div className="gallery-related">{file.relatedCommand.command}</div>
                      ) : (
                        <span className="gallery-note">{t('unknownCommand')}</span>
                      )}
                    </td>
                    <td>{file.previewAvailable ? t('previewAvailable') : t('previewUnavailable')}</td>
                    <td>
                      <button
                        type="button"
                        className={`gallery-pin${pinned ? ' pinned' : ''}`}
                        title={t('pinHint')}
                        onClick={(e) => { e.stopPropagation(); void togglePin(file) }}
                      >
                        {pinned ? t('unpin') : t('pin')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {files.length === 0 ? <div className="gallery-note">{t('noFiles')}</div> : null}
        </>
      ) : null}

      {previewing ? (
        <div className="gallery-preview-box">
          <strong>{previewing.path}</strong>
          {previewing.risk === 'danger' ? (
            <div className="gallery-note gallery-error">{t('dangerFile')}</div>
          ) : null}
          <div>
            <button type="button" onClick={() => void openPreview(previewing)}>{t('refresh')}</button>{' '}
            <button type="button" onClick={() => { setPreviewing(null); setPreviewPayload(null) }}>{t('close')}</button>
          </div>
          {previewLoading ? <div className="gallery-note">{t('loading')}</div> : null}
          <PreviewView payload={previewPayload} sessionId={selected} t={t} />
        </div>
      ) : null}
    </ToolkitPanel>
  )
}

function PreviewView({ payload, sessionId, t }: {
  payload: PreviewPayload | null
  sessionId: string
  t: (key: GalleryKey) => string
}) {
  if (!payload) return null
  switch (payload.kind) {
    case 'image':
      return <img src={payload.dataUrl} alt="" />
    case 'svg':
    case 'html':
      // Both SVG and HTML render inside a sandboxed iframe: no scripts,
      // no same-origin access, no parent DOM access.
      return <iframe sandbox="" srcDoc={payload.content} title="sandbox-preview" style={{ width: '100%', height: 320, border: 0, background: '#fff' }} />
    case 'json':
      return <pre className="gallery-json">{JSON.stringify(payload.tree, null, 2)}</pre>
    case 'pdf':
      return (
        <div>
          <a href={payload.url} target="_blank" rel="noreferrer">{t('openPdf')}</a>
        </div>
      )
    case 'zip':
      return (
        <div>
          <div className="gallery-note">{payload.entries.length} entries (listing only — never executed)</div>
          <pre>{payload.entries.map((e) => `${e.isDirectory ? '📁' : '📄'} ${e.name}${e.isDirectory ? '' : ` (${e.size} B)`}`).join('\n')}</pre>
        </div>
      )
    case 'csv':
      return (
        <table className="gallery-table">
          <thead><tr>{payload.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{payload.rows.slice(0, 200).map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      )
    case 'text':
    case 'markdown':
      // Markdown is intentionally rendered as plain text (React escapes the
      // text node). Never use dangerouslySetInnerHTML with model-authored
      // Markdown/HTML.
      return <pre>{payload.content}</pre>
    case 'none':
      return <div className="gallery-note">{payload.reason || t('noPreview')}</div>
    default:
      return <div className="gallery-note">{t('noPreview')}</div>
  }
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
