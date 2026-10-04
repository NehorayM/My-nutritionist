import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { notify } from '@/lib/notify'
import { Toaster } from './Toaster'

// jsdom lacks pointer capture, which sonner uses for swipe-to-dismiss.
const POINTER_CAPTURE = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const
const missing = POINTER_CAPTURE.filter((name) => !(name in Element.prototype))

beforeAll(() => {
  for (const name of missing) {
    Object.defineProperty(Element.prototype, name, { value: () => false, configurable: true, writable: true })
  }
})

afterAll(() => {
  for (const name of missing) Reflect.deleteProperty(Element.prototype, name)
})

afterEach(() => {
  act(() => notify.dismiss())
})

describe('Toaster + notify', () => {
  it('announces notifications in a labelled region and runs Undo', async () => {
    const undo = vi.fn<() => void>()
    render(<Toaster />)
    act(() => {
      notify.success('Oatmeal removed from breakfast', { undo })
    })
    expect(await screen.findByText('Oatmeal removed from breakfast')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Notifications/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undo).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByText('Oatmeal removed from breakfast')).not.toBeInTheDocument())
  })
})
