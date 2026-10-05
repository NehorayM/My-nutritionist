import { Info } from 'lucide-react'
import type { FoodProviderId, FoodSearchResult } from '@/services/food'
import { providerStatusMessage } from '../model/labels'

interface ProviderNotesProps {
  result: FoodSearchResult | null
  providers: readonly FoodProviderId[]
}

/** Per-provider status messages (offline, rate-limited, timeout…) shown next to whatever results did arrive. */
export function ProviderNotes({ result, providers }: ProviderNotesProps) {
  if (!result) return null
  const messages = providers
    .map((id) => providerStatusMessage(id, result.providerStatus[id], result.errors[id]))
    .filter((message): message is string => message !== null)
  if (messages.length === 0) return null
  return (
    <output className="flex flex-col gap-1.5">
      {messages.map((message) => (
        <span key={message} className="flex items-start gap-2 rounded-field bg-info/8 px-3 py-2 text-sm text-text">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
          <span>{message}</span>
        </span>
      ))}
    </output>
  )
}
