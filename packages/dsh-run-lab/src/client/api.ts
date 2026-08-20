/** Client-side HTTP wrapper for the host API. Uses the same { ok, value } envelope. */
import type { Experiment, CreateExperimentInput } from '../core/types.ts'

const API = '/plugins/dsh-run-lab/api'

export type RunLabEnvelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }

async function call<T>(method: string, body: unknown, signal?: AbortSignal): Promise<RunLabEnvelope<T>> {
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
  return value as RunLabEnvelope<T>
}

export const runLabApi = {
  list(signal?: AbortSignal): Promise<RunLabEnvelope<Experiment[]>> {
    return call('list', {}, signal)
  },
  get(id: string, signal?: AbortSignal): Promise<RunLabEnvelope<Experiment>> {
    return call('get', { id }, signal)
  },
  create(input: CreateExperimentInput, signal?: AbortSignal): Promise<RunLabEnvelope<Experiment>> {
    return call('create', input, signal)
  },
  run(id: string, options?: { repeat?: number }, signal?: AbortSignal): Promise<RunLabEnvelope<Experiment>> {
    return call('run', { id, ...(options?.repeat ? { repeat: options.repeat } : {}) }, signal)
  },
  delete(id: string, signal?: AbortSignal): Promise<RunLabEnvelope<{ deleted: boolean; id: string }>> {
    return call('delete', { id }, signal)
  },
  capabilities(signal?: AbortSignal): Promise<RunLabEnvelope<{ version: string; sequential: boolean; isolation: string[]; dshTokenFeed: boolean; commandAgentDriver: boolean }>> {
    return call('capabilities', {}, signal)
  },
}
