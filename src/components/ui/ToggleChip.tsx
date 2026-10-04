import { Check } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'
import { CHIP_BASE } from './Chip'

export interface ToggleChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  icon?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

/** On/off pill (filters, multi-select preferences). Exposes state via aria-pressed. */
export function ToggleChip({
  pressed,
  onPressedChange,
  icon,
  type = 'button',
  className,
  children,
  onClick,
  ref,
  ...rest
}: ToggleChipProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onPressedChange(!pressed)
      }}
      className={cn(
        CHIP_BASE,
        pressed
          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border-border bg-surface text-text hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {pressed ? <Check aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}
