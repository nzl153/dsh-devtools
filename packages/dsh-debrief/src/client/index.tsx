/**
 * dsh-debrief client half.
 *
 * Registers:
 *  - `conversation.chat.turnTail` (chain): compact debrief card after closed turns.
 *  - `conversation.session.header.actions` (list): fallback header button; hidden
 *    when the Toolkit shell is present.
 *  - A Toolkit entry for the unified Developer Toolkit navigation.
 */
import { useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconListPenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {
  openToolkitPanel,
  registerToolkitEntry,
  type ToolkitPanelContext,
  ToolkitEntryRow,
  ToolkitQuickAction,
  useToolkitShellReady,
} from 'dsh-toolkit-ui/shared'
import type { DebriefSettingsLike } from '../core/types.ts'
import { NS, en, zh, type DebriefKey } from './locales.ts'
import { adoptStyles } from './styles.ts'
import { TurnCard } from './components/TurnCard.tsx'
import { SessionPanel } from './components/SessionPanel.tsx'
import { debriefApi } from './api.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-debrief': DebriefKey
  }
}

export const inject = ['slots', 'locale']

/** Whether a closed turn should surface a card under the user's trigger setting. */
export function shouldShowTurn(settings: DebriefSettingsLike, turn: number): boolean {
  switch (settings.triggerMode) {
    case 'off':
      return false
    case 'session-only':
      return true
    case 'on-completion':
      return true
    case 'every-n-turns': {
      const interval = settings.turnInterval > 0 ? settings.turnInterval : 1
      return turn % interval === 0
    }
    default:
      return false
  }
}

/** Whether a card should render collapsed by default (low-interference modes). */
export function defaultCollapsedFor(settings: DebriefSettingsLike): boolean {
  return settings.triggerMode === 'session-only' || settings.triggerMode === 'on-completion'
}

/** A controlled settings holder so the turn-tail card can wait for settings. */
function useDebriefSettings(): DebriefSettingsLike | null {
  const [settings, setSettings] = useState<DebriefSettingsLike | null>(null)
  const FALLBACK: DebriefSettingsLike = { triggerMode: 'off', turnInterval: 1, testCommandPatterns: [], detectTodoMarkers: true }
  useEffect(() => {
    let cancelled = false
    void debriefApi.settings().then((res) => {
      if (cancelled) return
      setSettings(res.ok ? res.value : FALLBACK)
    }).catch(() => {
      if (!cancelled) setSettings(FALLBACK)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return settings
}

type TurnTailProps = PropsRuntime<'conversation.chat.turnTail'> &
  PropsLocale<'dsh-debrief'> & { matched: { closed: boolean } }

type HeaderActionProps = PropsRuntime<'conversation.session.header.actions'> &
  PropsLocale<'dsh-debrief'>

function DebriefQuick({ sessionId, t }: { sessionId: string; t: (key: DebriefKey) => string }) {
  return (
    <ToolkitQuickAction
      title={t('openPanel')}
      icon={<IconListPenOutline16 />}
      onClick={() => openToolkitPanel('dsh-debrief')}
    />
  )
}

function DebriefRow({ sessionId, t }: { sessionId: string; t: (key: DebriefKey) => string }) {
  return (
    <ToolkitEntryRow
      title={t('title')}
      subtitle="Mission debrief"
      icon={<IconListPenOutline16 />}
      onClick={() => openToolkitPanel('dsh-debrief')}
    />
  )
}

export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-debrief: dictionaries')
  const t = ctx.locale.bind(NS)

  // Per-turn card in the turn-tail chain slot.
  ctx.slots.inject('conversation.chat.turnTail', () =>
    ctx.slots.register({
      name: 'conversation.chat.turnTail',
      priority: 100,
      locale: NS,
      select: (owner: TurnTailOwnerProps) => {
        if (owner.turn?.status !== 'closed') return null
        return { closed: true }
      },
    }, (props: TurnTailProps) => {
      const settings = useDebriefSettings()
      const sessionId = props.sessionId
      const turn = props.turn?.turn ?? 0
      if (!settings) return null
      if (!shouldShowTurn(settings, turn)) return null
      const onContinue = (draft: string) => props.inputActions.setDraft(draft)
      return (
        <TurnCard
          sessionId={sessionId}
          turn={turn}
          t={props.t}
          defaultCollapsed={defaultCollapsedFor(settings)}
          onContinue={onContinue}
        />
      )
    }),
  )

  ctx.effect(() => registerToolkitEntry({
    id: 'dsh-debrief',
    category: 'observe',
    order: 20,
    title: t('title'),
    quick: true,
    renderRow: (sessionId) => <DebriefRow sessionId={sessionId} t={t} />,
    renderQuick: (sessionId) => <DebriefQuick sessionId={sessionId} t={t} />,
    renderPanel: (sessionId, onClose, context: ToolkitPanelContext) => (
      <SessionPanel
        sessionId={sessionId}
        t={t}
        onClose={onClose}
        onContinue={(draft) => context.inputActions?.setDraft?.(draft)}
      />
    ),
  }), 'dsh-debrief: toolkit entry')

  // Fallback session header action; hidden when the Toolkit shell is present.
  ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'dsh-debrief',
      order: 10,
      locale: NS,
      inject: () => ({}),
    }, (props: HeaderActionProps) => {
      const shellReady = useToolkitShellReady()
      const [open, setOpen] = useState(false)
      if (shellReady) return null
      const sessionId = props.sessionId
      const onContinue = (draft: string) => props.inputActions.setDraft(draft)
      return (
        <div data-debrief-root>
          <button type="button" onClick={() => setOpen((v) => !v)}>
            {t('openPanel')}
          </button>
          {open ? (
            <SessionPanel
              sessionId={sessionId}
              t={t}
              onClose={() => setOpen(false)}
              onContinue={onContinue}
            />
          ) : null}
        </div>
      )
    }),
  )
}
