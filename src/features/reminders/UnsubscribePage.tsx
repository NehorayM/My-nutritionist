import { BellOff, Leaf } from 'lucide-react'
import { useState } from 'react'
import { hashFor } from '@/app/routes'
import { Button, Card, CardContent } from '@/components/ui'
import { unsubscribe } from '@/services/reminders'

type State = { kind: 'ask' } | { kind: 'working' } | { kind: 'done'; all: boolean } | { kind: 'error'; message: string }

/** Opened from an email's "Turn this reminder off" link; works without signing in (the link is signed). */
export function UnsubscribePage({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: 'ask' })

  async function run(scope: 'one' | 'all') {
    setState({ kind: 'working' })
    const result = await unsubscribe(token, scope)
    setState(result.ok ? { kind: 'done', all: scope === 'all' } : { kind: 'error', message: result.message })
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 py-8">
          <span className="grid size-12 place-items-center rounded-card bg-primary text-primary-foreground">
            {state.kind === 'done' ? <BellOff aria-hidden="true" className="size-6" /> : <Leaf aria-hidden="true" className="size-6" />}
          </span>
          {state.kind === 'done' ? (
            <>
              <h1 className="text-title font-extrabold text-text">{state.all ? 'All reminders are off' : 'Reminder turned off'}</h1>
              <p className="text-text-muted">You won’t get {state.all ? 'reminder emails' : 'this reminder'} anymore. You can turn reminders back on in the app under Profile.</p>
            </>
          ) : (
            <>
              <h1 className="text-title font-extrabold text-text">Turn off reminder emails?</h1>
              <p className="text-text-muted">Choose whether to stop just this reminder or every reminder email from My-nutritionist.</p>
              {state.kind === 'error' ? (
                <p role="alert" className="rounded-field bg-danger/10 px-3 py-2 text-sm text-text">
                  {state.message}
                </p>
              ) : null}
              <div className="grid gap-2">
                <Button loading={state.kind === 'working'} onClick={() => void run('one')}>
                  Turn off this reminder
                </Button>
                <Button variant="secondary" disabled={state.kind === 'working'} onClick={() => void run('all')}>
                  Turn off all reminders
                </Button>
              </div>
            </>
          )}
          <a className="inline-block text-sm font-semibold text-primary" href={hashFor('profile')} onClick={() => window.location.replace(`${window.location.pathname}${hashFor('profile')}`)}>
            Open My-nutritionist
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
