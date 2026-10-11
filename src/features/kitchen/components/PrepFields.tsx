import { Field, NumberInput, SegmentedControl, ToggleChip } from '@/components/ui'
import { KITCHEN_EQUIPMENT, PANTRY_PREP, type KitchenEquipment, type PantryPrep } from '@/types'
import { EQUIPMENT_LABELS, PREP_HINTS, PREP_LABELS } from '../model/labels'
import type { PantryFormValues } from '../model/pantryForm'

const PREP_OPTIONS = PANTRY_PREP.map((value) => ({ value, label: PREP_LABELS[value] }))
const DEFAULT_METHODS: Record<PantryPrep, KitchenEquipment[]> = { ready: [], reheat: ['microwave', 'stove'], cook: ['stove', 'oven'] }

interface PrepFieldsProps {
  values: PantryFormValues
  onChange: (patch: Partial<PantryFormValues>) => void
}

/** How the item is eaten: ready / warm up / cook from raw, the equipment that works for it and the cooking time. */
export function PrepFields({ values, onChange }: PrepFieldsProps) {
  const toggle = (tool: KitchenEquipment, on: boolean) =>
    onChange({ methods: on ? KITCHEN_EQUIPMENT.filter((t) => t === tool || values.methods.includes(t)) : values.methods.filter((t) => t !== tool) })
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SegmentedControl
          label="How it’s eaten"
          value={values.prep}
          options={PREP_OPTIONS}
          fullWidth
          onValueChange={(prep) =>
            onChange({ prep, methods: values.methods.length > 0 && prep !== 'ready' ? values.methods : DEFAULT_METHODS[prep], cookMinutes: prep === 'cook' ? (values.cookMinutes ?? 20) : null })
          }
        />
        <p className="text-sm text-text-muted">{PREP_HINTS[values.prep]}</p>
      </div>
      {values.prep === 'ready' ? null : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-text">{values.prep === 'reheat' ? 'Can be warmed with' : 'Can be cooked with'}</legend>
          <div className="flex flex-wrap gap-2">
            {KITCHEN_EQUIPMENT.map((tool) => (
              <ToggleChip key={tool} pressed={values.methods.includes(tool)} onPressedChange={(on) => toggle(tool, on)}>
                {EQUIPMENT_LABELS[tool]}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
      )}
      {values.prep === 'cook' ? (
        <Field label="Cooking time">
          <NumberInput value={values.cookMinutes} onValueChange={(cookMinutes) => onChange({ cookMinutes })} unit="min" />
        </Field>
      ) : null}
    </div>
  )
}
