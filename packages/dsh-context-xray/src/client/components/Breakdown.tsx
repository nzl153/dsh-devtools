import type { ContextSnapshot } from '../../core/types.ts'
import { formatTokens } from '../../core/turn-diff/diff.ts'
import type { XrayKey } from '../locales.ts'

export function Breakdown({
  snapshot,
  t,
}: {
  snapshot: ContextSnapshot
  t: (key: XrayKey) => string
}) {
  const total = snapshot.categories.reduce((sum, c) => sum + c.tokens, 0)
  return (
    <div data-xray-breakdown>
      <h3>{t('categories')}</h3>
      {snapshot.categories.map((cat) => {
        const share = total > 0 ? Math.round((cat.tokens / total) * 1000) / 10 : 0
        return (
          <div key={cat.key}>
            <div className="xray-category-row">
              <span>{cat.label}</span>
              <span>
                {formatTokens(cat.tokens)} {t('tokens')} · {share}% · {t(cat.precision === 'exact' ? 'exact' : cat.precision === 'unavailable' ? 'unavailable' : 'estimated')}
              </span>
            </div>
            <div className="xray-bar">
              <span style={{ width: `${Math.min(100, share)}%` }} />
            </div>
          </div>
        )
      })}
      {(snapshot.totalTokens !== null || snapshot.pressure.projectedTokens !== null) && (
        <div className="xray-meta">
          {snapshot.totalTokens !== null && (
            <span>{t('providerTotal')}: {formatTokens(snapshot.totalTokens)}</span>
          )}
          {snapshot.pressure.pressureTokens !== null && (
            <span>{t('pressureTokens')}: {formatTokens(snapshot.pressure.pressureTokens)}</span>
          )}
          {snapshot.pressure.projectedTokens !== null && (
            <span>{t('projectedTokens')}: {formatTokens(snapshot.pressure.projectedTokens)}</span>
          )}
          {snapshot.contextWindow !== null && (
            <span>{t('contextWindow')}: {formatTokens(snapshot.contextWindow)}</span>
          )}
        </div>
      )}
    </div>
  )
}