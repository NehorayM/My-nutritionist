import { PasswordRecoveryDialog } from '@/app/PasswordRecoveryDialog'
import { RoutedApp } from '@/app/RoutedApp'
import { useUnsubscribeToken } from '@/app/useUnsubscribeToken'
import { SessionGate } from '@/app/SessionGate'
import { Toaster } from '@/components/ui/Toaster'
import { WelcomeScreen } from '@/features/onboarding/WelcomeScreen'
import { UnsubscribePage } from '@/features/reminders/UnsubscribePage'
import { useApplyTheme } from '@/hooks/useApplyTheme'

export default function App() {
  useApplyTheme()
  // Email unsubscribe links work without a session (the token is signed by the server).
  const unsubscribeToken = useUnsubscribeToken()
  if (unsubscribeToken) return <UnsubscribePage token={unsubscribeToken} />
  return (
    <>
      <SessionGate welcome={<WelcomeScreen />}>
        <RoutedApp />
      </SessionGate>
      <PasswordRecoveryDialog />
      <Toaster />
    </>
  )
}
