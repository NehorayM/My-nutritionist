import { useState } from 'react'
import { Button, Field, NumberInput, SegmentedControl, Sheet, ToggleChip } from '@/components/ui'
import { notify } from '@/lib/notify'
import { plannerSettingsSchema } from '@/schemas'
import { useKitchenStore } from '@/stores/kitchenStore'
import { KITCHEN_EQUIPMENT, MEAL_TYPES, type PlannerSettings } from '@/types'
import { EQUIPMENT_LABELS } from '../model/labels'
import { MealConstraintFields } from './MealConstraintFields'

interface KitchenSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: PlannerSettings
}

const SCOPE_OPTIONS = [
  { value: 'day', label: 'Same all day' },
  { value: 'meal', label: 'Per meal' },
] as const

/** Kitchen equipment (all day or per meal), cooking and time per meal, and calorie limits. */
export function KitchenSettingsSheet({ open, onOpenChange, settings }: KitchenSettingsSheetProps) {
  const [draft, setDraft] = useState<PlannerSettings>(settings)
  const [saving, setSaving] = useState(false)
  const valid = plannerSettingsSchema.safeParse(draft).success

  async function save() {
    setSaving(true)
    const result = await useKitchenStore.getState().saveSettings(draft)
    setSaving(false)
    if (!result.ok) {
      notify.error(result.message)
      return
    }
    notify.success('Planner settings saved')
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Kitchen & time"
      description="Plans only suggest what you can actually prepare."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!valid} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-text">Heating equipment</h3>
          <SegmentedControl
            label="Equipment availability"
            value={draft.equipmentScope}
            options={SCOPE_OPTIONS}
            fullWidth
            onValueChange={(equipmentScope) => setDraft({ ...draft, equipmentScope })}
          />
          {draft.equipmentScope === 'day' ? (
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">Equipment available all day</legend>
              {KITCHEN_EQUIPMENT.map((tool) => (
                <ToggleChip
                  key={tool}
                  pressed={draft.dayEquipment.includes(tool)}
                  onPressedChange={(on) =>
                    setDraft({ ...draft, dayEquipment: on ? KITCHEN_EQUIPMENT.filter((t) => t === tool || draft.dayEquipment.includes(t)) : draft.dayEquipment.filter((t) => t !== tool) })
                  }
                >
                  {EQUIPMENT_LABELS[tool]}
                </ToggleChip>
              ))}
            </fieldset>
          ) : (
            <p className="text-sm text-text-muted">Choose the equipment of each meal below (e.g. only a microwave at work).</p>
          )}
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-text">Calories for the day</h3>
          <p className="text-sm text-text-muted">Leave empty to use your daily target.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min kcal" optional>
              <NumberInput value={draft.dailyKcalMin} onValueChange={(v) => setDraft({ ...draft, dailyKcalMin: v === null ? null : Math.round(v) })} />
            </Field>
            <Field label="Max kcal" optional>
              <NumberInput value={draft.dailyKcalMax} onValueChange={(v) => setDraft({ ...draft, dailyKcalMax: v === null ? null : Math.round(v) })} />
            </Field>
          </div>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-text">Meals</h3>
          {MEAL_TYPES.map((meal) => (
            <MealConstraintFields
              key={meal}
              meal={meal}
              value={draft.meals[meal]}
              perMealEquipment={draft.equipmentScope === 'meal'}
              onChange={(next) => setDraft({ ...draft, meals: { ...draft.meals, [meal]: next } })}
            />
          ))}
        </section>
        {valid ? null : (
          <p role="alert" className="rounded-field bg-danger/10 px-3 py-2 text-sm text-text">
            Check the limits: calories 50–3,000 per meal and 500–6,000 per day, minimum not above maximum, time up to 240 minutes.
          </p>
        )}
      </div>
    </Sheet>
  )
}
