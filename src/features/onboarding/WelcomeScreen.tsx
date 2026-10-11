import { HardDrive, Leaf } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppShell } from '@/app/AppShell'
import { hashFor, parseHash } from '@/app/routes'
import { Button, Card, CardContent } from '@/components/ui'
import { AuthForm } from '@/features/profile/components/AuthForm'
import { session } from '@/services/session'
import { useSyncStore } from '@/stores/syncStore'

/** First screen when cloud accounts are available and nobody is signed in. */
export function WelcomeScreen() {
  const notice = useSyncStore((s) => s.authNotice)
  const [starting, setStarting] = useState(false)

  // A new session starts on the home tab, not on the tab the previous session ended on.
  useEffect(() => {
    if (parseHash(window.location.hash).kind === 'route') {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hashFor('meals')}`)
    }
  }, [])

  return (
    <AppShell>
      <div className="mx-auto grid min-h-dvh max-w-5xl content-center gap-8 px-5 py-10 md:px-8 lg:grid-cols-2 lg:items-center lg:gap-16">
        <header className="grid justify-items-start gap-4">
          <span className="grid size-12 place-items-center rounded-card bg-primary text-primary-foreground shadow-card lg:size-14">
            <Leaf aria-hidden="true" className="size-6 lg:size-7" />
          </span>
          <h1 className="text-title font-extrabold text-text lg:text-display">My-nutritionist</h1>
          <p className="max-w-md text-text-muted lg:text-lg">
            Log what you actually eat, see where your day stands, and get practical ideas for the rest of it.
          </p>
          <ul className="hidden gap-2 text-sm text-text lg:grid" aria-label="What you can do">
            <li>• Search foods in English or Hebrew</li>
            <li>• Plan meals from what’s in your kitchen</li>
            <li>• Email reminders that fit your day</li>
          </ul>
        </header>
        <div className="grid gap-6">
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
      </div>
    </AppShell>
  )
}
