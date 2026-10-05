import { Pencil, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { ErrorState, IconButton, LoadingState } from '@/components/ui'
import { notify } from '@/lib/notify'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import type { FoodItem } from '@/types'
import { FoodRow } from './FoodRow'

interface MyFoodsListProps {
  onSelect: (food: FoodItem) => void
  onEdit: (food: FoodItem) => void
}

async function deleteFood(food: FoodItem): Promise<void> {
  const result = await useFoodLibraryStore.getState().deleteCustomFood(food.id)
  if (!result.ok) {
    notify.error(result.message)
    return
  }
  notify.success(`Deleted ${food.name}`, {
    description: 'Meals you already logged keep their nutrition.',
    undo: () => {
      void useFoodLibraryStore
        .getState()
        .restoreCustomFood(result.value)
        .then((restored) => {
          if (!restored.ok) notify.error(restored.message)
        })
    },
  })
}

/** Foods the user created or saved: open to log, edit (custom foods), delete with Undo. */
export function MyFoodsList({ onSelect, onEdit }: MyFoodsListProps) {
  const headingId = useId()
  const status = useFoodLibraryStore((s) => s.status)
  const foods = useFoodLibraryStore((s) => s.userFoods)

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="text-base font-bold text-text">
        My foods
      </h3>
      {status === 'error' ? (
        <ErrorState
          title="Couldn't load your foods"
          onRetry={() => void useFoodLibraryStore.getState().load({ force: true })}
          className="py-6"
        />
      ) : status !== 'ready' ? (
        <LoadingState label="Loading your foods…" className="py-6" />
      ) : foods.length === 0 ? (
        <p className="text-sm text-text-muted">Foods you create, and products you add to favorites, appear here.</p>
      ) : (
        <ul aria-label="My foods" className="divide-y divide-border/60">
          {foods.map((food) => (
            <FoodRow
              key={food.id}
              food={food}
              onSelect={onSelect}
              actions={
                <>
                  {food.source === 'custom' ? (
                    <IconButton label={`Edit ${food.name}`} icon={<Pencil />} size="sm" onClick={() => onEdit(food)} />
                  ) : null}
                  <IconButton label={`Delete ${food.name}`} icon={<Trash2 />} size="sm" onClick={() => void deleteFood(food)} />
                </>
              }
            />
          ))}
        </ul>
      )}
    </section>
  )
}
