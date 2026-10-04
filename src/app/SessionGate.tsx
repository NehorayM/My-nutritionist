import { useEffect, type ReactNode } from 'react'
import { LoadingState } from '@/components/ui'
import { startSession } from '@/services/session/startSession'
import { useSessionStore } from '@/stores/sessionStore'

interface SessionGateProps {
  /** Rendered once the session is ready (repositories are set). */
  children: ReactNode
  /** Rendered when the user must choose between signing in and guest mode. */
  welcome: ReactNode
}

/** Decides guest vs account before any screen reads data. */
export function SessionGate({ children, welcome }: SessionGateProps) {
  const phase = useSessionStore((s) => s.phase)

  useEffect(() => {
    void startSession()
  }, [])

  if (phase === 'booting') {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <LoadingState label="Opening your day…" />
      </div>
    )
  }
  if (phase === 'welcome') return <>{welcome}</>
  return <>{children}</>
}
