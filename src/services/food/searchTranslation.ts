import type { QueryTranslation, QueryTranslator } from '@/services/translation'
import type { FoodSearchPage } from './providers/types'
import type { LocalSearchProvider } from './searchTypes'

/** What remote providers are asked: the English text and the translation it came from (null = not Hebrew). */
export interface RemoteQuery {
  text: string
  translation: QueryTranslation | null
}

/**
 * The English text for remote providers: the original text when it has no Hebrew; the dictionary translation at
 * once when it is complete (synchronously, so requests start without delay); otherwise the translator's best result
 * (machine translation when online). An empty `text` means nothing could be translated: remote providers are skipped.
 */
export function remoteQuery(translator: QueryTranslator | null, query: string, signal?: AbortSignal): RemoteQuery | Promise<RemoteQuery> {
  const instant = translator?.translateNow(query) ?? null
  if (instant === null) return { text: query, translation: null }
  if (instant.source === 'dictionary' || !translator) return { text: instant.query, translation: instant }
  return translator.translate(query, signal).then((translation) => ({ text: translation?.query ?? '', translation }))
}

/**
 * Local search for a possibly translated query: the user's own foods may have Hebrew names, the catalog has
 * English ones — both texts are searched and merged (English matches first, no duplicates).
 */
export async function searchLocal(
  local: LocalSearchProvider,
  query: string,
  english: string | null,
  pageSize: number,
  signal: AbortSignal,
): Promise<FoodSearchPage> {
  const own = await local.search({ text: query, page: 1, pageSize, signal })
  if (!english || english === query) return own
  const translated = await local.search({ text: english, page: 1, pageSize, signal })
  const ids = new Set(translated.items.map((food) => food.id))
  const items = [...translated.items, ...own.items.filter((food) => !ids.has(food.id))]
  return { ...own, items: items.slice(0, pageSize), hasMore: own.hasMore || translated.hasMore || items.length > pageSize }
}
