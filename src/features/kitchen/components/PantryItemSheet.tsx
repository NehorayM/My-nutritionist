import { useState } from 'react'
import { Button, Field, Input, NumberInput, Select, Sheet, Switch } from '@/components/ui'
import { notify } from '@/lib/notify'
import { useKitchenStore } from '@/stores/kitchenStore'
import type { FoodItem, PantryItem } from '@/types'
import { emptyForm, formError, formForFood, formForItem, toPantryInput, type PantryFormValues } from '../model/pantryForm'
import { FoodPicker } from './FoodPicker'
import { PrepFields } from './PrepFields'

interface PantryItemSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this item; omitted → add a new one. */
  item?: PantryItem | null
}

/** Add or edit something you have at home: the food, how much, how it’s eaten and when to use it by. */
export function PantryItemSheet({ open, onOpenChange, item = null }: PantryItemSheetProps) {
  const [values, setValues] = useState<PantryFormValues>(() => (item ? formForItem(item) : emptyForm()))
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const patch = (next: Partial<PantryFormValues>) => setValues((current) => ({ ...current, ...next }))
  const error = formError(values)
  const food = values.food
  const unitOptions = [{ value: 'g', label: 'grams' }, ...(food?.servings ?? []).map((serving, index) => ({ value: String(index), label: serving.label }))]

  async function save() {
    if (error) {
      setShowErrors(true)
      return
    }
    setSaving(true)
    const input = toPantryInput(values)
    const result = item ? await useKitchenStore.getState().updateItem(item.id, input) : await useKitchenStore.getState().addItem(input)
    setSaving(false)
    if (!result.ok) {
      notify.error(result.message)
      return
    }
    notify.success(item ? `Updated ${result.value.food.name}` : `Added ${result.value.food.name} to your kitchen`)
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? 'Edit kitchen item' : 'Add to your kitchen'}
      description={food ? undefined : 'Search for something in your fridge, freezer or pantry.'}
      size="lg"
      footer={
        food ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              {item ? 'Save changes' : 'Add to kitchen'}
            </Button>
          </>
        ) : null
      }
    >
      {food ? (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3 rounded-card bg-surface-2 px-4 py-3">
            <div className="min-w-0">
              <p className="font-bold text-text">{food.name}</p>
              {food.brand ? <p className="text-sm text-text-muted">{food.brand}</p> : null}
            </div>
            {item ? null : (
              <Button size="sm" variant="ghost" onClick={() => setValues(emptyForm())}>
                Change
              </Button>
            )}
          </div>
          <div className="space-y-3">
            <Switch checked={!values.tracked} onCheckedChange={(off) => patch({ tracked: !off })} label="I don’t track the amount" description="Plans then use normal portions." />
            {values.tracked ? (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
                <Field label="Amount">
                  <NumberInput value={values.amount} onValueChange={(amount) => patch({ amount })} />
                </Field>
                <Field label="Unit">
                  <Select value={values.unit} options={unitOptions} onValueChange={(unit) => patch({ unit })} />
                </Field>
              </div>
            ) : null}
          </div>
          <PrepFields values={values} onChange={patch} />
          <Field label="Use by" optional hint="Plans use items that expire soon first.">
            <Input type="date" value={values.useBy} onChange={(event) => patch({ useBy: event.target.value })} />
          </Field>
          {showErrors && error ? (
            <p role="alert" className="rounded-field bg-danger/10 px-3 py-2 text-sm text-text">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <FoodPicker onPick={(picked: FoodItem) => setValues(formForFood(picked))} />
      )}
    </Sheet>
  )
}
