import { useEffect, useId, useRef } from 'react'
import { Button, Field, Input, NumberInput, SegmentedControl } from '@/components/ui'
import { formatKcal, formatNutrient } from '@/lib/format'
import { TEXT_LIMITS } from '@/schemas'
import type { FoodItem } from '@/types'
import { useCustomFoodForm } from '../hooks/useCustomFoodForm'
import {
  MICRO_NUTRIENTS,
  OPTIONAL_NUTRIENTS,
  REQUIRED_NUTRIENTS,
  toPer100g,
  type NutrientBasis,
} from '../model/customFood'
import { formatPortionGrams } from '../model/portion'
import { AllergenPicker } from './AllergenPicker'
import { NutrientFields } from './NutrientFields'

interface CustomFoodFormProps {
  /** The custom food being edited, or null to create one. */
  food: FoodItem | null
  onSaved: (food: FoodItem) => void
  onCancel?: () => void
}

const BASIS_OPTIONS = [
  { value: 'per100g', label: 'Per 100 g' },
  { value: 'perServing', label: 'Per serving' },
] as const satisfies readonly { value: NutrientBasis; label: string }[]

const SUBHEADING = 'text-sm font-bold text-text'

/** Create or edit a custom food. Values can be typed per 100 g or per serving; they are stored per 100 g. */
export function CustomFoodForm({ food, onSaved, onCancel }: CustomFoodFormProps) {
  const form = useCustomFoodForm(food, onSaved)
  const { values, errors } = form
  const titleId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const perServing = values.basis === 'perServing'
  const servingText = values.servingGrams ? formatPortionGrams(values.servingGrams) : null
  const per100g = toPer100g(values)
  const showConversion =
    perServing && servingText !== null && !errors.servingGrams && REQUIRED_NUTRIENTS.every((key) => values.nutrients[key] !== null)

  // Editing starts at the top of the form (it sits above the list the edit was started from).
  useEffect(() => {
    if (food) nameRef.current?.focus()
  }, [food])

  useEffect(() => {
    if (form.invalidAttempt > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [form.invalidAttempt])

  return (
    <form
      ref={formRef}
      noValidate
      aria-labelledby={titleId}
      onSubmit={(event) => {
        event.preventDefault()
        void form.submit()
      }}
      className="space-y-5"
    >
      <h3 id={titleId} className="break-words text-base font-bold text-text">
        {food ? `Edit ${food.name}` : 'Create a custom food'}
      </h3>
      <Field label="Name" required error={errors.name}>
        <Input ref={nameRef} value={values.name} maxLength={TEXT_LIMITS.foodName} autoComplete="off" onChange={(event) => form.update({ name: event.target.value })} />
      </Field>
      <Field label="Brand" optional error={errors.brand}>
        <Input value={values.brand} maxLength={TEXT_LIMITS.brand} autoComplete="off" onChange={(event) => form.update({ brand: event.target.value })} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="flex w-full items-baseline justify-between gap-2 text-sm font-bold text-text">
          <span>Serving</span>
          <span className="text-xs font-medium text-text-muted">Optional</span>
        </legend>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)] gap-3">
          <Field label="Serving name" error={errors.servingLabel}>
            <Input
              value={values.servingLabel}
              maxLength={TEXT_LIMITS.servingLabel}
              placeholder="1 serving"
              autoComplete="off"
              onChange={(event) => form.update({ servingLabel: event.target.value })}
            />
          </Field>
          <Field label="Serving size" error={errors.servingGrams}>
            <NumberInput value={values.servingGrams} onValueChange={(servingGrams) => form.update({ servingGrams })} unit="g" />
          </Field>
        </div>
      </fieldset>
      <div className="space-y-2">
        <p className={SUBHEADING} aria-hidden="true">
          Values on the label are
        </p>
        <SegmentedControl<NutrientBasis>
          label="Values on the label are"
          value={values.basis}
          onValueChange={(basis) => form.update({ basis })}
          options={BASIS_OPTIONS}
          fullWidth
        />
      </div>
      <section aria-label="Nutrition" className="space-y-4">
        <h4 className={SUBHEADING}>{perServing ? `Nutrition per serving${servingText ? ` (${servingText})` : ''}` : 'Nutrition per 100 g'}</h4>
        <NutrientFields keys={REQUIRED_NUTRIENTS} values={values.nutrients} errors={errors} onChange={form.setNutrient} required />
        {errors.macros ? <p className="text-xs font-semibold text-danger">{errors.macros}</p> : null}
        <div>
          <h4 className={SUBHEADING}>More nutrients</h4>
          <p className="text-xs text-text-muted">Optional. Leave blank when the label doesn’t list it; it stays “not reported”.</p>
        </div>
        <NutrientFields keys={[...OPTIONAL_NUTRIENTS, ...MICRO_NUTRIENTS]} values={values.nutrients} errors={errors} onChange={form.setNutrient} />
        {showConversion ? (
          <p className="rounded-field bg-surface-2 px-3 py-2 text-sm text-text-muted">
            Saved per 100 g: {formatKcal(per100g.calories)} · {formatNutrient('protein', per100g.protein)} protein ·{' '}
            {formatNutrient('carbs', per100g.carbs)} carbs · {formatNutrient('fat', per100g.fat)} fat
          </p>
        ) : null}
      </section>
      <AllergenPicker values={values} onChange={form.update} />
      <div className="flex flex-wrap gap-2 pt-1 [&>*]:flex-1">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={form.saving}>
          {food ? 'Save changes' : 'Create food'}
        </Button>
      </div>
    </form>
  )
}
