import { OFF_ATTRIBUTION } from '@/services/food'
import type { FoodItem } from '@/types'

const OFF_URL = 'https://world.openfoodfacts.org'

/** Where the food's data comes from (Open Food Facts data is linked as its ODbL licence asks). */
export function FoodAttribution({ food }: { food: FoodItem }) {
  if (food.source === 'off') {
    const rest = food.attribution?.startsWith(OFF_ATTRIBUTION) ? food.attribution.slice(OFF_ATTRIBUTION.length) : ''
    return (
      <p className="break-words text-xs text-text-muted">
        Data:{' '}
        <a href={OFF_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-2">
          {OFF_ATTRIBUTION}
        </a>
        {rest}. Product data is added by contributors.
      </p>
    )
  }
  if (food.source === 'custom') return <p className="text-xs text-text-muted">A food you created. Values are as you entered them.</p>
  if (!food.attribution) return null
  return <p className="break-words text-xs text-text-muted">Data: {food.attribution}</p>
}
