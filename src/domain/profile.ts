import type { Profile } from '@/types'
import { ageOn, isDateKey } from './dates'

export const ADULT_AGE = 18

export function createDefaultProfile(userId: string, nowIso: string): Profile {
  return {
    userId,
    displayName: '',
    birthDate: null,
    sex: 'unspecified',
    heightCm: null,
    currentWeightKg: null,
    targetWeightKg: null,
    activityLevel: 'light',
    goal: 'general_wellness',
    goalPace: 'gentle',
    dietType: 'balanced',
    allergies: [],
    dislikes: [],
    preferredCuisines: [],
    maxPrepMinutes: 30,
    cookingSkill: 'intermediate',
    strengthSessionsPerWeek: 2,
    cardioSessionsPerWeek: 2,
    preferredWorkoutMinutes: 40,
    unitSystem: 'metric',
    weekStartsOn: 1,
    reminders: { weighIn: true, activity: true },
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

/** Age in years on `today`, or null when the birth date is unknown/invalid. */
export function profileAge(profile: Pick<Profile, 'birthDate'>, today: string): number | null {
  if (!profile.birthDate || !isDateKey(profile.birthDate)) return null
  return ageOn(profile.birthDate, today)
}

/** Minors get general wellness tracking only — never weight-change targets. */
export function isMinor(profile: Pick<Profile, 'birthDate'>, today: string): boolean {
  const age = profileAge(profile, today)
  return age !== null && age < ADULT_AGE
}

/** Fields required for personalized energy estimates. */
export function missingProfileFields(
  profile: Pick<Profile, 'birthDate' | 'heightCm' | 'currentWeightKg'> | null,
  latestWeightKg: number | null,
): Array<'birthDate' | 'heightCm' | 'weight'> {
  if (!profile) return ['birthDate', 'heightCm', 'weight']
  const missing: Array<'birthDate' | 'heightCm' | 'weight'> = []
  if (!profile.birthDate) missing.push('birthDate')
  if (profile.heightCm === null) missing.push('heightCm')
  if (latestWeightKg === null && profile.currentWeightKg === null) missing.push('weight')
  return missing
}
