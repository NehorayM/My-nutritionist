import { useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** `danger` for destructive actions (delete, reset). */
  tone?: 'primary' | 'danger'
  /** May be async: the confirm button shows a spinner and the dialog closes when it resolves. */
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}

/**
 * Asks before an irreversible action. Focus starts on Cancel so Enter never confirms by accident.
 * If `onConfirm` throws/rejects, the dialog stays open (the caller reports the error).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  async function handleConfirm() {
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // The caller surfaces the error; keep the dialog open so the user can retry or cancel.
    } finally {
      setBusy(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (busy) return
    if (!next) onCancel?.()
    onOpenChange(next)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      role="alertdialog"
      title={title}
      description={description}
      hideClose
      dismissOnOutsideClick={false}
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        cancelRef.current?.focus()
      }}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" disabled={busy} onClick={() => handleOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={() => void handleConfirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
