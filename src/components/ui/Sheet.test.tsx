import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Sheet } from './Sheet'

function Harness({ description, onOpenChange }: { description?: string; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add food</Button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          onOpenChange?.(next)
        }}
        title="Add to lunch"
        description={description}
        footer={<Button onClick={() => setOpen(false)}>Save</Button>}
      >
        <label htmlFor="search">Search foods</label>
        <input id="search" />
      </Sheet>
    </>
  )
}

describe('Sheet', () => {
  it('opens as a modal dialog named by its title, with an optional description', async () => {
    render(<Harness description="Search or scan a barcode" />)
    await userEvent.click(screen.getByRole('button', { name: 'Add food' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add to lunch' })
    expect(dialog).toHaveAccessibleDescription('Search or scan a barcode')
    expect(screen.getByRole('heading', { name: 'Add to lunch' })).toBeInTheDocument()
    expect(dialog).toContainElement(screen.getByRole('button', { name: 'Save' }))
  })

  it('moves focus inside and closes on Escape, returning focus to the trigger', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>()
    render(<Harness onOpenChange={onOpenChange} />)
    const trigger = screen.getByRole('button', { name: 'Add food' })
    await userEvent.click(trigger)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    expect(dialog).not.toHaveAttribute('aria-describedby')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(trigger).toHaveFocus()
  })

  it('closes with the close button', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Add food' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps keyboard focus trapped inside', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Add food' }))
    const dialog = await screen.findByRole('dialog')
    for (let i = 0; i < 5; i += 1) {
      await userEvent.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })
})
