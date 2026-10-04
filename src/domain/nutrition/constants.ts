import type { ActivityLevel, GoalPace, MealType, Sex, WellnessGoal } from '@/types'

/*
 * Constants of the Daily Target Engine. Values are wellness conventions built on the sources cited
 * next to each one (full notes: .research-cache/nutrition_science.md, verified 2026-10-03).
 */

// ── Energy ───────────────────────────────────────────────────────────────────────────────────

/**
 * Mifflin-St Jeor resting energy (kcal/day) = 10·kg + 6.25·cm − 5·age + sex constant.
 * Mifflin MD, St Jeor ST et al. Am J Clin Nutr 1990;51(2):241-7 (PMID 2305711).
 */
export const MIFFLIN_ST_JEOR = { perKg: 10, perCm: 6.25, perYear: -5 } as const

/**
 * Sex constants of the simplified equations: male +5, female −161. `unspecified` is an app convention:
 * the mean of both equations (−78, equal to the combined regression with sex = 0.5).
 */
export const MIFFLIN_SEX_CONSTANT: Readonly<Record<Sex, number>> = { male: 5, female: -161, unspecified: -78 }

/**
 * Activity multipliers (maintenance = BMR × factor). Conventional dietetics scale; no single primary
 * publication defines it. 1.2 sits below the FAO/WHO/UNU 2004 and NASEM 2023 "sedentary" PAL (~1.4), so
 * estimates lean conservative — the UI always labels them as estimates.
 */
export const ACTIVITY_FACTORS: Readonly<Record<ActivityLevel, number>> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

/**
 * Population reference energy for general (non-personalized) targets: the 2,000-kcal reference used by
 * FDA Daily Values and the Dietary Guidelines for Americans 2025-2030 food-pattern servings.
 */
export const POPULATION_DEFAULT_KCAL = 2000

/** Energy targets are rounded to this many kcal (avoids false precision). */
export const KCAL_ROUNDING = 10

/** Energy target comfort range: amount ± 10 %. */
export const ENERGY_RANGE_SHARE = 0.1

/**
 * Inputs outside these ranges are treated as missing (entry errors). Same bounds as the database checks
 * (`schemas/limits.ts`); age 0–120 years.
 */
export const PLAUSIBLE_INPUTS = {
  weightKg: { min: 20, max: 400 },
  heightCm: { min: 50, max: 272 },
  ageYears: { min: 0, max: 120 },
} as const

/** A resting estimate below this almost certainly comes from mistyped inputs → general targets. */
export const MIN_PLAUSIBLE_BMR_KCAL = 400

// ── Goal adjustment (adults only) ─────────────────────────────────────────────────────────────

/** Static energy density of body-weight change (~3,500 kcal/lb); Hall KD et al. Lancet 2011 (PMID 21872751). */
export const KCAL_PER_KG_BODY_WEIGHT = 7700
export const DAYS_PER_WEEK = 7

/** Planned loss rate, % of body weight per week (Helms 2014 upper bound is 1 %/wk). */
export const LOSS_RATE_PCT_PER_WEEK: Readonly<Record<GoalPace, number>> = { gentle: 0.25, moderate: 0.5 }

/** Deficit caps, kcal/day: AHA/ACC/TOS 2013 obesity guideline 500 kcal/day option (PMID 24222017); CDC 1–2 lb/wk. */
export const LOSS_DEFICIT_KCAL_CAP: Readonly<Record<GoalPace, number>> = { gentle: 250, moderate: 500 }

/** Planned gain rate, % of body weight per week: Iraki J et al. Sports 2019 (PMID 31247944), novice/intermediate. */
export const GAIN_RATE_PCT_PER_WEEK: Readonly<Record<GoalPace, number>> = { gentle: 0.25, moderate: 0.5 }

/** Surplus caps, kcal/day: conservative end of the ~10–20 % surplus range (Iraki 2019). */
export const GAIN_SURPLUS_KCAL_CAP: Readonly<Record<GoalPace, number>> = { gentle: 250, moderate: 300 }

