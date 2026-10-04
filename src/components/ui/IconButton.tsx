import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'
import { BUTTON_BASE, BUTTON_VARIANT_CLASSES, ICON_BUTTON_SIZE_CLASSES, type ButtonSize, type ButtonVariant } from './buttonStyles'
import { Spinner } from './Spinner'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /** Accessible name (required: the button has no visible text). Also used as the tooltip. */
  label: string
  icon: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  loading = false,
  type = 'button',
  className,
  title,
  onClick,
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={(event) => {
        if (loading) event.preventDefault()
        else onClick?.(event)
      }}
      className={cn(BUTTON_BASE, BUTTON_VARIANT_CLASSES[variant], ICON_BUTTON_SIZE_CLASSES[size], 'px-0', className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
    </button>
  )
}
