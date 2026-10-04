import { useState, type FormEvent } from 'react'
import { Button, Sheet } from '@/components/ui'
import { notify } from '@/lib/notify'
import { useWeightStore } from '@/stores/weightStore'
import type { UnitSystem, WeightEntry } from '@/types'
import { useWeighInForm } from '../hooks/useWeighInForm'
import { draftFromEntry, validateWeighIn } from '../lib/weighInForm'
import { weightUnitFor } from '../lib/weightUnits'
import { WeighInFields } from './WeighInFields'

const FORM_ID = 'edit-weigh-in-form'

interface EditWeighInSheetProps {
  /** Entry being edited; null closes the sheet. */
  entry: WeightEntry | null
  unitSystem: UnitSystem
  today: string
  onClose: () => void
}

/** Edit a stored weigh-in in a sheet; the form remounts per entry so it always starts from saved values. */
export function EditWeighInSheet({ entry, unitSystem, today, onClose }: EditWeighInSheetProps) {
  const [saving, setSaving] = useState(false)
  return (
    <Sheet
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Edit weigh-in"
      description="Changes update your chart and stats right away."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      {entry ? (
        <EditForm
          key={entry.id}
          entry={entry}
          unitSystem={unitSystem}
          today={today}
          saving={saving}
          onSavingChange={setSaving}
          onDone={onClose}
        />
      ) : null}
    </Sheet>
  )
}

interface EditFormProps {
  entry: WeightEntry
  unitSystem: UnitSystem
  today: string
  saving: boolean
  onSavingChange: (saving: boolean) => void
  onDone: () => void
}

function EditForm({ entry, unitSystem, today, saving, onSavingChange: setSaving, onDone }: EditFormProps) {
  const update = useWeightStore((s) => s.update)
  const [initial] = useState(() => draftFromEntry(entry, unitSystem))
  const { draft, errors, change, fail, formRef } = useWeighInForm(() => initial)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const result = validateWeighIn(draft, {
      unitSystem,
      now: new Date(),
      original: { weight: initial.weight, weightKg: entry.weightKg, inputUnit: entry.inputUnit },
    })
    if (!result.ok) {
      fail(result.errors)
      return
    }
    setSaving(true)
    const saved = await update({ ...entry, ...result.values })
    setSaving(false)
    if (!saved.ok) {
      notify.error(saved.message)
      return
    }
    notify.success('Weigh-in updated')
    onDone()
  }

  return (
    <form
      id={FORM_ID}
      ref={formRef}
      noValidate
      aria-busy={saving || undefined}
      onSubmit={(event) => void handleSubmit(event)}
      className="pt-1"
    >
      <WeighInFields
        draft={draft}
        errors={errors}
        unit={weightUnitFor(unitSystem)}
        today={today}
        onChange={change}
        showNote
      />
    </form>
  )
}
