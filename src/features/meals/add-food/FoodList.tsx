import type { FoodItem } from '@/types'
import { FoodRow } from './FoodRow'

interface FoodListProps {
  foods: readonly FoodItem[]
  onSelect: (food: FoodItem) => void
  /** Accessible name of the list ("Matching foods"). */
  label: string
}

/** A list of selectable foods (search results, favorites, my foods). */
export function FoodList({ foods, onSelect, label }: FoodListProps) {
  return (
    <ul aria-label={label} className="divide-y divide-border/60">
      {foods.map((food) => (
        <FoodRow key={food.id} food={food} onSelect={onSelect} />
      ))}
    </ul>
  )
}
