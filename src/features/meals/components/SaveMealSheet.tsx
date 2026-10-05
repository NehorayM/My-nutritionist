import { useId, useRef, useState, type FormEvent } from 'react'
import { Button, Field, Input, Sheet } from '@/components/ui'
import { mealLabel } from '@/domain/meals'
import { totalsForPortions } from '@/domain/nutrition'
import { formatKcal } from '@/lib/format'
import { notify } from '@/lib/notify'
import { COUNT_LIMITS, TEXT_LIMITS } from '@/schemas'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { toPortion } from '@/stores/mealsStore'
import type { MealEntry, MealType } from '@/types'
import { mealNoun } from '../model/labels'
import { formatPortionAmount } from '../model/portion'
import { knownValue } from '../model/summary'

interface SaveMealSheetProps {
  mealType: MealType
  entries: readonly MealEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Saves a meal's foods as a named template that can be logged again in one step. */
export function SaveMealSheet({ mealType, entries, open, onOpenChange }: SaveMealSheetProps) {
  const formId = useId()
  const [name, setName] = useState(`My ${mealNoun(mealType)}`)
  const [error, setError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const items = entries.slice(0, COUNT_LIMITS.savedMealItems.max)
  const kcal = formatKcal(knownValue(totalsForPortions(items).calories))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Give the meal a name.')
      inputRef.current?.focus()
      return
    }
    setSaving(true)
    const result = await useFoodLibraryStore.getState().saveMeal(name, items.map(toPortion), mealType)
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    notify.success('Meal saved', { description: `${result.value.name} · find it under Saved meals when adding food.` })
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Save as meal"
      description={`Log these ${mealLabel(mealType).toLowerCase()} foods again in one step.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Save meal
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-4 pt-1">
        <Field label="Name" error={error} required>
          <Input
            ref={inputRef}
            value={name}
            maxLength={TEXT_LIMITS.savedMealName}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value)
              setError(undefined)
            }}
          />
        </Field>
        <div className="rounded-card bg-surface-2 px-4 py-3">
          <p className="text-sm font-semibold text-text">
            {items.length} {items.length === 1 ? 'food' : 'foods'} · {kcal}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-text-muted">
            {items.map((entry) => (
              <li key={entry.id} className="flex gap-2">
                <span className="min-w-0 flex-1 truncate" title={entry.foodName}>
                  {entry.foodName}
                </span>
                <span className="max-w-[50%] shrink-0 truncate">{formatPortionAmount(entry)}</span>
              </li>
            ))}
          </ul>
          {entries.length > items.length ? (
            <p className="mt-2 text-xs text-text-muted">A saved meal holds up to {COUNT_LIMITS.savedMealItems.max} foods; the first ones are saved.</p>
          ) : null}
        </div>
      </form>
    </Sheet>
  )
}
