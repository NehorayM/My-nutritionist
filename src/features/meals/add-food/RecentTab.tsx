import { History, Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ErrorState, IconButton, LoadingState } from '@/components/ui'
import type { DateKey } from '@/domain/dates'
import { portionNutrients } from '@/domain/nutrition'
import { formatKcal } from '@/lib/format'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { useMealsStore, useRecentFoods } from '@/stores/mealsStore'
import type { FoodItem, FoodPortion, MealType } from '@/types'
import { foodFromPortion } from '../model/foods'
import { formatPortionAmount } from '../model/portion'
import { logPortions } from '../services/mealActions'
import { FoodRow } from './FoodRow'

interface RecentTabProps {
  mealType: MealType
  date: DateKey
  onSelect: (food: FoodItem, portion: FoodPortion) => void
}

/** Foods logged lately (one per food, with the last amount): re-log in one tap, or open to adjust. */
export function RecentTab({ mealType, date, onSelect }: RecentTabProps) {
  const status = useMealsStore((s) => s.recentStatus)
  const recent = useRecentFoods()
  const userFoods = useFoodLibraryStore((s) => s.userFoods)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  if (status === 'error') {
    return (
      <ErrorState
        title="Couldn't load recent foods"
        onRetry={() => void useMealsStore.getState().loadRecent()}
        className="py-6"
      />
    )
  }
  if (recent.length === 0) {
    return status === 'ready' ? (
      <EmptyState
        compact
        icon={<History />}
        title="No recent foods yet"
        description="Foods you log show up here, ready to add again with the same amount."
      />
    ) : (
      <LoadingState label="Loading recent foods…" className="py-6" />
    )
  }

  async function relog(key: string, portion: FoodPortion) {
    setBusyKey(key)
    await logPortions([portion], mealType, date)
    setBusyKey(null)
  }

  return (
    <ul aria-label="Recent foods" className="divide-y divide-border/60">
      {recent.map(({ key, portion }) => {
        const food = foodFromPortion(portion, userFoods)
        const amount = `${formatPortionAmount(portion)} · ${formatKcal(portionNutrients(portion).calories)}`
        return (
          <FoodRow
            key={key}
            food={food}
            onSelect={() => onSelect(food, portion)}
            detail={amount}
            actions={
              <IconButton
                label={`Add ${portion.foodName} again`}
                title={`Add ${amount} to this meal`}
                icon={<Plus />}
                variant="subtle"
                size="sm"
                loading={busyKey === key}
                onClick={() => void relog(key, portion)}
              />
            }
          />
        )
      })}
    </ul>
  )
}
