import { Star } from 'lucide-react'
import { useState } from 'react'
import { cn, IconButton } from '@/components/ui'
import { notify } from '@/lib/notify'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { favoriteFor } from '@/stores/foodLibraryHelpers'
import type { FoodItem } from '@/types'
import { canFavorite } from '../model/foods'

/**
 * Star toggle for a food (aria-pressed). Unsaved USDA / Open Food Facts results are saved to "My foods" first,
 * which the store does idempotently.
 */
export function FavoriteButton({ food }: { food: FoodItem }) {
  const favorites = useFoodLibraryStore((s) => s.favorites)
  const userFoods = useFoodLibraryStore((s) => s.userFoods)
  const [busy, setBusy] = useState(false)
  if (!canFavorite(food, userFoods)) return null
  const active = favoriteFor(food, favorites, userFoods) !== null

  async function toggle() {
    setBusy(true)
    const result = await useFoodLibraryStore.getState().toggleFavorite(food)
    setBusy(false)
    if (!result.ok) {
      notify.error(result.message)
      return
    }
    notify.success(result.value ? 'Added to favorites' : 'Removed from favorites', { id: 'favorite', description: food.name })
  }

  return (
    <IconButton
      label="Favorite"
      aria-pressed={active}
      icon={<Star className={cn(active && 'fill-current text-accent-ink')} />}
      variant="subtle"
      loading={busy}
      onClick={() => void toggle()}
    />
  )
}
