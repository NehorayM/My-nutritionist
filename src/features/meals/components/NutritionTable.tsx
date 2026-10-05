import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '@/components/ui'
import { NUTRIENTS } from '@/domain/nutrients'
import { formatNutrient } from '@/lib/format'
import { MICRO_KEYS, type NutrientKey, type NutrientProfile } from '@/types'
import { portionProfile } from '../model/foods'
import { formatPortionGrams } from '../model/portion'

const MAIN_KEYS: readonly NutrientKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber']
const MORE_KEYS: readonly NutrientKey[] = ['sugars', 'saturatedFat', 'sodium', ...MICRO_KEYS]

interface NutritionTableProps {
  per100g: NutrientProfile
  /** Grams of the chosen portion, or null while the amount is invalid. */
  grams: number | null
}

function Rows({ keys, per100g, portion }: { keys: readonly NutrientKey[]; per100g: NutrientProfile; portion: NutrientProfile | null }) {
  return keys.map((key) => (
    <tr key={key} className="border-t border-border/60">
      <th scope="row" className="py-1.5 pr-2 text-left font-medium text-text">
        {NUTRIENTS[key].label}
      </th>
      <td className="py-1.5 pl-2 text-right tabular-nums text-text-muted">{formatNutrient(key, per100g[key])}</td>
      <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-text">{portion ? formatNutrient(key, portion[key]) : '—'}</td>
    </tr>
  ))
}

/** Nutrition per 100 g and for the chosen portion: macros first, the rest behind "More nutrients". */
export function NutritionTable({ per100g, grams }: NutritionTableProps) {
  const [more, setMore] = useState(false)
  const moreId = useId()
  const portion = grams === null ? null : portionProfile(per100g, grams)
  const shown = more ? [...MAIN_KEYS, ...MORE_KEYS] : MAIN_KEYS
  const unknown = shown.some((key) => per100g[key] === null)

  return (
    <div className="space-y-2">
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">Nutrition facts</caption>
        <colgroup>
          <col />
          <col className="w-[28%]" />
          <col className="w-[30%]" />
        </colgroup>
        <thead>
          <tr className="text-xs text-text-muted">
            <th scope="col" className="pb-1 text-left font-semibold">
              Nutrient
            </th>
            <th scope="col" className="pb-1 pl-2 text-right font-semibold">
              Per 100 g
            </th>
            <th scope="col" className="pb-1 pl-2 text-right font-semibold">
              {grams === null ? 'Portion' : `In ${formatPortionGrams(grams)}`}
            </th>
          </tr>
        </thead>
        <tbody>
          <Rows keys={MAIN_KEYS} per100g={per100g} portion={portion} />
        </tbody>
        <tbody id={moreId} hidden={!more}>
          <Rows keys={MORE_KEYS} per100g={per100g} portion={portion} />
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={more}
          aria-controls={moreId}
          onClick={() => setMore((value) => !value)}
          className="hit-area inline-flex items-center gap-1 rounded-full text-sm font-semibold text-primary"
        >
          More nutrients
          <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', more && 'rotate-180')} />
        </button>
        {unknown ? <p className="text-xs text-text-muted">— not reported for this food</p> : null}
      </div>
    </div>
  )
}
