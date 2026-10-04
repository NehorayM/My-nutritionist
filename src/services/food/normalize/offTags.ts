import type { Allergen, DietFlags } from '@/types'

/**
 * Open Food Facts taxonomy tags → app allergens and diet flags.
 * Tags look like "en:milk"; dirty values ("en:Corn", "en:: sésamo") are ignored.
 */
const ALLERGEN_TAGS: Record<string, Allergen> = {
  'en:milk': 'milk',
  'en:eggs': 'egg',
  'en:fish': 'fish',
  'en:crustaceans': 'shellfish',
  'en:molluscs': 'shellfish',
  'en:nuts': 'tree_nuts',
  'en:peanuts': 'peanuts',
  'en:gluten': 'gluten',
  'en:soybeans': 'soy',
  'en:sesame-seeds': 'sesame',
}

/** OFF reports wheat under "en:gluten"; an explicit wheat tag is honored when present. */
const WHEAT_TAGS = new Set(['en:wheat'])

export interface OffAllergenInput {
  allergens_tags?: string[] | null
  traces_tags?: string[] | null
  ingredients_analysis_tags?: string[] | null
}

/** Ingredients were analyzed when at least one analysis tag is not "*-unknown". */
function ingredientsKnown(analysisTags: string[] | null | undefined): boolean {
  return (analysisTags ?? []).some((tag) => !tag.endsWith('-unknown'))
}

/**
 * Allergens declared or listed as traces ("may contain" — included because allergy filters must be
 * conservative). `null` = unknown: tags absent, or empty while the ingredient list was never analyzed.
 */
export function mapOffAllergens(input: OffAllergenInput): Allergen[] | null {
  const declared = input.allergens_tags
  if (declared === null || declared === undefined) return null
  const tags = [...declared, ...(input.traces_tags ?? [])]
  if (tags.length === 0) return ingredientsKnown(input.ingredients_analysis_tags) ? [] : null
  const allergens = new Set<Allergen>()
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase()
    const allergen = ALLERGEN_TAGS[normalized]
    if (allergen) allergens.add(allergen)
    if (WHEAT_TAGS.has(normalized)) allergens.add('wheat')
  }
  return [...allergens].sort()
}

export interface OffDietInput {
  labels_tags?: string[] | null
  ingredients_analysis_tags?: string[] | null
}

/**
 * Labels win (manufacturer claim), then ingredient analysis. "maybe"/"unknown" stay null.
 * Vegan implies vegetarian; non-vegetarian implies non-vegan.
 */
export function mapOffDietFlags(input: OffDietInput): DietFlags {
  const labels = new Set((input.labels_tags ?? []).map((tag) => tag.toLowerCase()))
  const analysis = new Set((input.ingredients_analysis_tags ?? []).map((tag) => tag.toLowerCase()))
  const fromAnalysis = (positive: string, negative: string): boolean | null => {
    if (analysis.has(positive)) return true
    if (analysis.has(negative)) return false
    return null
  }
  const veganLabel = labels.has('en:vegan')
  const vegetarian =
    veganLabel || labels.has('en:vegetarian') ? true : fromAnalysis('en:vegetarian', 'en:non-vegetarian')
  const vegan = veganLabel ? true : vegetarian === false ? false : fromAnalysis('en:vegan', 'en:non-vegan')
  return { vegetarian: vegan === true ? true : vegetarian, vegan }
}
