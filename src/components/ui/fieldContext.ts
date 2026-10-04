import { createContext, useContext } from 'react'

export interface FieldContextValue {
  id: string
  /** Space-separated ids of the hint and error, or undefined when neither is shown. */
  describedBy: string | undefined
  invalid: boolean
  required: boolean
  disabled: boolean
}

export const FieldContext = createContext<FieldContextValue | null>(null)

interface ControlProps {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling'
  required?: boolean
  disabled?: boolean
}

/**
 * Accessibility wiring for a form control placed inside <Field>: id (so the label points at it),
 * aria-describedby (hint + error), aria-invalid, required and disabled. Explicit props win.
 */
export function useFieldControlProps<P extends ControlProps>(props: P): P {
  const field = useContext(FieldContext)
  if (!field) return props
  const describedBy = [field.describedBy, props['aria-describedby']].filter(Boolean).join(' ') || undefined
  return {
    ...props,
    id: props.id ?? field.id,
    'aria-describedby': describedBy,
    'aria-invalid': props['aria-invalid'] ?? (field.invalid || undefined),
    required: props.required ?? (field.required || undefined),
    disabled: props.disabled ?? (field.disabled || undefined),
  }
}
