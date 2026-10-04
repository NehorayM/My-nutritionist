import { toast } from 'sonner'

/**
 * App-wide notifications. Features call `notify.*` and never import sonner directly, so the
 * toast library, durations and the Undo pattern stay consistent.
 */
export interface NotifyOptions {
  description?: string
  /** Adds an "Undo" action; the toast then stays longer so it can be reached. */
  undo?: () => void
  undoLabel?: string
  /** Re-using an id replaces an existing toast instead of stacking a new one. */
  id?: string
  /** Milliseconds; defaults depend on the kind and on whether Undo is offered. */
  duration?: number
}

export type NotifyId = string | number

const DURATION_MS = { success: 4000, info: 5000, error: 7000, withUndo: 8000 } as const

type Kind = 'success' | 'info' | 'error'

function show(kind: Kind, message: string, options: NotifyOptions = {}): NotifyId {
  const { description, undo, undoLabel = 'Undo', id, duration } = options
  return toast[kind](message, {
    id,
    description,
    duration: duration ?? (undo ? DURATION_MS.withUndo : DURATION_MS[kind]),
    action: undo ? { label: undoLabel, onClick: () => undo() } : undefined,
  })
}

export const notify = {
  success: (message: string, options?: NotifyOptions): NotifyId => show('success', message, options),
  info: (message: string, options?: NotifyOptions): NotifyId => show('info', message, options),
  error: (message: string, options?: NotifyOptions): NotifyId => show('error', message, options),
  /** Removes one toast, or all when no id is given. */
  dismiss: (id?: NotifyId): void => {
    toast.dismiss(id)
  },
}
