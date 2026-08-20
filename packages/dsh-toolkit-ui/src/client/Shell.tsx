import { useEffect, useState } from 'react'
import { Button, IconPanelLeftOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  TOOLKIT_CATEGORY_LABEL,
  setToolkitOpenId,
  useToolkitEntries,
  useToolkitOpenId,
} from '../shared/index.ts'
import type { ToolkitUiKey } from './locales.ts'

export type ToolkitHeaderActionProps = PropsRuntime<'conversation.session.header.actions'> &
  PropsLocale<'dsh-toolkit-ui'>

export function ToolkitHeaderAction({ sessionId, t, useWorkspaces, inputActions }: ToolkitHeaderActionProps) {
  const entries = useToolkitEntries()
  const openId = useToolkitOpenId()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (openId) setMenuOpen(false)
  }, [openId])

  const quick = entries.filter((entry) => entry.quick).sort((a, b) => a.order - b.order).slice(0, 3)
  const attention = entries.filter((entry) => {
    const state = entry.getState?.(sessionId) ?? entry.state
    return state === 'warning' || state === 'error' || state === 'ongoing'
  }).length

  const categories: Array<'observe' | 'workspace' | 'experiment'> = ['observe', 'workspace', 'experiment']

  return (
    <div className="dsh-tk dsh-tk-toolbar">
      {quick.map((entry) => (
        <div key={entry.id} className="dsh-tk-toolbar-slot">
          {entry.renderQuick(sessionId)}
        </div>
      ))}
      <div className="dsh-tk-toolbar-slot" style={{ position: 'relative' }}>
        <Button
          variant="ghost"
          size="sm"
          icon={<IconPanelLeftOutline16 />}
          className="dsh-tk-toolkit-button"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {t('toolkit' as ToolkitUiKey)}
          {attention > 0 ? <span className="dsh-tk-toolkit-count">{attention}</span> : null}
        </Button>
        {menuOpen ? (
          <>
            <div className="dsh-tk-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="dsh-tk-popover">
              {categories.map((category) => {
                const group = entries.filter((entry) => entry.category === category)
                if (group.length === 0) return null
                return (
                  <div className="dsh-tk-popover-group" key={category}>
                    <span className="dsh-tk-popover-group-title">
                      {TOOLKIT_CATEGORY_LABEL[category]}
                    </span>
                    {group.map((entry) => (
                      <div key={entry.id} className="dsh-tk-popover-entry">
                        {entry.renderRow(sessionId)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </>
        ) : null}
      </div>
      {(() => {
        const active = entries.find((entry) => entry.id === openId)
        if (!active) return null
        return active.renderPanel(sessionId, () => setToolkitOpenId(null), { useWorkspaces, inputActions })
      })()}
    </div>
  )
}
