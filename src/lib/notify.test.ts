import { beforeEach, describe, expect, it, vi } from 'vitest'

interface ToastOptions {
  id?: string
  description?: string
  duration: number
  action?: { label: string; onClick: () => void }
}
type ToastFn = (message: string, options: ToastOptions) => string

const toast = vi.hoisted(() => ({
  success: vi.fn<ToastFn>(() => 'toast-1'),
  info: vi.fn<ToastFn>(() => 'toast-2'),
  error: vi.fn<ToastFn>(() => 'toast-3'),
  dismiss: vi.fn<(id?: string | number) => void>(),
}))

vi.mock('sonner', () => ({ toast }))

const { notify } = await import('./notify')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notify', () => {
  it('shows a success toast with the default duration and no action', () => {
    const id = notify.success('Meal logged')
    expect(id).toBe('toast-1')
    expect(toast.success).toHaveBeenCalledWith('Meal logged', {
      id: undefined,
      description: undefined,
      duration: 4000,
      action: undefined,
    })
  })

  it('offers Undo that calls back and keeps the toast longer', () => {
    const undo = vi.fn<() => void>()
    notify.info('Suggestion hidden', { undo, description: 'Oatmeal bowl' })
    const options = toast.info.mock.calls[0]?.[1]
    if (!options?.action) throw new Error('expected an Undo action')
    expect(options.duration).toBe(8000)
    expect(options.description).toBe('Oatmeal bowl')
    expect(options.action.label).toBe('Undo')
    options.action.onClick()
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('keeps errors visible longer, respects explicit ids and durations', () => {
    notify.error("Couldn't save", { id: 'save', duration: 10_000, undoLabel: 'Restore' })
    expect(toast.error).toHaveBeenCalledWith("Couldn't save", {
      id: 'save',
      description: undefined,
      duration: 10_000,
      action: undefined,
    })
    notify.error('Sync paused')
    expect(toast.error).toHaveBeenLastCalledWith('Sync paused', expect.objectContaining({ duration: 7000 }))
  })

  it('dismisses toasts', () => {
    notify.dismiss('save')
    notify.dismiss()
    expect(toast.dismiss.mock.calls).toEqual([['save'], [undefined]])
  })
})
