// dsh-dev-loop client half.
// Registers a Toolkit entry; falls back to a compact header button when the
// Toolkit shell is absent.
import { Component, useState, type ReactNode } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconCodeOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {
  openToolkitPanel,
  registerToolkitEntry,
  type ToolkitPanelContext,
  ToolkitEntryRow,
  useToolkitShellReady,
} from 'dsh-toolkit-ui/shared'
import { DevLoopPanel } from './Panel.tsx'
import { NS, en, zh, type DevLoopKey } from './locales.ts'
import { adoptStyles } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-dev-loop': DevLoopKey
  }
}

export const inject = ['slots', 'locale']

type HeaderActionProps = PropsRuntime<'conversation.session.header.actions'> &
  PropsLocale<'dsh-dev-loop'>

function DevLoopRow({ sessionId, t }: { sessionId: string; t: (key: DevLoopKey) => string }) {
  return (
    <ToolkitEntryRow
      title={t('title')}
      subtitle="Build · Test · Run"
      icon={<IconCodeOutline16 />}
      onClick={() => openToolkitPanel('dsh-dev-loop')}
    />
  )
}

class PanelErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 8, color: '#c0392b', fontSize: 12 }}>
          DevLoop panel error: {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}

export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-dev-loop: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.effect(() => registerToolkitEntry({
    id: 'dsh-dev-loop',
    category: 'workspace',
    order: 30,
    title: t('title'),
    renderRow: (sessionId) => <DevLoopRow sessionId={sessionId} t={t} />,
    renderQuick: () => null,
    renderPanel: (sessionId, onClose, context: ToolkitPanelContext) => (
      <PanelErrorBoundary>
        <DevLoopPanel
          sessionId={sessionId}
          t={t}
          useWorkspaces={context.useWorkspaces as (selector: (state: unknown) => unknown) => unknown}
          onClose={onClose}
        />
      </PanelErrorBoundary>
    ),
  }), 'dsh-dev-loop: toolkit entry')

  ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'dsh-dev-loop',
      order: 20,
      locale: NS,
      inject: () => ({}),
    }, (props: HeaderActionProps) => {
      const shellReady = useToolkitShellReady()
      const [open, setOpen] = useState(false)
      if (shellReady) return null
      const sessionId = (props as unknown as { sessionId?: string }).sessionId ?? ''
      const useWorkspaces = (props as unknown as { useWorkspaces?: (selector: (state: unknown) => unknown) => unknown }).useWorkspaces
        ?? ((_selector: (state: unknown) => unknown) => [] as unknown)
      return (
        <div data-dev-loop-root>
          <button type="button" className="dsh-devloop-trigger" onClick={() => setOpen((v) => !v)}>
            {t('open')}
          </button>
          {open ? (
            <PanelErrorBoundary>
              <DevLoopPanel
                sessionId={sessionId}
                t={t}
                useWorkspaces={useWorkspaces}
                onClose={() => setOpen(false)}
              />
            </PanelErrorBoundary>
          ) : null}
        </div>
      )
    }),
  )
}
