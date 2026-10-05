import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button, Sheet } from '@/components/ui'
import { mealLabel } from '@/domain/meals'
import { notify } from '@/lib/notify'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { useMealsStore } from '@/stores/mealsStore'
import type { MealEntry, MealType } from '@/types'
import { foodFromPortion } from '../model/foods'
import { formatPortionAmount, portionError, portionGrams, portionValuesOf, unitFor, unitOptions, type PortionValues } from '../model/portion'
import { NutritionTable } from './NutritionTable'
import { PortionFields } from './PortionFields'

interface EditEntrySheetProps {
  entry: MealEntry
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (entry: MealEntry) => void
}

/** Change amount, unit or meal of a logged food. The nutrition snapshot from logging time is kept. */
export function EditEntrySheet({ entry, open, onOpenChange, onDelete }: EditEntrySheetProps) {
  const formId = useId()
  const userFoods = useFoodLibraryStore((s) => s.userFoods)
  const food = useMemo(() => foodFromPortion(entry, userFoods), [entry, userFoods])
  const options = useMemo(() => unitOptions(food.servings, entry), [food, entry])
  const [values, setValues] = useState<PortionValues>(() => portionValuesOf(entry))
  const [mealType, setMealType] = useState<MealType>(entry.mealType)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const error = submitted ? (portionError(values, options) ?? undefined) : undefined

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    const grams = portionGrams(values, options)
    if (grams === null || values.quantity === null) {
      amountRef.current?.focus()
      return
    }
    const unit = unitFor(options, values.unit)
    setSaving(true)
    const result = await useMealsStore.getState().updateEntry(entry.id, {
      quantity: unit.grams === null ? grams : values.quantity,
      servingLabel: unit.grams === null ? null : unit.label,
      servingGrams: unit.grams,
      mealType,
    })
    setSaving(false)
    if (!result.ok) {
      notify.error(result.message)
      return
    }
    notify.success('Entry updated', { description: `${entry.foodName} · ${formatPortionAmount(result.value)} · ${mealLabel(mealType)}` })
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit entry"
      description={mealLabel(entry.mealType)}
      footer={
        <>
          <Button
            variant="ghost"
            className="text-danger hover:bg-danger/8"
            onClick={() => {
              onOpenChange(false)
              onDelete(entry)
            }}
          >
            Remove
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-5 pt-1">
        <div>
          <h3 className="break-words text-base font-bold leading-snug text-text">{entry.foodName}</h3>
          {entry.brand ? <p className="text-sm text-text-muted">{entry.brand}</p> : null}
        </div>
        <PortionFields
          options={options}
          values={values}
          onChange={setValues}
          error={error}
          mealType={mealType}
          onMealChange={setMealType}
          amountRef={amountRef}
        />
        <NutritionTable per100g={entry.per100g} grams={portionGrams(values, options)} />
        <p className="text-xs text-text-muted">Nutrition values are kept from when this food was logged.</p>
      </form>
    </Sheet>
  )
}
