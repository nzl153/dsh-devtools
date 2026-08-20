/**
 * Extract lightweight route signals from DSH session messages.
 */
import type { Message } from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { RouteInput } from '../core/types.ts'

const RECENT_MESSAGE_COUNT = 6
const MAX_TEXT_CHARS = 4000

export function messageToRouteText(message: Message): string {
  const parts: string[] = []
  for (const block of message.content) {
    switch (block.type) {
      case 'text':
        parts.push(block.text)
        break
      case 'reasoning':
        parts.push(block.text)
        break
      case 'tool-call':
        parts.push(`tool:${block.name}`)
        break
      case 'tool-result': {
        for (const content of block.content) {
          if (content.type === 'text') parts.push(content.text)
          else if (content.type === 'reasoning') parts.push(content.text)
        }
        if (block.isError === true) parts.push('tool-error')
        break
      }
    }
  }
  return parts.join('\n').slice(0, MAX_TEXT_CHARS)
}

export function buildRouteInput(agent: Agent, lastPrompt: string): RouteInput {
  const recent: string[] = []
  const messages = agent.session.deriveMessages()
  const start = Math.max(0, messages.length - RECENT_MESSAGE_COUNT)
  for (let i = start; i < messages.length; i += 1) {
    recent.push(messageToRouteText(messages[i]!))
  }
  return {
    prompt: lastPrompt,
    recent: recent.join('\n'),
  }
}