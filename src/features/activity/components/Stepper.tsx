import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import { IconButton } from '@/components/ui'

interface StepperProps {
  label: string
  /** Lowercase plural noun used in the button names ("strength sessions"). */
  noun: string
  /** Singular form for a value of 1 ("strength session"). */
  nounOne: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

/**
 * Small whole-number control with −/+ buttons; the value is announced when it changes. Limits use
 * aria-disabled (not disabled) so focus stays on the button when a limit is reached.
 */
export function Stepper({ label, noun, nounOne, hint, value, min, max, onChange }: StepperProps) {
  const hintId = useId()
  return (
    <fieldset aria-describedby={hint ? hintId : undefined} className="flex items-center justify-between gap-4">
      <legend className="sr-only">{label}</legend>
      <div className="min-w-0">
        <p aria-hidden="true" className="text-sm font-semibold text-text">
          {label}
        </p>
        {hint ? (
          <p id={hintId} className="text-xs text-text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-border/60">
        <IconButton
          label={`Fewer ${noun}`}
          icon={<Minus />}
          variant="ghost"
          aria-disabled={value <= min || undefined}
          onClick={() => {
            if (value > min) onChange(value - 1)
          }}
        />
        <output aria-live="polite" className="w-8 text-center text-lg font-bold tabular-nums text-text">
          {value}
          <span className="sr-only"> {value === 1 ? nounOne : noun} per week</span>
        </output>
        <IconButton
          label={`More ${noun}`}
          icon={<Plus />}
          variant="ghost"
          aria-disabled={value >= max || undefined}
          onClick={() => {
            if (value < max) onChange(value + 1)
          }}
        />
      </div>
    </fieldset>
  )
}
