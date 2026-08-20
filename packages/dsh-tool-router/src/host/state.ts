/**
 * Per-agent mutable router state.
 *
 * This state is process-local and intentionally tiny: last prompt text,
 * currently requested fallback categories, and per-step bookkeeping for stats.
 */
import type { RoutePlan, StatsRecord, ToolCategory } from '../core/types.ts'

export interface AgentRouterState {
  lastPrompt: string
  enabledCategories: Set<ToolCategory>
  fallbackStepsLeft: number
  /** Visible names for the current/previous assembly, used to compute unused tools. */
  lastPlan?: RoutePlan
  /** Tool names actually used after the last assembly. */
  usedInStep: Set<string>
  /** Pending stats record finalized at step/end. */
  pendingRecord?: StatsRecord
}

export class RouterStateStore {
  private readonly states = new Map<string, AgentRouterState>()

  get(agentId: string): AgentRouterState {
    let state = this.states.get(agentId)
    if (state === undefined) {
      state = {
        lastPrompt: '',
        enabledCategories: new Set(),
        fallbackStepsLeft: 0,
        usedInStep: new Set(),
      }
      this.states.set(agentId, state)
    }
    return state
  }

  delete(agentId: string): void {
    this.states.delete(agentId)
  }

  clear(): void {
    this.states.clear()
  }
}