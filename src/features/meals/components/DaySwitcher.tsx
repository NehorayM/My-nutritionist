import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, IconButton } from '@/components/ui'
import { addDays, compareDateKeys, type DateKey } from '@/domain/dates'
import { formatDateLabel } from '@/lib/format'
import { useMealsStore } from '@/stores/mealsStore'

interface DaySwitcherProps {
  date: DateKey
  today: DateKey
}

/** Previous / next day (never past today) with a "Today" shortcut; the day label is announced on change. */
export function DaySwitcher({ date, today }: DaySwitcherProps) {
  const selectDate = useMealsStore((s) => s.selectDate)
  const isToday = compareDateKeys(date, today) >= 0
  const label = formatDateLabel(date, today)

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center rounded-full bg-surface-2 p-1 ring-1 ring-border/60">
        <IconButton label="Previous day" icon={<ChevronLeft />} size="sm" onClick={() => selectDate(addDays(date, -1))} />
        <p aria-live="polite" className="min-w-0 flex-1 truncate text-center text-[0.9375rem] font-bold text-text">
          {label}
        </p>
        <IconButton
          label="Next day"
          icon={<ChevronRight />}
          size="sm"
          disabled={isToday}
          onClick={() => selectDate(addDays(date, 1))}
        />
      </div>
      {isToday ? null : (
        <Button variant="subtle" size="sm" onClick={() => selectDate(null)}>
          Today
        </Button>
      )}
    </div>
  )
}
