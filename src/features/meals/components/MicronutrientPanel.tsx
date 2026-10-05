import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { cn, ProgressBar } from '@/components/ui'
import type { MicronutrientCoverage } from '@/domain/nutrition'
import { NUTRIENTS } from '@/domain/nutrients'
import { formatNutrient } from '@/lib/format'
import type { NutrientTotals } from '@/types'
import { knownValue } from '../model/summary'

interface MicronutrientPanelProps {
  coverage: MicronutrientCoverage
  totals: NutrientTotals
  entryCount: number
}

function completenessNote(coverage: MicronutrientCoverage, entryCount: number): string {
  if (entryCount === 0 || coverage.dataCompleteness === null) return 'Log food to see how this day covers these nutrients.'
  const complete = Math.round(coverage.dataCompleteness * entryCount)
  if (complete === entryCount) return 'Every logged food reports all of these nutrients.'
  const foods = entryCount === 1 ? 'food' : 'foods'
  return `${complete} of ${entryCount} logged ${foods} report all of these nutrients. Amounts that aren’t reported are left out, so totals may be higher.`
}

/** Expandable coverage of iron, calcium, vitamin C, vitamin D and potassium, transparent about missing data. */
export function MicronutrientPanel({ coverage, totals, entryCount }: MicronutrientPanelProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const someMissing = entryCount > 0 && coverage.items.some((item) => !item.dataComplete)

  return (
    <div className="border-t border-border/70">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-3 rounded-b-card px-5 py-3 text-left transition-colors hover:bg-text/4"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-text">Micronutrient coverage</span>
          <span className="block text-xs text-text-muted">
            {someMissing ? 'Some foods don’t report every micronutrient' : 'Iron, calcium, vitamins C and D, potassium'}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open} className="space-y-4 px-5 pb-5 pt-1">
        <ul className="space-y-3">
          {coverage.items.map((item) => {
            const value = knownValue(totals[item.key])
            const amount = formatNutrient(item.key, value, { unit: false })
            const target = formatNutrient(item.key, item.target)
            const missing = entryCount > 0 && !item.dataComplete
            return (
              <li key={item.key}>
                <ProgressBar
                  value={value}
                  max={item.target}
                  label={NUTRIENTS[item.key].label}
                  valueText={`${formatNutrient(item.key, value)} of ${target}${missing ? ', not reported for some foods' : ''}`}
                  tone="micro"
                  size="sm"
                  caption={
                    <span aria-hidden="true" className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-semibold text-text">{NUTRIENTS[item.key].label}</span>
                      <span className="text-text-muted">
                        {amount} / {target}
                      </span>
                    </span>
                  }
                />
                {missing ? <p className="mt-1 text-xs text-text-muted">Not reported for some foods</p> : null}
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-text-muted">{completenessNote(coverage, entryCount)}</p>
      </div>
    </div>
  )
}
