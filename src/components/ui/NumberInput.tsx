import { useId, useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { Input } from './Input'
import { isPartialDecimal, numberToInputText, parseDecimalInput } from './numberParsing'

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode'>

export interface NumberInputProps extends NativeProps {
  /** Current numeric value; null = empty / not yet a number. */
  value: number | null
  /** Called with the parsed number (null while empty or incomplete). */
  onValueChange: (value: number | null) => void
  allowNegative?: boolean
  /** Unit shown inside the field ("g", "kg", "min"). */
  unit?: ReactNode
  leading?: ReactNode
  ref?: Ref<HTMLInputElement>
}

/**
 * Decimal entry that works with mobile keypads and comma locales: `inputMode="decimal"`,
 * accepts "72,5" and "72.5", and ignores characters that cannot form a number.
 * Range and required checks belong to the form's validation (show them through <Field error>).
 */
export function NumberInput({
  value,
  onValueChange,
  allowNegative = false,
  unit,
  leading,
  ref,
  'aria-describedby': describedBy,
  ...rest
}: NumberInputProps) {
  const unitId = useId()
  const [text, setText] = useState(() => numberToInputText(value))
  const [lastValue, setLastValue] = useState(value)

  // Adopt values set from outside (reset, prefill) without clobbering what the user is typing.
  if (!Object.is(value, lastValue)) {
    setLastValue(value)
    if (!Object.is(parseDecimalInput(text), value)) setText(numberToInputText(value))
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(/\s+/g, '')
    if (!isPartialDecimal(next, allowNegative)) return
    setText(next)
    const parsed = parseDecimalInput(next)
    setLastValue(parsed)
    if (!Object.is(parsed, value)) onValueChange(parsed)
  }

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      value={text}
      onChange={handleChange}
      leading={leading}
      trailing={unit == null ? undefined : <span id={unitId}>{unit}</span>}
      aria-describedby={[describedBy, unit == null ? undefined : unitId].filter(Boolean).join(' ') || undefined}
      {...rest}
    />
  )
}
