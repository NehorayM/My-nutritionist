import { ENERGY_RANGE_SHARE } from './constants'
import { resolveTargetContext } from './context'
import { estimateEnergy } from './estimate'
import { roundKcal } from './format'
import { fiberTarget, limitTargets } from './limits'
import { macroTargets } from './macros'
import { micronutrientTargets } from './micronutrients'
import type { DailyTargets, DailyTargetsInput, NutrientTarget } from './types'

function energyTarget(energyKcal: number): NutrientTarget {
  return {
    amount: energyKcal,
    min: roundKcal(energyKcal * (1 - ENERGY_RANGE_SHARE)),
    max: roundKcal(energyKcal * (1 + ENERGY_RANGE_SHARE)),
    kind: 'energy',
  }
}

/**
 * Daily Target Engine. Physiological estimate (Mifflin-St Jeor × activity) → product goal (capped
 * deficit/surplus with floors; none for minors, incomplete profiles or wellness goals) → nutrient targets
 * (macros by diet pattern, fiber 14 g/1,000 kcal, micronutrient RDA/AI by age band & sex, sodium and
 * saturated-fat limits). Total sugars get no target. Weight = `latestWeightKg ?? profile.currentWeightKg`.
 *
 * Every number is explained in `assumptions` (short, neutral sentences for "How targets are calculated").
 * @throws RangeError when `date` is not a valid YYYY-MM-DD key.
 */
export function calculateDailyTargets(input: DailyTargetsInput): DailyTargets {
  const ctx = resolveTargetContext(input)
  const energy = estimateEnergy(ctx)
  const macros = macroTargets({
    energyKcal: energy.energyKcal,
    weightKg: ctx.weightKg,
    minor: ctx.minor,
    teenAmdr: ctx.ageBand === '14-18',
    goal: ctx.goal,
    diet: ctx.diet,
  })
  const fiber = fiberTarget(energy.energyKcal, ctx.diet)
  const limits = limitTargets(energy.energyKcal)
  const micros = micronutrientTargets(ctx.ageBand, ctx.sex, ctx.diet)

  const assumptions = [...energy.notes]
  if (ctx.diet !== ctx.requestedDiet) {
    assumptions.push('Keto targets aren’t set for people under 18, so balanced targets are shown.')
  }
  assumptions.push(...macros.notes, fiber.note, ...micros.notes)
  if (ctx.ageYears === null) assumptions.push('Adult reference values are used until a birth date is added.')
  assumptions.push(limits.note)

  return {
    mode: energy.mode,
    estimate: energy.estimate,
    targets: {
      calories: energyTarget(energy.energyKcal),
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: fiber.target,
      saturatedFat: limits.saturatedFat,
      sodium: limits.sodium,
      ...micros.targets,
    },
    assumptions,
  }
}
