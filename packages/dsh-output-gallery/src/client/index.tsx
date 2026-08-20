/** dsh-output-gallery client half.
 * Registers a Toolkit entry; falls back to a header button when the Toolkit
 * shell is absent. */
import { useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconFolderOpenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {
  openToolkitPanel,
  registerToolkitEntry,
  ToolkitEntryRow,
  useToolkitShellReady,
} from 'dsh-toolkit-ui/shared'
import { GalleryPanel } from './GalleryPanel.tsx'
import { NS, en, zh, type GalleryKey } from './locales.ts'
import { adoptStyles } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-output-gallery': GalleryKey
  }
}

export const inject = ['slots', 'locale']

type HeaderActionProps = PropsRuntime<'conversation.session.header.actions'> &
  PropsLocale<'dsh-output-gallery'>

function GalleryRow({ sessionId, t }: { sessionId: string; t: (key: GalleryKey) => string }) {
  return (
    <ToolkitEntryRow
      title={t('title')}
      subtitle="Artifacts · deliverables"
      icon={<IconFolderOpenOutline16 />}
      onClick={() => openToolkitPanel('dsh-output-gallery')}
    />
  )
}

export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-output-gallery: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.effect(() => registerToolkitEntry({
    id: 'dsh-output-gallery',
    category: 'workspace',
    order: 40,
    title: t('title'),
    renderRow: (sessionId) => <GalleryRow sessionId={sessionId} t={t} />,
    renderQuick: () => null,
    renderPanel: (sessionId, onClose) => <GalleryPanel sessionId={sessionId} t={t} onClose={onClose} />,
  }), 'dsh-output-gallery: toolkit entry')

  ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'dsh-output-gallery',
      order: 20,
      locale: NS,
      inject: () => ({}),
    }, (props: HeaderActionProps) => {
      const shellReady = useToolkitShellReady()
      const [open, setOpen] = useState(false)
      if (shellReady) return null
      const sessionId = props.sessionId
      return (
        <div data-gallery-root>
          <button type="button" className="gallery-trigger" onClick={() => setOpen((v) => !v)}>
            {t('open')}
          </button>
          {open ? (
            <GalleryPanel sessionId={sessionId} t={t} onClose={() => setOpen(false)} />
          ) : null}
        </div>
      )
    }),
  )
}
