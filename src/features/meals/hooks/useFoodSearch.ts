import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { logger } from '@/lib/logger'
import type { FoodSearchResult } from '@/services/food'
import type { FoodItem } from '@/types'
import { useFoodSearchService } from '../services/foodService'

/** Search-as-you-type debounce (docs/ARCHITECTURE.md › Food data). */
export const SEARCH_DEBOUNCE_MS = 350

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SearchState {
  /** Query the current results belong to. */
  query: string
  status: SearchStatus
  items: FoodItem[]
  /** Latest page's outcome (provider statuses and errors). */
  result: FoodSearchResult | null
  loadingMore: boolean
  /** Local results are shown while a remote provider is still answering. */
  partial: boolean
}

const IDLE: SearchState = { query: '', status: 'idle', items: [], result: null, loadingMore: false, partial: false }

function appendUnique(items: readonly FoodItem[], more: readonly FoodItem[]): FoodItem[] {
  const ids = new Set(items.map((item) => item.id))
  return [...items, ...more.filter((item) => !ids.has(item.id))]
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

type Runner = (
  query: string,
  page: number,
  signal: AbortSignal,
  onPartial?: (partial: FoodSearchResult) => void,
) => Promise<FoodSearchResult>

/** Paged search state for one query: first page on `start`, more on `loadMore`; stale answers are dropped. */
function usePagedSearch(run: Runner) {
  const [state, setState] = useState<SearchState>(IDLE)
  const controller = useRef<AbortController | null>(null)

  const start = useCallback(
    (query: string) => {
      controller.current?.abort()
      if (!query) {
        setState(IDLE)
        return
      }
      const abort = new AbortController()
      controller.current = abort
      setState((current) => ({ ...current, query, status: 'loading', loadingMore: false, partial: false }))
      // Local foods show up immediately; slower remote providers fill in when they answer.
      const showPartial = (partial: FoodSearchResult) => {
        if (!abort.signal.aborted) setState({ query, status: 'ready', items: partial.items, result: partial, loadingMore: false, partial: true })
      }
      run(query, 1, abort.signal, showPartial).then(
        (result) => {
          if (!abort.signal.aborted) setState({ query, status: 'ready', items: result.items, result, loadingMore: false, partial: false })
        },
        (error: unknown) => {
          if (abort.signal.aborted || isAbort(error)) return
          logger.warn('meals.search', 'Food search failed', error)
          setState({ query, status: 'error', items: [], result: null, loadingMore: false, partial: false })
        },
      )
    },
    [run],
  )

  const loadMore = useCallback(() => {
    const { query, result, status, loadingMore, partial } = state
    if (status !== 'ready' || partial || !result?.hasMore || loadingMore) return
    const abort = new AbortController()
    controller.current = abort
    setState((current) => ({ ...current, loadingMore: true }))
    run(query, result.page + 1, abort.signal).then(
      (next) => {
        if (abort.signal.aborted) return
        setState((current) => ({ ...current, items: appendUnique(current.items, next.items), result: next, loadingMore: false }))
      },
      (error: unknown) => {
        if (abort.signal.aborted || isAbort(error)) return
        logger.warn('meals.search', 'Loading more results failed', error)
        setState((current) => ({ ...current, loadingMore: false }))
      },
    )
  }, [run, state])

  const cancel = useCallback(() => {
    controller.current?.abort()
    setState(IDLE)
  }, [])

  useEffect(() => () => controller.current?.abort(), [])
  return { state, start, loadMore, cancel }
}

/** Debounced search-as-you-type over the local catalog, the user's foods and USDA (when available). */
export function useFoodSearch(text: string) {
  const service = useFoodSearchService()
  const query = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS)
  const run = useCallback<Runner>((q, page, signal, onPartial) => service.search(q, { page, signal, onPartial }), [service])
  const { state, start, loadMore } = usePagedSearch(run)

  useEffect(() => {
    start(query)
  }, [query, start])

  return { ...state, typing: text.trim() !== query, loadMore, retry: () => start(query) }
}

/** Explicit "Search packaged products" (Open Food Facts): only runs when asked, never as you type. */
export function usePackagedSearch(text: string) {
  const service = useFoodSearchService()
  const run = useCallback<Runner>((q, page, signal) => service.searchPackaged(q, { page, signal }), [service])
  const { state, start, loadMore, cancel } = usePagedSearch(run)
  const query = text.trim()
  const stale = state.status !== 'idle' && state.query !== query

  // Packaged results belong to the query they were asked for; a new query clears them.
  useEffect(() => {
    if (stale) cancel()
  }, [stale, cancel])

  return { ...(stale ? IDLE : state), search: () => start(query), loadMore }
}
