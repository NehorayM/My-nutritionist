import type { ProviderFoodDraft } from './providerFood'
import type { UsdaFoodDto } from './shared'

/**
 * Normalized USDA DTO (already mapped server-side by the shared module) → provider food draft.
 * USDA has no allergen or diet data: both stay unknown (null) so strict filters never assume safety.
 */
export function usdaDtoToDraft(dto: UsdaFoodDto): ProviderFoodDraft {
  return {
    source: 'usda',
    externalId: dto.externalId,
    name: dto.name,
    brand: dto.brand,
    barcode: dto.barcode,
    category: null,
    per100g: { ...dto.per100g },
    servings: dto.servings.map((serving) => ({ label: serving.label, grams: serving.grams })),
    allergens: null,
    dietFlags: { vegetarian: null, vegan: null },
    tags: [],
    mealTypes: [],
    prepMinutes: null,
    requiresCooking: null,
    costTier: null,
    attribution: dto.attribution,
    createdBy: null,
  }
}
