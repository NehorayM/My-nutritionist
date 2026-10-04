import { describe, expect, it } from 'vitest'
import {
  sqlBoolean,
  sqlInteger,
  sqlJsonb,
  sqlNullableString,
  sqlString,
  sqlTextArray,
  sqlTimestamptz,
  sqlUuid,
} from '@/data/sqlLiterals'

describe('sql literals', () => {
  it('quotes strings by doubling single quotes only', () => {
    expect(sqlString("it's")).toBe("'it''s'")
    expect(sqlString("''")).toBe("''''''")
    expect(sqlString('C:\\path')).toBe("'C:\\path'")
    expect(sqlString('Café · 100 g')).toBe("'Café · 100 g'")
    expect(() => sqlString('a\u0000b')).toThrow(/NUL/)
  })

  it('renders null for absent strings, booleans and integers', () => {
    expect(sqlNullableString(null)).toBe('null')
    expect(sqlNullableString('x')).toBe("'x'")
    expect(sqlBoolean(null)).toBe('null')
    expect(sqlBoolean(true)).toBe('true')
    expect(sqlBoolean(false)).toBe('false')
    expect(sqlInteger(null)).toBe('null')
    expect(sqlInteger(0)).toBe('0')
  })

  it('accepts only safe integers for integer columns', () => {
    expect(sqlInteger(25)).toBe('25')
    expect(() => sqlInteger(2.5)).toThrow(/integer/)
    expect(() => sqlInteger(Number.NaN)).toThrow(/integer/)
    expect(() => sqlInteger(Number.POSITIVE_INFINITY)).toThrow(/integer/)
  })

  it('validates and normalizes uuids', () => {
    expect(sqlUuid('081D21AB-42B5-5A29-86C0-AB09FAD95B82')).toBe("'081d21ab-42b5-5a29-86c0-ab09fad95b82'::uuid")
    expect(() => sqlUuid("x'; drop table public.food_items; --")).toThrow(/Invalid uuid/)
  })

  it('requires ISO instants with an explicit offset', () => {
    expect(sqlTimestamptz('2026-10-03T00:00:00.000Z')).toBe("'2026-10-03T00:00:00.000Z'::timestamptz")
    expect(sqlTimestamptz('2026-10-03T03:00:00+03:00')).toBe("'2026-10-03T03:00:00+03:00'::timestamptz")
    expect(() => sqlTimestamptz('2026-10-03')).toThrow(/Invalid ISO/)
    expect(() => sqlTimestamptz('2026-13-45T00:00:00Z')).toThrow(/Invalid ISO/)
  })

  it('renders text arrays, using an empty-array literal and null distinctly', () => {
    expect(sqlTextArray(null)).toBe('null')
    expect(sqlTextArray([])).toBe("'{}'::text[]")
    expect(sqlTextArray(['milk', "o'clock"])).toBe("array['milk', 'o''clock']::text[]")
  })

  it('renders jsonb from JSON text, preserving key order and nulls', () => {
    expect(sqlJsonb({ b: 1, a: null })).toBe(`'{"b":1,"a":null}'::jsonb`)
    expect(sqlJsonb([{ label: "chef's", grams: 2.5 }])).toBe(`'[{"label":"chef''s","grams":2.5}]'::jsonb`)
  })

  it('refuses non-finite numbers anywhere in a jsonb value', () => {
    expect(() => sqlJsonb({ calories: Number.NaN })).toThrow(/JSON cannot represent/)
    expect(() => sqlJsonb([{ nested: [1, Number.POSITIVE_INFINITY] }])).toThrow(/JSON cannot represent/)
  })
})
