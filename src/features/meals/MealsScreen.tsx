import { ScreenHeader } from '@/app/ScreenHeader'
import { todayKey } from '@/domain/dates'
import { formatLongDate } from '@/lib/format'

export function MealsScreen() {
  return <ScreenHeader eyebrow={formatLongDate(todayKey())} title="Meals" subtitle="What you've eaten today" />
}
