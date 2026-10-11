import { useState } from 'react'
import { Button, Field, Input, Select, Sheet, Switch, ToggleChip } from '@/components/ui'
import { mealLabel } from '@/domain/meals'
import { notify } from '@/lib/notify'
import { useRemindersStore, type ReminderInput } from '@/stores/remindersStore'
import { MEAL_TYPES, REMINDER_KINDS, type MealType, type ReminderKind, type ReminderSchedule } from '@/types'
import { KIND_LABELS, timeZoneOptions, WEEKDAY_LETTER, WEEKDAY_SHORT } from './labels'
import { inputOf, newReminderInput, reminderFormError } from './reminderForm'

interface ReminderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule?: ReminderSchedule | null
}

const KIND_OPTIONS = REMINDER_KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))
const MEAL_OPTIONS = MEAL_TYPES.map((value) => ({ value, label: mealLabel(value) }))

/** Create or edit an email reminder: topic, time, weekdays and time zone. */
export function ReminderSheet({ open, onOpenChange, schedule = null }: ReminderSheetProps) {
  const [input, setInput] = useState<ReminderInput>(() => (schedule ? inputOf(schedule) : newReminderInput()))
  const [saving, setSaving] = useState(false)
  const error = reminderFormError(input)
  const patch = (next: Partial<ReminderInput>) => setInput((current) => ({ ...current, ...next }))

  async function save() {
    if (error) return
    setSaving(true)
    const result = await useRemindersStore.getState().save(input, schedule?.id)
    setSaving(false)
    if (!result.ok) {
      notify.error(result.message)
      return
    }
    notify.success(schedule ? 'Reminder updated' : 'Reminder added')
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={schedule ? 'Edit reminder' : 'New email reminder'}
      description="Sent to your account’s email address at this local time."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={saving} disabled={error !== null} onClick={() => void save()}>
            {schedule ? 'Save' : 'Add reminder'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reminder">
          <Select
            value={input.kind}
            options={KIND_OPTIONS}
            onValueChange={(kind: ReminderKind) => {
              const mealType = input.mealType ?? 'lunch'
              // A new reminder follows the usual time of its topic; an edited one keeps its time.
              const localTime = schedule ? input.localTime : newReminderInput(kind, mealType).localTime
              patch({ kind, mealType: kind === 'meal_log' ? mealType : null, localTime })
            }}
          />
        </Field>
        {input.kind === 'meal_log' ? (
          <Field label="Meal">
            <Select
              value={input.mealType ?? 'lunch'}
              options={MEAL_OPTIONS}
              onValueChange={(mealType: MealType) => patch({ mealType, localTime: schedule ? input.localTime : newReminderInput('meal_log', mealType).localTime })}
            />
          </Field>
        ) : null}
        <Field label="Time">
          <Input type="time" value={input.localTime} onChange={(event) => patch({ localTime: event.target.value.slice(0, 5) })} />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-text">Days</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LETTER.map((letter, day) => (
              <ToggleChip
                key={WEEKDAY_SHORT[day]}
                aria-label={WEEKDAY_SHORT[day]}
                pressed={input.days.includes(day)}
                onPressedChange={(on) => patch({ days: on ? [...input.days, day].sort((a, b) => a - b) : input.days.filter((d) => d !== day) })}
                className="min-w-10 justify-center"
              >
                {letter}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
        <Field label="Time zone">
          <Select value={input.timezone} options={timeZoneOptions(input.timezone).map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))} onValueChange={(timezone) => patch({ timezone })} />
        </Field>
        {input.kind === 'meal_log' ? (
          <Switch checked={input.skipIfLogged} onCheckedChange={(skipIfLogged) => patch({ skipIfLogged })} label="Skip if I already logged it" description="No email when that meal already has food logged." />
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </Sheet>
  )
}
