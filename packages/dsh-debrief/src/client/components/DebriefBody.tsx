/** Shared body for a turn or session debrief (used by card and panel). */
import { useState } from 'react'
import type { Debrief } from '../../core/types.ts'
import { buildContinuePrompt, summarizeDebrief } from '../../core/actions.ts'
import { formatDuration, formatTokens } from '../../core/format.ts'
import type { DebriefKey } from '../locales.ts'
import {
  ChangedFilesList,
  CommandList,
  MetricRow,
  SectionTitle,
  TestSummary,
  ToolTable,
  UnresolvedList,
} from './shared.tsx'

export function DebriefBody({
  debrief,
  t,
  onContinue,
}: {
  debrief: Debrief
  t: (key: DebriefKey) => string
  onContinue?: (draft: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [showAllFiles, setShowAllFiles] = useState(false)
  const [showAllFailed, setShowAllFailed] = useState(false)
  const [draftInserted, setDraftInserted] = useState(false)

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(summarizeDebrief(debrief))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  const continueDraft = (): void => {
    if (!onContinue) return
    onContinue(buildContinuePrompt(debrief))
    setDraftInserted(true)
    setTimeout(() => setDraftInserted(false), 1500)
  }

  const changedCount = debrief.changedFiles.length
  const failedCount = debrief.failedCommands.length

  return (
    <div className="dsh-debrief-root">
      <MetricRow label={t('duration')} value={formatDuration(debrief.durationMs)} />
      {debrief.kind === 'session' ? (
        <MetricRow label={t('turns')} value={debrief.turnCount} />
      ) : null}
      <MetricRow label={t('steps')} value={debrief.stepCount} />
      <MetricRow label={t('toolCalls')} value={debrief.toolCallCount} />
      <MetricRow label={t('commands')} value={debrief.commandCount} />
      {debrief.tokens.usageReports > 0 ? (
        <>
          <MetricRow label={t('tokensIn')} value={formatTokens(debrief.tokens.inputTokens)} />
          <MetricRow label={t('tokensOut')} value={formatTokens(debrief.tokens.outputTokens)} />
          {debrief.tokens.cacheReadTokens > 0 ? (
            <MetricRow label={t('tokensCacheRead')} value={formatTokens(debrief.tokens.cacheReadTokens)} />
          ) : null}
          {debrief.tokens.cacheWriteTokens > 0 ? (
            <MetricRow label={t('tokensCacheWrite')} value={formatTokens(debrief.tokens.cacheWriteTokens)} />
          ) : null}
          {debrief.tokens.contextWindow !== null ? (
            <MetricRow label={t('contextWindow')} value={formatTokens(debrief.tokens.contextWindow)} />
          ) : null}
        </>
      ) : null}

      {debrief.tests.length > 0 ? (
        <>
          <SectionTitle>{t('testsPassed')}</SectionTitle>
          <TestSummary tests={debrief.tests} />
        </>
      ) : null}

      {changedCount > 0 ? (
        <>
          <SectionTitle>{t('changedFiles')} ({changedCount})</SectionTitle>
          <ChangedFilesList files={debrief.changedFiles} limit={showAllFiles ? undefined : 8} />
        </>
      ) : null}

      {debrief.filesRead.length > 0 ? (
        <>
          <SectionTitle>{t('filesRead')} ({debrief.filesRead.length})</SectionTitle>
          <ul className="dsh-debrief-list">
            {debrief.filesRead.slice(0, showAllFiles ? undefined : 8).map((file) => (
              <li key={`${file.toolName}:${file.path}`} className="dsh-debrief-list-item">
                <span className="dsh-debrief-tag dsh-debrief-tag-est">{file.toolName}</span>
                <code>{file.path}</code>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {failedCount > 0 ? (
        <>
          <SectionTitle>{t('failedCommands')} ({failedCount})</SectionTitle>
          <CommandList commands={debrief.failedCommands} limit={showAllFailed ? undefined : 6} />
        </>
      ) : null}

      {debrief.toolStats.length > 0 ? (
        <>
          <SectionTitle>{t('perTool')}</SectionTitle>
          <ToolTable stats={debrief.toolStats} />
        </>
      ) : null}

      {debrief.unresolved.length > 0 ? (
        <>
          <SectionTitle>{t('unresolved')}</SectionTitle>
          <UnresolvedList items={debrief.unresolved} limit={showAllFailed ? undefined : 6} />
        </>
      ) : null}

      {debrief.notes.length > 0 ? (
        <div className="dsh-debrief-note">
          {debrief.notes.map((note) => (
            <div key={note}>• {note}</div>
          ))}
        </div>
      ) : null}

      <div className="dsh-debrief-actions">
        <button type="button" onClick={() => void copy()}>
          {copied ? t('copied') : t('copySummary')}
        </button>
        {changedCount > 0 ? (
          <button type="button" onClick={() => setShowAllFiles((v) => !v)}>
            {showAllFiles ? t('collapseFiles') : t('viewFiles')}
          </button>
        ) : null}
        {failedCount > 0 ? (
          <button type="button" onClick={() => setShowAllFailed((v) => !v)}>
            {showAllFailed ? t('collapseFailed') : t('viewFailed')}
          </button>
        ) : null}
        {debrief.unresolved.length > 0 && onContinue ? (
          <button type="button" onClick={continueDraft}>
            {draftInserted ? t('draftInserted') : t('continueWork')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function titleFor(debrief: Debrief, t: (key: DebriefKey) => string): string {
  return debrief.kind === 'session' ? t('sessionTitle') : `${t('turnTitle')} #${debrief.turn}`
}

export function isSessionDebrief(d: Debrief): d is Extract<Debrief, { kind: 'session' }> {
  return d.kind === 'session'
}

export function isTurnDebrief(d: Debrief): d is Extract<Debrief, { kind: 'turn' }> {
  return d.kind === 'turn'
}