import { useEffect, useState } from 'react'
import { todayKey } from '@/domain/dates'

const MS_PER_MINUTE = 60_000

/** Local date key that updates itself after midnight (checked every minute and on tab focus). */
export function useToday(): string {
  const [today, setToday] = useState(() => todayKey())

  useEffect(() => {
    const refresh = () => setToday(todayKey())
    const timer = window.setInterval(refresh, MS_PER_MINUTE)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return today
}
