/**
 * Client-side HTTP wrapper for the dsh-time-machine host API.
 */
import type {
  FileChange,
  SessionRecord,
} from '../core/types.ts'
import type { RestorePreviewFile } from '../core/restore.ts'
import type { RestoreTargetShape } from '../core/engine.ts'

const API = '/plugins/dsh-time-machine/api'

export type TmEnvelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }

async function call<T>(method: string, body: unknown): Promise<TmEnvelope<T>> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const value: unknown = await res.json().catch(() => undefined)
  if (!res.ok) {
    const error = typeof value === 'object' && value !== null && 'error' in value
      ? (value as { error: { code: string; message: string } }).error
      : { code: 'http-' + res.status, message: 'HTTP ' + res.status }
    return { ok: false, error: { ...error, details: {} } }
  }
  return value as TmEnvelope<T>
}

export const tmApi = {
  timeline(sessionId: string): Promise<TmEnvelope<{ record: SessionRecord | null }>> {
    return call('timeline', { sessionId })
  },
  preview(sessionId: string, target: RestoreTargetShape, includeContents = false): Promise<TmEnvelope<{ previews: RestorePreviewFile[] }>> {
    return call('preview', { sessionId, ...target, includeContents })
  },
  restore(sessionId: string, target: RestoreTargetShape, confirmed: boolean, force = false): Promise<TmEnvelope<{ performed: number; results: RestorePreviewFile[] }>> {
    return call('restore', { sessionId, ...target, confirmed, force })
  },
  saveAs(sessionId: string, relPath: string, confirmed: boolean, targetPath?: string): Promise<TmEnvelope<{ savedPath: string }>> {
    return call('save-as', { sessionId, relPath, confirmed, targetPath })
  },
  clear(sessionId?: string): Promise<TmEnvelope<{ cleared: boolean }>> {
    return call('clear', { sessionId })
  },
}

export interface TurnViewModel {
  turn: number
  startedAt: number | null
  endedAt: number | null
  toolCalls: string[]
  changes: FileChange[]
}

/** Build per-turn view models from a record (client-side derivation). */
export function buildTurns(record: SessionRecord | null): TurnViewModel[] {
  if (!record) return []
  return record.turns.map((t) => ({
    turn: t.turn,
    startedAt: t.startedAt,
    endedAt: t.endedAt,
    toolCalls: [...t.toolCalls],
    changes: [...t.changes],
  }))
}
