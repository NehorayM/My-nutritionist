/** Text helpers for USDA descriptions, brands and GTINs. Pure, deterministic. */

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'w/'])

/** Collapses whitespace and trims. */
export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function capitalizeWord(word: string, index: number): string {
  const lower = word.toLowerCase()
  if (index > 0 && SMALL_WORDS.has(lower)) return lower
  if (/\d/.test(word)) return lower
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * "CHEDDAR CHEESE" → "Cheddar Cheese". Text that already contains lowercase letters
 * (e.g. "Cheese, cheddar") is left as-is so USDA's own casing is respected.
 */
export function sensibleCase(value: string): string {
  const text = cleanText(value)
  if (/\p{Ll}/u.test(text) || !/\p{Lu}/u.test(text)) return text
  let index = 0
  return text.replace(/[^\s\-/(),]+/g, (word) => capitalizeWord(word, index++))
}

/** Truncates to `max` characters, ending with an ellipsis when shortened. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

/** GTIN/UPC with 6–14 digits, else null. */
export function normalizeGtin(value: string | null): string | null {
  if (value === null) return null
  const digits = value.trim()
  return /^\d{6,14}$/.test(digits) ? digits : null
}

/** "28" → "28", 28.35 → "28.35", 0.25 → "0.25". */
export function formatAmount(value: number): string {
  return String(Math.round(value * 100) / 100)
}

const UNIT_CODES: Record<string, string> = {
  ONZ: 'oz',
  GRM: 'g',
  MLT: 'ml',
  TBSP: 'tbsp',
  TSP: 'tsp',
  CUP: 'cup',
}

/** Branded household text ("1 ONZ", "0.25 cup", "1 slice (21g)") → readable label. */
export function cleanHouseholdText(value: string): string {
  const text = cleanText(value)
  const shouting = !/\p{Ll}/u.test(text)
  const replaced = text.replace(/\b(ONZ|GRM|MLT|TBSP|TSP|CUP)\b/g, (code) => UNIT_CODES[code] ?? code)
  return shouting ? replaced.toLowerCase() : replaced
}
