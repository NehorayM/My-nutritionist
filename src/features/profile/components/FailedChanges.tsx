import { useState } from 'react'
import { Button, ConfirmDialog } from '@/components/ui'
import { notify } from '@/lib/notify'
import { session } from '@/services/session'

/** Changes the server rejected: retry them, or discard them deliberately (never silently). */
export function FailedChanges({ failed, message }: { failed: number; message: string | null }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [busy, setBusy] = useState(false)
  const label = `${failed} change${failed === 1 ? '' : 's'}`

  async function retry(): Promise<void> {
    setBusy(true)
    const count = await session().retryFailedSync()
    setBusy(false)
    notify.info(count > 0 ? `Trying ${count} change${count === 1 ? '' : 's'} again` : 'Nothing to retry')
  }

  async function discard(): Promise<void> {
    const count = await session().discardFailedSync()
    notify.info(`${count} change${count === 1 ? '' : 's'} discarded`)
  }

  return (
    <div className="grid gap-2 rounded-field bg-warning/10 p-3">
      <p className="font-semibold">{label} couldn't sync</p>
      {message ? <p className="text-text-muted">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" loading={busy} onClick={() => void retry()}>
          Retry
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmDiscard(true)}>
          Discard
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={`Discard ${label}?`}
        description="They will be removed from the sync queue and won't reach your account."
        confirmLabel="Discard"
        tone="danger"
        onConfirm={discard}
      />
    </div>
  )
}
