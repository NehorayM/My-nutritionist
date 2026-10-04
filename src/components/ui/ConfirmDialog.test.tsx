import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function Harness({ onConfirm, onCancel }: { onConfirm: () => void | Promise<void>; onCancel?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <p>{open ? 'open' : 'closed'}</p>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this entry?"
        description="Oatmeal will be removed from breakfast."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </>
  )
}

describe('ConfirmDialog', () => {
  it('is an alert dialog that starts focus on Cancel', async () => {
    render(<Harness onConfirm={() => undefined} />)
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this entry?' })
    expect(dialog).toHaveAccessibleDescription('Oatmeal will be removed from breakfast.')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('confirms once and closes', async () => {
    const onConfirm = vi.fn<() => void>()
    const onCancel = vi.fn<() => void>()
    render(<Harness onConfirm={onConfirm} onCancel={onCancel} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.getByText('closed')).toBeInTheDocument())
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel for Cancel and for Escape', async () => {
    const onConfirm = vi.fn<() => void>()
    const onCancel = vi.fn<() => void>()
    const { unmount } = render(<Harness onConfirm={onConfirm} onCancel={onCancel} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.getByText('closed')).toBeInTheDocument())
    unmount()

    render(<Harness onConfirm={onConfirm} onCancel={onCancel} />)
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByText('closed')).toBeInTheDocument())
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('shows progress for async confirmation and stays open if it fails', async () => {
    let reject: (error: Error) => void = () => undefined
    const onConfirm = vi.fn<() => Promise<void>>(
      () =>
        new Promise<void>((_, rejectPromise) => {
          reject = rejectPromise
        }),
    )
    render(<Harness onConfirm={onConfirm} />)
    const confirm = await screen.findByRole('button', { name: 'Delete' })
    await userEvent.click(confirm)
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)

    reject(new Error('offline'))
    await waitFor(() => expect(confirm).not.toHaveAttribute('aria-busy'))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('open')).toBeInTheDocument()
  })
})
