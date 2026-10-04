import { Info, NotebookPen } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type Ref } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { formatDateLabel, formatTime, formatWeight } from '@/lib/format'
import { notify } from '@/lib/notify'
import { useWeightStore } from '@/stores/weightStore'
import type { Profile, WeightEntry } from '@/types'
import { useWeighInForm } from '../hooks/useWeighInForm'
import { firstWeighInOn } from '../lib/history'
import { duplicateWeighInNotice } from '../lib/progressCopy'
import { newWeighInDraft, toTimeValue, validateWeighIn, type WeighInDraft } from '../lib/weighInForm'
import { weightUnitFor } from '../lib/weightUnits'
import { WeighInFields } from './WeighInFields'

const CLOCK_REFRESH_MS = 30_000

interface WeighInCardProps {
  profile: Profile
  entries: readonly WeightEntry[]
  today: string
  weightRef: Ref<HTMLInputElement>
}

/** Quick weigh-in: weight in the user's unit, date (no future days), time, optional note. */
export function WeighInCard({ profile, entries, today, weightRef }: WeighInCardProps) {
  const add = useWeightStore((s) => s.add)
  const { draft, errors, change, fail, reset, formRef } = useWeighInForm(() => newWeighInDraft(new Date()))
  const [showNote, setShowNote] = useState(false)
  const [saving, setSaving] = useState(false)
  const [timeEdited, setTimeEdited] = useState(false)
  const unitSystem = profile.unitSystem

  // Until the user picks a time, keep it at "now" so a form left open still records the real time.
  useEffect(() => {
    if (timeEdited) return undefined
    const timer = window.setInterval(() => change({ time: toTimeValue(new Date()) }), CLOCK_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [timeEdited, change])

  function handleChange(patch: Partial<WeighInDraft>) {
    if ('time' in patch) setTimeEdited(true)
    change(patch)
  }

  const notice = useMemo(() => {
    const first = firstWeighInOn(entries, draft.date)
    return first ? duplicateWeighInNotice(first, today, unitSystem) : null
  }, [entries, draft.date, today, unitSystem])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const result = validateWeighIn(draft, { unitSystem, now: new Date() })
    if (!result.ok) {
      fail(result.errors)
      return
    }
    setSaving(true)
    const saved = await add(result.values)
    setSaving(false)
    if (!saved.ok) {
      notify.error(saved.message)
      return
    }
    const { weightKg, date, measuredAt } = result.values
    notify.success('Weigh-in saved', {
      description: `${formatWeight(weightKg, unitSystem)} · ${formatDateLabel(date, today)}, ${formatTime(measuredAt)}`,
    })
    reset(newWeighInDraft(new Date()))
    setShowNote(false)
    setTimeEdited(false)
  }

  return (
    <Card as="section" aria-labelledby="weigh-in-title">
      <CardHeader>
        <CardTitle as="h2" id="weigh-in-title">
          Log a weigh-in
        </CardTitle>
        <CardDescription>Mornings, before breakfast, give the most comparable numbers.</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <WeighInFields
            draft={draft}
            errors={errors}
            unit={weightUnitFor(unitSystem)}
            today={today}
            onChange={handleChange}
            weightRef={weightRef}
            showNote={showNote}
            focusNote
          />
          {notice ? (
            <output className="flex gap-2 rounded-field bg-surface-2 px-3.5 py-2.5 text-sm text-text-muted">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
              <span>{notice}</span>
            </output>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={saving} className="flex-1">
              Save weigh-in
            </Button>
            {showNote ? null : (
              <Button variant="ghost" leadingIcon={<NotebookPen />} onClick={() => setShowNote(true)}>
                Add a note
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
