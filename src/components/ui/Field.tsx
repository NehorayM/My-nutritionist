import { CircleAlert } from 'lucide-react'
import { useId, useMemo, type ReactNode } from 'react'
import { cn } from './cn'
import { FieldContext, type FieldContextValue } from './fieldContext'

interface FieldProps {
  label: ReactNode
  /** Helper text under the control. */
  hint?: ReactNode
  /** Validation message; marks the control aria-invalid and links the message via aria-describedby. */
  error?: ReactNode
  required?: boolean
  disabled?: boolean
  /** Show "Optional" next to the label (prefer marking the few optional fields over many required ones). */
  optional?: boolean
  /** Visually hide the label (it stays the accessible name). */
  hideLabel?: boolean
  /** Use a specific id for the control (defaults to a generated one). */
  id?: string
  className?: string
  /** A single control from this kit (Input, NumberInput, Select, Textarea) — wired automatically. */
  children: ReactNode
}

export function Field({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  optional = false,
  hideLabel = false,
  id,
  className,
  children,
}: FieldProps) {
  const generatedId = useId()
  const controlId = id ?? `field-${generatedId}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const invalid = Boolean(error)

  const context = useMemo<FieldContextValue>(
    () => ({ id: controlId, describedBy, invalid, required, disabled }),
    [controlId, describedBy, invalid, required, disabled],
  )

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={controlId}
        className={cn(
          'flex items-baseline justify-between gap-2 text-sm font-semibold text-text',
          hideLabel && 'sr-only',
          disabled && 'opacity-60',
        )}
      >
        <span>{label}</span>
        {optional ? <span className="text-xs font-medium text-text-muted">Optional</span> : null}
      </label>
      <FieldContext value={context}>{children}</FieldContext>
      {hint ? (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-xs font-semibold text-danger">
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
