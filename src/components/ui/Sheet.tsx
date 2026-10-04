import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'
import { IconButton } from './IconButton'
import { OVERLAY_CLASSES } from './overlayStyles'
import { useReturnFocus } from './useReturnFocus'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Required accessible name, shown as the sheet heading. */
  title: ReactNode
  description?: ReactNode
  /** Visually hide the title (it remains the accessible name). */
  hideTitle?: boolean
  /** Sticky actions at the bottom (primary action last). */
  footer?: ReactNode
  /** Panel width at ≥ sm: md ≈ 28 rem, lg ≈ 36 rem. */
  size?: 'md' | 'lg'
  /** Focus a specific element on open (default: first focusable element). */
  onOpenAutoFocus?: (event: Event) => void
  className?: string
  children: ReactNode
}

/**
 * Modal sheet: slides up from the bottom on phones, centered panel from `sm`. Focus is trapped,
 * Escape and the close button dismiss it, and focus returns to the trigger.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  footer,
  size = 'md',
  onOpenAutoFocus,
  className,
  children,
}: SheetProps) {
  const focusHandlers = useReturnFocus(onOpenAutoFocus)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY_CLASSES} />
        <DialogPrimitive.Content
          {...focusHandlers}
          // Without a description, opt out of Radix's describedby wiring explicitly.
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-sheet bg-surface',
            'text-text shadow-raised outline-none',
            'data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(88dvh,48rem)] sm:w-[calc(100%-3rem)]',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-sheet',
            'sm:data-[state=open]:animate-pop-in sm:data-[state=closed]:animate-pop-out',
            size === 'md' ? 'sm:max-w-md' : 'sm:max-w-xl',
            className,
          )}
        >
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-text/15 sm:hidden" />
          <header className={cn('flex shrink-0 items-start gap-3 px-5 pb-3 pt-3 sm:pt-5', hideTitle && 'pb-0')}>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title
                className={cn('text-xl font-bold leading-tight tracking-tight', hideTitle && 'sr-only')}
              >
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-text-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close" icon={<X />} variant="subtle" size="sm" className="-mr-1 bg-text/6 text-text hover:bg-text/10" />
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          {footer ? (
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:pb-4 [&>*]:flex-1 sm:[&>*]:flex-none">
              {footer}
            </footer>
          ) : (
            <div aria-hidden="true" className="pb-safe shrink-0" />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
