/**
 * Client-side wrapper for the gallery host API.
 */
import type {
  ConfigPayload,
  GalleryEnvelope,
  GallerySession,
  PreviewPayload,
  RefreshResult,
} from '../core/types.ts'

const API = '/plugins/dsh-output-gallery/api'

export type GalleryApi = {
  list(sessionId: string, signal?: AbortSignal): Promise<GalleryEnvelope<{ session: GallerySession | null }>>
  refresh(sessionId: string, turn?: number, signal?: AbortSignal): Promise<GalleryEnvelope<RefreshResult>>
  preview(sessionId: string, path: string, signal?: AbortSignal): Promise<GalleryEnvelope<PreviewPayload>>
  pin(sessionId: string, path: string, pinned: boolean, signal?: AbortSignal): Promise<GalleryEnvelope<{ session: GallerySession }>>
  sessions(signal?: AbortSignal): Promise<GalleryEnvelope<{ sessions: Array<{ sessionId: string; workspace: string; lastScanAt: string }> }>>
  config(sessionId: string, signal?: AbortSignal): Promise<GalleryEnvelope<ConfigPayload>> 
  clear(sessionId: string): Promise<GalleryEnvelope<{ cleared: boolean; sessionId: string | null }>>
}

async function call<T>(method: string, body: unknown, signal?: AbortSignal): Promise<GalleryEnvelope<T>> {
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
  return value as GalleryEnvelope<T>
}

export const galleryApi: GalleryApi = {
  list(sessionId, signal) {
    return call('list', { sessionId }, signal)
  },
  refresh(sessionId, turn, signal) {
    return call('refresh', { sessionId, turn }, signal)
  },
  preview(sessionId, path, signal) {
    return call('preview', { sessionId, path }, signal)
  },
  pin(sessionId, path, pinned, signal) {
    return call('pin', { sessionId, path, pinned }, signal)
  },
  sessions(signal) {
    return call('sessions', {}, signal)
  },
  config(sessionId, signal) {
    return call('config', { sessionId }, signal)
  },
  clear(sessionId) {
    return call('clear', { sessionId }, undefined)
  },
}