/**
 * Pure client-side filter logic for the timeline panel.
 *
 * Kept free of React so it can be unit-tested directly.
 */
import type { FileChange } from '../core/types.ts'

export type FilterMode = 'all' | 'agent' | 'baseline' | 'conflict'

export interface FilterState {
  readonly fileFilter: string
  readonly mode: FilterMode
  /** Turn number to filter by; null disables the turn filter. */
  readonly turn: number | null
}

export function passesFilter(c: FileChange, state: FilterState): boolean {
  if (state.fileFilter && !c.relPath.includes(state.fileFilter)) return false
  if (state.turn !== null && c.source !== null && c.source.turn !== state.turn) return false
  if (state.mode === 'agent' && c.source === null) return false
  if (state.mode === 'baseline' && c.status !== 'modified' && c.status !== 'deleted' && c.status !== 'renamed') return false
  if (state.mode === 'conflict') {
    // Best-effort: external-edit risk is highest on modified/deleted/renamed.
    // Exact conflicts are flagged at preview time in the UI.
    return c.status === 'modified' || c.status === 'deleted' || c.status === 'renamed'
  }
  return true
}
