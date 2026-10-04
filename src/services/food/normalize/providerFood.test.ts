import { describe, expect, it } from 'vitest'
import { isUuid, userFoodId } from '@/lib/id'
import { unknownNutrients } from '@/domain/nutrients'
import type { FoodItem } from '@/types'
import { barcodeMatchKey, cleanBarcodeInput, normalizeBarcode } from './barcode'
import { isUnsavedProviderFood, providerFoodId, toProviderFood, toSavedProviderFood, type ProviderFoodDraft } from './providerFood'
import { usdaDtoToDraft } from './usda'
import { parseUsdaFoodDto } from './usdaSchema'

const TIMESTAMP = '2026-10-04T08:00:00.000Z'

function draft(overrides: Partial<ProviderFoodDraft> = {}): ProviderFoodDraft {
  return {
    source: 'off',
    externalId: '3017624010701',
    name: 'Nutella',
    brand: 'Ferrero',
    barcode: '3017624010701',
    category: null,
    per100g: { ...unknownNutrients(), calories: 539 },
    servings: [],
    allergens: ['tree_nuts'],
    dietFlags: { vegetarian: null, vegan: null },
    tags: [],
    mealTypes: [],
    prepMinutes: null,
    requiresCooking: null,
    costTier: null,
    attribution: 'Open Food Facts (ODbL) · 3017624010701',
    createdBy: null,
    ...overrides,
  }
}

describe('barcode helpers', () => {
  it.each([
    ['3017624010701', '3017624010701'],
    ['016000275287', '0016000275287'],
    ['00012345678905', '0012345678905'],
    ['0001234', '00001234'],
    ['000000017', '00000017'],
    ['7290-0000 00008', '7290000000008'],
    ['12345678901234', '12345678901234'],
  ])('normalizeBarcode(%s) → %s', (input, expected) => {
    expect(normalizeBarcode(input)).toBe(expected)
  })

  it('rejects non-numeric, too short, too long and all-zero codes', () => {
    expect(cleanBarcodeInput('12345')).toBeNull()
    expect(cleanBarcodeInput('123456789012345')).toBeNull()
    expect(normalizeBarcode('ABC123456')).toBeNull()
    expect(normalizeBarcode('00000000')).toBeNull()
  })

  it('matches the same product across USDA and OFF code formats', () => {
    expect(barcodeMatchKey('094395000172')).toBe(barcodeMatchKey('0094395000172'))
    expect(barcodeMatchKey(null)).toBeNull()
    expect(barcodeMatchKey('n/a')).toBeNull()
  })
})

describe('provider food ids', () => {
  it('gives unsaved provider results a deterministic transient UUID', async () => {
    const first = await toProviderFood(draft(), TIMESTAMP)
    const second = await toProviderFood(draft(), TIMESTAMP)
    expect(isUuid(first.id)).toBe(true)
    expect(first.id).toBe(second.id)
    expect(first.id).toBe(await providerFoodId('off', '3017624010701'))
    expect(first.id).not.toBe(await providerFoodId('usda', '3017624010701'))
    expect(first.createdAt).toBe(TIMESTAMP)
    expect(isUnsavedProviderFood(first)).toBe(true)
  })

  it('saves a provider result as a user food with the idempotent userFoodId', async () => {
    const food = await toProviderFood(draft(), TIMESTAMP)
    const saved = await toSavedProviderFood(food, 'user-1', '2026-10-05T00:00:00.000Z')
    expect(saved.id).toBe(await userFoodId('user-1', 'off', '3017624010701'))
    expect(saved.createdBy).toBe('user-1')
    expect(saved.updatedAt).toBe('2026-10-05T00:00:00.000Z')
    expect(isUnsavedProviderFood(saved)).toBe(false)
  })

  it('refuses to save non-provider foods or foods without an external id', async () => {
    const food = await toProviderFood(draft(), TIMESTAMP)
    const custom: FoodItem = { ...food, source: 'custom' }
    await expect(toSavedProviderFood(custom, 'user-1', TIMESTAMP)).rejects.toThrow(/Only USDA/)
    await expect(toSavedProviderFood({ ...food, externalId: null }, 'user-1', TIMESTAMP)).rejects.toThrow(/external id/)
  })
})

describe('USDA DTO → food', () => {
  const dto = {
    externalId: '173414',
    name: 'Cheese, cheddar',
    brand: null,
    barcode: null,
    dataType: 'sr_legacy',
    per100g: { calories: 403, protein: 22.87, vitaminD: 0.6 },
    servings: [{ label: '1 slice (1 oz)', grams: 28 }],
    attribution: 'USDA FoodData Central · SR Legacy #173414',
  }

  it('validates the contract and fills omitted nutrients with null', () => {
    const parsed = parseUsdaFoodDto(dto)
    expect(parsed?.per100g.fat).toBeNull()
    const result = usdaDtoToDraft(parsed!)
    expect(result).toMatchObject({
      source: 'usda',
      externalId: '173414',
      allergens: null,
      dietFlags: { vegetarian: null, vegan: null },
      servings: [{ label: '1 slice (1 oz)', grams: 28 }],
    })
  })

  it.each([
    ['negative nutrient', { per100g: { calories: -1 } }],
    ['calories above 1000', { per100g: { calories: 2228 } }],
    ['unknown data type', { dataType: 'experimental' }],
    ['non-numeric id', { externalId: 'abc' }],
    ['empty name', { name: ' ' }],
    ['invalid barcode', { barcode: '12' }],
    ['zero-gram serving', { servings: [{ label: '1 slice', grams: 0 }] }],
  ])('rejects a DTO with %s', (_label, overrides) => {
    expect(parseUsdaFoodDto({ ...dto, ...overrides })).toBeNull()
  })
})
