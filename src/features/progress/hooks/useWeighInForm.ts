import { useCallback, useEffect, useRef, useState } from 'react'
import type { WeighInDraft, WeighInErrors } from '../lib/weighInForm'

/** Draft + field errors for a weigh-in form; after a failed submit, focus moves to the first invalid field. */
export function useWeighInForm(initial: () => WeighInDraft) {
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<WeighInErrors>({})
  const [failedAttempts, setFailedAttempts] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (failedAttempts === 0) return
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [failedAttempts])

  const change = useCallback((patch: Partial<WeighInDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setErrors((current) => {
      const keys = Object.keys(patch) as (keyof WeighInDraft)[]
      if (!keys.some((key) => key in current)) return current
      const next = { ...current }
      for (const key of keys) delete next[key]
      return next
    })
  }, [])

  function fail(next: WeighInErrors) {
    setErrors(next)
    setFailedAttempts((count) => count + 1)
  }

  function reset(next: WeighInDraft) {
    setDraft(next)
    setErrors({})
  }

  return { draft, errors, change, fail, reset, formRef }
}
