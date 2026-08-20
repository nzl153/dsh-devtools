/**
 * dsh-run-lab client half.
 * Registers a Toolkit entry; falls back to the sidebar footer action when the
 * Toolkit shell is absent.
 */
import { useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { IconBranchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {
  openToolkitPanel,
  registerToolkitEntry,
  ToolkitEntryRow,
  useToolkitShellReady,
} from 'dsh-toolkit-ui/shared'
import { Panel } from './Panel.tsx'
import { NS, en, zh, type RunLabKey } from './locales.ts'
import { adoptStyles } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-run-lab': RunLabKey
  }
}

export const inject = ['slots', 'locale']

type FooterActionProps = PropsRuntime<'sidebar.footer.action'> & PropsLocale<'dsh-run-lab'>

function RunLabRow({ sessionId, t }: { sessionId: string; t: (key: RunLabKey) => string }) {
  return (
    <ToolkitEntryRow
      title={t('title')}
      subtitle="Agent A/B experiments"
      icon={<IconBranchOutline16 />}
      onClick={() => openToolkitPanel('dsh-run-lab')}
    />
  )
}

export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-run-lab: dictionaries')

  const t = ctx.locale.bind(NS)

  ctx.effect(() => registerToolkitEntry({
    id: 'dsh-run-lab',
    category: 'experiment',
    order: 10,
    title: t('title'),
    renderRow: (sessionId) => <RunLabRow sessionId={sessionId} t={t} />,
    renderQuick: () => null,
    renderPanel: (_sessionId, onClose) => <Panel onClose={onClose} t={t} />,
  }), 'dsh-run-lab: toolkit entry')

  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'dsh-run-lab',
      order: 20,
      locale: NS,
      inject: () => ({}),
    }, (props: FooterActionProps) => {
      const shellReady = useToolkitShellReady()
      const [open, setOpen] = useState(false)
      if (shellReady) return null
      const { t: tt } = props
      return (
        <div data-runlab-root>
          <button type="button" className="rl-footer-action" onClick={() => setOpen((v) => !v)}>
            {props.wide ? tt('open') : '🧪'}
          </button>
          {open ? <Panel onClose={() => setOpen(false)} t={tt} /> : null}
        </div>
      )
    }),
  )
}
