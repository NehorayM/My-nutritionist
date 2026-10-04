/** Characters a user may have typed so far while entering a decimal (comma or dot separator). */
const PARTIAL_DECIMAL = /^-?\d*(?:[.,]\d*)?$/
const PARTIAL_UNSIGNED = /^\d*(?:[.,]\d*)?$/

/** True if `text` can still become a valid number (allows "", "-", "7,", ".5"). */
export function isPartialDecimal(text: string, allowNegative: boolean): boolean {
  return (allowNegative ? PARTIAL_DECIMAL : PARTIAL_UNSIGNED).test(text)
}

/**
 * Parses user input that may use a comma decimal separator ("72,5" → 72.5).
 * Returns null for empty or incomplete input ("", "-", ".").
 */
export function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** Canonical text for a number when it is set from outside the input. */
export function numberToInputText(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return String(value)
}
