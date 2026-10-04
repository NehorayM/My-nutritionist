import type { Profile } from '@/types'
import { ADULT_AGE, profileAge } from '@/domain/profile'
import type { WeightGoalInput } from './types'

type GoalProfile = Pick<Profile, 'birthDate' | 'targetWeightKg' | 'goal' | 'goalPace'>

/**
 * Goal settings for calculateTrajectory / buildWeightChart from a profile. Adulthood needs a known birth
 * date: an unknown age is treated like a minor's (no trajectory), the protective choice.
 */
export function weightGoalInput(profile: GoalProfile, today: string): WeightGoalInput {
  const age = profileAge(profile, today)
  return {
    targetKg: profile.targetWeightKg,
    goal: profile.goal,
    goalPace: profile.goalPace,
    isAdult: age !== null && age >= ADULT_AGE,
  }
}
