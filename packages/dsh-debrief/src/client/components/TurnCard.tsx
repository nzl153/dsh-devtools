/** Compact turn debrief card rendered in the `conversation.chat.turnTail` slot. */
import { useEffect, useState } from 'react'
import type { TurnDebrief } from '../../core/types.ts'
import { debriefApi } from '../api.ts'
import { DebriefBody } from './DebriefBody.tsx'
import { CrossPluginButtons } from './CrossPluginButtons.tsx'

export function TurnCard({
  sessionId,
  turn,
  t,
  defaultCollapsed = false,
  onContinue,
}: {
  sessionId: string
  turn: number
  t: (key: import('../locales.ts').DebriefKey) => string
  /** Start collapsed for low-interference modes (session-only / on-completion). */
  defaultCollapsed?: boolean
  onContinue?: (draft: string) => void
}) {
  const [debrief, setDebrief] = useState<TurnDebrief | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    void debriefApi.turn(sessionId, turn, controller.signal).then((res) => {
      if (cancelled) return
      if (res.ok) setDebrief(res.value)
      else setError(res.error.message)
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err))
    })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [sessionId, turn])

  if (error) return null
  if (!debrief) return null
  if (dismissed) return null

  return (
    <div className="dsh-debrief-card" data-debrief-turn={debrief.turn}>
      <div className="dsh-debrief-card-title">
        <button
          type="button"
          className="dsh-debrief-card-toggle"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <span>{t('title')} · {t('turnTitle')} #{debrief.turn}</span>
        <button
          type="button"
          className="dsh-debrief-card-close"
          title={t('close')}
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      </div>
      {!collapsed ? (
        <>
          <DebriefBody debrief={debrief} t={t} onContinue={onContinue} />
          <CrossPluginButtons t={t} showTimeMachine showXray />
        </>
      ) : null}
    </div>
  )
}