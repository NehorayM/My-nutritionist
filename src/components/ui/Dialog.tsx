import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'
import { IconButton } from './IconButton'
import { OVERLAY_CLASSES } from './overlayStyles'
import { useReturnFocus } from './useReturnFocus'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Action buttons, primary action last. */
  footer?: ReactNode
  /** Hide the corner close button (e.g. when the footer has an explicit Cancel). */
  hideClose?: boolean
  /** `alertdialog` for confirmations that interrupt the user. */
  role?: 'dialog' | 'alertdialog'
  onOpenAutoFocus?: (event: Event) => void
  /** Prevent dismissal by clicking outside (confirmations). */
  dismissOnOutsideClick?: boolean
  className?: string
  children?: ReactNode
}

/** Small centered modal for short content and confirmations. Use Sheet for forms and lists. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  hideClose = false,
  role = 'dialog',
  onOpenAutoFocus,
  dismissOnOutsideClick = true,
  className,
  children,
}: DialogProps) {
  const focusHandlers = useReturnFocus(onOpenAutoFocus)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY_CLASSES} />
        <DialogPrimitive.Content
          role={role}
          {...focusHandlers}
          onPointerDownOutside={dismissOnOutsideClick ? undefined : (event) => event.preventDefault()}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2',
            'max-h-[85dvh] overflow-y-auto rounded-card-lg bg-surface p-6 text-text shadow-raised outline-none',
            'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
            className,
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-lg font-bold leading-snug tracking-tight">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1.5 text-[0.9375rem] text-text-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            {hideClose ? null : (
              <DialogPrimitive.Close asChild>
                <IconButton label="Close" icon={<X />} size="sm" className="-mr-2 -mt-1" />
              </DialogPrimitive.Close>
            )}
          </div>
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
