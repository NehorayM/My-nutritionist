import { Cloud, CloudOff, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, Sheet } from '@/components/ui'
import { formatTime } from '@/lib/format'
import { notify } from '@/lib/notify'
import { isSupabaseConfigured } from '@/lib/supabase'
import { session } from '@/services/session'
import { useSessionStore } from '@/stores/sessionStore'
import { useSyncStore } from '@/stores/syncStore'
import { connectionSummary, pendingText } from '../lib/connectionSummary'
import { AuthForm } from './AuthForm'
import { FailedChanges } from './FailedChanges'

/** Authentication + connection status ("Connected to Supabase" / "Running in Offline/Local Mode"). */
export function AccountCard() {
  const mode = useSessionStore((s) => s.mode)
  const email = useSessionStore((s) => s.email)
  const connection = useSyncStore((s) => s.connection)
  const sync = useSyncStore((s) => s.sync)
  const [authOpen, setAuthOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [checking, setChecking] = useState(false)
  const authAvailable = isSupabaseConfigured()
  const summary = connectionSummary({ mode, connection, sync, authAvailable })
  const pending = pendingText(sync)
  const unsynced = (sync?.pending ?? 0) + (sync?.failed ?? 0)

  async function checkConnection(): Promise<void> {
    setChecking(true)
    const state = await session().verifyConnection()
    setChecking(false)
    if (state === 'connected') notify.success('Connected to Supabase')
    else notify.info("Supabase isn't reachable right now — your changes stay on this device.")
  }

  async function signOut(): Promise<void> {
    const result = await session().signOut()
    if (!result.ok) notify.error(result.message)
  }

  return (
    <Card as="section" aria-labelledby="account-title">
      <CardHeader action={<Badge tone={summary.tone}>{mode === 'cloud' ? 'Account' : 'Guest'}</Badge>}>
        <CardTitle as="h2" id="account-title">
          {mode === 'cloud' && connection === 'connected' ? (
            <Cloud aria-hidden="true" className="mr-2 inline size-5 text-primary" />
          ) : (
            <CloudOff aria-hidden="true" className="mr-2 inline size-5 text-text-muted" />
          )}
          {summary.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <output className="block text-text-muted">{summary.description}</output>
        {mode === 'cloud' && email ? <p className="truncate">Signed in as <span className="font-semibold">{email}</span></p> : null}
        {pending ? <p className="font-semibold tabular-nums">{pending}</p> : null}
        {mode === 'cloud' && sync?.lastSyncedAt ? <p className="text-text-muted">Last synced at {formatTime(sync.lastSyncedAt)}</p> : null}
        {mode === 'cloud' && sync && sync.failed > 0 ? <FailedChanges failed={sync.failed} message={sync.lastError} /> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          {mode === 'cloud' ? (
            <>
              <Button variant="secondary" leadingIcon={<RefreshCw aria-hidden="true" className="size-4" />} loading={checking} onClick={() => void checkConnection()}>
                Check connection
              </Button>
              <Button variant="ghost" leadingIcon={<LogOut aria-hidden="true" className="size-4" />} onClick={() => setConfirmSignOut(true)}>
                Sign out
              </Button>
            </>
          ) : authAvailable ? (
            <Button leadingIcon={<LogIn aria-hidden="true" className="size-4" />} onClick={() => setAuthOpen(true)}>
              Sign in or create account
            </Button>
          ) : null}
        </div>
      </CardContent>
      <Sheet open={authOpen} onOpenChange={setAuthOpen} title="Your account" description="Back up your data and use it on any device.">
        <AuthForm onSignedIn={() => setAuthOpen(false)} />
      </Sheet>
      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out on this device?"
        description={
          unsynced > 0
            ? `${unsynced} change${unsynced === 1 ? " hasn't" : "s haven't"} synced yet. They stay on this device and sync after you sign in again.`
            : 'Your data stays safe in your account. Data cached on this device is removed.'
        }
        confirmLabel="Sign out"
        onConfirm={signOut}
      />
    </Card>
  )
}
