import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui'
import type { FoodPortion, MealType } from '@/types'
import { NutritionTable } from '../components/NutritionTable'
import { PortionFields } from '../components/PortionFields'
import { useFoodDetails } from '../hooks/useFoodDetails'
import type { FoodSelection } from '../model/addFood'
import { ALLERGEN_LABELS, SOURCE_TONES, sourceLabel } from '../model/labels'
import {
  buildPortion,
  defaultPortionValues,
  portionError,
  portionGrams,
  portionValuesOf,
  unitOptions,
  type PortionValues,
} from '../model/portion'
import { FoodAttribution } from './FoodAttribution'
import { FavoriteButton } from './FavoriteButton'

interface FoodDetailProps {
  selection: FoodSelection
  /** Id of the form, so the sheet's sticky footer can submit it. */
  formId: string
  mealType: MealType
  onMealChange: (mealType: MealType) => void
  onSubmit: (portion: FoodPortion) => void
}

/** A food's nutrition per 100 g and for the chosen portion, with amount, unit and meal pickers. */
export function FoodDetail({ selection, formId, mealType, onMealChange, onSubmit }: FoodDetailProps) {
  const { food, loading } = useFoodDetails(selection.food)
  const { portion } = selection
  const options = useMemo(() => unitOptions(food.servings, portion ?? undefined), [food.servings, portion])
  const [values, setValues] = useState<PortionValues>(() =>
    portion ? portionValuesOf(portion) : defaultPortionValues(selection.food.servings),
  )
  const [submitted, setSubmitted] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const error = submitted ? (portionError(values, options) ?? undefined) : undefined
  const allergens = food.allergens?.map((allergen) => ALLERGEN_LABELS[allergen]) ?? []

  // Moving from a list into the detail view: start reading at the food's name.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    const next = buildPortion(food, values, options)
    if (next === null) {
      amountRef.current?.focus()
      return
    }
    onSubmit(next)
  }

  return (
    <form id={formId} noValidate onSubmit={handleSubmit} aria-label={`Add ${food.name}`} className="space-y-5 pt-1">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 ref={headingRef} tabIndex={-1} className="break-words text-lg font-bold leading-snug text-text">
            {food.name}
          </h3>
          <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-text-muted">
            {food.brand ? <span className="min-w-0 max-w-full truncate">{food.brand}</span> : null}
            <Badge tone={SOURCE_TONES[food.source]}>{sourceLabel(food)}</Badge>
          </p>
        </div>
        <FavoriteButton food={food} />
      </div>
      <PortionFields
        options={options}
        values={values}
        onChange={setValues}
        error={error}
        mealType={mealType}
        onMealChange={onMealChange}
        amountRef={amountRef}
      />
      {loading ? <p className="text-xs text-text-muted">Loading more serving sizes…</p> : null}
      <NutritionTable per100g={food.per100g} grams={portionGrams(values, options)} />
      {allergens.length > 0 ? (
        <p className="text-sm text-text-muted">
          <span className="font-semibold text-text">Contains:</span> {allergens.join(', ')}
        </p>
      ) : null}
      <FoodAttribution food={food} />
    </form>
  )
}
