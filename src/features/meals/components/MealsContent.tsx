import { useId, type ReactNode } from 'react'
import { addDays, type DateKey } from '@/domain/dates'
import { DEFAULT_MEAL_SLOTS } from '@/domain/meals'
import { formatDateLabel } from '@/lib/format'
import type { MealType } from '@/types'
import type { MealsDay } from '../hooks/useMealsDay'
import type { MealsSheets } from '../hooks/useMealsSheets'
import { repeatedMessageFor, repeatLabelFor } from '../model/labels'
import { removeEntry, repeatMeal } from '../services/mealActions'
import { MealCard } from './MealCard'
import { NutritionSummary } from './NutritionSummary'

interface MealsContentProps {
  day: MealsDay
  today: DateKey
  sheets: MealsSheets
  /**
   * Mount point for "Smart options for the rest of today" (src/features/meals/recommendations), rendered between
   * the nutrition summary and the meal cards. Nothing is rendered when it is not provided.
   */
  recommendations?: ReactNode
}

/** The selected day: nutrition summary, the recommendations slot, then the four meal cards. */
export function MealsContent({ day, today, sheets, recommendations }: MealsContentProps) {
  const mealsHeadingId = useId()
  const previousDate = addDays(day.date, -1)
  const dayLabel = formatDateLabel(day.date, today)
  const previousLabel = formatDateLabel(previousDate, today)

  function repeatLabel(mealType: MealType): string | null {
    const had = day.previousEntries.some((entry) => entry.mealType === mealType)
    return had ? repeatLabelFor(mealType, previousLabel) : null
  }

  return (
    <>
      <NutritionSummary
        dayLabel={dayLabel}
        totals={day.totals}
        targets={day.targets}
        coverage={day.coverage}
        entryCount={day.entries.length}
      />
      {recommendations}
      <section aria-labelledby={mealsHeadingId} className="space-y-4">
        <h2 id={mealsHeadingId} className="sr-only">
          Meals, {dayLabel}
        </h2>
        {DEFAULT_MEAL_SLOTS.map(({ key: mealType }) => {
          const entries = day.entries.filter((entry) => entry.mealType === mealType)
          return (
            <MealCard
              key={mealType}
              mealType={mealType}
              entries={entries}
              totals={day.totals.byMeal[mealType]}
              repeatLabel={repeatLabel(mealType)}
              onAdd={sheets.openAddFood}
              onRepeat={(meal) => repeatMeal(previousDate, day.date, meal, repeatedMessageFor(meal, previousLabel))}
              onEdit={sheets.openEdit}
              onDelete={(entry) => void removeEntry(entry)}
              onSaveMeal={(meal) => sheets.openSaveMeal(meal, entries)}
            />
          )
        })}
      </section>
    </>
  )
}
