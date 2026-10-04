import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Field } from './Field'
import { Input } from './Input'
import { NumberInput } from './NumberInput'
import { parseDecimalInput } from './numberParsing'
import { Select } from './Select'
import { Textarea } from './Textarea'

describe('Field', () => {
  it('labels its control and links the hint', () => {
    render(
      <Field label="Display name" hint="Shown only to you">
        <Input />
      </Field>,
    )
    const input = screen.getByLabelText('Display name')
    expect(input).toHaveAccessibleDescription('Shown only to you')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('marks the control invalid and describes it with hint and error', () => {
    render(
      <Field label="Target weight" hint="In kilograms" error="Enter a weight between 30 and 300 kg" required>
        <Input />
      </Field>,
    )
    const input = screen.getByRole('textbox', { name: 'Target weight' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toBeRequired()
    expect(input).toHaveAccessibleDescription('In kilograms Enter a weight between 30 and 300 kg')
  })

  it('wires Select and Textarea the same way and lets explicit props win', () => {
    render(
      <>
        <Field label="Diet" error="Pick a diet">
          <Select value="balanced" onValueChange={() => undefined} options={[{ value: 'balanced', label: 'Balanced' }]} />
        </Field>
        <Field label="Notes" disabled>
          <Textarea disabled={false} />
        </Field>
      </>,
    )
    expect(screen.getByRole('combobox', { name: 'Diet' })).toHaveAccessibleDescription('Pick a diet')
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeEnabled()
  })

  it('shows an Optional marker without changing the accessible name', () => {
    render(
      <Field label="Brand" optional>
        <Input />
      </Field>,
    )
    expect(screen.getByText('Optional')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Brand/ })).toBeInTheDocument()
  })
})

describe('Select', () => {
  it('reports the typed option value', async () => {
    const onValueChange = vi.fn<(value: string) => void>()
    render(
      <Field label="Units">
        <Select
          value="metric"
          onValueChange={onValueChange}
          options={[
            { value: 'metric', label: 'Metric (kg, cm)' },
            { value: 'imperial', label: 'Imperial (lb, ft)' },
          ]}
        />
      </Field>,
    )
    await userEvent.selectOptions(screen.getByLabelText('Units'), 'imperial')
    expect(onValueChange).toHaveBeenCalledWith('imperial')
  })
})

function ControlledNumber({ initial = null, onValue }: { initial?: number | null; onValue: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(initial)
  return (
    <>
      <Field label="Weight">
        <NumberInput
          value={value}
          unit="kg"
          onValueChange={(next) => {
            setValue(next)
            onValue(next)
          }}
        />
      </Field>
      <button type="button" onClick={() => setValue(80)}>
        Prefill
      </button>
    </>
  )
}

describe('NumberInput', () => {
  it('uses a decimal keypad and accepts comma decimals', async () => {
    const onValue = vi.fn<(value: number | null) => void>()
    render(<ControlledNumber onValue={onValue} />)
    const input = screen.getByRole('textbox', { name: 'Weight' })
    expect(input).toHaveAttribute('inputmode', 'decimal')
    await userEvent.type(input, '72,5')
    expect(input).toHaveValue('72,5')
    expect(onValue).toHaveBeenLastCalledWith(72.5)
    expect(input).toHaveAccessibleDescription('kg')
  })

  it('ignores characters that cannot form a number and negative signs by default', async () => {
    const onValue = vi.fn<(value: number | null) => void>()
    render(<ControlledNumber onValue={onValue} />)
    const input = screen.getByRole('textbox', { name: 'Weight' })
    await userEvent.type(input, '-6a8.2.5')
    expect(input).toHaveValue('68.25')
    expect(onValue).toHaveBeenLastCalledWith(68.25)
  })

  it('reports null while empty and adopts values set from outside', async () => {
    const onValue = vi.fn<(value: number | null) => void>()
    render(<ControlledNumber initial={70} onValue={onValue} />)
    const input = screen.getByRole('textbox', { name: 'Weight' })
    expect(input).toHaveValue('70')
    await userEvent.clear(input)
    expect(onValue).toHaveBeenLastCalledWith(null)
    await userEvent.click(screen.getByRole('button', { name: 'Prefill' }))
    expect(input).toHaveValue('80')
  })
})

describe('parseDecimalInput', () => {
  it('parses dot and comma decimals and rejects incomplete input', () => {
    expect(parseDecimalInput('72.5')).toBe(72.5)
    expect(parseDecimalInput(' 72,5 ')).toBe(72.5)
    expect(parseDecimalInput('.5')).toBe(0.5)
    expect(parseDecimalInput('7.')).toBe(7)
    expect(parseDecimalInput('-3')).toBe(-3)
    expect(parseDecimalInput('')).toBeNull()
    expect(parseDecimalInput('-')).toBeNull()
    expect(parseDecimalInput('.')).toBeNull()
    expect(parseDecimalInput('1e3')).toBeNull()
    expect(parseDecimalInput('1,2,3')).toBeNull()
  })
})
