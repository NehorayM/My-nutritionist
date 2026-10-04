import { isRecord, readNumber, readRecord, readString, type UnknownRecord } from './guards.ts'
import { cleanHouseholdText, formatAmount, truncate } from './text.ts'
import { USDA_LIMITS, type UsdaServingDto } from './types.ts'

/**
 * Household servings from the three FDC shapes (research §A.6):
 * - Branded: servingSize + servingSizeUnit (+ householdServingFullText)
 * - Foundation / SR Legacy / Survey detail: foodPortions[]
 * - Survey search results: foodMeasures[]
 * Grams always come from USDA (`gramWeight` / `servingSize`), never from parsing labels.
 */

const NOT_SPECIFIED = /quantity not specified/i
const NUMERIC_CODE = /^\d+$/

function servingUnit(raw: string | null): 'g' | 'ml' | null {
  const unit = raw?.trim().toLowerCase()
  if (unit === 'g' || unit === 'grm' || unit === 'gm') return 'g'
  // Branded liquids report nutrients per 100 ml; treating ml as g keeps portions consistent with those values.
  if (unit === 'ml' || unit === 'mlt') return 'ml'
  return null
}

/** Branded label serving, e.g. { label: "1 oz (28 g)", grams: 28 }. */
export function brandedServing(food: UnknownRecord): UsdaServingDto | null {
  const size = readNumber(food, 'servingSize')
  const unit = servingUnit(readString(food, 'servingSizeUnit'))
  if (size === null || size <= 0 || unit === null) return null
  const amount = `${formatAmount(size)} ${unit}`
  const household = readString(food, 'householdServingFullText')
  if (household === null) return { label: `1 serving (${amount})`, grams: size }
  const text = cleanHouseholdText(household)
  const label = /\d\s*(g|ml)\b/i.test(text) ? text : `${text} (${amount})`
  return { label, grams: size }
}

function portionLabel(portion: UnknownRecord): string | null {
  const measureUnit = readRecord(portion, 'measureUnit')
  const unitName = measureUnit ? readString(measureUnit, 'name') : null
  if (unitName === 'RACC') return '1 typical serving'
  const amount = readNumber(portion, 'amount')
  const description = readString(portion, 'portionDescription')
  const rawModifier = readString(portion, 'modifier')
  // Survey (FNDDS) modifiers are numeric portion codes, not text.
  const modifier = rawModifier !== null && !NUMERIC_CODE.test(rawModifier) ? rawModifier : null
  if (description !== null && NOT_SPECIFIED.test(description)) return null
  const quantity = formatAmount(amount !== null && amount > 0 ? amount : 1)
  if (unitName !== null && unitName !== 'undetermined') {
    // Foundation: amount + unit (+ "shredded"-style description)
    const detail = [description, modifier].filter((part): part is string => part !== null).join(', ')
    return detail ? `${quantity} ${unitName}, ${detail}` : `${quantity} ${unitName}`
  }
  if (description !== null) return description // Survey: "1 cup, diced"
  if (modifier !== null) return `${quantity} ${modifier}` // SR Legacy: "1 slice (1 oz)"
  return null
}

function sortKey(row: UnknownRecord): number {
  return readNumber(row, 'sequenceNumber') ?? readNumber(row, 'rank') ?? Number.MAX_SAFE_INTEGER
}

function sortedRecords(rows: unknown[]): UnknownRecord[] {
  return rows.filter(isRecord).sort((a, b) => sortKey(a) - sortKey(b))
}

/** foodPortions[] (format=full) → servings, ordered by USDA sequence. */
export function portionServings(rows: unknown[]): UsdaServingDto[] {
  const servings: UsdaServingDto[] = []
  for (const portion of sortedRecords(rows)) {
    const grams = readNumber(portion, 'gramWeight')
    const label = portionLabel(portion)
    if (grams === null || grams <= 0 || label === null) continue
    servings.push({ label, grams })
  }
  return servings
}

/** foodMeasures[] (Survey search results) → servings, ordered by rank. */
export function measureServings(rows: unknown[]): UsdaServingDto[] {
  const servings: UsdaServingDto[] = []
  for (const measure of sortedRecords(rows)) {
    const grams = readNumber(measure, 'gramWeight')
    const label = readString(measure, 'disseminationText')
    if (grams === null || grams <= 0 || label === null || NOT_SPECIFIED.test(label)) continue
    servings.push({ label, grams })
  }
  return servings
}

/** De-duplicates by label (case-insensitive), trims labels and caps the list (food_items allows ≤ 20). */
export function finalizeServings(servings: UsdaServingDto[]): UsdaServingDto[] {
  const seen = new Set<string>()
  const result: UsdaServingDto[] = []
  for (const serving of servings) {
    const label = truncate(serving.label, USDA_LIMITS.servingLabelMax)
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ label, grams: Math.round(serving.grams * 100) / 100 })
    if (result.length === USDA_LIMITS.servingsMax) break
  }
  return result
}
