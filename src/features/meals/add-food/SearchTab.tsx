import { Package, Plus, RotateCcw, Search, WifiOff } from 'lucide-react'
import { Button, EmptyState, Field, Input, Spinner } from '@/components/ui'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { MIN_REMOTE_QUERY_LENGTH } from '@/services/food'
import type { FoodItem } from '@/types'
import { useFoodSearch, usePackagedSearch } from '../hooks/useFoodSearch'
import { BarcodeLookup } from './BarcodeLookup'
import { FoodList } from './FoodList'
import { ProviderNotes } from './ProviderNotes'

interface SearchTabProps {
  query: string
  onQueryChange: (query: string) => void
  onSelect: (food: FoodItem) => void
  onCreateCustom: () => void
}

function resultsAnnouncement(busy: boolean, count: number, hasMore: boolean, ready: boolean): string {
  if (busy) return 'Searching…'
  if (!ready) return ''
  if (count === 0) return 'No matching foods.'
  return `${count} ${count === 1 ? 'food' : 'foods'} found${hasMore ? ', more available' : ''}.`
}

/** Search-as-you-type (catalog, your foods, USDA when available), explicit packaged-product search and barcode lookup. */
export function SearchTab({ query, onQueryChange, onSelect, onCreateCustom }: SearchTabProps) {
  const online = useOnlineStatus()
  const search = useFoodSearch(query)
  const packaged = usePackagedSearch(query)
  const trimmed = query.trim()
  const busy = trimmed !== '' && (search.typing || search.status === 'loading')
  const showEmpty = search.status === 'ready' && !busy && search.items.length === 0

  return (
    <div className="space-y-4">
      <Field label="Search foods" hideLabel>
        <Input
          type="search"
          value={query}
          leading={<Search />}
          placeholder="Search foods, e.g. oats or hummus"
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </Field>
      <p aria-live="polite" className="sr-only">
        {resultsAnnouncement(busy, search.items.length, search.result?.hasMore === true, search.status === 'ready')}
      </p>
      {online ? null : (
        <output className="flex items-start gap-2 rounded-field bg-surface-2 px-3 py-2 text-sm text-text">
          <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
          You’re offline. Foods on this device still show up.
        </output>
      )}
      {trimmed === '' ? (
        <p className="text-sm text-text-muted">Search everyday foods from the catalog, foods you created, and USDA data when it’s available.</p>
      ) : (
        <section aria-label="Search results" className="space-y-3">
          {search.status === 'error' ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-field bg-warning/10 px-3 py-2 text-sm text-text">
              Search didn’t finish. Your foods are safe.
              <Button variant="ghost" size="sm" leadingIcon={<RotateCcw />} onClick={search.retry}>
                Try again
              </Button>
            </div>
          ) : null}
          <ProviderNotes result={search.result} providers={['local', 'usda']} />
          {search.items.length > 0 ? <FoodList foods={search.items} onSelect={onSelect} label="Matching foods" /> : null}
          {busy && search.items.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Spinner /> Searching…
            </p>
          ) : null}
          {showEmpty ? (
            <EmptyState
              compact
              title={`No matches for “${trimmed}”`}
              description="Try a shorter or different name, search packaged products, or create your own food."
              actions={
                <Button size="sm" variant="secondary" leadingIcon={<Plus />} onClick={onCreateCustom}>
                  Create custom food
                </Button>
              }
            />
          ) : null}
          {search.result?.hasMore && !busy && !search.partial ? (
            <Button variant="secondary" size="sm" fullWidth loading={search.loadingMore} onClick={search.loadMore}>
              Load more
            </Button>
          ) : null}
        </section>
      )}
      {trimmed.length >= MIN_REMOTE_QUERY_LENGTH ? (
        <section aria-label="Packaged products" className="space-y-3 border-t border-border/70 pt-4">
          {packaged.status === 'idle' ? (
            <Button variant="subtle" size="sm" leadingIcon={<Package />} onClick={packaged.search}>
              Search packaged products
            </Button>
          ) : (
            <>
              <h3 className="text-sm font-bold text-text">Packaged products for “{packaged.query}”</h3>
              <ProviderNotes result={packaged.result} providers={['off']} />
              {packaged.status === 'loading' ? (
                <p className="flex items-center gap-2 text-sm text-text-muted">
                  <Spinner /> Searching packaged products…
                </p>
              ) : null}
              {packaged.items.length > 0 ? <FoodList foods={packaged.items} onSelect={onSelect} label="Packaged products found" /> : null}
              {packaged.status === 'ready' && packaged.items.length === 0 && packaged.result?.providerStatus.off === 'ok' ? (
                <p className="text-sm text-text-muted">No packaged products found.</p>
              ) : null}
              {packaged.status === 'error' ? <p className="text-sm text-text-muted">Packaged product search didn’t finish. Please try again.</p> : null}
              {packaged.result?.hasMore ? (
                <Button variant="secondary" size="sm" fullWidth loading={packaged.loadingMore} onClick={packaged.loadMore}>
                  Load more packaged products
                </Button>
              ) : null}
            </>
          )}
        </section>
      ) : null}
      <div className="border-t border-border/70 pt-4">
        <BarcodeLookup onFound={onSelect} />
      </div>
    </div>
  )
}
