/**
 * dsh-context-xray client half.
 * Registers a Toolkit entry and, when the Toolkit shell is absent, falls back
 * to a compact header action that opens the same panel.
 */
import { useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconDataOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
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
import { NS, en, zh, type XrayKey } from './locales.ts'
import { adoptStyles } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-context-xray': XrayKey
  }
}

export const inject = ['slots', 'locale']

type HeaderActionProps = PropsRuntime<'conversation.session.header.actions'> &
  PropsLocale<'dsh-context-xray'>

function ContextQuick({ sessionId, t }: { sessionId: string; t: (key: XrayKey) => string }) {
  return (
    <ToolkitQuickAction
      title={t('open')}
      icon={<IconDataOutline16 />}
      onClick={() => openToolkitPanel('dsh-context-xray')}
    />
  )
}

function ContextRow({ sessionId, t }: { sessionId: string; t: (key: XrayKey) => string }) {
  return (
    <ToolkitEntryRow
      title={t('title')}
      subtitle="Context · token inspector"
      icon={<IconDataOutline16 />}
      onClick={() => openToolkitPanel('dsh-context-xray')}
    />
  )
}

function HeaderAction({ sessionId, t }: HeaderActionProps) {
  const shellReady = useToolkitShellReady()
  const [open, setOpen] = useState(false)
  if (shellReady) return null
  return (
    <div data-xray-root>
      <button type="button" className="xray-trigger" onClick={() => setOpen((v) => !v)}>
        {t('open')}
      </button>
      {open ? (
        <Panel sessionId={sessionId} t={t} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  )
}

export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-context-xray: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.effect(() => registerToolkitEntry({
    id: 'dsh-context-xray',
    category: 'observe',
    order: 10,
    title: t('title'),
    quick: true,
    renderRow: (sessionId) => <ContextRow sessionId={sessionId} t={t} />,
    renderQuick: (sessionId) => <ContextQuick sessionId={sessionId} t={t} />,
    renderPanel: (sessionId, onClose) => <Panel sessionId={sessionId} t={t} onClose={onClose} />,
  }), 'dsh-context-xray: toolkit entry')

  ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'dsh-context-xray',
      order: 10,
      locale: NS,
      inject: () => ({}),
    }, (props: HeaderActionProps) => <HeaderAction {...props} />),
  )
}
