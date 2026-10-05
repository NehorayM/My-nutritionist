import { PasswordRecoveryDialog } from '@/app/PasswordRecoveryDialog'
import { RoutedApp } from '@/app/RoutedApp'
import { SessionGate } from '@/app/SessionGate'
import { Toaster } from '@/components/ui/Toaster'
import { WelcomeScreen } from '@/features/onboarding/WelcomeScreen'
import { useApplyTheme } from '@/hooks/useApplyTheme'

export default function App() {
  useApplyTheme()
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
