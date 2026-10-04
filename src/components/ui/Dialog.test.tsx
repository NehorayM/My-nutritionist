import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'
import { Dialog } from './Dialog'

function Harness({ dismissOnOutsideClick, hideClose }: { dismissOnOutsideClick?: boolean; hideClose?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>How targets are calculated</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="How targets are calculated"
        description="Estimates for general wellness, not medical advice."
        dismissOnOutsideClick={dismissOnOutsideClick}
        hideClose={hideClose}
        footer={<Button onClick={() => setOpen(false)}>Got it</Button>}
      >
        <p>Energy uses the Mifflin-St Jeor equation.</p>
      </Dialog>
    </>
  )
}

/** Radix sets `pointer-events: none` on the page behind a modal; a real press there still reaches the document. */
const outside = userEvent.setup({ pointerEventsCheck: 0 })

async function openDialog(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole('button', { name: 'How targets are calculated' }))
  return screen.findByRole('dialog', { name: 'How targets are calculated' })
}

describe('Dialog', () => {
  it('is a named, described modal with body and footer, closed by the close button', async () => {
    render(<Harness />)
    const dialog = await openDialog()
    expect(dialog).toHaveAccessibleDescription('Estimates for general wellness, not medical advice.')
    expect(dialog).toHaveTextContent('Energy uses the Mifflin-St Jeor equation.')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'How targets are calculated' })).toHaveFocus()
  })

  it('closes on an outside press by default', async () => {
    render(<Harness />)
    await openDialog()
    await outside.click(document.body)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('can require an explicit choice: no outside dismissal, no corner close', async () => {
    render(<Harness dismissOnOutsideClick={false} hideClose />)
    await openDialog()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    await outside.click(document.body)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
