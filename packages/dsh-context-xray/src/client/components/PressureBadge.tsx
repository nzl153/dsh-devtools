import type { PressureInfo } from '../../core/types.ts'
import type { XrayKey } from '../locales.ts'

export function PressureBadge({
  pressure,
  t,
}: {
  pressure: PressureInfo
  t: (key: XrayKey) => string
}) {
  if (!pressure.level) return null
  const labelKey = `pressure.${pressure.level}` as XrayKey
  return (
    <span className={`xray-pressure-badge xray-pressure-${pressure.level}`} data-pressure={pressure.level}>
      {t(labelKey)}
    </span>
  )
}