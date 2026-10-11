import { CalendarClock, Pencil, Trash2 } from 'lucide-react'
import { Badge, IconButton } from '@/components/ui'
import { daysBetween } from '@/domain/dates'
import { USE_SOON_DAYS } from '@/domain/planner'
import type { PantryItem } from '@/types'
import { amountText, prepText } from '../model/labels'

interface PantryItemRowProps {
  item: PantryItem
  today: string
  onEdit: (item: PantryItem) => void
  onRemove: (item: PantryItem) => void
}

function expiryBadge(useBy: string | null, today: string) {
  if (useBy === null) return null
  const days = daysBetween(today, useBy)
  if (days < 0) return <Badge tone="danger" icon={<CalendarClock />}>Past use-by</Badge>
  if (days === 0) return <Badge tone="warning" icon={<CalendarClock />}>Use today</Badge>
  if (days <= USE_SOON_DAYS) return <Badge tone="warning" icon={<CalendarClock />}>Use in {days} {days === 1 ? 'day' : 'days'}</Badge>
  return <Badge tone="neutral" icon={<CalendarClock />}>Use by {useBy.slice(5).split('-').reverse().join('/')}</Badge>
}

/** One thing at home: name, amount, how it's eaten and its use-by date, with edit / remove. */
export function PantryItemRow({ item, today, onEdit, onRemove }: PantryItemRowProps) {
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-semibold leading-snug text-text">{item.food.name}</p>
        <p className="text-sm text-text-muted">
          {amountText(item)} · {prepText(item)}
        </p>
        {expiryBadge(item.useBy, today)}
      </div>
      <div className="-mr-2 flex shrink-0 items-center">
        <IconButton label={`Edit ${item.food.name}`} icon={<Pencil />} size="sm" onClick={() => onEdit(item)} />
        <IconButton label={`Remove ${item.food.name}`} icon={<Trash2 />} size="sm" onClick={() => onRemove(item)} />
      </div>
    </li>
  )
}
