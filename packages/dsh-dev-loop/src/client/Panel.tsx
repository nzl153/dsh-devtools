// dsh-dev-loop：面板组件。
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { DevLoopSummary, CommandRun, DevLoopConfig } from '../core/types.ts'
import { devLoopApi, type RunActionResult } from './api.ts'
import { NS } from './locales.ts'

interface PanelProps {
  sessionId: string
  t: TranslateNS<typeof NS>
  useWorkspaces: (selector: (state: unknown) => unknown) => unknown
  onClose: () => void
}

function statusLabel(t: TranslateNS<typeof NS>, status: CommandRun['status']): string {
  switch (status) {
    case 'running': return t('running')
    case 'succeeded': return t('succeeded')
    case 'failed': return t('failed')
    case 'cancelled': return t('cancelled')
    default: return t('idle')
  }
}

function statusChipStyle(status: CommandRun['status']): React.CSSProperties {
  switch (status) {
    case 'succeeded': return { background: 'var(--dsw-alias-state-success-tertiary)', color: 'var(--dsw-alias-state-success-primary)' }
    case 'failed': return { background: 'var(--dsw-alias-state-error-secondary)', color: 'var(--dsw-alias-state-error-primary)' }
    case 'running': return { background: 'var(--dsw-alias-state-warn-tertiary)', color: 'var(--dsw-alias-state-warn-primary)' }
    case 'cancelled': return { background: 'var(--dsw-alias-interactive-bg-hover)', color: 'var(--dsw-alias-label-tertiary)' }
    default: return { background: 'var(--dsw-alias-interactive-bg-hover)', color: 'var(--dsw-alias-label-secondary)' }
  }
}

