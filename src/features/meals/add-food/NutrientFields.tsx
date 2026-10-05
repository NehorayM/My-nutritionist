import { Field, NumberInput } from '@/components/ui'
import { NUTRIENTS } from '@/domain/nutrients'
import type { NutrientKey } from '@/types'
import type { CustomFoodErrors } from '../model/customFood'

interface NutrientFieldsProps {
  keys: readonly NutrientKey[]
  values: Record<NutrientKey, number | null>
  errors: CustomFoodErrors
  onChange: (key: NutrientKey, value: number | null) => void
  required?: boolean
}

/** Two-column grid of nutrient amounts (unit inside each field). Blank means "unknown", never 0. */
export function NutrientFields({ keys, values, errors, onChange, required = false }: NutrientFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
      {keys.map((key) => (
        <Field key={key} label={NUTRIENTS[key].label} error={errors[key]} required={required}>
          <NumberInput value={values[key]} onValueChange={(value) => onChange(key, value)} unit={NUTRIENTS[key].unit} />
        </Field>
      ))}
    </div>
  )
}
