import { Barcode } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Field, Input } from '@/components/ui'
import { logger } from '@/lib/logger'
import { cleanBarcodeInput, type BarcodeLookupResult } from '@/services/food'
import type { FoodItem } from '@/types'
import { providerStatusMessage } from '../model/labels'
import { useFoodSearchService } from '../services/foodService'

const INVALID = 'Enter the 6–14 digits printed under the barcode.'

function outcomeMessage(result: BarcodeLookupResult): string | null {
  switch (result.status) {
    case 'found':
      return null
    case 'invalid_code':
      return INVALID
    case 'not_found':
      return `No product found for ${result.barcode}. You can create it as a custom food.`
    case 'incomplete':
      return `${result.productName ?? 'This product'} is listed without nutrition facts. You can create it as a custom food.`
    case 'error':
      return providerStatusMessage('off', result.error.kind, result.error) ?? 'The lookup didn’t finish. Please try again.'
  }
}

/** Typed barcode lookup: foods on this device first, then Open Food Facts. */
export function BarcodeLookup({ onFound }: { onFound: (food: FoodItem) => void }) {
  const service = useFoodSearchService()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    const digits = cleanBarcodeInput(code)
    if (digits === null) {
      setError(INVALID)
      return
    }
    setError(undefined)
    setBusy(true)
    try {
      const result = await service.lookupBarcode(digits)
      if (result.status === 'found') onFound(result.food)
      else if (result.status === 'invalid_code') setError(INVALID)
      else setMessage(outcomeMessage(result))
    } catch (failure) {
      logger.warn('meals.barcode', 'Barcode lookup failed', failure)
      setMessage('The lookup didn’t finish. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-2" aria-label="Barcode lookup">
      <div className="flex items-start gap-2">
        <Field label="Barcode" error={error} className="min-w-0 flex-1">
          <Input
            value={code}
            inputMode="numeric"
            autoComplete="off"
            placeholder="6–14 digits"
            leading={<Barcode />}
            onChange={(event) => {
              setCode(event.target.value)
              setError(undefined)
            }}
          />
        </Field>
        {/* Top margin = label height + gap, so the button lines up with the input. */}
        <Button type="submit" variant="secondary" loading={busy} className="mt-[1.625rem]">
          Look up
        </Button>
      </div>
      {message ? <output className="block text-sm text-text-muted">{message}</output> : null}
    </form>
  )
}
