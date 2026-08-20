/**
 * dsh-session-archaeologist client half.
 * Registers a Toolkit entry; falls back to the sidebar footer action when the
 * Toolkit shell is absent.
 */
import { useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconSearchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {
  openToolkitPanel,
  registerToolkitEntry,
  ToolkitEntryRow,
  useToolkitShellReady,
} from 'dsh-toolkit-ui/shared'
import { SearchPanel } from './SearchPanel.tsx'
import { NS, en, zh, type ArchKey } from './locales.ts'
import { adoptStyles } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-session-archaeologist': ArchKey
  }
}

export const inject = ['slots', 'locale']

type FooterActionProps = PropsRuntime<'sidebar.footer.action'> &
  PropsLocale<'dsh-session-archaeologist'>

type SessionLike = {
  prompt?: (content: Array<{ type: 'text'; text: string }>, mode: 'queue' | 'steer') => Promise<unknown>
}

function ArchRow({ sessionId, t }: { sessionId: string; t: (key: ArchKey) => string }) {
  return (
    <ToolkitEntryRow
      title={t('title')}
      subtitle="Session full-text search"
      icon={<IconSearchOutline16 />}
      onClick={() => openToolkitPanel('dsh-session-archaeologist')}
    />
  )
}

export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-session-archaeologist: dictionaries')
  const t = ctx.locale.bind(NS)

  const currentSessionId = (): string | undefined => ctx.sessions?.list?.getSnapshot?.().current
  const currentWorkspace = (): string | undefined => {
    const snap = ctx.sessions?.list?.getSnapshot?.()
    const id = snap?.current
    return id ? snap?.byId?.[id]?.cwd : undefined
  }
  const sendFollowUp = async (text: string, mode: 'queue' | 'steer'): Promise<string | null> => {
    const snapshot = ctx.sessions?.list?.getSnapshot?.()
    const id = snapshot?.current
    if (!id) return 'no-current-session'
    const binding = ctx.sessions?.binding?.(id) as { session?: SessionLike } | undefined
    if (!binding?.session?.prompt) return 'no-current-session'
    const result = await binding.session.prompt([{ type: 'text', text }], mode) as { ok?: boolean; error?: { message?: string } }
    if (result && 'error' in result && result.error) return result.error.message ?? 'send-failed'
    return null
  }

  ctx.effect(() => registerToolkitEntry({
    id: 'dsh-session-archaeologist',
    category: 'observe',
    order: 40,
    title: t('title'),
    renderRow: (sessionId) => <ArchRow sessionId={sessionId} t={t} />,
    renderQuick: () => null,
    renderPanel: (sessionId, onClose) => (
      <SearchPanel
        t={t as (key: ArchKey) => string}
        onClose={onClose}
        currentSessionId={currentSessionId}
        currentWorkspace={currentWorkspace}
        sendFollowUp={sendFollowUp}
      />
    ),
  }), 'dsh-session-archaeologist: toolkit entry')

  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'dsh-session-archaeologist',
      order: 20,
      locale: NS,
      inject: () => ({}),
    }, (props: FooterActionProps) => {
      const shellReady = useToolkitShellReady()
      const [open, setOpen] = useState(false)
      if (shellReady) return null
      return (
        <div data-archaeologist-foot>
          <button
            type="button"
            className="archaeologist-trigger"
            title={t('open')}
            onClick={() => setOpen((v) => !v)}
          >
            {props.wide ? t('open') : '🔎'}
          </button>
          {open ? (
            <div style={{ position: 'absolute', bottom: 40, right: 8 }}>
              <SearchPanel
                t={t as (key: ArchKey) => string}
                onClose={() => setOpen(false)}
                currentSessionId={currentSessionId}
                currentWorkspace={currentWorkspace}
                sendFollowUp={sendFollowUp}
              />
            </div>
          ) : null}
        </div>
      )
    }),
  )
}
