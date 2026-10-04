/**
 * Barcode helpers. Open Food Facts normalization (docs: ref-barcode-normalization): strip leading zeros,
 * then pad codes of ≤ 7 digits to 8 and codes of 9–12 digits to 13. Scanned/typed input may contain
 * spaces or hyphens; anything else is rejected.
 */
const SEPARATORS = /[\s-]+/g

/** Digits of a scanned/typed code when it has 6–14 digits, else null. */
export function cleanBarcodeInput(input: string): string | null {
  const digits = input.replace(SEPARATORS, '')
  return /^\d{6,14}$/.test(digits) ? digits : null
}

/** OFF-normalized barcode (8–14 digits) or null for invalid input. */
export function normalizeBarcode(input: string): string | null {
  const digits = cleanBarcodeInput(input)
  if (digits === null) return null
  const stripped = digits.replace(/^0+/, '')
  if (stripped.length === 0) return null
  if (stripped.length <= 7) return stripped.padStart(8, '0')
  if (stripped.length >= 9 && stripped.length <= 12) return stripped.padStart(13, '0')
  return stripped
}

/**
 * Key for matching the same product across providers (USDA gtinUpc "094395000172" ≡ OFF "0094395000172"):
 * digits without leading zeros.
 */
export function barcodeMatchKey(code: string | null): string | null {
  if (code === null) return null
  const digits = code.replace(SEPARATORS, '')
  if (!/^\d+$/.test(digits)) return null
  const stripped = digits.replace(/^0+/, '')
  return stripped.length > 0 ? stripped : null
}