export function DevLoopPanel({ sessionId, t, useWorkspaces, onClose }: PanelProps): React.ReactElement {
  const [root, setRoot] = useState<string>('')
  const [rootInput, setRootInput] = useState<string>('')
  const [manualRoot, setManualRoot] = useState(false)
  const [summary, setSummary] = useState<DevLoopSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [presetOpen, setPresetOpen] = useState(false)
  const [presetFramework, setPresetFramework] = useState<'node' | 'python' | 'rust' | 'dotnet' | 'godot'>('node')
  const [presetName, setPresetName] = useState('')
  const [presetText, setPresetText] = useState('')

  const workspaceItems = (useWorkspaces((s: unknown) => (s as { items?: Array<{ path: string; sessionIds: string[] }> })?.items) ?? []) as Array<{ path: string; sessionIds: string[] }>
  const detectedRoot = useMemo(() => {
    if (manualRoot) return root
    const ws = workspaceItems.find((w) => (w.sessionIds ?? []).includes(sessionId))
    return ws?.path ?? ''
  }, [workspaceItems, sessionId, manualRoot]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeRoot = manualRoot ? root : detectedRoot

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await devLoopApi.summary(activeRoot || undefined)
    if (res.ok) {
      setSummary(res.value)
      if (!manualRoot && !res.value.project && res.value.actions.length === 0 && activeRoot) {
        // workspace 存在但无配置，提示
      }
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [activeRoot, manualRoot]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runAction = useCallback(async (action: string, confirmTrust = false) => {
    if (!activeRoot) return
    setError(null)
    const res = await devLoopApi.run(activeRoot, action, confirmTrust)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    const result: RunActionResult = res.value
    if (result.needsTrust) {
      setError(`TRUST:${activeRoot}`)
      return
    }
    await refresh()
    // 轮询直到运行结束
    const id = result.run.id
    if (!id) return
    const timer = setInterval(async () => {
      const s = await devLoopApi.summary(activeRoot)
      if (s.ok) {
        const r = s.value.runs[id]
        setSummary(s.value)
        if (r && r.status !== 'running' && r.status !== 'idle') {
          clearInterval(timer)
        }
      }
    }, 800)
  }, [activeRoot, refresh])

  const cancelRun = useCallback(async (id: string) => {
    await devLoopApi.cancel(id)
    await refresh()
  }, [refresh])

  const confirmTrust = useCallback(async () => {
    if (!activeRoot) return
    const name = summary?.project?.name
    await devLoopApi.confirmTrust(activeRoot, name)
    // 重试上次未执行的动作
    setError(null)
    const res = await devLoopApi.summary(activeRoot)
    if (res.ok) setSummary(res.value)
  }, [activeRoot, summary, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendError = useCallback(async () => {
    if (!activeRoot) return
    const res = await devLoopApi.sendError(sessionId, activeRoot)
    if (res.ok) {
      setError(res.value.ok ? res.value.message : res.value.message)
    } else {
      setError(res.error.message)
    }
  }, [activeRoot, sessionId])

  const toggleWatch = useCallback(async () => {
    if (!activeRoot) return
    const started = summary?.watch?.started ?? false
    const res = started
      ? await devLoopApi.watchStop(activeRoot)
      : await devLoopApi.watchStart(activeRoot)
    if (res.ok) {
      await refresh()
    } else {
      setError(res.error.message)
    }
  }, [activeRoot, refresh, summary?.watch?.started]) // eslint-disable-line react-hooks/exhaustive-deps

  const generatePreset = useCallback(async () => {
    const name = presetName.trim() || summary?.project?.name || 'My Project'
    const res = await devLoopApi.generatePreset(presetFramework, name, activeRoot || undefined)
    if (res.ok) {
      setPresetText(res.value.text)
      setError(null)
    } else {
      setError(res.error.message)
    }
  }, [presetFramework, presetName, summary?.project?.name, activeRoot])

  const running = useMemo(() => Object.values(summary?.runs ?? {}).some((r) => r.status === 'running'), [summary])
  const lastFail = summary?.lastFail

  const trustPrompt = error !== null && error.startsWith('TRUST:')

  return (
    <div className="dsh-devloop-root">
      <header className="dsh-devloop-head">
        <span className="dsh-devloop-head-title">
          {summary?.project?.name ?? t('title')}
          <span
            className="dsh-devloop-status-chip"
            style={{ ...(summary?.trusted
              ? { background: 'var(--dsw-alias-state-success-tertiary)', color: 'var(--dsw-alias-state-success-primary)' }
              : { background: 'var(--dsw-alias-state-error-secondary)', color: 'var(--dsw-alias-state-error-primary)' }), marginLeft: 8 }}
          >
            {summary?.trusted ? t('trusted') : t('notTrusted')}
          </span>
        </span>
        <span style={{ fontSize: 11, color: '#888' }}>{activeRoot || t('noWorkspace')}</span>
        <button type="button" className="dsh-devloop-close" onClick={onClose} aria-label="close">✕</button>
      </header>

      <div className="dsh-devloop-body">
        {!activeRoot ? (
          <div>
            <div className="dsh-devloop-notice">{t('noWorkspace')}</div>
            <input
              className="dsh-devloop-root-input"
              value={rootInput}
              placeholder="E:\\path\\to\\project"
              onChange={(e) => {
                setRootInput(e.target.value)
                setManualRoot(true)
                setRoot(e.target.value)
              }}
            />
          </div>
        ) : null}

        {loading ? <div className="dsh-devloop-notice">{t('loading')}</div> : null}

        {!loading && summary && !summary.project ? (
          <div className="dsh-devloop-notice">{t('noConfig')}</div>
        ) : null}

        {trustPrompt ? (
          <div className="dsh-devloop-trust">
            <div>{t('trustWarning')}</div>
            <button type="button" className="dsh-devloop-action-btn" onClick={() => { void confirmTrust() }}>
              {t('confirmTrust')}
            </button>
          </div>
        ) : null}

        {error !== null && !trustPrompt ? (
          <div className="dsh-devloop-notice" style={{ color: 'var(--dsw-alias-state-error-primary)' }}>{error}</div>
        ) : null}

        {summary?.project ? (
          <>
            <div className="dsh-devloop-actions">
              {Object.values(summary.project.actions).map((a) => (
                <button
                  key={a.name}
                  type="button"
                  className="dsh-devloop-action-btn"
                  disabled={running}
                  onClick={() => { void runAction(a.name) }}
                >
                  {a.name}
                </button>
              ))}
              {running ? (
                <button
                  type="button"
                  className="dsh-devloop-action-btn"
                  onClick={() => { const r = Object.values(summary.runs).find((x) => x.status === 'running'); if (r) void cancelRun(r.id) }}
                >
                  {t('stop')}
                </button>
              ) : null}
            </div>

            {summary.watch ? (
              <div className="dsh-devloop-watch">
                <strong>{t('watch')}</strong>
                <span className="dsh-devloop-watch-meta">
                  {summary.watch.action}
                  {summary.watch.running ? ` · ${t('running')}` : ''}
                  {summary.watch.pending ? ` · ${t('watchPending')}` : ''}
                </span>
                <button
                  type="button"
                  className="dsh-devloop-action-btn"
                  onClick={() => { void toggleWatch() }}
                >
                  {summary.watch.started ? t('watchStop') : t('watchStart')}
                </button>
              </div>
            ) : null}

            {summary.afterAgent ? (
              <div className="dsh-devloop-watch">
                <strong>{t('afterAgent')}</strong>
                <span className="dsh-devloop-watch-meta">
                  {summary.afterAgent.enabled ? t('afterAgentOn') : t('afterAgentOff')}
                  {' · '}
                  {summary.afterAgent.action}
                  {summary.afterAgent.lastStatus ? ` · ${statusLabel(t, summary.afterAgent.lastStatus)}` : ''}
                </span>
              </div>
            ) : null}

            <div className="dsh-devloop-preset">
              <button type="button" className="dsh-devloop-action-btn" onClick={() => setPresetOpen((v) => !v)}>
                {t('generatePreset')}
              </button>
              {presetOpen ? (
                <div className="dsh-devloop-preset-body">
                  <select
                    className="dsh-devloop-root-input"
                    value={presetFramework}
                    onChange={(e) => setPresetFramework(e.target.value as typeof presetFramework)}
                  >
                    {(['node', 'python', 'rust', 'dotnet', 'godot'] as const).map((fw) => (
                      <option key={fw} value={fw}>{fw}</option>
                    ))}
                  </select>
                  <input
                    className="dsh-devloop-root-input"
                    value={presetName}
                    placeholder={t('presetName')}
                    onChange={(e) => setPresetName(e.target.value)}
                  />
                  <button type="button" className="dsh-devloop-action-btn" onClick={() => { void generatePreset() }}>
                    {t('generatePreset')}
                  </button>
                  {presetText ? (
                    <textarea className="dsh-devloop-preset-text" readOnly value={presetText} rows={12} />
                  ) : null}
                </div>
              ) : null}
            </div>

            {lastFail ? (
              <div className="dsh-devloop-notice" style={{ marginBottom: 8 }}>
                <strong>{t('lastFail')}:</strong> {lastFail.action} · {formatAgo(lastFail.at)}
                {lastFail.snippet ? <pre className="dsh-devloop-output" style={{ maxHeight: 90 }}>{lastFail.snippet}</pre> : null}
                <div style={{ marginTop: 6 }}>
                  <button type="button" className="dsh-devloop-action-btn" onClick={() => { void sendError() }}>
                    {t('sendError')}
                  </button>
                  <button
                    type="button"
                    className="dsh-devloop-action-btn"
                    onClick={() => {
                      const btn = [...document.querySelectorAll('button')].find((b) => ['战报', 'Debrief'].some((k) => (b.textContent ?? '').includes(k)))
                      btn?.click()
                    }}
                  >
                    {t('openDebrief')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="dsh-devloop-notice">{t('noLastFail')}</div>
            )}

            <div className="dsh-devloop-records" style={{ marginTop: 10 }}>
              {Object.entries(summary.runs).sort((a, b) => (b[1].startedAt ?? 0) - (a[1].startedAt ?? 0)).map(([id, r]) => (
                <RecordRow key={id} id={id} run={r} t={t} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function RecordRow({ run, t }: { id: string; run: CommandRun; t: TranslateNS<typeof NS> }): React.ReactElement {
  return (
    <div className="dsh-devloop-record">
      <div className="dsh-devloop-record-head">
        <strong>{run.action}</strong>
        <span className="dsh-devloop-status-chip" style={statusChipStyle(run.status)}>{statusLabel(t, run.status)}</span>
        <span className="dsh-devloop-record-meta">
          {run.durationMs > 0 ? `${t('duration')} ${(run.durationMs / 1000).toFixed(1)}s` : ''}
          {run.exitCode !== null ? ` · ${t('exit')} ${run.exitCode}` : ''}
        </span>
      </div>
      <pre className="dsh-devloop-output">{run.output || t('emptyOutput')}</pre>
    </div>
  )
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 0) return 'now'
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}
