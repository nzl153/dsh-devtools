import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// 类型增强（declare module 合并）来源，必须显式 import：
//  - ui-renderer/client → Context.slots
//  - ui-session/client  → SessionStandardProps.sessionId
//  - ui-conversation/client → SlotMap 里的 conversation.* 槽位
//  - client-locale/client   → Context.locale
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { adoptToolkitStyles, setToolkitShellReady } from '../shared/index.ts'
import { NS, en, zh, type ToolkitUiKey } from './locales.ts'
import { ToolkitHeaderAction } from './Shell.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-toolkit-ui': ToolkitUiKey
  }
}

export const inject = ['slots', 'locale']

type HeaderActionProps = PropsRuntime<'conversation.session.header.actions'> &
  PropsLocale<'dsh-toolkit-ui'>

export function apply(ctx: ClientContext): void {
  adoptToolkitStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-toolkit-ui: dictionaries')
  ctx.effect(() => {
    setToolkitShellReady(true)
    return () => setToolkitShellReady(false)
  }, 'dsh-toolkit-ui: shell-ready')

  ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'dsh-toolkit-ui',
      order: -100,
      locale: NS,
      inject: () => ({}),
    }, (props: HeaderActionProps) => <ToolkitHeaderAction {...props} />),
  )
}
