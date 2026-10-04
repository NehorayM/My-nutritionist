import { MICRO_KEYS, type DietType, type MicroKey, type Sex } from '@/types'
import { AGE_BAND_LABELS, PLANT_BASED_IRON_FACTOR, referenceIntake, upperLimit, type AgeBand } from './dri'
import { PLANT_BASED_DIETS } from './diets'
import { roundTenth } from './format'
import type { NutrientTarget } from './types'

export interface MicronutrientTargets {
  targets: Record<MicroKey, NutrientTarget>
  notes: string[]
}

const GROUP_LABELS: Readonly<Record<'female' | 'male', { teen: string; adult: string }>> = {
  female: { teen: 'girls', adult: 'women' },
  male: { teen: 'boys', adult: 'men' },
}

function referenceNote(sex: Sex, band: AgeBand): string {
  if (sex === 'unspecified') {
    return `Vitamin and mineral targets use the higher of the female and male reference intakes for ${AGE_BAND_LABELS[band]}.`
  }
  const group = GROUP_LABELS[sex][band === '14-18' ? 'teen' : 'adult']
  return `Vitamin and mineral targets use reference intakes for ${group}, ${AGE_BAND_LABELS[band]}.`
}

/**
 * Micronutrient targets (kind 'goal'): RDA/AI for the age band and sex; `max` is the Tolerable Upper
 * Intake Level when one exists (an informational ceiling). Unspecified sex → the higher of the female and
 * male values. Vegetarian and vegan patterns raise the iron target × 1.8 (plant iron is absorbed less).
 */
export function micronutrientTargets(band: AgeBand, sex: Sex, diet: DietType): MicronutrientTargets {
  const plantBased = PLANT_BASED_DIETS.includes(diet)
  const entries = MICRO_KEYS.map((key): [MicroKey, NutrientTarget] => {
    const base = referenceIntake(key, band, sex)
    const amount = key === 'iron' && plantBased ? roundTenth(base * PLANT_BASED_IRON_FACTOR) : base
    return [key, { amount, min: null, max: upperLimit(key, band), kind: 'goal' }]
  })

  const notes = [referenceNote(sex, band)]
  if (plantBased) notes.push('Iron target is 1.8 times higher for vegetarian and vegan eating, because iron from plants is absorbed less.')
  return { targets: Object.fromEntries(entries) as Record<MicroKey, NutrientTarget>, notes }
}
