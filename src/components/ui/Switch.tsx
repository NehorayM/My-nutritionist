import { useId, type ReactNode } from 'react'
import { cn } from './cn'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Visible label; clicking it toggles the switch. */
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
  id?: string
}

/**
 * On/off setting that applies immediately (role="switch"). Space and Enter toggle it
 * (native button behavior). For choices submitted with a form, prefer a checkbox.
 */
export function Switch({ checked, onCheckedChange, label, description, disabled = false, className, id }: SwitchProps) {
  const generatedId = useId()
  const switchId = id ?? `switch-${generatedId}`
  const labelId = `${switchId}-label`
  const descriptionId = description ? `${switchId}-description` : undefined

  return (
    <div className={cn('flex min-h-11 items-center gap-4', disabled && 'opacity-60', className)}>
      <div className="min-w-0 flex-1">
        <label id={labelId} htmlFor={switchId} className="block text-[0.9375rem] font-semibold text-text">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="mt-0.5 text-sm text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'hit-area relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5',
          'transition-colors duration-200 ease-out-soft disabled:cursor-not-allowed motion-reduce:transition-none',
          checked ? 'bg-primary' : 'bg-text-muted/35',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'block size-6 rounded-full bg-surface shadow-thumb transition-transform duration-200 ease-out-soft',
            'motion-reduce:transition-none',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}
