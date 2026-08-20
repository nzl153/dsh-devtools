/** Session debrief panel opened from the session header action. */
import { useCallback, useEffect, useState } from 'react'
import { IconListPenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { Metric, ToolkitPanel } from 'dsh-toolkit-ui/shared'
import type { SessionDebrief } from '../../core/types.ts'
import { debriefApi } from '../api.ts'
import { DebriefBody } from './DebriefBody.tsx'
import { CrossPluginButtons } from './CrossPluginButtons.tsx'

export function SessionPanel({
  sessionId,
  t,
  onClose,
  onContinue,
}: {
  sessionId: string
  t: (key: import('../locales.ts').DebriefKey) => string
  onClose: () => void
  onContinue?: (draft: string) => void
}) {
  const [debrief, setDebrief] = useState<SessionDebrief | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await debriefApi.session(sessionId)
      if (res.ok) setDebrief(res.value)
      else setError(res.error.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ToolkitPanel
      title={t('sessionTitle')}
      icon={<IconListPenOutline16 />}
      onClose={onClose}
      summary={
        debrief ? (
          <>
            <Metric value={debrief.turnCount} label={t('turns')} />
            <Metric value={debrief.toolCallCount} label={t('toolCalls')} />
            <Metric value={debrief.commandCount} label={t('commands')} />
          </>
        ) : undefined
      }
    >
      {loading && !debrief ? <div>{t('loading')}</div> : null}
      {error ? <div className="dsh-debrief-note" style={{ color: 'var(--dsw-alias-state-error-primary)' }}>{error}</div> : null}
      {debrief ? (
        <div className="dsh-debrief-scroll">
          <DebriefBody debrief={debrief} t={t} onContinue={onContinue} />
          <CrossPluginButtons t={t} showTimeMachine showXray />
        </div>
      ) : null}
    </ToolkitPanel>
  )
}