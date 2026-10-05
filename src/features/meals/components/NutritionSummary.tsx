import { useId } from 'react'
import { Card, ProgressBar, ProgressRing, type Tone } from '@/components/ui'
import type { DailyTargets, DayTotals, MicronutrientCoverage } from '@/domain/nutrition'
import { NUTRIENTS } from '@/domain/nutrients'
import { MACRO_KEYS, type MacroKey } from '@/types'
import { amountCopy, calorieCopy, knownValue, missingDataNote } from '../model/summary'
import { MicronutrientPanel } from './MicronutrientPanel'

interface NutritionSummaryProps {
  dayLabel: string
  totals: DayTotals
  targets: DailyTargets
  coverage: MicronutrientCoverage
  entryCount: number
}

const MACRO_TONES: Record<MacroKey, Tone> = { protein: 'protein', carbs: 'carbs', fat: 'fat', fiber: 'fiber' }

/** Calorie ring, macro bars and micronutrient coverage for one day, with honest notes about missing data. */
export function NutritionSummary({ dayLabel, totals, targets, coverage, entryCount }: NutritionSummaryProps) {
  const titleId = useId()
  const calories = calorieCopy(totals.totals.calories, targets.targets.calories)
  const note = missingDataNote(totals.totals, ['calories', ...MACRO_KEYS])

  return (
    <Card as="section" aria-labelledby={titleId}>
      <h2 id={titleId} className="sr-only">
        Nutrition, {dayLabel}
      </h2>
      <div className="flex items-center gap-5 px-5 pb-2 pt-5">
        <ProgressRing
          value={knownValue(totals.totals.calories)}
          max={targets.targets.calories?.amount ?? null}
          label="Calories"
          valueText={calories.valueText}
          size={120}
          thickness={11}
        >
          <span className="flex flex-col items-center">
            <span className="text-2xl font-extrabold leading-none tracking-tight text-text">{calories.consumed}</span>
            <span className="mt-1 text-xs font-semibold text-text-muted">kcal eaten</span>
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-1">
          {calories.target ? (
            <p className="text-sm text-text-muted">
              Target <span className="font-semibold text-text">{calories.target}</span>
            </p>
          ) : null}
          {calories.status ? <p className="text-lg font-bold leading-snug tracking-tight text-text">{calories.status}</p> : null}
          {targets.mode === 'general' ? (
            <p className="text-xs text-text-muted">General wellness targets. Add your details in Profile for personal ones.</p>
          ) : null}
        </div>
      </div>
      <ul aria-label="Macronutrients" className="grid grid-cols-2 gap-x-5 gap-y-3 px-5 pb-4 pt-3">
        {MACRO_KEYS.map((key) => {
          const copy = amountCopy(key, totals.totals[key], targets.targets[key])
          return (
            <li key={key}>
              <ProgressBar
                value={copy.value}
                max={copy.max}
                label={NUTRIENTS[key].label}
                valueText={copy.valueText}
                tone={MACRO_TONES[key]}
                size="sm"
                caption={
                  <span aria-hidden="true" className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold text-text">{NUTRIENTS[key].shortLabel}</span>
                    <span className="truncate text-text-muted">{copy.text}</span>
                  </span>
                }
              />
            </li>
          )
        })}
      </ul>
      {note ? <p className="px-5 pb-4 text-xs text-text-muted">{note}</p> : null}
      <MicronutrientPanel coverage={coverage} totals={totals.totals} entryCount={entryCount} />
    </Card>
  )
}
