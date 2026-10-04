import type { ServingOption } from '@/types'
import { normalizeBarcode } from './barcode'
import type { OffProduct } from './offSchema'
import { mapOffNutriments, toNonNegativeNumber } from './offNutrients'
import { mapOffAllergens, mapOffDietFlags } from './offTags'
import type { ProviderFoodDraft } from './providerFood'
import { FOOD_TEXT_LIMITS, cleanText, formatAmount, truncate } from './shared'

export const OFF_SOURCE_NAME = 'Open Food Facts'
/** ODbL requires attribution wherever OFF-derived data is shown. */
export const OFF_ATTRIBUTION = 'Open Food Facts (ODbL)'

export function offAttribution(code: string): string {
  return `${OFF_ATTRIBUTION} · ${code}`
}

function nameOf(product: OffProduct): string | null {
  for (const candidate of [product.product_name, product.product_name_en]) {
    if (typeof candidate !== 'string') continue
    const name = cleanText(candidate)
    if (name.length > 0) return truncate(name, FOOD_TEXT_LIMITS.nameMax)
  }
  return null
}

/** First brand of OFF's comma-separated list ("Hacendado, MERCADONA" → "Hacendado"). */
function brandOf(product: OffProduct): string | null {
  const raw = product.brands
  const first = typeof raw === 'string' ? raw.split(',')[0] : raw?.find((brand) => typeof brand === 'string')
  if (typeof first !== 'string') return null
  const brand = cleanText(first)
  return brand.length > 0 ? truncate(brand, FOOD_TEXT_LIMITS.brandMax) : null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Upper bound for one serving; larger values are data-entry errors (e.g. a whole case of bottles). */
const MAX_SERVING_GRAMS = 5000

/**
 * `serving_quantity` (grams or ml, computed by OFF) + `serving_size` (free text label).
 * ml servings are kept as grams because OFF liquids report nutrients per 100 ml (density ≈ 1).
 */
export function offServings(product: OffProduct): ServingOption[] {
  const quantity = toNonNegativeNumber(product.serving_quantity)
  if (quantity === null || quantity <= 0 || quantity > MAX_SERVING_GRAMS) return []
  const unit = (product.serving_quantity_unit ?? 'g').trim().toLowerCase()
  if (unit !== 'g' && unit !== 'ml') return []
  const amountText = formatAmount(quantity)
  const amount = `${amountText} ${unit}`
  const size = typeof product.serving_size === 'string' ? cleanText(product.serving_size) : ''
  const statesAmount = new RegExp(`(^|[^\\d.])${escapeRegExp(amountText)}\\s*(g|gr|grams?|ml)\\b`, 'i').test(size)
  const label = size === '' ? `1 serving (${amount})` : statesAmount ? size : `${size} (${amount})`
  return [{ label: truncate(label, FOOD_TEXT_LIMITS.servingLabelMax), grams: Math.round(quantity * 100) / 100 }]
}

function hasNoNutritionData(product: OffProduct): boolean {
  return product.no_nutrition_data === 'on' || product.no_nutrition_data === true
}

export type OffRejectReason = 'invalid_code' | 'missing_name' | 'missing_nutrition'

export type OffMappingResult =
  | { ok: true; draft: ProviderFoodDraft }
  | { ok: false; reason: OffRejectReason; code: string | null; name: string | null }

/**
 * Maps one validated OFF product. Rejected (unusable) products: invalid code, no name, or none of
 * calories/protein/carbs/fat known — logging needs at least one of those.
 */
export function mapOffProduct(product: OffProduct): OffMappingResult {
  const code = product.code === null || product.code === undefined ? null : normalizeBarcode(String(product.code))
  const name = nameOf(product)
  if (code === null) return { ok: false, reason: 'invalid_code', code: null, name }
  if (name === null) return { ok: false, reason: 'missing_name', code, name }
  const per100g = mapOffNutriments(hasNoNutritionData(product) ? null : product.nutriments)
  if (per100g.calories === null && per100g.protein === null && per100g.carbs === null && per100g.fat === null) {
    return { ok: false, reason: 'missing_nutrition', code, name }
  }
  return {
    ok: true,
    draft: {
      source: 'off',
      externalId: code,
      name,
      brand: brandOf(product),
      barcode: code,
      category: null,
      per100g,
      servings: offServings(product),
      allergens: mapOffAllergens(product),
      dietFlags: mapOffDietFlags(product),
      tags: [],
      mealTypes: [],
      prepMinutes: null,
      requiresCooking: null,
      costTier: null,
      attribution: offAttribution(code),
      createdBy: null,
    },
  }
}

/** Convenience: the draft, or null when the product is unusable. */
export function offProductToDraft(product: OffProduct): ProviderFoodDraft | null {
  const result = mapOffProduct(product)
  return result.ok ? result.draft : null
}
