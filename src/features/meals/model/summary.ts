import type { NutrientTarget } from '@/domain/nutrition'
import { NUTRIENTS } from '@/domain/nutrients'
import { formatKcal, formatNutrient } from '@/lib/format'
import type { NutrientKey, NutrientTotal, NutrientTotals } from '@/types'

/** Below this many kcal from the target, the day reads as "at your target" rather than a tiny remainder. */
const AT_TARGET_KCAL = 5

/** Known amount of a total, or null when no logged food reported it (shown as "—"). */
export function knownValue(total: NutrientTotal): number | null {
  if (total.knownCount === 0 && total.missingCount > 0) return null
  return total.value
}

export interface CalorieCopy {
  /** "1,240" (or "—"). */
  consumed: string
  /** "760 kcal remaining", "Above target by 120 kcal", "At your target". */
  status: string | null
  target: string | null
  valueText: string
}

export function calorieCopy(total: NutrientTotal, target: NutrientTarget | undefined): CalorieCopy {
  const consumed = knownValue(total)
  const consumedText = formatKcal(consumed, { unit: false })
  if (!target || target.amount <= 0) {
    return { consumed: consumedText, status: null, target: null, valueText: `${formatKcal(consumed)} eaten` }
  }
  const targetText = formatKcal(target.amount)
  const difference = target.amount - (consumed ?? 0)
  let status: string
  if (Math.abs(difference) < AT_TARGET_KCAL) status = 'At your target'
  else if (difference > 0) status = `${formatKcal(difference)} remaining`
  else status = `Above target by ${formatKcal(-difference)}`
  return {
    consumed: consumedText,
    status,
    target: targetText,
    valueText: `${formatKcal(consumed)} of ${targetText}, ${status.toLowerCase()}`,
  }
}

export interface AmountCopy {
  /** "62 / 110 g" or "62 g" without a target; "—" when unknown. */
  text: string
  valueText: string
  value: number | null
  max: number | null
}

export function amountCopy(key: NutrientKey, total: NutrientTotal, target: NutrientTarget | undefined): AmountCopy {
  const value = knownValue(total)
  const amount = formatNutrient(key, value)
  if (!target || target.amount <= 0) return { text: amount, valueText: amount, value, max: null }
  const goal = formatNutrient(key, target.amount)
  const text = `${formatNutrient(key, value, { unit: false })} / ${goal}`
  const over = value !== null && value > target.amount ? `, ${formatNutrient(key, value - target.amount)} above target` : ''
  return { text, valueText: `${amount} of ${goal}${over}`, value, max: target.amount }
}

/** "Fiber, saturated fat and vitamin D": first label capitalized, later ones in sentence case ("vitamin D"). */
function nutrientList(keys: readonly NutrientKey[]): string {
  const names = keys.map((key, index) => {
    const label = NUTRIENTS[key].label
    return index === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1)
  })
  return names.length === 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

const verbFor = (keys: readonly NutrientKey[]) => (keys.length === 1 ? 'isn’t' : 'aren’t')

/**
 * Honest note about missing data among `keys`, or null when every logged food reported them:
 * "Fiber isn’t reported for some foods, so this total may be higher." and, for nutrients no logged food
 * reported, "Sodium and iron aren’t reported for these foods."
 */
export function missingDataNote(totals: NutrientTotals, keys: readonly NutrientKey[]): string | null {
  const partial = keys.filter((key) => totals[key].missingCount > 0 && totals[key].knownCount > 0)
  const none = keys.filter((key) => totals[key].missingCount > 0 && totals[key].knownCount === 0)
  const sentences: string[] = []
  if (partial.length > 0) {
    const subject = partial.length === 1 ? 'this total' : 'these totals'
    sentences.push(`${nutrientList(partial)} ${verbFor(partial)} reported for some foods, so ${subject} may be higher.`)
  }
  const first = none[0]
  if (first !== undefined) {
    const foods = totals[first].missingCount === 1 ? 'this food' : 'these foods'
    sentences.push(`${nutrientList(none)} ${verbFor(none)} reported for ${foods}.`)
  }
  return sentences.length > 0 ? sentences.join(' ') : null
}
