import type { Ref } from 'react'
import { Field, Input, NumberInput, Textarea } from '@/components/ui'
import { TEXT_LIMITS } from '@/schemas/limits'
import type { WeightUnit } from '@/types'
import type { WeighInDraft, WeighInErrors } from '../lib/weighInForm'

interface WeighInFieldsProps {
  draft: WeighInDraft
  errors: WeighInErrors
  unit: WeightUnit
  today: string
  onChange: (patch: Partial<WeighInDraft>) => void
  weightRef?: Ref<HTMLInputElement>
  /** Show the note field (the quick card reveals it on demand). */
  showNote: boolean
  /** Focus the note when it appears (after "Add a note"). */
  focusNote?: boolean
}

/** Weight, date, time and note controls shared by the quick weigh-in card and the edit sheet. */
export function WeighInFields({ draft, errors, unit, today, onChange, weightRef, showNote, focusNote = false }: WeighInFieldsProps) {
  return (
    <div className="space-y-4">
      <Field label="Weight" error={errors.weight} required>
        <NumberInput
          ref={weightRef}
          value={draft.weight}
          onValueChange={(weight) => onChange({ weight })}
          unit={unit}
          placeholder={unit === 'lb' ? 'e.g. 158.4' : 'e.g. 71.8'}
        />
      </Field>
      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-3">
        <Field label="Date" error={errors.date} required>
          <Input type="date" value={draft.date} max={today} onChange={(event) => onChange({ date: event.target.value })} />
        </Field>
        <Field label="Time" error={errors.time} required>
          <Input type="time" value={draft.time} onChange={(event) => onChange({ time: event.target.value })} />
        </Field>
      </div>
      {showNote ? (
        <Field label="Note" optional error={errors.note} hint={`Up to ${TEXT_LIMITS.weightNote} characters, e.g. “after a long run”.`}>
          <Textarea rows={2} autoFocus={focusNote} value={draft.note} onChange={(event) => onChange({ note: event.target.value })} />
        </Field>
      ) : null}
    </div>
  )
}
