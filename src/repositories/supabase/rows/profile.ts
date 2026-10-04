import type {
  ActivityLevel,
  Allergen,
  CookingSkill,
  Cuisine,
  DietType,
  GoalPace,
  Profile,
  ReminderPreferences,
  Sex,
  UnitSystem,
  WellnessGoal,
} from '@/types'
import { profileSchema } from '@/schemas'
import { asRow, numeric, parseMapped } from './shared'

/** `public.profiles` row (001_initial_schema.sql). `id` is the owner (auth.users.id). */
export interface ProfileRow {
  id: string
  display_name: string
  birth_date: string | null
  sex: Sex
  height_cm: number | null
  current_weight_kg: number | null
  target_weight_kg: number | null
  activity_level: ActivityLevel
  goal: WellnessGoal
  goal_pace: GoalPace
  diet_type: DietType
  allergies: Allergen[]
  dislikes: string[]
  preferred_cuisines: Cuisine[]
  max_prep_minutes: number
  cooking_skill: CookingSkill
  strength_sessions_per_week: number
  cardio_sessions_per_week: number
  preferred_workout_minutes: number
  unit_system: UnitSystem
  week_starts_on: 0 | 1
  reminders: ReminderPreferences
  created_at: string
  updated_at: string
}

export function profileToRow(profile: Profile): ProfileRow {
  return {
    id: profile.userId,
    display_name: profile.displayName,
    birth_date: profile.birthDate,
    sex: profile.sex,
    height_cm: profile.heightCm,
    current_weight_kg: profile.currentWeightKg,
    target_weight_kg: profile.targetWeightKg,
    activity_level: profile.activityLevel,
    goal: profile.goal,
    goal_pace: profile.goalPace,
    diet_type: profile.dietType,
    allergies: profile.allergies,
    dislikes: profile.dislikes,
    preferred_cuisines: profile.preferredCuisines,
    max_prep_minutes: profile.maxPrepMinutes,
    cooking_skill: profile.cookingSkill,
    strength_sessions_per_week: profile.strengthSessionsPerWeek,
    cardio_sessions_per_week: profile.cardioSessionsPerWeek,
    preferred_workout_minutes: profile.preferredWorkoutMinutes,
    unit_system: profile.unitSystem,
    week_starts_on: profile.weekStartsOn,
    reminders: profile.reminders,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  }
}

export function profileFromRow(value: unknown): Profile | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(profileSchema, {
    userId: row.id,
    displayName: row.display_name,
    birthDate: row.birth_date,
    sex: row.sex,
    heightCm: numeric(row.height_cm),
    currentWeightKg: numeric(row.current_weight_kg),
    targetWeightKg: numeric(row.target_weight_kg),
    activityLevel: row.activity_level,
    goal: row.goal,
    goalPace: row.goal_pace,
    dietType: row.diet_type,
    allergies: row.allergies,
    dislikes: row.dislikes,
    preferredCuisines: row.preferred_cuisines,
    maxPrepMinutes: numeric(row.max_prep_minutes),
    cookingSkill: row.cooking_skill,
    strengthSessionsPerWeek: numeric(row.strength_sessions_per_week),
    cardioSessionsPerWeek: numeric(row.cardio_sessions_per_week),
    preferredWorkoutMinutes: numeric(row.preferred_workout_minutes),
    unitSystem: row.unit_system,
    weekStartsOn: numeric(row.week_starts_on),
    reminders: row.reminders,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