/**
 * Minimum energy target without professional guidance: AHA/ACC/TOS 2013 reduced-calorie options start at
 * 1,200 (women) / 1,500 (men) kcal/day. `unspecified` uses the more protective 1,500 (app convention).
 */
export const CALORIE_FLOOR_KCAL: Readonly<Record<Sex, number>> = { female: 1200, male: 1500, unspecified: 1500 }

// ── Macronutrients ───────────────────────────────────────────────────────────────────────────

/** Atwater energy factors, kcal per gram. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const

export interface ShareRange {
  /** Percent of energy. */
  min: number
  max: number
}

/**
 * Acceptable Macronutrient Distribution Ranges (% of energy), NASEM DRI Summary Tables.
 * Ages 4–18: protein 10–30, fat 25–35; adults 19+: protein 10–35, fat 20–35; carbohydrate 45–65.
 */
export const AMDR = {
  teen: { protein: { min: 10, max: 30 }, fat: { min: 25, max: 35 }, carbs: { min: 45, max: 65 } },
  adult: { protein: { min: 10, max: 35 }, fat: { min: 20, max: 35 }, carbs: { min: 45, max: 65 } },
} as const satisfies Record<string, Record<'protein' | 'fat' | 'carbs', ShareRange>>

/**
 * Adult protein, g per kg body weight per day, by goal. DGA 2025-2030: 1.2–1.6 g/kg; ACSM/AND/DC 2016:
 * 1.2–2.0 g/kg for active people; ISSN 2017: 1.4–2.0 g/kg; Iraki 2019: 1.6–2.2 g/kg when building muscle.
 */
export const PROTEIN_G_PER_KG: Readonly<Record<WellnessGoal, number>> = {
  general_wellness: 1.2,
  maintain: 1.2,
  lose_weight: 1.6,
  gain_weight: 1.4,
  build_muscle: 1.8,
}

/** `high_protein` diet: at least this many g/kg (ISSN 2017; ACSM 2016 upper range). */
export const HIGH_PROTEIN_G_PER_KG = 1.8

/** Under-18s: protein RDA for ages 14–18 (NASEM), shown as an "at least" amount. */
export const MINOR_PROTEIN_G_PER_KG = 0.85

// ── Fiber & limits ───────────────────────────────────────────────────────────────────────────

/** Fiber Adequate Intake basis: 14 g per 1,000 kcal (NASEM 2002/2005; FDA DV 28 g at 2,000 kcal). */
export const FIBER_G_PER_1000_KCAL = 14

/**
 * Keto exception: total carbohydrate — which includes fiber — stays at or below 50 g, so the fiber goal is
 * capped at 20 g (reachable with non-starchy vegetables, avocado, nuts and seeds). App convention.
 */
export const KETO_FIBER_CAP_G = 20

/** Sodium Chronic Disease Risk Reduction intake (ages 14+), NASEM 2019; DGA 2025-2030 "less than 2,300 mg". */
export const SODIUM_LIMIT_MG = 2300

/** Saturated fat below 10 % of energy (DGA 2025-2030; WHO healthy diet fact sheet). */
export const SATURATED_FAT_MAX_SHARE = 0.1

// ── Remaining-day rules ──────────────────────────────────────────────────────────────────────

/**
 * Local time (minutes after midnight) at which a meal slot closes for "remaining meals".
 * Breakfast until 11:00, lunch until 16:30, dinner until 22:00, snacks until 23:00. App convention.
 */
export const MEAL_WINDOW_END_MINUTES: Readonly<Record<MealType, number>> = {
  breakfast: 11 * 60,
  lunch: 16 * 60 + 30,
  dinner: 22 * 60,
  snack: 23 * 60,
}

/** A goal nutrient is a "gap" while at least this share of its target is still to go. */
export const GAP_MIN_REMAINING_SHARE = 0.2

/**
 * Tolerance for comparisons of summed floating-point amounts at an exact boundary
 * (e.g. 18 − 14.4 = 3.5999999999999996). Far below any displayed precision.
 */
export const NUMERIC_TOLERANCE = 1e-9
