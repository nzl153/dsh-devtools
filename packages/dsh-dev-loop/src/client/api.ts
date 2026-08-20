// dsh-dev-loop：client 侧 HTTP wrapper for the host API。
import type { DevLoopSummary, CommandRun, DevLoopConfig, WatchStatus } from '../core/types.ts'

const API = '/plugins/dsh-dev-loop/api'

export type DevLoopEnvelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }

async function call<T>(method: string, body: unknown, signal?: AbortSignal): Promise<DevLoopEnvelope<T>> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const value: unknown = await res.json().catch(() => undefined)
  if (!res.ok) {
    const error = typeof value === 'object' && value !== null && 'error' in value
      ? (value as { error: { code: string; message: string } }).error
      : { code: 'http-' + res.status, message: 'HTTP ' + res.status }
    return { ok: false, error: { ...error, details: {} } }
  }
  return value as DevLoopEnvelope<T>
}

export interface RunActionResult {
  run: CommandRun
  needsTrust: boolean
  trusted: boolean
  config: DevLoopConfig | null
  warning?: string
}

export const devLoopApi = {
  summary(root: string | undefined, signal?: AbortSignal): Promise<DevLoopEnvelope<DevLoopSummary>> {
    return call<DevLoopSummary>('summary', { root: root ?? null }, signal)
  },
  run(root: string, action: string, confirmTrust = false): Promise<DevLoopEnvelope<RunActionResult>> {
    return call<RunActionResult>('run', { root, action, confirmTrust })
  },
  cancel(id: string): Promise<DevLoopEnvelope<{ cancelled: boolean }>> {
    return call('cancel', { id })
  },
  confirmTrust(root: string, name?: string): Promise<DevLoopEnvelope<{ trusted: boolean; root: string }>> {
    return call('confirm-trust', { root, name })
  },
  sendError(sessionId: string, root: string, action?: string): Promise<DevLoopEnvelope<{ ok: boolean; method: 'agent-followup' | 'fallback-copy'; message: string }>> {
    return call('send-error', { sessionId, root, action })
  },
  watchStart(root: string): Promise<DevLoopEnvelope<{ status: WatchStatus | null }>> {
    return call('watch-start', { root })
  },
  watchStop(root: string): Promise<DevLoopEnvelope<{ status: WatchStatus | null }>> {
    return call('watch-stop', { root })
  },
  generatePreset(
    framework: 'node' | 'python' | 'rust' | 'dotnet' | 'godot',
    name: string,
    root?: string,
  ): Promise<DevLoopEnvelope<{ text: string; framework: string; name: string }>> {
    return call('generate-preset', { framework, name, root: root ?? '' })
  },
}
