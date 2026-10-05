import { useState } from 'react'
import { notify } from '@/lib/notify'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import type { FoodItem, NutrientKey } from '@/types'
import {
  customFoodValues,
  emptyCustomFood,
  hasErrors,
  toCustomFoodInput,
  validateCustomFood,
  type CustomFoodErrors,
  type CustomFoodValues,
} from '../model/customFood'

export interface CustomFoodForm {
  values: CustomFoodValues
  /** Shown after the first submit attempt, then live. */
  errors: CustomFoodErrors
  saving: boolean
  /** Increments after a failed submit so the form can focus the first invalid field. */
  invalidAttempt: number
  update: (patch: Partial<CustomFoodValues>) => void
  setNutrient: (key: NutrientKey, value: number | null) => void
  submit: () => Promise<void>
}

/** State, validation and saving for the create / edit custom food form. */
export function useCustomFoodForm(food: FoodItem | null, onSaved: (food: FoodItem) => void): CustomFoodForm {
  const [values, setValues] = useState<CustomFoodValues>(() => (food ? customFoodValues(food) : emptyCustomFood()))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [invalidAttempt, setInvalidAttempt] = useState(0)

  async function submit() {
    setSubmitted(true)
    if (hasErrors(validateCustomFood(values))) {
      setInvalidAttempt((count) => count + 1)
      return
    }
    setSaving(true)
    const store = useFoodLibraryStore.getState()
    const input = toCustomFoodInput(values)
    const result = food ? await store.updateCustomFood(food.id, input) : await store.createCustomFood(input)
    setSaving(false)
    if (!result.ok) {
      notify.error(result.message)
      return
    }
    onSaved(result.value)
  }

  return {
    values,
    errors: submitted ? validateCustomFood(values) : {},
    saving,
    invalidAttempt,
    update: (patch) => setValues((current) => ({ ...current, ...patch })),
    setNutrient: (key, value) => setValues((current) => ({ ...current, nutrients: { ...current.nutrients, [key]: value } })),
    submit,
  }
}
