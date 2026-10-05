import type { Ref } from 'react'
import { Field, NumberInput, Select } from '@/components/ui'
import type { MealType } from '@/types'
import { MEAL_OPTIONS } from '../model/labels'
import {
  formatPortionGrams,
  portionGrams,
  switchUnit,
  unitFor,
  unitOptionText,
  type PortionValues,
  type UnitOption,
} from '../model/portion'

interface PortionFieldsProps {
  options: readonly UnitOption[]
  values: PortionValues
  onChange: (values: PortionValues) => void
  /** Amount validation message (shown after a submit attempt). */
  error?: string
  mealType: MealType
  onMealChange: (mealType: MealType) => void
  amountRef?: Ref<HTMLInputElement>
}

/** Amount + unit (grams or one of the food's servings) + meal. */
export function PortionFields({ options, values, onChange, error, mealType, onMealChange, amountRef }: PortionFieldsProps) {
  const unit = unitFor(options, values.unit)
  const grams = portionGrams(values, options)
  const hint = unit.grams !== null && grams !== null ? `= ${formatPortionGrams(grams)}` : undefined

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-3">
        <Field label="Amount" error={error} hint={hint} required>
          <NumberInput ref={amountRef} value={values.quantity} onValueChange={(quantity) => onChange({ ...values, quantity })} />
        </Field>
        <Field label="Unit">
          <Select
            value={unit.value}
            onValueChange={(next) => onChange(switchUnit(values, options, next))}
            options={options.map((option) => ({ value: option.value, label: unitOptionText(option) }))}
          />
        </Field>
      </div>
      <Field label="Meal">
        <Select<MealType> value={mealType} onValueChange={onMealChange} options={MEAL_OPTIONS} />
      </Field>
    </div>
  )
}
