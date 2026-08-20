// dsh-dev-loop：把最近一次失败输出发送给当前 Agent。
// 使用 @deepseek-ai/dsh-agent 的 agent.followup()（identified + source 消息）。
// 若无法获取 live agent 或发送失败，调用方应回退到“复制错误文本”。

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

export interface SendErrorResult {
  ok: boolean
  method: 'agent-followup' | 'fallback-copy'
  message: string
}

export function sendErrorToAgent(
  ctx: Context,
  sessionId: string,
  text: string,
): SendErrorResult {
  if (!sessionId || !text.trim()) {
    return { ok: false, method: 'fallback-copy', message: '没有可发送的错误文本' }
  }
  const trimmed = text.length > 12000 ? `${text.slice(0, 12000)}\n… [truncated]` : text
  try {
    const agent = ctx.agents?.get(sessionId as import('@deepseek-ai/dsh-session').SessionId)
    if (!agent) {
      return { ok: false, method: 'fallback-copy', message: '当前会话没有 live agent，请复制错误文本后手动发送' }
    }
    const message = createUserMessage({
      content: [{ type: 'text', text: `[dsh-dev-loop] 最近一次命令失败输出（bounded context）：\n\n${trimmed}` }],
      source: {
        kind: 'plugin',
        plugin: 'dsh-dev-loop',
        form: 'notice',
        summary: `dev-loop 失败输出已发送给当前 Agent（${Math.min(trimmed.length, 12000)} chars）`,
      },
    })
    agent.followup(message)
    return { ok: true, method: 'agent-followup', message: '已作为 follow-up 消息发送给当前 Agent' }
  } catch (error: unknown) {
    return {
      ok: false,
      method: 'fallback-copy',
      message: `发送失败（${error instanceof Error ? error.message : String(error)}），请复制错误文本`,
    }
  }
}