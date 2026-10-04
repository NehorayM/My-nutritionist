import { normalizeBarcode } from './normalize/barcode'
import { throwIfAborted } from './providerErrors'
import type { OffBarcodeResult } from './providers/openFoodFactsProvider'
import { cacheKey, readThrough, settle } from './serviceSupport'
import type {
  BarcodeLookupResult,
  CachedValue,
  FoodSearchCache,
  LocalSearchProvider,
  PackagedSearchProvider,
} from './searchTypes'

export interface BarcodeLookupDeps {
  local: LocalSearchProvider
  off: PackagedSearchProvider | null
  cache: FoodSearchCache | null
  timeoutMs: number
}

const readBarcode = (entry: CachedValue) => (entry.kind === 'barcode' ? entry.result : undefined)
const wrapBarcode = (result: OffBarcodeResult): CachedValue => ({ kind: 'barcode', result })

/**
 * Barcode lookup: the user's saved products and the bundled catalog first (works offline, no rate limit),
 * then Open Food Facts. Open Food Facts answers (including "not found") are cached so re-scanning the same
 * product does not spend the 15 reads/min budget. A failing local lookup falls through to Open Food Facts.
 */
export async function lookupBarcodeAcrossProviders(
  deps: BarcodeLookupDeps,
  code: string,
  signal: AbortSignal | undefined,
): Promise<BarcodeLookupResult> {
  throwIfAborted(signal)
  const barcode = normalizeBarcode(code)
  if (barcode === null) return { status: 'invalid_code' }

  const lookupLocal = deps.local.lookupBarcode?.bind(deps.local)
  if (lookupLocal !== undefined) {
    const localOutcome = await settle('local', (s) => lookupLocal(barcode, s), signal, deps.timeoutMs)
    throwIfAborted(signal)
    if (localOutcome.ok && localOutcome.value !== null) {
      return { status: 'found', food: localOutcome.value, providerId: 'local' }
    }
  }

  const { off } = deps
  if (off === null || !off.isAvailable()) return { status: 'not_found', barcode }
  const outcome = await settle(
    'off',
    (s) =>
      readThrough(deps.cache, cacheKey('off', 'barcode', barcode), readBarcode, wrapBarcode, () =>
        off.lookupBarcodeDetailed(barcode, s),
      ),
    signal,
    deps.timeoutMs,
  )
  throwIfAborted(signal)
  if (!outcome.ok) return { status: 'error', barcode, error: outcome.error }
  const result = outcome.value
  switch (result.status) {
    case 'found':
      return { status: 'found', food: result.food, providerId: 'off' }
    case 'incomplete':
      return { status: 'incomplete', barcode, productName: result.productName }
    case 'invalid_code':
      return { status: 'invalid_code' }
    case 'not_found':
      return { status: 'not_found', barcode }
  }
}
