import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

function Harness({ onChange, disabled = false }: { onChange?: (value: boolean) => void; disabled?: boolean }) {
  const [checked, setChecked] = useState(false)
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      label="Morning weigh-in reminder"
      description="A gentle nudge on the Progress tab"
      onCheckedChange={(next) => {
        setChecked(next)
        onChange?.(next)
      }}
    />
  )
}

describe('Switch', () => {
  it('exposes switch semantics with its label and description', () => {
    render(<Harness />)
    const control = screen.getByRole('switch', { name: 'Morning weigh-in reminder' })
    expect(control).toHaveAttribute('aria-checked', 'false')
    expect(control).toHaveAccessibleDescription('A gentle nudge on the Progress tab')
  })

  it('toggles with Space and Enter from the keyboard', async () => {
    const onChange = vi.fn<(value: boolean) => void>()
    render(<Harness onChange={onChange} />)
    const control = screen.getByRole('switch')
    await userEvent.tab()
    expect(control).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(control).toHaveAttribute('aria-checked', 'true')
    await userEvent.keyboard('{Enter}')
    expect(control).toHaveAttribute('aria-checked', 'false')
    expect(onChange.mock.calls).toEqual([[true], [false]])
  })

  it('toggles when the visible label is clicked', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByText('Morning weigh-in reminder'))
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('does not toggle when disabled', async () => {
    const onChange = vi.fn<(value: boolean) => void>()
    render(<Harness onChange={onChange} disabled />)
    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('switch')).toBeDisabled()
  })
})
