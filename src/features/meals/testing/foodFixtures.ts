import { vi } from 'vitest'
import { systemFoodBySlug } from '@/data/systemFoods'
import { nutrientProfile } from '@/domain/nutrients'
import { providerFoodId, type FoodProviderError, type FoodSearchServiceOptions } from '@/services/food'
import type { FoodItem, FoodPortion, NutrientProfile, ServingOption } from '@/types'

/** A catalog portion: `servingIndex` picks one of the food's servings (quantity of them), otherwise grams. */
export function catalogPortion(slug: string, quantity: number, servingIndex: number | null = null): FoodPortion {
  const food = systemFoodBySlug(slug)
  if (!food) throw new Error(`Unknown catalog food ${slug}`)
  const serving = servingIndex === null ? null : food.servings[servingIndex]
  if (servingIndex !== null && !serving) throw new Error(`${slug} has no serving ${servingIndex}`)
  return {
    foodId: food.id,
    foodSource: food.source,
    foodExternalId: food.externalId,
    foodName: food.name,
    brand: food.brand,
    quantity,
    servingLabel: serving?.label ?? null,
    servingGrams: serving?.grams ?? null,
    grams: serving ? quantity * serving.grams : quantity,
    per100g: { ...food.per100g },
  }
}

interface ProviderFoodInput {
  source: 'usda' | 'off'
  externalId: string
  name: string
  brand?: string | null
  per100g: Partial<NutrientProfile>
  servings?: ServingOption[]
}

/** An unsaved provider search result (USDA / Open Food Facts), shaped like the normalizers produce it. */
export async function providerFood(input: ProviderFoodInput): Promise<FoodItem> {
  const stamp = new Date().toISOString()
  return {
    id: await providerFoodId(input.source, input.externalId),
    source: input.source,
    externalId: input.externalId,
    name: input.name,
    brand: input.brand ?? null,
    barcode: input.source === 'off' ? input.externalId : null,
    category: null,
    per100g: nutrientProfile(input.per100g),
    servings: input.servings ?? [],
    allergens: null,
    dietFlags: { vegetarian: null, vegan: null },
    tags: [],
    mealTypes: [],
    prepMinutes: null,
    requiresCooking: null,
    costTier: null,
    attribution: input.source === 'off' ? `Open Food Facts (ODbL) · ${input.externalId}` : `USDA FoodData Central · #${input.externalId}`,
    createdBy: null,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

type UsdaProvider = NonNullable<FoodSearchServiceOptions['usda']>
export type OffProvider = NonNullable<FoodSearchServiceOptions['off']>

/** A fake USDA provider answering every search with `pages[page - 1]` (or failing with `error`). */
export function fakeUsda(pages: FoodItem[][], error?: FoodProviderError) {
  return {
    isAvailable: () => true,
    search: vi.fn<UsdaProvider['search']>(async ({ page }) => {
      if (error) throw error
      return { providerId: 'usda', items: pages[page - 1] ?? [], page, hasMore: page < pages.length }
    }),
  } satisfies UsdaProvider
}

/** A fake Open Food Facts provider: no packaged results and unknown barcodes unless overridden. */
export function fakeOff(overrides: Partial<Pick<OffProvider, 'searchPackaged' | 'lookupBarcodeDetailed'>> = {}) {
  return {
    isAvailable: () => true,
    searchPackaged: vi.fn<OffProvider['searchPackaged']>(
      overrides.searchPackaged ?? (async ({ page }) => ({ providerId: 'off', items: [], page, hasMore: false })),
    ),
    lookupBarcodeDetailed: vi.fn<OffProvider['lookupBarcodeDetailed']>(
      overrides.lookupBarcodeDetailed ?? (async () => ({ status: 'not_found' })),
    ),
  } satisfies OffProvider
}
