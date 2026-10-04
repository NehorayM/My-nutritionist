import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Plus } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { IconButton } from './IconButton'

describe('Button', () => {
  it('calls onClick and defaults to type="button" so it never submits forms by accident', async () => {
    const onClick = vi.fn<() => void>()
    const onSubmit = vi.fn<(event: SubmitEvent) => void>((event) => event.preventDefault())
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button onClick={onClick} leadingIcon={<Plus data-testid="icon" />}>
          Add food
        </Button>
      </form>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add food' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('is busy while loading: keeps its name and focus, ignores clicks and blocks submit', async () => {
    const onClick = vi.fn<() => void>()
    const onSubmit = vi.fn<() => void>()
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <Button type="submit" loading onClick={onClick}>
          Save
        </Button>
      </form>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()

    await userEvent.click(button)
    expect(button).toHaveFocus()
    expect(onClick).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not respond when disabled', async () => {
    const onClick = vi.fn<() => void>()
    render(
      <Button disabled onClick={onClick}>
        Log meal
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Log meal' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('IconButton', () => {
  it('uses the required label as its accessible name and tooltip', async () => {
    const onClick = vi.fn<() => void>()
    render(<IconButton label="Add to breakfast" icon={<Plus />} onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Add to breakfast' })
    expect(button).toHaveAttribute('title', 'Add to breakfast')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('ignores activation while loading', async () => {
    const onClick = vi.fn<() => void>()
    render(<IconButton label="Refresh" icon={<Plus />} loading onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Refresh' })
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })
})
