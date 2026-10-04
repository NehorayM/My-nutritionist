import { useId, useState, type FormEvent } from 'react'
import { Button, Field, NumberInput, Sheet } from '@/components/ui'
import { LIMITS } from '@/schemas'
import { notify } from '@/lib/notify'
import { useProfileStore } from '@/stores/profileStore'
import type { Profile } from '@/types'
import { Stepper } from './Stepper'

interface WeeklyPlanSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile
}

const SESSIONS = LIMITS.sessionsPerWeek
const MINUTES = LIMITS.preferredWorkoutMinutes

function minutesError(minutes: number | null): string | undefined {
  if (minutes !== null && Number.isInteger(minutes) && minutes >= MINUTES.min && minutes <= MINUTES.max) return undefined
  return `Enter whole minutes between ${MINUTES.min} and ${MINUTES.max}.`
}

/** Weekly plan editor; saving updates the profile, so this week's progress recomputes right away. */
export function WeeklyPlanSheet({ open, onOpenChange, profile }: WeeklyPlanSheetProps) {
  const formId = useId()
  const [strength, setStrength] = useState(profile.strengthSessionsPerWeek)
  const [cardio, setCardio] = useState(profile.cardioSessionsPerWeek)
  const [minutes, setMinutes] = useState<number | null>(profile.preferredWorkoutMinutes)
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const saving = useProfileStore((s) => s.saving)
  const error = submitted ? minutesError(minutes) : undefined

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setFailure(null)
    if (minutesError(minutes) || minutes === null) {
      event.currentTarget.querySelector<HTMLElement>('input')?.focus()
      return
    }
    const current = useProfileStore.getState().profile ?? profile
    const result = await useProfileStore.getState().save({
      ...current,
      strengthSessionsPerWeek: strength,
      cardioSessionsPerWeek: cardio,
      preferredWorkoutMinutes: minutes,
    })
    if (!result.ok) {
      setFailure(result.message)
      return
    }
    notify.success('Weekly plan updated', { description: 'This week’s progress now uses your new plan.' })
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Weekly plan"
      description="Choose what a typical week looks like for you. Changes apply to this week right away."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Save plan
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-5 pt-1">
        <Stepper
          label="Strength sessions"
          noun="strength sessions"
          nounOne="strength session"
          hint="Resistance or weight training."
          value={strength}
          min={SESSIONS.min}
          max={SESSIONS.max}
          onChange={setStrength}
        />
        <Stepper
          label="Cardio sessions"
          noun="cardio sessions"
          nounOne="cardio session"
          hint="Runs, rides, swims, HIIT and walks of 20+ minutes."
          value={cardio}
          min={SESSIONS.min}
          max={SESSIONS.max}
          onChange={setCardio}
        />
        <Field
          label="Preferred session length"
          error={error}
          required
          hint="Smart Catch-Up suggests sessions close to this length (20–60 minutes)."
        >
          <NumberInput value={minutes} onValueChange={setMinutes} unit="min" />
        </Field>
        {failure ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {failure}
          </p>
        ) : null}
      </form>
    </Sheet>
  )
}
