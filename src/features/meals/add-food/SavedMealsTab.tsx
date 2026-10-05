import { BookmarkPlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, EmptyState, ErrorState, IconButton, LoadingState } from '@/components/ui'
import type { DateKey } from '@/domain/dates'
import { mealLabel } from '@/domain/meals'
import { totalsForPortions } from '@/domain/nutrition'
import { formatKcal } from '@/lib/format'
import { notify } from '@/lib/notify'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import type { MealType, SavedMeal } from '@/types'
import { knownValue } from '../model/summary'
import { logPortions } from '../services/mealActions'

interface SavedMealsTabProps {
  mealType: MealType
  date: DateKey
  /** Called after a template was logged (the sheet closes). */
  onLogged: () => void
}

async function deleteMeal(meal: SavedMeal): Promise<void> {
  const result = await useFoodLibraryStore.getState().deleteSavedMeal(meal.id)
  if (!result.ok) {
    notify.error(result.message)
    return
  }
  notify.success(`Deleted “${meal.name}”`, {
    undo: () => {
      void useFoodLibraryStore
        .getState()
        .restoreSavedMeal(result.value)
        .then((restored) => {
          if (!restored.ok) notify.error(restored.message)
        })
    },
  })
}

/** Meal templates: log all of a template's foods to the chosen meal in one step, or delete a template. */
export function SavedMealsTab({ mealType, date, onLogged }: SavedMealsTabProps) {
  const status = useFoodLibraryStore((s) => s.status)
  const meals = useFoodLibraryStore((s) => s.savedMeals)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (status === 'error') {
    return (
      <ErrorState
        title="Couldn't load your saved meals"
        onRetry={() => void useFoodLibraryStore.getState().load({ force: true })}
        className="py-6"
      />
    )
  }
  if (status !== 'ready') return <LoadingState label="Loading saved meals…" className="py-6" />
  if (meals.length === 0) {
    return (
      <EmptyState
        compact
        icon={<BookmarkPlus />}
        title="No saved meals yet"
        description="Use “Save as meal” on a meal card to keep a combination you eat often."
      />
    )
  }

  async function log(meal: SavedMeal) {
    setBusyId(meal.id)
    const ok = await logPortions(meal.items, mealType, date, { message: `Logged “${meal.name}” to ${mealLabel(mealType)}` })
    setBusyId(null)
    if (ok) onLogged()
  }

  return (
    <ul aria-label="Saved meals" className="space-y-3">
      {meals.map((meal) => {
        const kcal = formatKcal(knownValue(totalsForPortions(meal.items).calories))
        const count = meal.items.length
        return (
          <li key={meal.id} aria-label={meal.name} className="rounded-card bg-surface-2 px-4 py-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold text-text" title={meal.name}>
                  {meal.name}
                </h3>
                <p className="text-sm text-text-muted">
                  {count} {count === 1 ? 'food' : 'foods'} · {kcal}
                </p>
              </div>
              <IconButton label={`Delete ${meal.name}`} icon={<Trash2 />} size="sm" className="-mr-1" onClick={() => void deleteMeal(meal)} />
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-text-muted">{meal.items.map((item) => item.foodName).join(', ')}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              loading={busyId === meal.id}
              aria-label={`Log ${meal.name} to ${mealLabel(mealType)}`}
              onClick={() => void log(meal)}
            >
              Log to {mealLabel(mealType)}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
