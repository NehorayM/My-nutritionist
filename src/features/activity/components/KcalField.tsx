import { Field, NumberInput } from '@/components/ui'
import { formatKcal, formatWeight } from '@/lib/format'
import type { UnitSystem } from '@/types'

interface KcalFieldProps {
  value: number | null
  onChange: (value: number | null) => void
  error?: string
  /** Live MET-based estimate; null when it cannot be computed. */
  estimate: number | null
  weightKg: number | null
  unitSystem: UnitSystem
}

/** Optional calories with the informational MET estimate shown live. */
export function KcalField({ value, onChange, error, estimate, weightKg, unitSystem }: KcalFieldProps) {
  const note =
    weightKg === null
      ? 'Add a weigh-in on the Progress tab to see an estimate.'
      : estimate === null
        ? 'An estimate appears once the duration is filled in.'
        : `Based on ${formatWeight(weightKg, unitSystem)} and typical values for this activity.`
  return (
    <div className="space-y-3">
      <div className="rounded-card bg-surface-2 px-4 py-3" aria-live="polite">
        <p className="text-sm font-semibold text-text">
          {estimate === null ? 'No energy estimate yet' : `≈ ${formatKcal(estimate)}`}
          {estimate === null ? null : <span className="font-medium text-text-muted"> — estimate, for information only</span>}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">{note}</p>
      </div>
      <Field
        label="Calories"
        optional
        error={error}
        hint={estimate === null ? 'Add it if a watch or machine measured it.' : 'Leave empty to save the estimate.'}
      >
        <NumberInput
          value={value}
          onValueChange={onChange}
          unit="kcal"
          placeholder={estimate === null ? undefined : String(estimate)}
        />
      </Field>
    </div>
  )
}
