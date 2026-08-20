/** Client-side HTTP wrapper for the host API. */
import type { ContextSnapshot, DiagnosticExport, SessionHistory } from '../core/types.ts'

const API = '/plugins/dsh-context-xray/api'

export type XrayEnvelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }

async function call<T>(method: string, body: unknown, signal?: AbortSignal): Promise<XrayEnvelope<T>> {
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
  return value as XrayEnvelope<T>
}

export const xrayApi = {
  snapshot(sessionId: string, includeBody = false, signal?: AbortSignal): Promise<XrayEnvelope<ContextSnapshot>> {
    return call<ContextSnapshot>('snapshot', { sessionId, includeBody }, signal)
  },
  history(sessionId: string, signal?: AbortSignal): Promise<XrayEnvelope<{ history: SessionHistory | null }>> {
    return call('history', { sessionId }, signal)
  },
  clear(sessionId?: string): Promise<XrayEnvelope<{ cleared: boolean; sessionId: string | null }>> {
    return call('clear', { sessionId }, undefined)
  },
  diagnostic(sessionId: string, signal?: AbortSignal): Promise<XrayEnvelope<DiagnosticExport>> {
    return call('diagnostic', { sessionId }, signal)
  },
}