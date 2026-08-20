/**
 * dsh-time-machine client half.
 * Registers a Toolkit entry and falls back to a compact header button when the
 * Toolkit shell is not installed.
 */
import { useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconArchiveOutline20 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {
  openToolkitPanel,
  registerToolkitEntry,
  ToolkitEntryRow,
  ToolkitQuickAction,
  useToolkitShellReady,
} from 'dsh-toolkit-ui/shared'
import { Panel } from './Panel.tsx'
import { NS, en, zh, type TmKey } from './locales.ts'
import { adoptStyles } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-time-machine': TmKey
  }
}

export const inject = ['slots', 'locale']

type HeaderActionProps = PropsRuntime<'conversation.session.header.actions'> &
  PropsLocale<'dsh-time-machine'>

function TmQuick({ sessionId, t }: { sessionId: string; t: (key: TmKey) => string }) {
  return (
    <ToolkitQuickAction
      title={t('open')}
      icon={<IconArchiveOutline20 />}
      onClick={() => openToolkitPanel('dsh-time-machine')}
    />
  )
}

function TmRow({ sessionId, t }: { sessionId: string; t: (key: TmKey) => string }) {
  return (
    <ToolkitEntryRow
      title={t('title')}
      subtitle="Workspace timeline · restore"
      icon={<IconArchiveOutline20 />}
      onClick={() => openToolkitPanel('dsh-time-machine')}
    />
  )
}

function HeaderAction({ sessionId, t }: HeaderActionProps) {
  const shellReady = useToolkitShellReady()
  const [open, setOpen] = useState(false)
  if (shellReady) return null
  return (
    <div data-tm-root>
      <button type="button" className="tm-trigger" onClick={() => setOpen((v) => !v)}>
        ⏱ {t('open')}
      </button>
      {open ? (
        <Panel sessionId={sessionId} t={t} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  )
}

export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-time-machine: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.effect(() => registerToolkitEntry({
    id: 'dsh-time-machine',
    category: 'workspace',
    order: 20,
    title: t('title'),
    quick: true,
    renderRow: (sessionId) => <TmRow sessionId={sessionId} t={t} />,
    renderQuick: (sessionId) => <TmQuick sessionId={sessionId} t={t} />,
    renderPanel: (sessionId, onClose) => <Panel sessionId={sessionId} t={t} onClose={onClose} />,
  }), 'dsh-time-machine: toolkit entry')

  ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'dsh-time-machine',
      order: 20,
      locale: NS,
      inject: () => ({}),
    }, (props: HeaderActionProps) => <HeaderAction {...props} />),
  )
}
