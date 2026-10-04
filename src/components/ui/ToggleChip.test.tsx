import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Chip } from './Chip'
import { ToggleChip } from './ToggleChip'

function Harness() {
  const [pressed, setPressed] = useState(false)
  return (
    <ToggleChip pressed={pressed} onPressedChange={setPressed}>
      Vegetarian
    </ToggleChip>
  )
}

describe('ToggleChip', () => {
  it('toggles aria-pressed on click and keyboard', async () => {
    render(<Harness />)
    const chip = screen.getByRole('button', { name: 'Vegetarian' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await userEvent.keyboard(' ')
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('lets onClick cancel the toggle', async () => {
    const onPressedChange = vi.fn<(pressed: boolean) => void>()
    render(
      <ToggleChip pressed={false} onPressedChange={onPressedChange} onClick={(event) => event.preventDefault()}>
        Vegan
      </ToggleChip>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Vegan' }))
    expect(onPressedChange).not.toHaveBeenCalled()
  })
})

describe('Chip', () => {
  it('is a plain button action', async () => {
    const onClick = vi.fn<() => void>()
    render(<Chip onClick={onClick}>Copy yesterday</Chip>)
    const chip = screen.getByRole('button', { name: 'Copy yesterday' })
    expect(chip).not.toHaveAttribute('aria-pressed')
    await userEvent.click(chip)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
