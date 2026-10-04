import { useCallback, useState } from 'react'

interface ControllableStateOptions<T> {
  value: T | undefined
  defaultValue: T
  onChange?: (value: T) => void
}

/** State that can be controlled by the parent (`value` given) or kept internally (`defaultValue`). */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: ControllableStateOptions<T>): [T, (next: T) => void] {
  const [internal, setInternal] = useState(defaultValue)
  const controlled = value !== undefined
  const current = controlled ? value : internal

  const setValue = useCallback(
    (next: T) => {
      if (!controlled) setInternal(next)
      if (!Object.is(next, current)) onChange?.(next)
    },
    [controlled, current, onChange],
  )

  return [current, setValue]
}
