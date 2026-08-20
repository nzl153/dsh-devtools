/**
 * Run Lab 面板：实验列表 / 新建 / 跑 A/B / 结果左右对照。
 */
import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { IconBranchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { Metric, ToolkitPanel } from 'dsh-toolkit-ui/shared'
import type { Experiment } from '../core/types.ts'
import { runLabApi } from './api.ts'
import type { RunLabKey } from './locales.ts'

export interface PanelProps {
  onClose: () => void
  t: (key: RunLabKey) => string
}

interface Draft {
  title: string
  prompt: string
  baseline: string
  forceCopy: boolean
  repeat: string
  aLabel: string
  aAgentCommand: string
  aEvaluatorCommand: string
  bLabel: string
  bAgentCommand: string
  bEvaluatorCommand: string
}

const emptyDraft: Draft = {
  title: '',
  prompt: '',
  baseline: '',
  forceCopy: false,
  repeat: '1',
  aLabel: 'Branch A',
  aAgentCommand: '',
  aEvaluatorCommand: '',
  bLabel: 'Branch B',
  bAgentCommand: '',
  bEvaluatorCommand: '',
}

export function Panel({ onClose, t }: PanelProps): ReactElement {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await runLabApi.list()
    if (res.ok) setExperiments(res.value)
  }, [])

  useEffect(() => {
    void refresh().catch(() => setError('failed to load experiments'))
  }, [refresh])

  const create = async (): Promise<void> => {
    if (!draft.prompt.trim() || !draft.baseline.trim()) {
      setError('prompt and baseline are required')
      return
    }
    setBusy(true)
    setError('')
    try {
      const repeat = Number(draft.repeat)
      const res = await runLabApi.create({
        title: draft.title || undefined,
        prompt: draft.prompt,
        baseline: draft.baseline,
        forceCopy: draft.forceCopy,
        repeat: Number.isInteger(repeat) && repeat > 0 ? repeat : undefined,
        branches: [
          {
            id: 'a',
            label: draft.aLabel || 'Branch A',
            agentCommand: draft.aAgentCommand || undefined,
            evaluator: draft.aEvaluatorCommand ? { command: draft.aEvaluatorCommand } : undefined,
          },
          {
            id: 'b',
            label: draft.bLabel || 'Branch B',
            agentCommand: draft.bAgentCommand || undefined,
            evaluator: draft.bEvaluatorCommand ? { command: draft.bEvaluatorCommand } : undefined,
          },
        ],
      })
      if (res.ok) {
        setDraft(emptyDraft)
        await refresh()
      } else {
        setError(res.error.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const run = async (id: string): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const res = await runLabApi.run(id)
      if (res.ok) {
        setExpanded(id)
        await refresh()
      } else {
        setError(res.error.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const res = await runLabApi.delete(id)
      if (!res.ok) setError(res.error.message)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const exp = experiments.find((e) => e.id === expanded)

  return (
    <ToolkitPanel
      title={t('title')}
      icon={<IconBranchOutline16 />}
      status={t('subtitle')}
      onClose={onClose}
      summary={
        <>
          <Metric value={experiments.length} label={t('list')} />
        </>
      }
    >
        <div className="rl-grid">
          <div className="rl-field">
            <label>{t('prompt')}</label>
            <textarea value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} />
          </div>
          <div className="rl-field">
            <label>{t('baseline')}</label>
            <input value={draft.baseline} onChange={(e) => setDraft({ ...draft, baseline: e.target.value })} />
            <label><input type="checkbox" checked={draft.forceCopy}
              onChange={(e) => setDraft({ ...draft, forceCopy: e.target.checked })} /> force copy (non-git)</label>
            <label>{t('repeat')}</label>
            <input type="number" min="1" step="1" value={draft.repeat}
              onChange={(e) => setDraft({ ...draft, repeat: e.target.value })} />
          </div>
        </div>

        {['a', 'b'].map((branch) => {
          const key = branch as 'a' | 'b'
          const prefix = key.toUpperCase()
          return (
            <div className="rl-grid" key={key}>
              <div className="rl-field">
                <label>{t(branch === 'a' ? 'branchA' : 'branchB')} — {t('label')}</label>
                <input value={key === 'a' ? draft.aLabel : draft.bLabel}
                  onChange={(e) => setDraft({ ...draft, [key === 'a' ? 'aLabel' : 'bLabel']: e.target.value })} />
              </div>
              <div className="rl-field">
                <label>{t('agentCommand')}</label>
                <input value={key === 'a' ? draft.aAgentCommand : draft.bAgentCommand}
                  onChange={(e) => setDraft({ ...draft, [key === 'a' ? 'aAgentCommand' : 'bAgentCommand']: e.target.value })} />
              </div>
              <div className="rl-field" style={{ gridColumn: '1 / -1' }}>
                <label>{t('evaluatorCommand')} ({prefix})</label>
                <input value={key === 'a' ? draft.aEvaluatorCommand : draft.bEvaluatorCommand}
                  onChange={(e) => setDraft({ ...draft, [key === 'a' ? 'aEvaluatorCommand' : 'bEvaluatorCommand']: e.target.value })} />
              </div>
            </div>
          )
        })}

        <div className="rl-row">
          <button type="button" className="rl-btn" disabled={busy} onClick={() => void create()}>{t('create')}</button>
          <label><input type="checkbox" checked={draft.forceCopy}
            onChange={(e) => setDraft({ ...draft, forceCopy: e.target.checked })} /> force copy</label>
        </div>

        {error ? <div className="rl-err">{error}</div> : null}

        <div style={{ marginTop: 16 }}>
          <div className="rl-sub">{t('list')}</div>
          {experiments.length === 0 ? <div>{t('empty')}</div> : null}
          {experiments.map((e) => (
            <div className="rl-card" key={e.id}>
              <div className="rl-row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <strong>{e.title}</strong>
                  <div className="rl-status">{e.id} · {t('status')}: {e.status}</div>
                </div>
                <div className="rl-row">
                  <button type="button" className="rl-btn" disabled={busy} onClick={() => void run(e.id)}>{t('run')}</button>
                  <button type="button" className="rl-btn danger" disabled={busy} onClick={() => void remove(e.id)}>{t('delete')}</button>
                </div>
              </div>
              {expanded === e.id && e.result ? <ResultView exp={e} /> : null}
            </div>
          ))}
        </div>
    </ToolkitPanel>
  )
}

function ResultView({ exp }: { exp: Experiment }): ReactElement {
  const result = exp.result
  if (!result) return <div className="rl-note">not run yet</div>
  const rows = Object.entries(result.comparison.metrics)
  return (
    <div style={{ marginTop: 10 }}>
      <div className="rl-row">
        <span className="rl-status">winner: <b>{result.comparison.winner}</b></span>
      </div>
      <div className="rl-grid" style={{ marginTop: 8 }}>
        {result.runs.map((run) => {
          const s = run.summary
          return (
            <div key={run.branch} className="rl-card" style={{ margin: 0 }}>
              <strong>{run.branch.toUpperCase()} x{run.repeat}</strong>
              <div className="rl-status">success rate: {Math.round(s.successRate * 100)}% ({s.successCount}/{s.count})</div>
              <div className="rl-metrics">
                <span>median wall</span><b>{s.medianWallTimeMs ?? 'n/a'}ms</b>
                <span>median tools</span><b>{s.medianToolCalls ?? 'n/a'}</b>
                <span>median tokens</span><b>{s.medianTokens ?? 'n/a'}</b>
                <span>files</span><b>{run.metrics.filesChanged ?? 'n/a'}</b>
                <span>diff</span><b>{run.metrics.diffSize ?? 'n/a'}</b>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 12 }}>
        {rows.filter(([, v]) => v.a !== null || v.b !== null).map(([k, v]) => (
          <div key={k} className="rl-status">
            {k}: A={v.a ?? 'n/a'} B={v.b ?? 'n/a'} (<b>{v.better}</b>)
          </div>
        ))}
      </div>
    </div>
  )
}