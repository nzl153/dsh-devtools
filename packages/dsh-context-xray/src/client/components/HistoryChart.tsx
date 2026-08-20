import { useMemo, useState } from 'react'
import type { SessionHistory, TurnPoint } from '../../core/types.ts'
import { diffTurns, formatSignedTokens, formatTokens } from '../../core/turn-diff/diff.ts'
import type { XrayKey } from '../locales.ts'

export function HistoryChart({
  history,
  t,
}: {
  history: SessionHistory | null
  t: (key: XrayKey) => string
}) {
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null)

  const entries = useMemo(() => [...(history?.entries ?? [])].sort((a, b) => a.turn - b.turn), [history])
  const max = useMemo(() => Math.max(1, ...entries.map((e) => e.totalTokens ?? 0)), [entries])

  const selected = entries.find((e) => e.turn === selectedTurn) ?? null
  const selectedIndex = selected ? entries.findIndex((e) => e.turn === selected.turn) : -1
  const previous = selectedIndex > 0 ? entries[selectedIndex - 1] : undefined
  const diff = selected ? diffTurns(previous, selected) : null

  if (entries.length === 0) {
    return <div className="xray-note">{t('noData')}</div>
  }

  return (
    <div>
      <h3>{t('history')}</h3>
      <div className="xray-history">
        {entries.map((entry) => (
          <button
            key={entry.turn}
            type="button"
            className={`bar${selectedTurn === entry.turn ? ' selected' : ''}`}
            style={{ height: `${Math.max(4, ((entry.totalTokens ?? 0) / max) * 100)}%` }}
            title={`Turn ${entry.turn}: ${formatTokens(entry.totalTokens ?? 0)}`}
            onClick={() => setSelectedTurn(entry.turn)}
          />
        ))}
      </div>
      <div className="xray-history-list">
        {entries.map((entry, index) => {
          const prev = index > 0 ? entries[index - 1] : undefined
          const delta = prev ? (entry.totalTokens ?? 0) - (prev.totalTokens ?? 0) : 0
          return (
            <button
              key={entry.turn}
              type="button"
              className={`xray-history-item${selectedTurn === entry.turn ? ' selected' : ''}`}
              onClick={() => setSelectedTurn(entry.turn)}
            >
              <span>Turn {entry.turn}</span>
              <span>{formatTokens(entry.totalTokens ?? 0)}</span>
              <span className="xray-history-delta">{formatSignedTokens(delta)}</span>
            </button>
          )
        })}
      </div>
      {selected && diff ? (
        <div className="xray-diff">
          <h4>Turn {selected.turn} {t('breakdown')}</h4>
          {diff.deltas.length === 0 ? <div className="xray-note">{t('noData')}</div> : null}
          {diff.deltas.map((delta) => (
            <div key={delta.key} className="xray-delta-row">
              <div className="xray-delta-main">
                <span>{delta.label}</span>
                <span>
                  {formatTokens(delta.tokens)} · {formatSignedTokens(delta.delta)}
                </span>
              </div>
              <div className="xray-delta-note">{t(delta.explanationKey as XrayKey)}</div>
            </div>
          ))}
          {diff.majorGain.length > 0 ? (
            <div className="xray-note">{t('majorGain')}: {diff.majorGain.join(', ')}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function turnDelta(prev: TurnPoint | undefined, next: TurnPoint): number {
  return (next.totalTokens ?? 0) - (prev?.totalTokens ?? 0)
}