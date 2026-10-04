import { useEffect, useState } from 'react'

/** Returns `value` after it has stopped changing for `delayMs` (default 350 ms, the search debounce). */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    if (Object.is(value, debounced)) return undefined
    const timer = window.setTimeout(() => setDebounced(value), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [value, delayMs, debounced])

  return debounced
}
