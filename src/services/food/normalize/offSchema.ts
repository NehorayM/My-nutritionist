import { z } from 'zod'

/**
 * Lenient Zod schemas for the Open Food Facts v2 product shape (only the `fields=` we request).
 * Crowd-sourced data is messy: tags may contain non-strings, numbers may arrive as strings.
 */
const tagList = z.array(z.unknown()).transform((tags) => tags.filter((tag): tag is string => typeof tag === 'string'))

export const OFF_PRODUCT_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'brands',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'nutriments',
  'no_nutrition_data',
  'allergens_tags',
  'traces_tags',
  'labels_tags',
  'ingredients_analysis_tags',
] as const

export const offProductSchema = z.object({
  code: z.union([z.string(), z.number()]).nullish(),
  product_name: z.string().nullish(),
  product_name_en: z.string().nullish(),
  brands: z.union([z.string(), z.array(z.unknown())]).nullish(),
  serving_size: z.string().nullish(),
  serving_quantity: z.union([z.number(), z.string()]).nullish(),
  serving_quantity_unit: z.string().nullish(),
  nutriments: z.record(z.string(), z.unknown()).nullish(),
  no_nutrition_data: z.union([z.string(), z.boolean()]).nullish(),
  allergens_tags: tagList.nullish(),
  traces_tags: tagList.nullish(),
  labels_tags: tagList.nullish(),
  ingredients_analysis_tags: tagList.nullish(),
})
export type OffProduct = z.infer<typeof offProductSchema>

/** GET /api/v2/product/{code} — `status` 1 = found, 0 = not found / invalid code. */
export const offProductResponseSchema = z.object({
  status: z.union([z.number(), z.string()]).transform(Number),
  status_verbose: z.string().nullish(),
  code: z.union([z.string(), z.number()]).nullish(),
  product: z.unknown().optional(),
})

/** GET /cgi/search.pl?…&json=1 — products are validated one by one (bad ones are dropped). */
export const offSearchResponseSchema = z.object({
  count: z.union([z.number(), z.string()]).transform(Number),
  page: z.union([z.number(), z.string()]).transform(Number),
  page_size: z.union([z.number(), z.string()]).transform(Number),
  products: z.array(z.unknown()),
})
