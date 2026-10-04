import { Pencil, Trash2 } from 'lucide-react'
import { Badge, IconButton } from '@/components/ui'
import { formatDateLabel, formatTime, formatWeight } from '@/lib/format'
import type { UnitSystem, WeightEntry } from '@/types'
import type { HistoryDay } from '../lib/history'

interface HistoryDayGroupProps {
  day: HistoryDay
  today: string
  unitSystem: UnitSystem
  onEdit: (entry: WeightEntry) => void
  onDelete: (entry: WeightEntry) => void
}

/** One date with its weigh-ins (newest first); with several, the one the chart uses is marked. */
export function HistoryDayGroup({ day, today, unitSystem, onEdit, onDelete }: HistoryDayGroupProps) {
  const dateLabel = formatDateLabel(day.date, today)
  const several = day.items.length > 1
  const headingId = `history-${day.date}`
  return (
    <li aria-labelledby={headingId}>
      <h3 id={headingId} className="px-1 pb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
        {dateLabel}
      </h3>
      <ul className="divide-y divide-border/70 overflow-hidden rounded-card bg-surface ring-1 ring-border/70">
        {day.items.map(({ entry, usedInChart }) => {
          const time = formatTime(entry.measuredAt)
          const name = `${dateLabel} ${time}`
          return (
            <li key={entry.id} className="flex items-center gap-3 py-2 pl-4 pr-2">
              <div className="min-w-0 flex-1 py-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-base font-bold tabular-nums text-text">{formatWeight(entry.weightKg, unitSystem)}</span>
                  <span className="text-sm text-text-muted">{time}</span>
                  {several && usedInChart ? <Badge tone="primary">Used in chart</Badge> : null}
                </div>
                {entry.note ? <p className="mt-0.5 line-clamp-2 break-words text-sm text-text-muted">{entry.note}</p> : null}
              </div>
              <IconButton label={`Edit weigh-in, ${name}`} icon={<Pencil />} size="md" onClick={() => onEdit(entry)} />
              <IconButton label={`Delete weigh-in, ${name}`} icon={<Trash2 />} size="md" onClick={() => onDelete(entry)} />
            </li>
          )
        })}
      </ul>
    </li>
  )
}
