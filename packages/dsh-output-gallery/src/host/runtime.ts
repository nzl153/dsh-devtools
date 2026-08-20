/**
 * Gallery runtime: coordinates store + scanner + indexer for a session.
 * Used by the HTTP API and the turn/end hook. This is host-only; the core
 * indexer and scanner remain importable without DSH.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-session'
import { scanWorkspace } from './scanner.ts'
import { indexScan, emptySession, type ScanFile } from '../core/indexer.ts'
import { normalizeKey } from '../core/version.ts'
import { buildPreview } from './preview.ts'
import { applyRelatedCommands, type EventLike } from '../core/relations.ts'
import type { GalleryStore } from './store.ts'
import type { GalleryConfig, GallerySession, PreviewPayload, RefreshResult } from '../core/types.ts'
import { DEFAULT_CONFIG } from '../core/filter.ts'

type AnySession = {
  id: string
  header?: { cwd?: string }
  cwd?: string
  workspace?: string
  events?: readonly EventLike[]
}

export class GalleryRuntime {
  constructor(
    private readonly ctx: Context,
    private readonly store: GalleryStore,
    private readonly config: GalleryConfig,
  ) {}

  private configOverride: GalleryConfig | null = null

  setConfig(config: GalleryConfig): void {
    this.configOverride = config
  }

  currentConfig(): GalleryConfig {
    return this.configOverride ?? this.config
  }

  async refresh(sessionId: string, turn?: number): Promise<RefreshResult> {
    const session = this.findSession(sessionId)
    if (!session) throw new Error(`session not found: ${sessionId}`)
    const workspace = this.workspaceFor(session)
    if (!workspace) throw new Error(`session has no workspace: ${sessionId}`)

    const prev = await this.store.read(sessionId)
    const resolvedTurn = turn ?? (prev?.lastScannedTurn ?? 0) + 1
    const config = this.currentConfig()
    const scanned = await scanWorkspace({ workspace, turn: resolvedTurn, config })

    const base = prev ?? emptySession(sessionId, workspace, resolvedTurn)
    const result = indexScan(base, scanned.files, { config: scanned.config, turn: resolvedTurn, workspace })
    // Preserve the workspace from the session, not just the old store.
    result.session.workspace = workspace
    // Attach the latest related command from this session's live event log.
    const sessionWithRelations = applyRelatedCommands(result.session, session.events ?? [])
    await this.store.write(sessionWithRelations)
    return {
      sessionId,
      scannedFiles: scanned.files.length,
      added: result.added,
      changed: result.changed,
      removed: result.removed,
      files: sessionWithRelations.files,
    }
  }

  /** Set (or clear) the user's deliverable pin for a tracked file. */
  async setPinned(sessionId: string, path: string, pinned: boolean): Promise<GallerySession> {
    const session = await this.store.read(sessionId)
    if (!session) throw new Error(`session not found: ${sessionId}`)
    const key = normalizeKey(path)
    if (pinned && !session.files.some((f) => normalizeKey(f.path) === key)) {
      throw new Error(`file not tracked: ${path}`)
    }
    const pins = { ...(session.pins ?? {}), [key]: pinned }
    const updated: GallerySession = {
      ...session,
      pins,
      files: session.files.map((f) => ({
        ...f,
        pinned: pins[normalizeKey(f.path)] === true,
      })),
    }
    await this.store.write(updated)
    return updated
  }

  async list(sessionId: string): Promise<GallerySession | null> {
    return this.store.read(sessionId)
  }

  async listSessions(): Promise<Array<{ sessionId: string; workspace: string; lastScanAt: string }>> {
    return this.store.listSessions()
  }

  async preview(sessionId: string, path: string): Promise<PreviewPayload> {
    const session = await this.store.read(sessionId)
    if (!session) throw new Error(`session not found: ${sessionId}`)
    const file = session.files.find((f) => f.path === path || f.path.replace(/\\/g, '/') === path.replace(/\\/g, '/'))
    if (!file) throw new Error(`file not tracked: ${path}`)
    const config = this.currentConfig()
    return buildPreview(file, config, session.workspace)
  }

  async getConfig(sessionId: string): Promise<{ config: GalleryConfig; source: 'default' | 'file' | 'runtime'; configPath: string | null }> {
    const session = this.findSession(sessionId)
    if (session) {
      const workspace = this.workspaceFor(session)
      if (workspace) {
        const scanned = await scanWorkspace({ workspace, turn: 0 })
        if (scanned.configSource === 'file') {
          return { config: this.currentConfig(), source: 'file', configPath: scanned.configPath }
        }
      }
    }
    return { config: this.currentConfig(), source: this.configOverride ? 'runtime' : 'default', configPath: null }
  }

  async clear(sessionId?: string): Promise<void> {
    await this.store.clear(sessionId)
  }

  private findSession(sessionId: string): AnySession | null {
    const sessions = (this.ctx.get('sessions') as any)?.get?.(sessionId) ?? null
    return sessions as AnySession | null
  }

  private workspaceFor(session: AnySession): string | undefined {
    return session.header?.cwd ?? session.cwd ?? session.workspace
  }
}

/** Convenience for tests/E2E: run a scan+index without DSH. */
export async function runStandaloneIndex(
  store: GalleryStore,
  workspace: string,
  sessionId: string,
  turn: number,
  config?: GalleryConfig,
): Promise<RefreshResult & { config: GalleryConfig }> {
  const prev = await store.read(sessionId)
  const base = prev ?? emptySession(sessionId, workspace, turn)
  const scanned = await scanWorkspace({ workspace, turn, config })
  const result = indexScan(base, scanned.files, { config: scanned.config, turn, workspace })
  result.session.workspace = workspace
  await store.write(result.session)
  return {
    sessionId,
    scannedFiles: scanned.files.length,
    added: result.added,
    changed: result.changed,
    removed: result.removed,
    files: result.session.files,
    config: scanned.config,
  }
}