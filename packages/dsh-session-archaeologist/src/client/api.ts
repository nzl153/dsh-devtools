/** Client-side HTTP wrapper for the host API. */
import type {
  Excerpt,
  IndexStatus,
  SearchFilters,
  SearchResponse,
  SessionTimeline,
} from '../core/types.ts'

const API = '/plugins/dsh-session-archaeologist/api'

export type ArchEnvelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }

async function call<T>(method: string, body: unknown, signal?: AbortSignal): Promise<ArchEnvelope<T>> {
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
  return value as ArchEnvelope<T>
}

export interface ExcerptSelectionRequest {
  sessionId: string
  hitIds: number[]
}

export interface ExcerptRequest extends Partial<{
  maxChars: number
  maxTokens: number
  contextRadius: number
}> {
  selections: ExcerptSelectionRequest[]
}

export interface ContextResult {
  delivered: boolean
  reason?: string
  mode: 'inject' | 'steer'
}

export const archApi = {
  status(signal?: AbortSignal): Promise<ArchEnvelope<IndexStatus>> {
    return call<IndexStatus>('status', {}, signal)
  },
  search(query: string, filters?: SearchFilters, limit = 50, signal?: AbortSignal): Promise<ArchEnvelope<SearchResponse>> {
    return call<SearchResponse>('search', { query, filters, limit }, signal)
  },
  index(sessionId?: string): Promise<ArchEnvelope<unknown>> {
    return call('index', { sessionId }, undefined)
  },
  reindex(): Promise<ArchEnvelope<unknown>> {
    return call('reindex', {}, undefined)
  },
  deleteIndex(): Promise<ArchEnvelope<{ cleared: boolean }>> {
    return call('delete-index', {}, undefined)
  },
  exclude(sessionId?: string, workspace?: string, unexclude = false): Promise<ArchEnvelope<IndexStatus>> {
    return call<IndexStatus>('exclude', { sessionId, workspace, unexclude }, undefined)
  },
  timeline(sessionId: string): Promise<ArchEnvelope<SessionTimeline>> {
    return call<SessionTimeline>('timeline', { sessionId }, undefined)
  },
  excerpt(request: ExcerptRequest): Promise<ArchEnvelope<Excerpt>> {
    return call<Excerpt>('excerpt', request, undefined)
  },
  context(sessionId: string, text: string, mode: 'inject' | 'steer' = 'inject'): Promise<ArchEnvelope<ContextResult>> {
    return call<ContextResult>('context', { sessionId, text, mode }, undefined)
  },
}