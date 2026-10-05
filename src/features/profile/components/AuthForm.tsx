import { useState } from 'react'
import { Button, Field, Input, SegmentedControl } from '@/components/ui'
import { session } from '@/services/session'

export type AuthMode = 'signin' | 'signup' | 'reset'

const MIN_PASSWORD = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface AuthFormProps {
  initialMode?: AuthMode
  /** Called after a successful sign-in / sign-up that created a session. */
  onSignedIn?: () => void
}

/** Sign in, create an account, or request a password reset — Supabase Auth only, no custom password handling. */
export function AuthForm({ initialMode = 'signin', onSignedIn }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(next: AuthMode): void {
    setMode(next)
    setErrors({})
    setFailure(null)
    setNotice(null)
  }

  function validate(): boolean {
    const found = {
      email: EMAIL_PATTERN.test(email.trim()) ? undefined : 'Enter a valid email address.',
      password:
        mode === 'reset' || password.length >= (mode === 'signup' ? MIN_PASSWORD : 1)
          ? undefined
          : mode === 'signup'
            ? `Use at least ${MIN_PASSWORD} characters.`
            : 'Enter your password.',
    }
    setErrors(found)
    return !found.email && !found.password
  }

  async function submit(): Promise<void> {
    if (!validate()) return
    setBusy(true)
    setFailure(null)
    setNotice(null)
    const address = email.trim()
    try {
      if (mode === 'signin') {
        const result = await session().signIn(address, password)
        if (result.ok) onSignedIn?.()
        else setFailure(result.message)
      } else if (mode === 'signup') {
        const result = await session().signUp(address, password)
        if (!result.ok) setFailure(result.error.message)
        else if (result.needsConfirmation) setNotice('Check your inbox to confirm your email, then sign in here.')
        else onSignedIn?.()
      } else {
        const result = await session().requestPasswordReset(address)
        if (result.ok) setNotice('If an account exists for that email, a reset link is on its way. Open it on this device.')
        else setFailure(result.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const submitLabel = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      {mode !== 'reset' ? (
        <SegmentedControl<AuthMode>
          label="Account action"
          fullWidth
          value={mode}
          onValueChange={switchMode}
          options={[
            { value: 'signin', label: 'Sign in' },
            { value: 'signup', label: 'Create account' },
          ]}
        />
      ) : null}
      <Field label="Email" error={errors.email}>
        <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {mode !== 'reset' ? (
        <Field label="Password" error={errors.password} hint={mode === 'signup' ? `At least ${MIN_PASSWORD} characters.` : undefined}>
          <Input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      ) : null}
      {failure ? <p role="alert" className="text-sm font-semibold text-danger">{failure}</p> : null}
      {notice ? <output className="block rounded-field bg-primary/8 p-3 text-sm text-text">{notice}</output> : null}
      <Button type="submit" loading={busy} fullWidth size="lg">
        {submitLabel}
      </Button>
      <Button type="button" variant="ghost" onClick={() => switchMode(mode === 'reset' ? 'signin' : 'reset')}>
        {mode === 'reset' ? 'Back to sign in' : 'Forgot your password?'}
      </Button>
    </form>
  )
}
