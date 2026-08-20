// 跨插件轻量集成：探测其他 DSH 插件是否安装，若存在则提供跳转按钮。
// 不 import 对方源码，只探测 HTTP API 存在性，并通过点击对方已渲染的入口按钮打开。
// 对方不存在时按钮不渲染，静默降级。
import { useEffect, useState } from 'react'
import type { DebriefKey } from '../locales.ts'

type PluginId = 'dsh-time-machine' | 'dsh-context-xray' | 'dsh-debrief' | 'dsh-output-gallery' | 'dsh-dev-loop' | 'dsh-run-lab'

const PROBES: Record<PluginId, { path: string; body: Record<string, unknown> }> = {
  'dsh-time-machine': { path: '/plugins/dsh-time-machine/api/timeline', body: {} },
  'dsh-context-xray': { path: '/plugins/dsh-context-xray/api/sessions', body: {} },
  'dsh-debrief': { path: '/plugins/dsh-debrief/api/settings', body: {} },
  'dsh-output-gallery': { path: '/plugins/dsh-output-gallery/api/sessions', body: {} },
  'dsh-dev-loop': { path: '/plugins/dsh-dev-loop/api/summary', body: {} },
  'dsh-run-lab': { path: '/plugins/dsh-run-lab/api/list', body: {} },
}

async function probe(id: PluginId): Promise<boolean> {
  try {
    const res = await fetch(PROBES[id].path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(PROBES[id].body),
    })
    // 404 = 未安装；其他任何响应（包括 400/500）都说明路由存在
    return res.status !== 404
  } catch {
    return false
  }
}

function clickByText(keywords: string[]): boolean {
  const buttons = [...document.querySelectorAll('button')]
  const target = buttons.find((b) => {
    const text = (b.textContent ?? '').trim()
    return keywords.some((k) => text.includes(k))
  })
  if (target) {
    target.click()
    return true
  }
  return false
}

export function CrossPluginButtons({
  t,
  showTimeMachine = false,
  showXray = false,
  showDebrief = false,
}: {
  t: (key: DebriefKey) => string
  showTimeMachine?: boolean
  showXray?: boolean
  showDebrief?: boolean
}) {
  const [available, setAvailable] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const run = async (): Promise<void> => {
      const next: Record<string, boolean> = {}
      if (showTimeMachine) next['timeMachine'] = await probe('dsh-time-machine')
      if (showXray) next['xray'] = await probe('dsh-context-xray')
      if (showDebrief) next['debrief'] = await probe('dsh-debrief')
      setAvailable(next)
    }
    void run()
  }, [showTimeMachine, showXray, showDebrief])

  return (
    <span className="dsh-debrief-cross" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {available['timeMachine'] ? (
        <button type="button" onClick={() => void clickByText(['时间机器', 'Time Machine'])}>
          {t('openTimeMachine')}
        </button>
      ) : null}
      {available['xray'] ? (
        <button type="button" onClick={() => void clickByText(['上下文', 'Context'])}>
          {t('openXray')}
        </button>
      ) : null}
    </span>
  )
}