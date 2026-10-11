import { Search } from 'lucide-react'
import { useState } from 'react'
import { Field, Input, Spinner } from '@/components/ui'
import { FoodList } from '@/features/meals/add-food/FoodList'
import { TranslationNote } from '@/features/meals/add-food/TranslationNote'
import { useFoodSearch } from '@/features/meals/hooks/useFoodSearch'
import type { FoodItem } from '@/types'

/** Search-as-you-type over the catalog, your foods and USDA (Hebrew works too) to pick what you have at home. */
export function FoodPicker({ onPick }: { onPick: (food: FoodItem) => void }) {
  const [query, setQuery] = useState('')
  const search = useFoodSearch(query)
  const busy = query.trim() !== '' && (search.typing || search.status === 'loading')
  return (
    <div className="space-y-3">
      <Field
        label="Find a food"
        hint={
          <>
            Type in English or Hebrew, e.g. eggs, rice or <bdi lang="he">ביצים</bdi>.
          </>
        }
      >
        <Input
          type="search"
          dir="auto"
          autoFocus
          value={query}
          leading={<Search />}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => setQuery(event.target.value)}
        />
      </Field>
      {busy ? null : <TranslationNote translation={search.result?.translation} />}
      {busy && search.items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Spinner /> Searching…
        </p>
      ) : null}
      {search.items.length > 0 ? <FoodList foods={search.items.slice(0, 12)} onSelect={onPick} label="Foods to add" /> : null}
      {search.status === 'ready' && !busy && search.items.length === 0 ? (
        <p className="text-sm text-text-muted">No matching foods. Try a shorter name.</p>
      ) : null}
    </div>
  )
}
