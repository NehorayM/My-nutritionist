import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Toaster as SonnerToaster } from 'sonner'
import { useResolvedTheme } from '@/hooks/useApplyTheme'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Spinner } from './Spinner'

/** Sonner reads these variables for its default toast styling; map them to our tokens. */
const TOKEN_STYLE = {
  '--normal-bg': 'var(--color-surface)',
  '--normal-text': 'var(--color-text)',
  '--normal-border': 'var(--color-border)',
  '--border-radius': 'var(--radius-card)',
  '--width': 'min(356px, calc(100vw - 2rem))',
} as CSSProperties

/**
 * Phones: centered above the bottom navigation. From md (side navigation): bottom-right corner.
 * Offsets come from --toast-offset (tokens.css). Mount once in App.
 */
export function Toaster() {
  const theme = useResolvedTheme()
  const wide = useMediaQuery('(min-width: 48rem)')
  return (
    <SonnerToaster
      theme={theme}
      position={wide ? 'bottom-right' : 'bottom-center'}
      offset={{ bottom: 'var(--toast-offset)' }}
      mobileOffset={{ bottom: 'var(--toast-offset)', left: '1rem', right: '1rem' }}
      gap={10}
      visibleToasts={3}
      closeButton={false}
      containerAriaLabel="Notifications"
      style={TOKEN_STYLE}
      icons={{
        success: <CircleCheck className="size-5 text-success" aria-hidden="true" />,
        error: <CircleAlert className="size-5 text-danger" aria-hidden="true" />,
        info: <Info className="size-5 text-info" aria-hidden="true" />,
        warning: <TriangleAlert className="size-5 text-warning" aria-hidden="true" />,
        loading: <Spinner className="size-5 text-primary" />,
        close: <X className="size-4" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'font-sans shadow-raised! gap-3! px-4! py-3.5!',
          title: 'text-[0.9375rem]! font-semibold!',
          description: 'text-sm! text-text-muted!',
          actionButton:
            'rounded-full! bg-primary/12! px-3.5! h-9! text-sm! font-bold! text-primary! hover:bg-primary/18!',
        },
      }}
    />
  )
}
