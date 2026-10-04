import { describe, expect, it } from 'vitest'
import { systemFoodCatalogSchema, systemFoodRecordSchema, type SystemFoodRecord } from '@/data/catalogSchema'
import { SYSTEM_FOOD_CATALOG, SYSTEM_FOOD_RECORDS } from '@/data/catalog'

function validRecord(): SystemFoodRecord {
  const first = SYSTEM_FOOD_RECORDS[0]
  if (!first) throw new Error('catalog is empty')
  return structuredClone(first)
}

function issuesOf(value: unknown): string[] {
  const result = systemFoodRecordSchema.safeParse(value)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('systemFoodRecordSchema', () => {
  it('accepts every committed record', () => {
    for (const record of SYSTEM_FOOD_RECORDS) expect(issuesOf(record)).toEqual([])
  })

  it('requires every nutrient key and rejects unknown ones', () => {
    const missing = validRecord()
    const { fiber: _fiber, ...withoutFiber } = missing.per100g
    expect(issuesOf({ ...missing, per100g: withoutFiber })).toContain('per100g.fiber')

    const extra = validRecord()
    expect(issuesOf({ ...extra, per100g: { ...extra.per100g, caffeine: 1 } })).not.toEqual([])
  })

  it('keeps unknown nutrients as null but rejects negative amounts', () => {
    const record = validRecord()
    expect(issuesOf({ ...record, per100g: { ...record.per100g, vitaminD: null } })).toEqual([])
    expect(issuesOf({ ...record, per100g: { ...record.per100g, sodium: -1 } })).toEqual(['per100g.sodium'])
  })

  it('rejects malformed slugs, ids and provenance', () => {
    const record = validRecord()
    expect(issuesOf({ ...record, slug: 'Chicken Breast' })).toEqual(['slug'])
    expect(issuesOf({ ...record, slug: 'a'.repeat(65) })).toEqual(['slug'])
    expect(issuesOf({ ...record, id: 'not-a-uuid' })).toEqual(['id'])
    expect(issuesOf({ ...record, usda: { ...record.usda, fdcId: 0 } })).toEqual(['usda.fdcId'])
    expect(issuesOf({ ...record, usda: { ...record.usda, dataType: 'branded' } })).toEqual(['usda.dataType'])
    expect(issuesOf({ ...record, usda: { ...record.usda, match: 'guess' } })).toEqual(['usda.match'])
  })

  it('rejects servings that could not be logged', () => {
    const record = validRecord()
    expect(issuesOf({ ...record, servings: [{ label: '1 cup', grams: 0 }] })).toEqual(['servings.0.grams'])
    expect(issuesOf({ ...record, servings: [{ label: ' ', grams: 10 }] })).toEqual(['servings.0.label'])
    expect(issuesOf({ ...record, servings: [{ label: 'x'.repeat(81), grams: 10 }] })).toEqual(['servings.0.label'])
  })

  it('only allows cost tiers 1-3 and whole prep minutes', () => {
    const record = validRecord()
    expect(issuesOf({ ...record, costTier: 4 })).toEqual(['costTier'])
    expect(issuesOf({ ...record, prepMinutes: 2.5 })).toEqual(['prepMinutes'])
    expect(issuesOf({ ...record, costTier: null, prepMinutes: null, requiresCooking: null })).toEqual([])
  })

  it('rejects fields that are not part of the format', () => {
    expect(issuesOf({ ...validRecord(), brand: 'Acme' })).not.toEqual([])
  })
})

describe('systemFoodCatalogSchema', () => {
  it('rejects duplicate slugs and duplicate ids', () => {
    const record = validRecord()
    const sameSlug = { ...record, id: '00000000-0000-5000-8000-000000000000' }
    const sameId = { ...record, slug: 'another_food' }
    const meta = SYSTEM_FOOD_CATALOG.meta
    const messages = (foods: unknown[]): string[] => {
      const result = systemFoodCatalogSchema.safeParse({ meta, foods })
      return result.success ? [] : result.error.issues.map((issue) => issue.message)
    }
    expect(messages([record, sameSlug])).toEqual([`Duplicate slug "${record.slug}"`])
    expect(messages([record, sameId])).toEqual([`Duplicate id "${record.id}"`])
  })

  it('requires an ISO release instant and at least one food', () => {
    const meta = { ...SYSTEM_FOOD_CATALOG.meta, releasedAt: '3 October 2026' }
    expect(systemFoodCatalogSchema.safeParse({ meta, foods: [validRecord()] }).success).toBe(false)
    expect(systemFoodCatalogSchema.safeParse({ meta: SYSTEM_FOOD_CATALOG.meta, foods: [] }).success).toBe(false)
  })
})
