import type { Allergen } from './food'

export const SEXES = ['female', 'male', 'unspecified'] as const
export type Sex = (typeof SEXES)[number]

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]

/** Product goal chosen by the user. Not a medical recommendation. */
export const WELLNESS_GOALS = ['general_wellness', 'maintain', 'lose_weight', 'gain_weight', 'build_muscle'] as const
export type WellnessGoal = (typeof WELLNESS_GOALS)[number]

export const GOAL_PACES = ['gentle', 'moderate'] as const
export type GoalPace = (typeof GOAL_PACES)[number]

/** Diet pattern preference/constraint. New patterns: add here + rules in domain/adaptive/diets.ts. */
export const DIET_TYPES = ['balanced', 'high_protein', 'mediterranean', 'keto', 'vegetarian', 'vegan'] as const
export type DietType = (typeof DIET_TYPES)[number]

export const CUISINES = [
  'mediterranean',
  'israeli',
  'middle_eastern',
  'american',
  'italian',
  'asian',
  'mexican',
  'indian',
] as const
export type Cuisine = (typeof CUISINES)[number]

export const COOKING_SKILLS = ['beginner', 'intermediate', 'confident'] as const
export type CookingSkill = (typeof COOKING_SKILLS)[number]

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const
export type UnitSystem = (typeof UNIT_SYSTEMS)[number]

export interface ReminderPreferences {
  /** Show an in-app morning weigh-in nudge on the Progress tab. */
  weighIn: boolean
  /** Show an in-app nudge when planned weekly sessions remain. */
  activity: boolean
}

/** Personal Profile. All body values are stored in metric units. */
export interface Profile {
  /** Equals the owning user id (auth.users.id, or the local guest id). */
  userId: string
  displayName: string
  /** YYYY-MM-DD. Used to derive age; null = not provided. */
  birthDate: string | null
  sex: Sex
  heightCm: number | null
  /** Used when no weigh-in exists yet. */
  currentWeightKg: number | null
  targetWeightKg: number | null
  activityLevel: ActivityLevel
  goal: WellnessGoal
  goalPace: GoalPace
  dietType: DietType
  allergies: Allergen[]
  /** Free-text dislikes matched against food names/tags (case-insensitive). */
  dislikes: string[]
  preferredCuisines: Cuisine[]
  /** Preferred maximum preparation time per meal, minutes. */
  maxPrepMinutes: number
  cookingSkill: CookingSkill
  strengthSessionsPerWeek: number
  cardioSessionsPerWeek: number
  /** Typical session length the user prefers, minutes (used by Smart Catch-Up). */
  preferredWorkoutMinutes: number
  unitSystem: UnitSystem
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1
  reminders: ReminderPreferences
  createdAt: string
  updatedAt: string
}
