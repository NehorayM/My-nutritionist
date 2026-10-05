import { useState } from 'react'
import { Button, Field, Input, Sheet } from '@/components/ui'
import { notify } from '@/lib/notify'
import { session } from '@/services/session'
import { useSessionStore } from '@/stores/sessionStore'

const MIN_PASSWORD = 8

/** Shown after a password-reset link was opened: asks for the new password. */
export function PasswordRecoveryDialog() {
  const open = useSessionStore((s) => s.passwordRecovery)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(): Promise<void> {
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`)
      return
    }
    setBusy(true)
    const result = await session().updatePassword(password)
    setBusy(false)
    if (result.ok) {
      setPassword('')
      notify.success('Your password was updated')
    } else setError(result.message)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) useSessionStore.setState({ passwordRecovery: false })
      }}
      title="Choose a new password"
      description="You opened a password reset link. Set a new password for your account."
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Field label="New password" error={error} hint={`At least ${MIN_PASSWORD} characters.`}>
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" loading={busy} fullWidth>
          Save new password
        </Button>
      </form>
    </Sheet>
  )
}
