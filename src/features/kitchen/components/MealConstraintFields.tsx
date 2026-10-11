import { Field, NumberInput, Switch, ToggleChip } from '@/components/ui'
import { mealLabel } from '@/domain/meals'
import { KITCHEN_EQUIPMENT, type MealConstraint, type MealType } from '@/types'
import { EQUIPMENT_LABELS } from '../model/labels'

interface MealConstraintFieldsProps {
  meal: MealType
  value: MealConstraint
  /** Show the equipment choice (equipment is set per meal). */
  perMealEquipment: boolean
  onChange: (next: MealConstraint) => void
}

/** One meal's limits: planned or not, equipment, cooking, time and calories. */
export function MealConstraintFields({ meal, value, perMealEquipment, onChange }: MealConstraintFieldsProps) {
  const label = mealLabel(meal)
  const patch = (next: Partial<MealConstraint>) => onChange({ ...value, ...next })
  return (
    <fieldset className="space-y-3 rounded-card bg-surface-2 p-4">
      <legend className="sr-only">{label}</legend>
      <Switch checked={value.enabled} onCheckedChange={(enabled) => patch({ enabled })} label={<span className="font-bold">{label}</span>} />
      {value.enabled ? (
        <>
          {perMealEquipment ? (
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">{label} equipment</legend>
              {KITCHEN_EQUIPMENT.map((tool) => (
                <ToggleChip
                  key={tool}
                  pressed={value.equipment.includes(tool)}
                  onPressedChange={(on) => patch({ equipment: on ? KITCHEN_EQUIPMENT.filter((t) => t === tool || value.equipment.includes(t)) : value.equipment.filter((t) => t !== tool) })}
                >
                  {EQUIPMENT_LABELS[tool]}
                </ToggleChip>
              ))}
            </fieldset>
          ) : null}
          <Switch checked={value.canCook} onCheckedChange={(canCook) => patch({ canCook })} label="I can cook" description="Off: only ready-to-eat or warmed-up food." />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Time">
              <NumberInput value={value.maxMinutes} onValueChange={(maxMinutes) => patch({ maxMinutes: Math.max(0, Math.round(maxMinutes ?? 0)) })} unit="min" />
            </Field>
            <Field label="Min kcal" optional>
              <NumberInput value={value.kcalMin} onValueChange={(kcalMin) => patch({ kcalMin: kcalMin === null ? null : Math.round(kcalMin) })} />
            </Field>
            <Field label="Max kcal" optional>
              <NumberInput value={value.kcalMax} onValueChange={(kcalMax) => patch({ kcalMax: kcalMax === null ? null : Math.round(kcalMax) })} />
            </Field>
          </div>
        </>
      ) : null}
    </fieldset>
  )
}
