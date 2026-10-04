import { RoutedApp } from '@/app/RoutedApp'
import { SessionGate } from '@/app/SessionGate'
import { Toaster } from '@/components/ui/Toaster'
import { useApplyTheme } from '@/hooks/useApplyTheme'

export default function App() {
  useApplyTheme()
  return (
    <>
      <SessionGate welcome={null}>
        <RoutedApp />
      </SessionGate>
      <Toaster />
    </>
  )
}
