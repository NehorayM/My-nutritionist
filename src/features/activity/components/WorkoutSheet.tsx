import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button, Field, Input, NumberInput, SegmentedControl, Sheet, Textarea } from '@/components/ui'
import { formatDateLabel, formatDuration } from '@/lib/format'
import { notify } from '@/lib/notify'
import { TEXT_LIMITS } from '@/schemas'
import { useActivityStore, type WorkoutResult } from '@/stores/activityStore'
import { INTENSITIES, type Intensity, type Profile } from '@/types'
import { useKcalEstimate } from '../hooks/useWeeklyActivity'
import { countsTowardText, INTENSITY_LABELS, WORKOUT_TYPE_LABELS } from '../model/labels'
import {
  hasErrors,
  initialWorkoutValues,
  toWorkoutInput,
  validateWorkoutForm,
  type WorkoutFormErrors,
  type WorkoutFormValues,
  type WorkoutSheetTarget,
} from '../model/workoutForm'
import { KcalField } from './KcalField'
import { WorkoutTypePicker } from './WorkoutTypePicker'

interface WorkoutSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: WorkoutSheetTarget
  today: string
  profile: Profile
  weightKg: number | null
}

const COPY = {
  log: { title: 'Log workout', description: undefined, submit: 'Save workout', done: 'Workout logged' },
  edit: { title: 'Edit workout', description: undefined, submit: 'Save changes', done: 'Workout updated' },
  complete: {
    title: 'Complete session',
    description: 'Adjust anything that went differently, then log it.',
    submit: 'Log session',
    done: 'Session logged',
  },
} as const

const INTENSITY_OPTIONS = INTENSITIES.map((value) => ({ value, label: INTENSITY_LABELS[value] }))

function save(target: WorkoutSheetTarget, input: ReturnType<typeof toWorkoutInput>): Promise<WorkoutResult> {
  const store = useActivityStore.getState()
  if (target.mode === 'edit') return store.updateWorkout(target.workout.id, input)
  if (target.mode === 'complete') return store.completeScheduled(target.session.id, input)
  return store.logWorkout(input)
}

/** Log, edit, or complete a scheduled session. Validation messages appear under each field. */
export function WorkoutSheet({ open, onOpenChange, target, today, profile, weightKg }: WorkoutSheetProps) {
  const formId = useId()
  const [values, setValues] = useState<WorkoutFormValues>(() => initialWorkoutValues(target, today, profile.preferredWorkoutMinutes))
  const [errors, setErrors] = useState<WorkoutFormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const estimate = useKcalEstimate(values, weightKg)
  const copy = COPY[target.mode]

  // After a failed submit, move focus to the first invalid field once it is marked aria-invalid.
  useEffect(() => {
    if (focusRequest > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [focusRequest])

  function update(patch: Partial<WorkoutFormValues>) {
    const next = { ...values, ...patch }
    setValues(next)
    if (submitted) setErrors(validateWorkoutForm(next, today))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validateWorkoutForm(values, today)
    setSubmitted(true)
    setErrors(found)
    if (hasErrors(found)) {
      setFocusRequest((count) => count + 1)
      return
    }
    setSaving(true)
    const result = await save(target, toWorkoutInput(values, weightKg))
    setSaving(false)
    if (!result.ok) {
      notify.error(result.message)
      return
    }
    const { entry } = result
    const summary = `${WORKOUT_TYPE_LABELS[entry.type]} · ${formatDuration(entry.durationMin)} · ${formatDateLabel(entry.date, today)}`
    const undo =
      target.mode === 'edit'
        ? undefined
        : () => {
            void useActivityStore.getState().deleteWorkout(entry.id)
          }
    notify.success(copy.done, { description: summary, undo, id: `workout-${entry.id}` })
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {copy.submit}
          </Button>
        </>
      }
    >
      <form ref={formRef} id={formId} noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-5 pt-1">
        <WorkoutTypePicker
          value={values.type}
          onChange={(type) => update({ type })}
          hint={countsTowardText(values.type, values.durationMin)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" error={errors.date} required>
            <Input type="date" value={values.date} max={today} onChange={(event) => update({ date: event.target.value })} />
          </Field>
          <Field label="Duration" error={errors.durationMin} required>
            <NumberInput value={values.durationMin} onValueChange={(durationMin) => update({ durationMin })} unit="min" />
          </Field>
        </div>
        <div className="space-y-2">
          <p aria-hidden="true" className="text-sm font-semibold text-text">
            Intensity
          </p>
          <SegmentedControl<Intensity>
            label="Intensity"
            value={values.intensity}
            onValueChange={(intensity) => update({ intensity })}
            options={INTENSITY_OPTIONS}
            fullWidth
          />
        </div>
        <KcalField
          value={values.kcal}
          onChange={(kcal) => update({ kcal })}
          error={errors.kcal}
          estimate={estimate}
          weightKg={weightKg}
          unitSystem={profile.unitSystem}
        />
        <Field label="Notes" optional error={errors.notes}>
          <Textarea
            value={values.notes}
            maxLength={TEXT_LIMITS.workoutNotes}
            rows={2}
            placeholder="How did it feel?"
            onChange={(event) => update({ notes: event.target.value })}
          />
        </Field>
      </form>
    </Sheet>
  )
}
