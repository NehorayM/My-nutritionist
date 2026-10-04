/**
 * PostgreSQL literal rendering for generated migrations. Pure and node-safe.
 * Strings use standard-conforming quoting (`'` doubled, backslashes literal — the PostgreSQL default since 9.1).
 */

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/

export function sqlString(value: string): string {
  if (value.includes('\u0000')) throw new Error('PostgreSQL text cannot contain NUL characters')
  return `'${value.replaceAll("'", "''")}'`
}

export function sqlNullableString(value: string | null): string {
  return value === null ? 'null' : sqlString(value)
}

/** Integer literal (e.g. smallint columns); rejects fractions and non-finite values. */
export function sqlInteger(value: number | null): string {
  if (value === null) return 'null'
  if (!Number.isSafeInteger(value)) throw new Error(`Expected an integer, got ${value}`)
  return String(value)
}

export function sqlBoolean(value: boolean | null): string {
  if (value === null) return 'null'
  return value ? 'true' : 'false'
}

export function sqlUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new Error(`Invalid uuid "${value}"`)
  return `${sqlString(value.toLowerCase())}::uuid`
}

/** ISO-8601 instant with an explicit offset, so the value never depends on the session time zone. */
export function sqlTimestamptz(value: string): string {
  if (!ISO_INSTANT_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid ISO timestamp "${value}"`)
  }
  return `${sqlString(value)}::timestamptz`
}

/** `array['a', 'b']::text[]`; an empty list is `'{}'::text[]`; null stays SQL null. */
export function sqlTextArray(values: readonly string[] | null): string {
  if (values === null) return 'null'
  if (values.length === 0) return `'{}'::text[]`
  return `array[${values.map(sqlString).join(', ')}]::text[]`
}

function assertFiniteNumbers(value: JsonValue): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`JSON cannot represent ${value}`)
    return
  }
  if (value === null || typeof value !== 'object') return
  // Object.values covers both arrays (elements) and objects (property values).
  Object.values(value).forEach(assertFiniteNumbers)
}

/** JSON text as a jsonb literal. Key order is preserved as given, so callers control determinism. */
export function sqlJsonb(value: JsonValue): string {
  assertFiniteNumbers(value)
  return `${sqlString(JSON.stringify(value))}::jsonb`
}
