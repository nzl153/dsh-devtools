/** Client-side HTTP wrapper for the dsh-debrief host API. */
import type { SessionDebrief, TurnDebrief, DebriefSettingsLike } from '../core/types.ts'

const API = '/plugins/dsh-debrief/api'

export type DebriefEnvelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }

async function call<T>(method: string, body: unknown, signal?: AbortSignal): Promise<DebriefEnvelope<T>> {
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
  return value as DebriefEnvelope<T>
}

export const debriefApi = {
  turn(sessionId: string, turn: number, signal?: AbortSignal): Promise<DebriefEnvelope<TurnDebrief>> {
    return call('turn', { sessionId, turn }, signal)
  },
  session(sessionId: string, signal?: AbortSignal): Promise<DebriefEnvelope<SessionDebrief>> {
    return call('session', { sessionId }, signal)
  },
  turns(sessionId: string, signal?: AbortSignal): Promise<DebriefEnvelope<{ turns: number[] }>> {
    return call('turns', { sessionId }, signal)
  },
  settings(signal?: AbortSignal): Promise<DebriefEnvelope<DebriefSettingsLike>> {
    return call('settings', {}, signal)
  },
}