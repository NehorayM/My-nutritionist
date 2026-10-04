import { useState, type FormEvent } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, NumberInput, SegmentedControl, Select } from '@/components/ui'
import { isWeightChangeGoal } from '@/domain/weight'
import { formatWeight } from '@/lib/format'
import { notify } from '@/lib/notify'
import { useProfileStore } from '@/stores/profileStore'
import type { GoalPace, WellnessGoal } from '@/types'
import { useGoalEstimate } from '../hooks/useGoalEstimate'
import type { ProgressModel } from '../hooks/useProgressModel'
import { goalDraftFromProfile, goalOptions, isGoalDirty, validateGoal, type GoalDraft } from '../lib/goalForm'
import { PACE_LABELS } from '../lib/progressCopy'
import { inputValueToKg, weightError, weightUnitFor } from '../lib/weightUnits'
import { GoalEstimateNote } from './GoalEstimateNote'

const GOAL_HINTS: Record<WellnessGoal, string> = {
  general_wellness: 'Balanced targets for everyday health. Your trend is shown without a target.',
  maintain: 'Targets aim to keep your weight steady; the trend shows how steady it is.',
  lose_weight: 'A gradual, capped pace with calorie floors.',
  gain_weight: 'A gradual, capped pace with a modest surplus.',
  build_muscle: 'Protein-forward targets with a modest surplus to support strength training.',
}

/** Goals whose calorie adjustment depends on the pace (adults only). */
const PACED_GOALS: readonly WellnessGoal[] = ['lose_weight', 'gain_weight', 'build_muscle']

const PACE_OPTIONS = [
  { value: 'gentle', label: PACE_LABELS.gentle },
  { value: 'moderate', label: PACE_LABELS.moderate },
] as const satisfies readonly { value: GoalPace; label: string }[]

const MINOR_NOTE =
  'For people under 18, weight tracking here is wellness-focused: weight-loss and weight-gain goals and target weights aren’t offered, and targets follow general guidance for your age.'

/** Goal, pace and target weight, saved to the profile. Remounts when the saved values change. */
export function GoalCard({ model }: { model: ProgressModel }) {
  const { profile, minor } = model
  const key = [profile.goal, profile.goalPace, profile.targetWeightKg, profile.unitSystem, minor].join('|')
  return <GoalForm key={key} model={model} />
}

function GoalForm({ model }: { model: ProgressModel }) {
  const { profile, minor, today, anchorKg, goalInput } = model
  const save = useProfileStore((s) => s.save)
  const saving = useProfileStore((s) => s.saving)
  const [saved] = useState(() => goalDraftFromProfile(profile, minor))
  const [draft, setDraft] = useState<GoalDraft>(saved)
  const [targetError, setTargetError] = useState<string | null>(null)
  const unit = weightUnitFor(profile.unitSystem)
  const weightGoal = isWeightChangeGoal(draft.goal)
  const paced = !minor && PACED_GOALS.includes(draft.goal)
  const draftTargetKg = draft.target !== null && !weightError(draft.target, unit, '') ? inputValueToKg(draft.target, unit) : null
  const estimate = useGoalEstimate({
    goal: draft.goal,
    pace: draft.pace,
    targetKg: draftTargetKg,
    currentKg: anchorKg,
    isAdult: goalInput.isAdult,
    today,
  })

  function update(patch: Partial<GoalDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setTargetError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateGoal(draft, { profile, minor, currentKg: anchorKg })
    if (!result.ok) {
      setTargetError(result.errors.target ?? null)
      return
    }
    const outcome = await save({ ...profile, ...result.values })
    if (outcome.ok) notify.success('Goal saved')
    else notify.error(outcome.message)
  }

  const fallback = !weightGoal
    ? null
    : !goalInput.isAdult
      ? 'Add your birth date in Profile to see an estimated date — estimates are shown for adults only.'
      : anchorKg === null
        ? 'Log a weigh-in to see an estimated date.'
        : draft.target === null
          ? 'Add a target weight to see an estimated date.'
          : null
  const rates = estimate.paceRatesKg

  return (
    <Card as="section" aria-labelledby="goal-title">
      <CardHeader>
        <CardTitle as="h2" id="goal-title">
          Goal settings
        </CardTitle>
        <CardDescription>Shapes your daily targets and the chart’s target line.</CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <Field label="Goal" hint={minor ? 'Targets follow general wellness guidance for your age.' : GOAL_HINTS[draft.goal]}>
            <Select value={draft.goal} options={goalOptions(minor)} onValueChange={(goal) => update({ goal })} />
          </Field>
          {minor ? <p className="rounded-field bg-surface-2 px-3.5 py-3 text-sm text-text-muted">{MINOR_NOTE}</p> : null}
          {paced ? (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-text" aria-hidden="true">
                Pace
              </p>
              <SegmentedControl<GoalPace>
                label="Pace"
                value={draft.pace}
                onValueChange={(pace) => update({ pace })}
                options={PACE_OPTIONS}
                fullWidth
              />
              <p className="text-xs text-text-muted">
                {rates
                  ? `Gentle ≈ ${formatWeight(rates.gentle, profile.unitSystem)}/week · Moderate ≈ ${formatWeight(rates.moderate, profile.unitSystem)}/week at your current weight. Both are capped for safety.`
                  : 'Both paces are gradual and capped for safety.'}
              </p>
            </div>
          ) : null}
          {weightGoal ? (
            <>
              <Field label="Target weight" optional error={targetError ?? undefined}>
                <NumberInput value={draft.target} onValueChange={(target) => update({ target })} unit={unit} />
              </Field>
              <GoalEstimateNote trajectory={estimate.trajectory} unitSystem={profile.unitSystem} fallback={fallback} />
            </>
          ) : null}
          <Button type="submit" variant="secondary" fullWidth loading={saving} disabled={!isGoalDirty(draft, saved)}>
            Save goal
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
