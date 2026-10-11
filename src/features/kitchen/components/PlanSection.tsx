import { ChefHat, CircleCheck, Info, RefreshCw } from 'lucide-react'
import { useId } from 'react'
import { Button, Card, EmptyState, SectionHeader } from '@/components/ui'
import type { PlannerResult } from '@/domain/planner'
import { formatNumber } from '@/lib/format'
import { EXCLUSION_TEXT } from '../model/labels'
import { PlannedMealCard } from './PlannedMealCard'

interface PlanSectionProps {
  result: PlannerResult
  today: string
  onOtherPlan: () => void
}

/** Today's plan: one card per planned meal, the day's total against its range, and items left out (why). */
export function PlanSection({ result, today, onOtherPlan }: PlanSectionProps) {
  const headingId = useId()
  const { dayPlan, day } = result
  const planned = result.meals.filter((meal) => meal.gap !== 'disabled')
  const empty = planned.every((meal) => meal.gap === 'nothing_available')
  if (empty) {
    return (
      <section aria-labelledby={headingId}>
        <Card>
          <EmptyState
            headingLevel="h2"
            icon={<ChefHat />}
            title={<span id={headingId}>Your plan starts with your kitchen</span>}
            description={
              planned.length === 0
                ? 'Every meal is turned off in Kitchen & time. Turn on the meals you want planned.'
                : 'Add a few things you have at home. Each meal is then built only from them, within your equipment, time and calories.'
            }
          />
        </Card>
      </section>
    )
  }
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <SectionHeader
        id={headingId}
        title="Today’s plan"
        description="Built only from your kitchen, within your equipment, time and calories."
        action={
          <Button size="sm" variant="ghost" leadingIcon={<RefreshCw />} onClick={onOtherPlan}>
            New plan
          </Button>
        }
      />
      {dayPlan ? (
        <output
          className={`flex items-start gap-2 rounded-card px-4 py-3 text-sm ${dayPlan.fits ? 'bg-success/10' : 'bg-warning/10'}`}
          data-testid="day-total"
        >
          {dayPlan.fits ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />}
          <span>
            <span className="font-semibold text-text">
              {formatNumber(dayPlan.totals.kcal)} kcal planned · {formatNumber(dayPlan.totals.protein)} g protein
            </span>
            <span className="block text-text-muted">
              {dayPlan.fits
                ? `Within your day of ${formatNumber(day.min)}–${formatNumber(day.max)} kcal, using only what you have.`
                : `Your kitchen can’t fill a whole day of ${formatNumber(day.min)}–${formatNumber(day.max)} kcal yet — each meal below still fits its own limits. Add food or adjust the limits.`}
            </span>
          </span>
        </output>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {planned.map((plan) => (
          <PlannedMealCard key={`${plan.mealType}:${dayPlan?.meals[plan.mealType]?.id ?? 'none'}`} plan={plan} chosen={dayPlan?.meals[plan.mealType] ?? null} today={today} />
        ))}
      </div>
      {result.excluded.length > 0 ? (
        <details className="rounded-card bg-surface-2 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-text">
            Not used in plans: {result.excluded.length} {result.excluded.length === 1 ? 'item' : 'items'}
          </summary>
          <ul className="mt-2 space-y-1 text-text-muted">
            {result.excluded.map((item) => (
              <li key={item.pantryItemId}>
                <span className="font-medium text-text">{item.foodName}</span> — {EXCLUSION_TEXT[item.reason]}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
