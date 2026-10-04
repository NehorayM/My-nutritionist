/**
 * Tiny runtime readers for untrusted USDA JSON. Plain TypeScript: no Deno/browser globals,
 * so the Edge Function and Vitest share it. Readers never coerce missing values to 0.
 */
export type UnknownRecord = Record<string, unknown>

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Trimmed, non-empty string (whitespace collapsed) or null. */
export function readString(source: UnknownRecord, key: string): string | null {
  const value = source[key]
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : null
}

const NUMERIC_STRING = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/

/** Finite number (numeric strings accepted) or null. */
export function readNumber(source: UnknownRecord, key: string): number | null {
  const value = source[key]
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && NUMERIC_STRING.test(value.trim())) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function readArray(source: UnknownRecord, key: string): unknown[] {
  const value = source[key]
  return Array.isArray(value) ? value : []
}

export function readRecord(source: UnknownRecord, key: string): UnknownRecord | null {
  const value = source[key]
  return isRecord(value) ? value : null
}

/** Rounds away floating-point noise (e.g. 0.07900000000000001 → 0.079). */
export function roundNutrient(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
