import type {
  ActivityLevel,
  Allergen,
  CookingSkill,
  Cuisine,
  DietType,
  Sex,
} from '@/types'

export const SEX_LABELS: Record<Sex, string> = {
  female: 'Female',
  male: 'Male',
  unspecified: 'Prefer not to say',
}

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, { label: string; hint: string }> = {
  sedentary: { label: 'Mostly sitting', hint: 'Desk work, little walking' },
  light: { label: 'Lightly active', hint: 'Some walking most days' },
  moderate: { label: 'Moderately active', hint: 'On your feet often, or exercise 3–5 days a week' },
  active: { label: 'Very active', hint: 'Physical work or hard exercise most days' },
  very_active: { label: 'Extra active', hint: 'Hard physical work plus training' },
}

export const DIET_LABELS: Record<DietType, { label: string; hint: string }> = {
  balanced: { label: 'Balanced', hint: 'A bit of everything, no strict rules' },
  high_protein: { label: 'High protein', hint: 'More protein in every meal' },
  mediterranean: { label: 'Mediterranean', hint: 'Vegetables, legumes, olive oil, fish' },
  keto: { label: 'Keto', hint: 'Very low carbohydrate' },
  vegetarian: { label: 'Vegetarian', hint: 'No meat or fish' },
  vegan: { label: 'Vegan', hint: 'No animal products' },
}

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: 'Milk',
  egg: 'Egg',
  fish: 'Fish',
  shellfish: 'Shellfish',
  tree_nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  wheat: 'Wheat',
  gluten: 'Gluten',
  soy: 'Soy',
  sesame: 'Sesame',
}

export const CUISINE_LABELS: Record<Cuisine, string> = {
  mediterranean: 'Mediterranean',
  israeli: 'Israeli',
  middle_eastern: 'Middle Eastern',
  american: 'American',
  italian: 'Italian',
  asian: 'Asian',
  mexican: 'Mexican',
  indian: 'Indian',
}

export const COOKING_SKILL_LABELS: Record<CookingSkill, string> = {
  beginner: 'Keep it simple',
  intermediate: 'Comfortable cooking',
  confident: 'Love to cook',
}

/** Select options from a label map, in declaration order. */
export function optionsFrom<V extends string>(labels: Record<V, string | { label: string }>) {
  return (Object.keys(labels) as V[]).map((value) => {
    const entry = labels[value]
    return { value, label: typeof entry === 'string' ? entry : entry.label }
  })
}
