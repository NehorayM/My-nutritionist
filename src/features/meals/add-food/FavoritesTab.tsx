import { Star } from 'lucide-react'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { useFavoriteFoods, useFoodLibraryStore } from '@/stores/foodLibraryStore'
import type { FoodItem } from '@/types'
import { FoodList } from './FoodList'

/** The user's favorite foods (catalog foods and their own foods). */
export function FavoritesTab({ onSelect }: { onSelect: (food: FoodItem) => void }) {
  const status = useFoodLibraryStore((s) => s.status)
  const foods = useFavoriteFoods()

  if (status === 'error') {
    return (
      <ErrorState
        title="Couldn't load your favorites"
        onRetry={() => void useFoodLibraryStore.getState().load({ force: true })}
        className="py-6"
      />
    )
  }
  if (status !== 'ready') return <LoadingState label="Loading favorites…" className="py-6" />
  if (foods.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Star />}
        title="No favorites yet"
        description="Open a food and tap the star to keep it here for quick logging."
      />
    )
  }
  return <FoodList foods={foods} onSelect={onSelect} label="Favorite foods" />
}
