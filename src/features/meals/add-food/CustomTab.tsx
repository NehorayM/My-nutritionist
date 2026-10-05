import { useState } from 'react'
import { notify } from '@/lib/notify'
import type { FoodItem } from '@/types'
import { CustomFoodForm } from './CustomFoodForm'
import { MyFoodsList } from './MyFoodsList'

interface CustomTabProps {
  /** A new food was created: the sheet opens it so it can be logged right away. */
  onCreated: (food: FoodItem) => void
  onSelect: (food: FoodItem) => void
}

/** Create a custom food (or edit one), plus the list of the user's own foods. */
export function CustomTab({ onCreated, onSelect }: CustomTabProps) {
  const [editing, setEditing] = useState<FoodItem | null>(null)
  // A fresh form after every successful create.
  const [round, setRound] = useState(0)

  function handleSaved(food: FoodItem) {
    if (editing) {
      notify.success('Food updated', { description: `${food.name}. Meals you already logged keep their nutrition.` })
      setEditing(null)
      return
    }
    notify.success('Food created', { description: `${food.name} is in My foods.` })
    setRound((value) => value + 1)
    onCreated(food)
  }

  return (
    <div className="space-y-8">
      <CustomFoodForm
        key={editing ? `edit-${editing.id}` : `new-${round}`}
        food={editing}
        onSaved={handleSaved}
        onCancel={editing ? () => setEditing(null) : undefined}
      />
      <MyFoodsList
        onSelect={onSelect}
        onEdit={setEditing}
      />
    </div>
  )
}
