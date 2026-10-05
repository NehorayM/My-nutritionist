import { ToggleChip } from '@/components/ui'
import { ALLERGENS, type Allergen } from '@/types'
import type { CustomFoodValues } from '../model/customFood'
import { ALLERGEN_LABELS } from '../model/labels'

type DietValues = Pick<CustomFoodValues, 'allergens' | 'noAllergens' | 'vegetarian' | 'vegan'>

interface AllergenPickerProps {
  values: DietValues
  onChange: (patch: Partial<DietValues>) => void
}

const LEGEND = 'mb-1 text-sm font-semibold text-text'

/** Allergens (or "none of these") and diet flags. Nothing selected means "not sure", which stays unknown. */
export function AllergenPicker({ values, onChange }: AllergenPickerProps) {
  function toggleAllergen(allergen: Allergen, pressed: boolean) {
    const allergens = pressed ? [...values.allergens, allergen] : values.allergens.filter((item) => item !== allergen)
    onChange({ allergens, noAllergens: false })
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className={LEGEND}>Allergens</legend>
        <p className="mb-2 text-xs text-text-muted">Leave everything off if you’re not sure.</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((allergen) => (
            <ToggleChip
              key={allergen}
              pressed={values.allergens.includes(allergen)}
              onPressedChange={(pressed) => toggleAllergen(allergen, pressed)}
            >
              {ALLERGEN_LABELS[allergen]}
            </ToggleChip>
          ))}
          <ToggleChip
            pressed={values.noAllergens}
            onPressedChange={(pressed) => onChange({ noAllergens: pressed, allergens: pressed ? [] : values.allergens })}
          >
            None of these
          </ToggleChip>
        </div>
      </fieldset>
      <fieldset>
        <legend className={LEGEND}>Diet</legend>
        <div className="flex flex-wrap gap-2">
          <ToggleChip
            pressed={values.vegetarian || values.vegan}
            onPressedChange={(pressed) => onChange({ vegetarian: pressed, vegan: pressed ? values.vegan : false })}
          >
            Vegetarian
          </ToggleChip>
          <ToggleChip
            pressed={values.vegan}
            onPressedChange={(pressed) => onChange({ vegan: pressed, vegetarian: pressed ? true : values.vegetarian })}
          >
            Vegan
          </ToggleChip>
        </div>
      </fieldset>
    </div>
  )
}
