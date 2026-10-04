import type { z } from 'zod'

/** A row object as returned by PostgREST, or null when the value is not an object. */
export function asRow(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

const NUMERIC_TEXT = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/

/**
 * Postgres `numeric` values may arrive as JSON numbers or as strings (e.g. "72.50") depending on
 * the API layer; numeric strings become numbers, anything else is passed through for the schema to judge.
 */
export function numeric(value: unknown): unknown {
  return typeof value === 'string' && NUMERIC_TEXT.test(value.trim()) ? Number(value) : value
}

/**
 * Converts the given numeric fields of each object in a jsonb array (e.g. `servings[].grams`).
 * Non-arrays and non-object items are returned unchanged so the schema reports them.
 */
export function numericItemFields(value: unknown, keys: readonly string[]): unknown {
  if (!Array.isArray(value)) return value
  return value.map((item: unknown) => {
    const object = asRow(item)
    if (!object) return item
    const converted: Record<string, unknown> = { ...object }
    for (const key of keys) if (key in converted) converted[key] = numeric(converted[key])
    return converted
  })
}

/** Validates a mapped candidate with the entity schema; null when it does not describe a valid record. */
export function parseMapped<T>(schema: z.ZodType<T, unknown>, candidate: unknown): T | null {
  const parsed = schema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}
