import { HardDrive, Leaf } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '@/app/AppShell'
import { Button, Card, CardContent } from '@/components/ui'
import { AuthForm } from '@/features/profile/components/AuthForm'
import { session } from '@/services/session'
import { useSyncStore } from '@/stores/syncStore'

/** First screen when cloud accounts are available and nobody is signed in. */
export function WelcomeScreen() {
  const notice = useSyncStore((s) => s.authNotice)
  const [starting, setStarting] = useState(false)

  return (
    <AppShell>
      <div className="grid gap-6 px-5 pt-10 pb-8">
        <header className="grid justify-items-start gap-3">
          <span className="grid size-12 place-items-center rounded-card bg-primary text-primary-foreground">
            <Leaf aria-hidden="true" className="size-6" />
          </span>
          <h1 className="text-title font-bold text-text">My-nutritionist</h1>
          <p className="text-text-muted">
            Log what you actually eat, see where your day stands, and get practical ideas for the rest of it.
          </p>
        </header>
        {notice ? (
          <output className="flex items-start justify-between gap-3 rounded-card bg-warning/10 p-4 text-sm">
            <span>{notice}</span>
            <button type="button" className="font-semibold text-primary" onClick={() => session().dismissAuthNotice()}>
              Dismiss
            </button>
          </output>
        ) : null}
        <Card>
          <CardContent className="pt-5">
            <AuthForm />
          </CardContent>
        </Card>
        <div className="grid gap-2 text-center">
          <Button
            variant="secondary"
            size="lg"
            loading={starting}
            leadingIcon={<HardDrive aria-hidden="true" className="size-4" />}
            onClick={() => {
              setStarting(true)
              void session().continueAsGuest()
            }}
          >
            Continue as guest
          </Button>
          <p className="text-xs text-text-muted">
            No account needed. Everything stays on this device; you can sign in later and import it.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
