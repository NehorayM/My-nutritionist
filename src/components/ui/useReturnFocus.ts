import { useCallback, useRef } from 'react'

/**
 * Radix returns focus to a <Dialog.Trigger>; our sheets and dialogs are controlled without one.
 * This remembers the element focused when the modal opened and restores it on close.
 */
export function useReturnFocus(onOpenAutoFocus?: (event: Event) => void) {
  const returnTo = useRef<HTMLElement | null>(null)

  const handleOpenAutoFocus = useCallback(
    (event: Event) => {
      // Runs before Radix moves focus, so activeElement is still the opener.
      const active = document.activeElement
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null
      onOpenAutoFocus?.(event)
    },
    [onOpenAutoFocus],
  )

  const handleCloseAutoFocus = useCallback((event: Event) => {
    const target = returnTo.current
    returnTo.current = null
    if (target?.isConnected) {
      event.preventDefault()
      target.focus({ preventScroll: true })
    }
  }, [])

  return { onOpenAutoFocus: handleOpenAutoFocus, onCloseAutoFocus: handleCloseAutoFocus }
}
