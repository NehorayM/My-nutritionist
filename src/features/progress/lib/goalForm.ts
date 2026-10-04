import type { SelectOption } from '@/components/ui'
import { GOAL_TOLERANCE_KG, isWeightChangeGoal } from '@/domain/weight'
import { formatWeight } from '@/lib/format'
import type { GoalPace, Profile, UnitSystem, WellnessGoal } from '@/types'
import { WELLNESS_GOALS } from '@/types'
import { GOAL_LABELS } from './progressCopy'
import { inputValueToKg, kgToInputValue, weightError, weightUnitFor } from './weightUnits'

export interface GoalDraft {
  goal: WellnessGoal
  pace: GoalPace
  /** Target weight in the user's unit; null = none. */
  target: number | null
}

export type GoalValues = Pick<Profile, 'goal' | 'goalPace' | 'targetWeightKg'>
export type GoalValidation = { ok: true; values: GoalValues } | { ok: false; errors: { target?: string } }

/** Goals offered: under-18s never see weight-loss or weight-gain goals. */
export function goalOptions(minor: boolean): SelectOption<WellnessGoal>[] {
  return WELLNESS_GOALS.filter((goal) => !minor || !isWeightChangeGoal(goal)).map((goal) => ({
    value: goal,
    label: GOAL_LABELS[goal],
  }))
}

export function goalDraftFromProfile(profile: Profile, minor: boolean): GoalDraft {
  const unit = weightUnitFor(profile.unitSystem)
  return {
    goal: minor && isWeightChangeGoal(profile.goal) ? 'general_wellness' : profile.goal,
    pace: profile.goalPace,
    target: profile.targetWeightKg === null ? null : kgToInputValue(profile.targetWeightKg, unit),
  }
}

interface ValidateGoalOptions {
  profile: Profile
  minor: boolean
  /** Latest known body weight (kg) for the direction check; null skips it. */
  currentKg: number | null
}

function directionError(goal: WellnessGoal, targetKg: number, currentKg: number, unitSystem: UnitSystem): string | null {
  const current = formatWeight(currentKg, unitSystem)
  if (Math.abs(targetKg - currentKg) <= GOAL_TOLERANCE_KG) {
    return `That's within ${formatWeight(GOAL_TOLERANCE_KG, unitSystem)} of your current ${current} — “Maintain weight” may fit better.`
  }
  if (goal === 'lose_weight' && targetKg > currentKg) {
    return `For a weight-loss goal, choose a target below your current ${current}.`
  }
  if (goal === 'gain_weight' && targetKg < currentKg) {
    return `For a weight-gain goal, choose a target above your current ${current}.`
  }
  return null
}

/**
 * Converts the goal form to profile values. The target is only edited for adult weight-change goals;
 * otherwise the stored target is kept untouched (it is simply not used).
 */
export function validateGoal(draft: GoalDraft, { profile, minor, currentKg }: ValidateGoalOptions): GoalValidation {
  const goal = minor && isWeightChangeGoal(draft.goal) ? 'general_wellness' : draft.goal
  const base = { goal, goalPace: draft.pace }
  if (!isWeightChangeGoal(goal)) return { ok: true, values: { ...base, targetWeightKg: profile.targetWeightKg } }
  if (draft.target === null) return { ok: true, values: { ...base, targetWeightKg: null } }

  const unit = weightUnitFor(profile.unitSystem)
  const rangeMessage = weightError(draft.target, unit, '')
  if (rangeMessage) return { ok: false, errors: { target: rangeMessage } }

  const unchanged =
    profile.targetWeightKg !== null && kgToInputValue(profile.targetWeightKg, unit) === draft.target
  const targetKg = unchanged ? profile.targetWeightKg! : inputValueToKg(draft.target, unit)
  const direction = currentKg === null ? null : directionError(goal, targetKg, currentKg, profile.unitSystem)
  if (direction) return { ok: false, errors: { target: direction } }
  return { ok: true, values: { ...base, targetWeightKg: targetKg } }
}

export function isGoalDirty(draft: GoalDraft, saved: GoalDraft): boolean {
  return draft.goal !== saved.goal || draft.pace !== saved.pace || draft.target !== saved.target
}
