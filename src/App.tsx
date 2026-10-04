import { RoutedApp } from '@/app/RoutedApp'
import { Toaster } from '@/components/ui/Toaster'
import { useApplyTheme } from '@/hooks/useApplyTheme'

export default function App() {
  useApplyTheme()
  return (
    <>
      <RoutedApp />
      <Toaster />
    </>
  )
}
