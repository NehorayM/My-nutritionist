import { NUTRIENTS } from '@/domain/nutrients'
import { formatNutrient } from '@/lib/format'
import { MICRO_KEYS, type NutrientKey, type NutrientTotals } from '@/types'
import { knownValue, missingDataNote } from '../model/summary'

/** Detail nutrients of a meal beyond calories and the main macros. */
const DETAIL_KEYS: readonly NutrientKey[] = ['fiber', 'sugars', 'saturatedFat', 'sodium', ...MICRO_KEYS]

interface MealDetailsProps {
  totals: NutrientTotals
  id: string
  hidden: boolean
}

/** Fiber, sugars, saturated fat, sodium and the micronutrients the meal's foods report. */
export function MealDetails({ totals, id, hidden }: MealDetailsProps) {
  const known = DETAIL_KEYS.filter((key) => knownValue(totals[key]) !== null)
  const note = missingDataNote(totals, DETAIL_KEYS)

  return (
    <div id={id} hidden={hidden} className="space-y-2 px-5 pb-4">
      {known.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-sm">
          {known.map((key) => (
            <div key={key} className="flex items-baseline justify-between gap-2">
              <dt className="text-text-muted">{NUTRIENTS[key].label}</dt>
              <dd className="font-semibold tabular-nums text-text">{formatNutrient(key, totals[key].value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? <p className="text-xs text-text-muted">{note}</p> : null}
    </div>
  )
}
